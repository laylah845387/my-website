import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { adjustPoints, markOfferwallMeTransaction } from "@/lib/user-data";

function md5(value: string): string {
  return crypto.createHash("md5").update(value).digest("hex");
}

async function readParams(request: NextRequest): Promise<URLSearchParams> {
  const params = new URLSearchParams(request.nextUrl.searchParams);
  if (request.method !== "POST") return params;

  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const form = await request.formData();
      form.forEach((value, key) => {
        if (typeof value === "string") params.set(key, value);
      });
    } else if (contentType.includes("application/json")) {
      const json = await request.json();
      Object.entries(json ?? {}).forEach(([key, value]) => params.set(key, String(value)));
    }
  } catch {
    // Keep query parameters if the body is empty or malformed.
  }

  return params;
}

export async function POST(request: NextRequest) {
  const params = await readParams(request);

  const secret = process.env.OFFERWALL_ME_SECRET_KEY;
  const userId = params.get("subId");
  const transactionId = params.get("transId");
  const rewardRaw = params.get("reward");
  const status = params.get("status") || "1";
  const signature = params.get("signature");

  if (!secret) return new NextResponse("ERROR: Postback not configured", { status: 200 });
  if (!userId || !transactionId || !rewardRaw || !signature) {
    return new NextResponse("ERROR: Missing parameters", { status: 200 });
  }
  if (md5(`${userId}${transactionId}${rewardRaw}${secret}`) !== signature) {
    return new NextResponse("ERROR: Signature doesn't match", { status: 200 });
  }

  const reward = Number.parseFloat(rewardRaw);
  if (!Number.isFinite(reward) || reward < 0) {
    return new NextResponse("ERROR: Invalid reward", { status: 200 });
  }

  const points = Math.round(reward);
  const previous = await markOfferwallMeTransaction(transactionId, {
    userId,
    points,
    status,
    offerId: null,
  });

  if (previous) {
    if (status === "2" && previous.credited) {
      await adjustPoints(previous.userId, -previous.points);
      await markOfferwallMeTransaction(transactionId, { ...previous, status, credited: false });
    } else if (status === "1" && !previous.credited) {
      await adjustPoints(userId, points);
      await markOfferwallMeTransaction(transactionId, {
        userId,
        points,
        status,
        offerId: null,
        credited: true,
      });
    }
    return new NextResponse("ok", { status: 200 });
  }

  if (status === "1") {
    await adjustPoints(userId, points);
    await markOfferwallMeTransaction(transactionId, {
      userId,
      points,
      status,
      offerId: null,
      credited: true,
    });
  }

  return new NextResponse("ok", { status: 200 });
}

export async function GET(request: NextRequest) {
  return POST(request);
}