import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/session";
import { BitcotasksProvider } from "@/services/offerwall";

/**
 * GET /api/offers
 *
 * Serves the current list of offers through the OfferwallProvider
 * interface. Now backed by real BitcoTasks Offer/Survey API calls —
 * falls back to demo data automatically if BitcoTasks isn't configured
 * yet, or returns nothing (e.g. still pending approval).
 */
export async function GET(request: NextRequest) {
  const cookie = request.cookies.get("session")?.value;
  const user = verifySessionCookie(cookie);
  const userIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";

  const provider = new BitcotasksProvider();
  const offers = await provider.getOffers(user?.id ?? "guest", userIp);

  return NextResponse.json({ offers });
}
