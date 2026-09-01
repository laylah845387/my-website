import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/session";
import { getUserSnapshot } from "@/lib/user-data";

export async function GET(request: NextRequest) {
  const cookie = request.cookies.get("session")?.value;
  const user = verifySessionCookie(cookie);

  if (!user) {
    return NextResponse.json({
      signedIn: false,
      points: 0,
      completedOffers: [],
      orders: [],
    });
  }

  const snapshot = await getUserSnapshot(user.id);
  return NextResponse.json({ signedIn: true, ...snapshot });
}
