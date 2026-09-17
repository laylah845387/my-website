import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { adjustPoints, markAoycoTransaction } from "@/lib/user-data";

function md5(value: string): string {
  return crypto.createHash("md5").update(value).digest("hex");
}

async function handlePostback(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const secret = process.env.AOYCO_SECRET_KEY;
  const userId = params.get("subId");
  const transactionId = params.get("transId");
  const rewardRaw = params.get("reward");
  const signature = params.get("signature");
  const status = params.get("status") || "1";

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
  const previous = await markAoycoTransaction(transactionId, {
    userId,
    points,
    status,
    offerId: null,
  });

  if (previous) {
    if (status === "2" && previous.credited) {
      await adjustPoints(previous.userId, -previous.points);
      await markAoycoTransaction(transactionId, { ...previous, status, credited: false });
    }
    return new NextResponse("ok", { status: 200 });
  }

  if (status !== "1") return new NextResponse("ok", { status: 200 });

  await adjustPoints(userId, points);
  await markAoycoTransaction(transactionId, {
    userId,
    points,
    status,
    offerId: null,
    credited: true,
  });
  return new NextResponse("ok", { status: 200 });
}

export async function GET(request: NextRequest) {
  return handlePostback(request);
}

export async function POST(request: NextRequest) {
  return handlePostback(request);
}
