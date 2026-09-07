import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/session";
import { BitcotasksProvider, CpxResearchProvider } from "@/services/offerwall";

/**
 * POST /api/offers/start
 * body: { offerId: string, provider?: string }
 *
 * Starts an offer through the OfferwallProvider abstraction. Requires
 * the visitor to be signed in with Discord, since progress is tracked
 * per-account. `provider` tells us which network's API to ask (each
 * Offer object already carries this field from /api/offers) — if it's
 * missing or unrecognized, we fall back to BitcoTasks for backwards
 * compatibility with the demo data, which has no real provider.
 */
export async function POST(request: NextRequest) {
  const cookie = request.cookies.get("session")?.value;
  const user = verifySessionCookie(cookie);

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let offerId: string | undefined;
  let providerName: string | undefined;
  try {
    const body = await request.json();
    offerId = body?.offerId;
    providerName = body?.provider;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!offerId) {
    return NextResponse.json({ error: "Missing offerId" }, { status: 400 });
  }

  const userIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";

  const provider =
    providerName === "cpx-research" ? new CpxResearchProvider() : new BitcotasksProvider();

  const result = await provider.startOffer(user.id, offerId, userIp);
  return NextResponse.json(result);
}
