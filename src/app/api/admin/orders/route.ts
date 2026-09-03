import { NextRequest, NextResponse } from "next/server";
import { getAllOrders } from "@/lib/user-data";

export async function GET(request: NextRequest) {
  const password = request.headers.get("x-admin-password");

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orders = await getAllOrders();
  return NextResponse.json({ orders });
}
