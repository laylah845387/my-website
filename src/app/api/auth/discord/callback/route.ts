import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, fetchDiscordUser } from "@/services/discord/discord";
import { createSessionCookie } from "@/lib/session";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = request.nextUrl.origin;

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const savedState = request.cookies.get("discord_oauth_state")?.value;

  // Reject if Discord reported an error, or the state doesn't match
  // (state mismatch means this isn't a legitimate continuation of a
  // login we started — could be CSRF, so refuse it).
  if (searchParams.get("error") || !code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(new URL("/?error=discord_auth_failed", origin));
  }

  const accessToken = await exchangeCodeForToken(code);
  if (!accessToken) {
    return NextResponse.redirect(new URL("/?error=discord_auth_failed", origin));
  }

  const discordUser = await fetchDiscordUser(accessToken);
  if (!discordUser) {
    return NextResponse.redirect(new URL("/?error=discord_auth_failed", origin));
  }

  let sessionValue: string;
  try {
    sessionValue = createSessionCookie({
      id: discordUser.id,
      username: discordUser.username,
      avatarUrl: discordUser.avatarUrl,
    });
  } catch {
    return NextResponse.redirect(new URL("/?error=discord_not_configured", origin));
  }

  const response = NextResponse.redirect(new URL("/", origin));
  response.cookies.set("session", sessionValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
  response.cookies.delete("discord_oauth_state");
  return response;
}
