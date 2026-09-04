import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/session";
import { createTicket, getTicketsForUser } from "@/lib/support-data";

export async function GET(request: NextRequest) {
  const cookie = request.cookies.get("session")?.value;
  const user = verifySessionCookie(cookie);

  if (!user) {
    return NextResponse.json({ tickets: [] });
  }

  const tickets = await getTicketsForUser(user.id);
  return NextResponse.json({ tickets });
}

export async function POST(request: NextRequest) {
  const cookie = request.cookies.get("session")?.value;
  const user = verifySessionCookie(cookie);

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let message: string | undefined;
  try {
    const body = await request.json();
    message = body?.message;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!message || !message.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const ticket = await createTicket(user.id, user.username, message.trim());
  return NextResponse.json({ ticket });
}
