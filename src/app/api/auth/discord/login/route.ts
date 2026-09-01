import { NextRequest, NextResponse } from "next/server";
import { getAuthorizationUrl, generateState } from "@/services/discord/discord";
import { getPublicOrigin } from "@/lib/request-origin";

export async function GET(request: NextRequest) {
  let authUrl: string;
  const state = generateState();

  try {
    authUrl = getAuthorizationUrl(state);
  } catch {
    // Discord isn't configured yet (missing env vars) — send the user
    // back home with an error flag instead of crashing.
    return NextResponse.redirect(new URL("/?error=discord_not_configured", getPublicOrigin(request)));
  }

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("discord_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 5, // 5 minutes — just long enough to complete the login
    path: "/",
  });
  return response;
}
