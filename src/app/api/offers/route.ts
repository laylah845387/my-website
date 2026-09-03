import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/session";
import { BitcotasksProvider } from "@/services/offerwall";
import { getCompletedOffers, getOfferViewCounts, markOfferViewed } from "@/lib/user-data";

/**
 * GET /api/offers
 *
 * Serves the current list of offers, with a small twist for completed
 * ones: an offer stays visible (labeled "completed") for exactly one
 * return visit after the user finishes it, then disappears from the
 * list entirely on the visit after that, to keep the page decluttered.
 */
export async function GET(request: NextRequest) {
  const cookie = request.cookies.get("session")?.value;
  const user = verifySessionCookie(cookie);
  const userIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";

  const provider = new BitcotasksProvider();
  const allOffers = await provider.getOffers(user?.id ?? "guest", userIp);

  if (!user) {
    return NextResponse.json({ offers: allOffers, completedOffers: [] });
  }

  const [completedIds, viewCounts] = await Promise.all([
    getCompletedOffers(user.id),
    getOfferViewCounts(user.id),
  ]);
  const completedSet = new Set(completedIds);

  const offersToMarkViewed: string[] = [];
  const hiddenIds = new Set<string>();

  const visibleOffers = allOffers.filter((offer) => {
    if (!completedSet.has(offer.id)) return true; // never completed — always show

    const views = viewCounts[offer.id] ?? 0;
    if (views >= 1) {
      hiddenIds.add(offer.id);
      return false; // already shown once since completing — hide now
    }

    offersToMarkViewed.push(offer.id);
    return true; // first return visit since completing — show with completed label
  });

  // Record that these were just shown, so they're hidden on the next visit.
  await Promise.all(offersToMarkViewed.map((id) => markOfferViewed(user.id, id)));

  const visibleCompletedIds = allOffers
    .filter((o) => completedSet.has(o.id) && !hiddenIds.has(o.id))
    .map((o) => o.id);

  return NextResponse.json({ offers: visibleOffers, completedOffers: visibleCompletedIds });
}
