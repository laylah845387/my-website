import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/session";
import { dismissOffer } from "@/lib/user-data";

export async function POST(request: NextRequest) {
  const user = verifySessionCookie(request.cookies.get("session")?.value);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let offerId: unknown;
  try {
    offerId = (await request.json())?.offerId;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (typeof offerId !== "string" || !offerId.startsWith("cpx-")) {
    return NextResponse.json({ error: "Invalid offerId" }, { status: 400 });
  }

  const dismissed = await dismissOffer(user.id, offerId);
  return NextResponse.json({ dismissed });
}