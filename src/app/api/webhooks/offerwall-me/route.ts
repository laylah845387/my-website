import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  adjustPoints,
  markOfferwallMeTransaction,
  recordOfferwallMeMilestone,
  removeOfferwallMeMilestone,
} from "@/lib/user-data";

function md5(value: string): string {
  return crypto.createHash("md5").update(value).digest("hex");
}

function getOfferIds(params: URLSearchParams): string[] {
  const provider = params.get("provider") || params.get("offer_provider") || "";
  const rawIds = [
    params.get("offerId"),
    params.get("offer_id"),
    params.get("offer"),
    params.get("campaign_id"),
    params.get("campaignId"),
    params.get("campaign"),
    params.get("cid"),
  ].filter((value): value is string => Boolean(value?.trim()));

  return [...new Set(rawIds.flatMap((rawId) => {
    if (rawId.startsWith("offerwall-me-")) return [rawId];

    const normalizedRawId = rawId.includes(":") || !provider
      ? rawId
      : `${provider}:${rawId}`;
    return [
      `offerwall-me-offerapi.php-${normalizedRawId}`,
      rawId.includes(":") ? `offerwall-me-offerapi.php-${rawId}` : "",
    ].filter(Boolean);
  }))];
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

  // Log EVERY param the postback actually sends, not just the ones we
  // already know about — we need to see the real field name for "which
  // offer" and "which specific step/milestone" this completion belongs
  // to before per-checkpoint tracking can be built correctly. Guessing a
  // field name here would silently cross off the wrong checkpoint (or
  // none at all) if wrong, so this needs one real completion's data
  // first. Once you've completed a real milestone, check Render's logs
  // for this line and share it.
  console.log(
    "[Offerwall.me] Postback received — ALL params:",
    Object.fromEntries(params.entries())
  );

  const points = Math.round(reward);

  const offerIds = getOfferIds(params);
  const offerId = offerIds[0] ?? null;

  const previous = await markOfferwallMeTransaction(transactionId, {
    userId,
    points,
    status,
    offerId,
  });

  if (previous) {
    if (status === "2" && previous.credited) {
      await adjustPoints(previous.userId, -previous.points);
      await markOfferwallMeTransaction(transactionId, { ...previous, status, credited: false });
      if (previous.offerId) {
        await removeOfferwallMeMilestone(previous.userId, previous.offerId, previous.points, transactionId);
      }
      await Promise.all(
        offerIds
          .filter((id) => id !== previous.offerId)
          .map((id) => removeOfferwallMeMilestone(previous.userId, id, previous.points, transactionId))
      );
    } else if (status === "1" && !previous.credited) {
      await adjustPoints(userId, points);
      await markOfferwallMeTransaction(transactionId, {
        userId,
        points,
        status,
        offerId,
        credited: true,
      });
      await Promise.all(offerIds.map((id) => recordOfferwallMeMilestone(userId, id, points, transactionId)));
    }
    return new NextResponse("ok", { status: 200 });
  }

  if (status === "1") {
    await adjustPoints(userId, points);
    await markOfferwallMeTransaction(transactionId, {
      userId,
      points,
      status,
      offerId,
      credited: true,
    });
    await Promise.all(offerIds.map((id) => recordOfferwallMeMilestone(userId, id, points, transactionId)));
  }

  return new NextResponse("ok", { status: 200 });
}

export async function GET(request: NextRequest) {
  return POST(request);
}