import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/session";
import { getOfferProgress, getUserOfferProgress, toggleOfferMilestone } from "@/lib/user-data";

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

export async function POST(request: NextRequest) {
  const cookie = request.cookies.get("session")?.value;
  const user = verifySessionCookie(cookie);

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let offerId: string | undefined;
  let milestoneId: string | undefined;
  let points: number | undefined;
  let completed: boolean | undefined;

  try {
    const body = await request.json();
    offerId = body?.offerId;
    milestoneId = body?.milestoneId;
    points = Number(body?.points ?? 0);
    completed = Boolean(body?.completed);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!offerId || !milestoneId) {
    return NextResponse.json({ error: "Missing offerId or milestoneId" }, { status: 400 });
  }

  const result = await toggleOfferMilestone(user.id, offerId, milestoneId, points, completed);
  return NextResponse.json(result);
}
