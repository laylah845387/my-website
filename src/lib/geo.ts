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
    console.warn(`[Geo] No usable IP to look up (got ${JSON.stringify(ip)}) — treating region as unknown.`);
    return null;
  }

  const redis = getRedis();

  try {
    const cached = await redis.get<string>(geoKey(ip));
    if (cached) return cached;
  } catch (err) {
    console.warn(`[Geo] Redis cache read failed for ${ip}:`, err);
  }

  try {
    const res = await fetch(`https://ipapi.co/${ip}/country/`, {
      signal: AbortSignal.timeout(3000),
    });

    const text = (await res.text()).trim();

    if (!res.ok) {
      console.warn(`[Geo] ipapi.co returned ${res.status} for IP ${ip}: ${text}`);
      return null;
    }

    const upper = text.toUpperCase();
    // ipapi.co returns a bare 2-letter code on success, or an error
    // message / empty body on failure or rate-limit — only trust
    // something that actually looks like a country code.
    if (!/^[A-Z]{2}$/.test(upper)) {
      console.warn(`[Geo] ipapi.co returned an unexpected body for IP ${ip}: ${JSON.stringify(text)}`);
      return null;
    }

    await redis.set(geoKey(ip), upper, { ex: GEO_TTL_SECONDS }).catch(() => {});
    return upper;
  } catch (err) {
    console.warn(`[Geo] Lookup failed for IP ${ip}:`, err);
    return null;
  }
}
