import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  adjustPoints,
  markOfferwallMeTransaction,
  recordOfferwallMeMilestone,
  recordOfferwallMeMilestoneByName,
  removeOfferwallMeMilestone,
  removeOfferwallMeMilestoneByName,
} from "@/lib/user-data";

function md5(value: string): string {
  return crypto.createHash("md5").update(value).digest("hex");
}

function getOfferIds(params: URLSearchParams): string[] {
  const provider = params.get("provider") || params.get("offer_provider") || "";
  const rawIds = [
    params.get("offerId"),
    params.get("offerid"),
    params.get("offerID"),
    params.get("offer_id"),
    params.get("offer"),
    params.get("campaign_id"),
    params.get("campaignId"),
    params.get("campaignid"),
    params.get("campaign"),
    params.get("cid"),
    params.get("task_id"),
    params.get("taskId"),
  ].filter((value): value is string => Boolean(value?.trim()));

  const endpoints = ["offerapi.php", "api.php", "slapi.php"];
  return [...new Set(rawIds.flatMap((rawId) => {
    if (rawId.startsWith("offerwall-me-")) return [rawId];

    const providerAndId = rawId.includes(":")
      ? rawId
      : provider
        ? `${provider}:${rawId}`
        : rawId;
    const idOnly = rawId.includes(":") ? rawId.slice(rawId.indexOf(":") + 1) : rawId;
    const endpointHint = providerAndId.split(":")[0].toLowerCase();
    const matchingEndpoints = endpoints.filter((endpoint) =>
      endpointHint === endpoint || endpointHint === endpoint.replace(".php", "")
    );
    const endpointsToTry = matchingEndpoints.length > 0 ? matchingEndpoints : endpoints;

    return endpointsToTry.flatMap((endpoint) => [
      `offerwall-me-${endpoint}-${idOnly}`,
      `offerwall-me-${endpoint}-${providerAndId}`,
    ]);
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

  console.log(
    "[Offerwall.me] Postback request received:",
    JSON.stringify({
      method: request.method,
      params: Object.fromEntries(
        [...params.entries()].filter(([key]) => key.toLowerCase() !== "signature")
      ),
      hasSignature: params.has("signature"),
    })
  );

  const secret = process.env.OFFERWALL_ME_SECRET_KEY;
  const userId = params.get("subId");
  const transactionId = params.get("transId");
  const rewardRaw = params.get("reward");
  const status = params.get("status") || "1";
  const signature = params.get("signature");

  if (!secret) {
    console.warn("[Offerwall.me] Postback rejected: secret is not configured");
    return new NextResponse("ERROR: Postback not configured", { status: 200 });
  }
  if (!userId || !transactionId || !rewardRaw || !signature) {
    console.warn("[Offerwall.me] Postback rejected: missing required parameter", {
      hasUserId: Boolean(userId),
      hasTransactionId: Boolean(transactionId),
      hasReward: Boolean(rewardRaw),
      hasSignature: Boolean(signature),
    });
    return new NextResponse("ERROR: Missing parameters", { status: 200 });
  }
  if (md5(`${userId}${transactionId}${rewardRaw}${secret}`) !== signature) {
    console.warn("[Offerwall.me] Postback rejected: signature mismatch");
    return new NextResponse("ERROR: Signature doesn't match", { status: 200 });
  }

  const reward = Number.parseFloat(rewardRaw);
  if (!Number.isFinite(reward) || reward < 0) {
    return new NextResponse("ERROR: Invalid reward", { status: 200 });
  }

  // Log the validated callback fields so identifier mismatches are visible
  // in Render without logging the signature itself.
  console.log(
    "[Offerwall.me] Postback received — params:",
    Object.fromEntries(
      [...params.entries()].filter(([key]) => key.toLowerCase() !== "signature")
    )
  );

  const points = Math.round(reward);

  const offerIds = getOfferIds(params);
  const offerId = offerIds[0] ?? null;
  const offerName = params.get("offer_name") || params.get("offerName") || null;

  const previous = await markOfferwallMeTransaction(transactionId, {
    userId,
    points,
    status,
    offerId,
    offerName,
  });

  if (previous) {
    if (status === "2" && previous.credited) {
      await adjustPoints(previous.userId, -previous.points);
      await markOfferwallMeTransaction(transactionId, { ...previous, status, credited: false });
      if (previous.offerId) {
        await removeOfferwallMeMilestone(previous.userId, previous.offerId, previous.points, transactionId);
      }
      if (previous.offerName) {
        await removeOfferwallMeMilestoneByName(previous.userId, previous.offerName, previous.points, transactionId);
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
      if (offerName) {
        await recordOfferwallMeMilestoneByName(userId, offerName, points, transactionId);
      }
    } else if (status === "1" && previous.credited && offerIds.length > 0) {
      // A retry may contain the offer ID even when the original credit did
      // not. Keep the point credit idempotent, but backfill milestone state.
      await Promise.all(offerIds.map((id) => recordOfferwallMeMilestone(userId, id, points, transactionId)));
    } else if (status === "1" && previous.credited && offerName && offerIds.length === 0) {
      await recordOfferwallMeMilestoneByName(userId, offerName, points, transactionId);
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
    if (offerName) {
      await recordOfferwallMeMilestoneByName(userId, offerName, points, transactionId);
    }
  }

  return new NextResponse("ok", { status: 200 });
}

export async function GET(request: NextRequest) {
  return POST(request);
}