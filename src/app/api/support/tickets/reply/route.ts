import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/session";
import { addUserReply } from "@/lib/support-data";

export async function POST(request: NextRequest) {
  const cookie = request.cookies.get("session")?.value;
  const user = verifySessionCookie(cookie);

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let ticketId: string | undefined;
  let message: string | undefined;
  try {
    const body = await request.json();
    ticketId = body?.ticketId;
    message = body?.message;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!ticketId || !message || !message.trim()) {
    return NextResponse.json({ error: "Missing ticketId or message" }, { status: 400 });
  }

  const result = await addUserReply(user.id, ticketId, message.trim());
  if (!result.ticket) {
    return NextResponse.json({ error: result.error ?? "Could not add reply" }, { status: 400 });
  }

  return NextResponse.json({ ticket: result.ticket });
}
