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

  try {
    const snapshot = await getUserSnapshot(user.id);
    return NextResponse.json({ signedIn: true, ...snapshot });
  } catch (error) {
    // Account storage being unavailable must not make a valid Discord session look
    // logged out in the client. Keep the identity and let the UI retry data.
    console.error("[User] Could not load account data:", error);
    return NextResponse.json({
      signedIn: true,
      points: 0,
      completedOffers: [],
      orders: [],
      dataUnavailable: true,
    });
  }
}
