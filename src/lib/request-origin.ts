import { NextRequest } from "next/server";

/**
 * Render's proxy doesn't forward the headers we'd normally use to detect
 * the site's real public address, so request.nextUrl / host headers can
 * resolve to the container's internal address (e.g. localhost:10000)
 * instead of your real domain.
 *
 * Since DISCORD_REDIRECT_URI is already set to your real, working public
 * URL (Discord wouldn't be able to redirect back to you otherwise), we
 * derive the origin from that instead — it's guaranteed correct.
 */
export function getPublicOrigin(request: NextRequest): string {
  const configuredRedirect = process.env.DISCORD_REDIRECT_URI;
  if (configuredRedirect) {
    try {
      return new URL(configuredRedirect).origin;
    } catch {
      // fall through to the header-based guess below
    }
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const host = forwardedHost ?? request.headers.get("host") ?? request.nextUrl.host;
  const proto = forwardedProto ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto}://${host}`;
}
