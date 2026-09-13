import { getRedis } from "./redis";

const GEO_TTL_SECONDS = 60 * 60 * 24; // 24h — a given IP's country rarely changes

function geoKey(ip: string) {
  return `geo:ip:${ip}`;
}

/**
 * Best-effort IP -> 2-letter country code lookup, using the free
 * ipapi.co API, cached in Redis so we don't hit their rate limit or add
 * latency for the same recurring visitor. Returns null if the IP is
 * missing/local, or if the lookup fails or times out for any reason —
 * callers should treat null as "region unknown," never as a guessed
 * specific country.
 */
export async function getCountryForIp(ip: string | undefined | null): Promise<string | null> {
  if (!ip || ip === "0.0.0.0" || ip === "127.0.0.1" || ip === "::1") {
    return null;
  }

  const redis = getRedis();

  try {
    const cached = await redis.get<string>(geoKey(ip));
    if (cached) return cached;
  } catch {
    // Cache miss/error — fall through to a live lookup.
  }

  try {
    const res = await fetch(`https://ipapi.co/${ip}/country/`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;

    const text = (await res.text()).trim().toUpperCase();
    // ipapi.co returns a bare 2-letter code on success, or an error
    // message / empty body on failure or rate-limit — only trust
    // something that actually looks like a country code.
    if (!/^[A-Z]{2}$/.test(text)) return null;

    await redis.set(geoKey(ip), text, { ex: GEO_TTL_SECONDS }).catch(() => {});
    return text;
  } catch {
    return null;
  }
}
