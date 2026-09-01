import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/session";

export async function GET(request: NextRequest) {
  const cookie = request.cookies.get("session")?.value;
  const user = verifySessionCookie(cookie);
  return NextResponse.json({ user });
}
