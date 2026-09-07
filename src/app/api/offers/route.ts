import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/session";
import { BitcotasksProvider, CpxResearchProvider } from "@/services/offerwall";
import { getCompletedOffers } from "@/lib/user-data";
import { offers as mockOffers } from "@/data/offers";

/**
 * GET /api/offers
 *
 * Serves the combined list of offers from every configured provider
 * (BitcoTasks, CPX Research, ...). Each offer is tagged with its
 * `provider` field so /api/offers/start knows which one to ask when the
 * user clicks it. If NEITHER provider has real offers available yet
 * (e.g. still pending approval), demo data fills the page instead of
 * leaving it empty — but as soon as either provider returns anything
 * real, the demo data disappears entirely rather than mixing with it.
 */
export async function GET(request: NextRequest) {
  const cookie = request.cookies.get("session")?.value;
  const user = verifySessionCookie(cookie);
  const userIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
  const userId = user?.id ?? "guest";

  const [bitcotasksOffers, cpxOffers] = await Promise.all([
    new BitcotasksProvider().getOffers(userId, userIp),
    new CpxResearchProvider().getOffers(userId, userIp),
  ]);

  const realOffers = [...bitcotasksOffers, ...cpxOffers];
  const allOffers = realOffers.length > 0 ? realOffers : mockOffers;

  if (!user) {
    return NextResponse.json({ offers: allOffers });
  }

  const completedIds = await getCompletedOffers(user.id);
  const completedSet = new Set(completedIds);
  const visibleOffers = allOffers.filter((offer) => !completedSet.has(offer.id));

  return NextResponse.json({ offers: visibleOffers });
}
