import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/session";
import { markOfferComplete } from "@/lib/user-data";

export async function POST(request: NextRequest) {
  const cookie = request.cookies.get("session")?.value;
  const user = verifySessionCookie(cookie);

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let offerId: string | undefined;
  let points: number | undefined;
  try {
    const body = await request.json();
    offerId = body?.offerId;
    points = body?.points;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!offerId || typeof points !== "number") {
    return NextResponse.json({ error: "Missing offerId or points" }, { status: 400 });
  }

  const result = await markOfferComplete(user.id, offerId, points);
  return NextResponse.json(result);
}
