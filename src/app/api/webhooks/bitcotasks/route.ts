import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getRedis } from "@/lib/redis";
import { adjustPoints } from "@/lib/user-data";

/**
 * BitcoTasks S2S Postback receiver.
 *
 * BitcoTasks calls this endpoint automatically whenever one of your
 * users completes a real task, to tell you to credit their points.
 * This is the ONLY trustworthy place real points get credited — never
 * the browser, since a user's own browser can't be trusted to honestly
 * report "I finished the task."
 *
 * Docs: https://bitcotasks.com/documentations#ow_postback
 *
 * Required env var: BITCOTASKS_SECRET_KEY (from My Apps → Edit)
 */

function md5(input: string): string {
  return crypto.createHash("md5").update(input).digest("hex");
}

async function readParams(request: NextRequest): Promise<URLSearchParams> {
  const params = new URLSearchParams(request.nextUrl.searchParams);

  if (request.method === "POST") {
    try {
      const contentType = request.headers.get("content-type") || "";

      if (
        contentType.includes("multipart/form-data") ||
        contentType.includes("application/x-www-form-urlencoded")
      ) {
        // request.formData() handles both multipart and urlencoded bodies.
        const formData = await request.formData();
        formData.forEach((value, key) => {
          if (typeof value === "string") {
            params.set(key, value);
          }
        });
      } else if (contentType.includes("application/json")) {
        const json = await request.json();
        Object.entries(json ?? {}).forEach(([key, value]) => params.set(key, String(value)));
      }
    } catch {
      // Ignore — fall back to whatever was in the query string.
    }
  }

  return params;
}

async function handlePostback(request: NextRequest): Promise<NextResponse> {
  const params = await readParams(request);

  const secret = process.env.BITCOTASKS_SECRET_KEY;
  if (!secret) {
    // Misconfigured on our end — tell BitcoTasks to retry later rather
    // than silently dropping the credit.
    return new NextResponse("ERROR: Postback not configured", { status: 200 });
  }

  const subId = params.get("subId");
  const transId = params.get("transId");
  const reward = params.get("reward");
  const status = params.get("status");
  const signature = params.get("signature");

  if (!subId || !transId || !reward || !signature) {
    return new NextResponse("ERROR: Missing parameters", { status: 200 });
  }

  const expectedSignature = md5(`${subId}${transId}${reward}${secret}`);
  if (expectedSignature !== signature) {
    return new NextResponse("ERROR: Signature doesn't match", { status: 200 });
  }

  const redis = getRedis();

  // Duplicate protection: BitcoTasks may resend the same postback (e.g.
  // if our response was slow). Each transId should only ever be credited
  // once, no matter how many times it arrives.
  const isNew = await redis.sadd("bitcotasks:processed-transactions", transId);
  if (isNew === 0) {
    return new NextResponse("ok", { status: 200 });
  }

  const rewardAmount = Math.round(parseFloat(reward)) || 0;
  const isChargeback = status === "2";

  await adjustPoints(subId, isChargeback ? -rewardAmount : rewardAmount);

  // Must be exactly "ok" (lowercase, nothing else) or BitcoTasks marks
  // this postback as failed and resends it later.
  return new NextResponse("ok", { status: 200 });
}

export async function GET(request: NextRequest) {
  return handlePostback(request);
}

export async function POST(request: NextRequest) {
  return handlePostback(request);
}
