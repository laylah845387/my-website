import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/session";
import { BitcotasksProvider, CpxResearchProvider, AffikeProvider, OfferwallMeProvider } from "@/services/offerwall";
import { getCompletedOffers, getDismissedOffers } from "@/lib/user-data";

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

  const providerRequests = [
    new BitcotasksProvider().getOffers(userId, userIp),
    new CpxResearchProvider().getOffers(userId, userIp),
    new AffikeProvider().getOffers(userId, userIp),
    new OfferwallMeProvider().getOffers(userId, userIp),
  ];
  const [bitcotasksOffers, cpxOffers, affikeOffers, offerwallMeOffers] = await Promise.all(
    providerRequests.map((request) => request.catch((error) => {
      console.error("[Offers] Provider failed:", error);
      return [];
    }))
  );

  // Temporary testing order: keep Offerwall.me cards at the top until their
  // integration is verified, then return to the normal mixed ordering.
  const allOffers = [...offerwallMeOffers, ...bitcotasksOffers, ...cpxOffers, ...affikeOffers];

  if (!user) {
    return NextResponse.json({ offers: allOffers });
  }

  let completedIds: string[] = [];
  let dismissedIds: string[] = [];
  try {
    [completedIds, dismissedIds] = await Promise.all([
      getCompletedOffers(user.id),
      getDismissedOffers(user.id),
    ]);
  } catch (error) {
    console.error("[Offers] Could not load user offer state:", error);
  }
  const unavailableSet = new Set([...completedIds, ...dismissedIds]);
  const visibleOffers = allOffers.filter((offer) => !unavailableSet.has(offer.id));

  return NextResponse.json({ offers: visibleOffers, completedOffers: completedIds });
}
