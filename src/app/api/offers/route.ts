import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/session";
import { BitcotasksProvider } from "@/services/offerwall";

/**
 * GET /api/offers
 *
 * Serves the current list of offers through the same OfferwallProvider
 * interface the real Bitcotasks integration will use. Right now,
 * BitcotasksProvider.getOffers() returns mock data (see
 * src/services/offerwall/bitcotasks.ts) because we don't have API
 * credentials yet — but the page fetching this route doesn't need to
 * change at all once real credentials are added.
 */
export async function GET(request: NextRequest) {
  const cookie = request.cookies.get("session")?.value;
  const user = verifySessionCookie(cookie);

  const provider = new BitcotasksProvider();
  const offers = await provider.getOffers(user?.id ?? "guest");

  return NextResponse.json({ offers });
}
