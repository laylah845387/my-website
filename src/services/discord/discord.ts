/**
 * Discord Integration Service
 *
 * Handles the Discord OAuth2 flow used to link a visitor's Discord account
 * so their progress (points, completed tasks) can be tracked against it.
 *
 * Flow:
 * 1. User clicks "Link Discord to Start Earning"
 * 2. GET /api/auth/discord/login redirects to Discord's authorization URL
 * 3. Discord redirects back to /api/auth/discord/callback with a code
 * 4. We exchange the code for an access token
 * 5. We fetch the user's Discord profile (id, username, avatar)
 * 6. We store that in a signed, httpOnly session cookie
 *
 * Required environment variables:
 * - DISCORD_CLIENT_ID
 * - DISCORD_CLIENT_SECRET
 * - DISCORD_REDIRECT_URI   (must exactly match the redirect URI registered
 *                            in the Discord Developer Portal, including
 *                            the protocol, e.g. https://yoursite.onrender.com/api/auth/discord/callback)
 */

import crypto from "crypto";

export interface DiscordUser {
  id: string;
  username: string;
  discriminator?: string;
  avatar: string | null;
  avatarUrl: string;
}

interface DiscordConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

function getConfig(): DiscordConfig {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Discord OAuth is not configured. Set DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, and DISCORD_REDIRECT_URI."
    );
  }

  return { clientId, clientSecret, redirectUri };
}

/** Generates a random, unguessable value used to prevent CSRF on the OAuth redirect. */
export function generateState(): string {
  return crypto.randomBytes(16).toString("hex");
}

/** Builds the URL that sends the user to Discord's consent screen. */
export function getAuthorizationUrl(state: string): string {
  const { clientId, redirectUri } = getConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    // "identify" is enough to get id/username/avatar — we don't request
    // email or anything more sensitive than we actually need.
    scope: "identify",
    state,
    prompt: "consent",
  });
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

/** Exchanges the authorization code Discord sent us for an access token. */
export async function exchangeCodeForToken(code: string): Promise<string | null> {
  const { clientId, clientSecret, redirectUri } = getConfig();

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const res = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token ?? null;
}

/** Fetches the logged-in Discord user's profile using their access token. */
export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser | null> {
  const res = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) return null;
  const data = await res.json();

  const avatarUrl: string = data.avatar
    ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.${
        String(data.avatar).startsWith("a_") ? "gif" : "png"
      }?size=128`
    : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(data.id) >> BigInt(22)) % 6}.png`;

  return {
    id: data.id,
    username: data.global_name || data.username,
    discriminator: data.discriminator,
    avatar: data.avatar ?? null,
    avatarUrl,
  };
}
