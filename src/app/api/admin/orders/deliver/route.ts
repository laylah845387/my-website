import { NextRequest, NextResponse } from "next/server";
import { setOrderDelivered } from "@/lib/user-data";

export async function POST(request: NextRequest) {
  const password = request.headers.get("x-admin-password");

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { orderId?: string; discordId?: string; delivered?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { orderId, discordId, delivered } = body;
  if (!orderId || !discordId || typeof delivered !== "boolean") {
    return NextResponse.json({ error: "Missing orderId, discordId, or delivered" }, { status: 400 });
  }

  const updated = await setOrderDelivered(discordId, orderId, delivered);
  if (!updated) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({ order: updated });
}
