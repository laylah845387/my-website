import { NextRequest, NextResponse } from "next/server";
import { adjustPoints, markAyocoTransaction, markOfferComplete } from "@/lib/user-data";

function isReversal(status: string): boolean {
  return /reject|declin|cancel|chargeback|revers|fraud|failed/i.test(status);
}

function isApproved(status: string): boolean {
  return /approv|complete|confirm|success|convert|paid/i.test(status);
}

async function readParams(request: NextRequest): Promise<URLSearchParams> {
  const params = new URLSearchParams(request.nextUrl.searchParams);
  if (request.method !== "POST") return params;

  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("form-urlencoded") || contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      form.forEach((value, key) => {
        if (typeof value === "string") params.set(key, value);
      });
    } else if (contentType.includes("application/json")) {
      const body = await request.json();
      Object.entries(body ?? {}).forEach(([key, value]) => params.set(key, String(value)));
    }
  } catch {
    // Keep query parameters if the body is empty or malformed.
  }
  return params;
}

async function handlePostback(request: NextRequest): Promise<NextResponse> {
  const params = await readParams(request);
  const expectedSecret = process.env.AYOCO_POSTBACK_SECRET;
  if (!expectedSecret) return new NextResponse("ERROR: Postback not configured", { status: 200 });

  if (params.get("secret") !== expectedSecret) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const userId = params.get("user_id") || params.get("sub_id") || params.get("subid") || params.get("user");
  const transactionId = params.get("transaction_id") || params.get("transaction") || params.get("txn_id") || params.get("conversion_id");
  const rawOfferId = params.get("offer_id") || params.get("offer") || params.get("offerId");
  const rewardRaw = params.get("points") || params.get("reward") || params.get("payout") || params.get("user_reward");
  const status = params.get("status") || "approved";

  if (params.get("test") === "1" || transactionId?.startsWith("test_")) {
    return NextResponse.json({ status: "test_ok" });
  }

  if (!userId || !transactionId || !rewardRaw || userId.includes("{") || transactionId.includes("{")) {
    return new NextResponse("ERROR: Missing parameters", { status: 200 });
  }

  const rawReward = Number.parseFloat(rewardRaw);
  if (!Number.isFinite(rawReward) || rawReward < 0) {
    return new NextResponse("ERROR: Invalid reward", { status: 200 });
  }

  const rewardUnit = process.env.AYOCO_REWARD_UNIT || "points";
  const rate = Number.parseFloat(process.env.AYOCO_POINTS_PER_DOLLAR || "100");
  const points = Math.max(0, Math.round(rewardUnit === "dollars" ? rawReward * (Number.isFinite(rate) ? rate : 100) : rawReward));
  const offerId = rawOfferId ? `ayoco-${rawOfferId.replace(/^ayoco-/, "")}` : null;
  const previous = await markAyocoTransaction(transactionId, {
    userId,
    points,
    status,
    offerId,
  });

  if (previous) {
    if (isReversal(status) && !isReversal(previous.status) && previous.credited) {
      await adjustPoints(previous.userId, -previous.points);
      await markAyocoTransaction(transactionId, { ...previous, status, credited: false });
      return NextResponse.json({ status: "reversed", transactionId });
    }
    if (isApproved(status) && !previous.credited && !isReversal(previous.status)) {
      await adjustPoints(userId, points);
      if (offerId) await markOfferComplete(userId, offerId, 0);
      await markAyocoTransaction(transactionId, { userId, points, status, offerId, credited: true });
      return NextResponse.json({ status: "ok", transactionId });
    }
    return new NextResponse("ok", { status: 200 });
  }

  if (!isApproved(status) || isReversal(status)) {
    return NextResponse.json({ status: "pending", transactionId });
  }

  await adjustPoints(userId, points);
  if (offerId) await markOfferComplete(userId, offerId, 0);
  await markAyocoTransaction(transactionId, { userId, points, status, offerId, credited: true });
  return NextResponse.json({ status: "ok", transactionId });
}

export async function GET(request: NextRequest) {
  return handlePostback(request);
}

export async function POST(request: NextRequest) {
  return handlePostback(request);
}