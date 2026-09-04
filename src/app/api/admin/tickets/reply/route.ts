import { NextRequest, NextResponse } from "next/server";
import { addAdminReply } from "@/lib/support-data";

export async function POST(request: NextRequest) {
  const password = request.headers.get("x-admin-password");

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { ticketId?: string; discordId?: string; message?: string; status?: "OPEN" | "RESOLVED" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { ticketId, discordId, message, status } = body;
  if (!ticketId || !discordId || !message || !message.trim()) {
    return NextResponse.json({ error: "Missing ticketId, discordId, or message" }, { status: 400 });
  }

  const ticket = await addAdminReply(discordId, ticketId, message.trim(), status);
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  return NextResponse.json({ ticket });
}
