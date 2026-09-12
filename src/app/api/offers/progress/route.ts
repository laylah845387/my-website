import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/session";
import { getOfferProgress, getUserOfferProgress } from "@/lib/user-data";

export async function GET(request: NextRequest) {
  const cookie = request.cookies.get("session")?.value;
  const user = verifySessionCookie(cookie);

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const offerId = request.nextUrl.searchParams.get("offerId");

  if (offerId) {
    const progress = await getOfferProgress(user.id, offerId);
    return NextResponse.json({ offerId, progress });
  }

  const progress = await getUserOfferProgress(user.id);
  return NextResponse.json({ progress });
}
