import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/session";
import { BitcotasksProvider } from "@/services/offerwall";
import { getCompletedOffers } from "@/lib/user-data";

/**
 * GET /api/offers
 *
 * Serves the current list of offers. Once an offer is completed, it's
 * filtered out of this response immediately on the very next visit/refresh
 * — the "completed" label the user sees right after finishing a task is
 * purely a client-side, same-session thing (see earn/page.tsx), not
 * something this endpoint needs to reproduce.
 */
export async function GET(request: NextRequest) {
  const cookie = request.cookies.get("session")?.value;
  const user = verifySessionCookie(cookie);
  const userIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";

  const provider = new BitcotasksProvider();
  const allOffers = await provider.getOffers(user?.id ?? "guest", userIp);

  if (!user) {
    return NextResponse.json({ offers: allOffers });
  }

  const completedIds = await getCompletedOffers(user.id);
  const completedSet = new Set(completedIds);
  const visibleOffers = allOffers.filter((offer) => !completedSet.has(offer.id));

  return NextResponse.json({ offers: visibleOffers });
}
