import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/session";
import { getCompletedOffers, getPoints } from "@/lib/user-data";

export async function GET(request: NextRequest) {
  const cookie = request.cookies.get("session")?.value;
  const user = verifySessionCookie(cookie);

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const offerId = request.nextUrl.searchParams.get("offerId");
  if (!offerId) {
    return NextResponse.json({ error: "Missing offerId" }, { status: 400 });
  }

  const [completedOffers, points] = await Promise.all([
    getCompletedOffers(user.id),
    getPoints(user.id),
  ]);

  return NextResponse.json({
    completed: completedOffers.includes(offerId),
    points,
  });
}