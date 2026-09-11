import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/session";
import { BitcotasksProvider, CpxResearchProvider, AffikeProvider } from "@/services/offerwall";
import { getCompletedOffers } from "@/lib/user-data";

/**
 * GET /api/offers
 *
 * Serves the combined list of REAL offers from every configured provider
 * (BitcoTasks, CPX Research, Affike, ...). No demo/placeholder data is
 * ever mixed in — if every provider comes back empty, the response is
 * simply an empty list, and the Earn page shows its own "no offers
 * available" empty state rather than fake tasks.
 */
export async function GET(request: NextRequest) {
  const cookie = request.cookies.get("session")?.value;
  const user = verifySessionCookie(cookie);
  const userIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
  const userId = user?.id ?? "guest";

  const [bitcotasksOffers, cpxOffers, affikeOffers] = await Promise.all([
    new BitcotasksProvider().getOffers(userId, userIp),
    new CpxResearchProvider().getOffers(userId, userIp),
    new AffikeProvider().getOffers(userId, userIp),
  ]);

  const allOffers = [...bitcotasksOffers, ...cpxOffers, ...affikeOffers];

  if (!user) {
    return NextResponse.json({ offers: allOffers });
  }

  const completedIds = await getCompletedOffers(user.id);
  const completedSet = new Set(completedIds);
  const visibleOffers = allOffers.filter((offer) => !completedSet.has(offer.id));

  return NextResponse.json({ offers: visibleOffers, completedOffers: completedIds });
}
