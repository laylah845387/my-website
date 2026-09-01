import crypto from "crypto";

/**
 * Lightweight signed-cookie session.
 *
 * The cookie value is: base64url(payload) + "." + HMAC-SHA256 signature.
 * Because it's signed with SESSION_SECRET (server-only, never sent to the
 * browser), a user cannot forge or edit their own session data even though
 * the cookie itself just looks like a string. The cookie is also set as
 * httpOnly, so client-side JavaScript can never read or steal it directly.
 */

export interface SessionUser {
  id: string;
  username: string;
  avatarUrl: string;
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET is not set. Add it to your environment variables."
    );
  }
  return secret;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function createSessionCookie(user: SessionUser): string {
  const payload = Buffer.from(JSON.stringify(user)).toString("base64url");
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function verifySessionCookie(cookie: string | undefined | null): SessionUser | null {
  if (!cookie) return null;

  const dotIndex = cookie.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const payload = cookie.slice(0, dotIndex);
  const signature = cookie.slice(dotIndex + 1);
  if (!payload || !signature) return null;

  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return null;
  }

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }
}
