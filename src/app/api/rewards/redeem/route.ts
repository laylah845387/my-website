import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/session";
import { redeemRewardForUser } from "@/lib/user-data";
import { Order } from "@/types";

function generateId(): string {
  return `order_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function POST(request: NextRequest) {
  const cookie = request.cookies.get("session")?.value;
  const user = verifySessionCookie(cookie);

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: { rewardId?: string; rewardName?: string; rewardImage?: string; points?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { rewardId, rewardName, rewardImage, points } = body;
  if (!rewardId || !rewardName || typeof points !== "number") {
    return NextResponse.json({ error: "Missing reward details" }, { status: 400 });
  }

  const order: Order = {
    id: generateId(),
    rewardId,
    rewardName,
    rewardImage: rewardImage ?? "",
    points,
    status: "COMPLETED",
    createdAt: new Date().toISOString(),
  };

  const result = await redeemRewardForUser(user.id, order);

  if (!result.success) {
    return NextResponse.json(
      { success: false, points: result.points, error: "Insufficient points" },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true, points: result.points, order });
}
