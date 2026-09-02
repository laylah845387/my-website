import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/session";
import { BitcotasksProvider } from "@/services/offerwall";

/**
 * POST /api/offers/start
 * body: { offerId: string }
 *
 * Starts an offer through the OfferwallProvider abstraction. Requires
 * the visitor to be signed in with Discord, since progress is tracked
 * per-account.
 *
 * Once real Bitcotasks credentials are added, provider.startOffer()
 * will return a real redirectUrl (the actual task page to send the
 * user to). Until then it returns { redirectUrl: undefined }, and the
 * page falls back to the existing local "simulate completion" flow.
 */
export async function POST(request: NextRequest) {
  const cookie = request.cookies.get("session")?.value;
  const user = verifySessionCookie(cookie);

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let offerId: string | undefined;
  try {
    const body = await request.json();
    offerId = body?.offerId;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!offerId) {
    return NextResponse.json({ error: "Missing offerId" }, { status: 400 });
  }

  const provider = new BitcotasksProvider();
  const userIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
  const result = await provider.startOffer(user.id, offerId, userIp);

  return NextResponse.json(result);
}
