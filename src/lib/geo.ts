import { getRedis } from "./redis";

const GEO_TTL_SECONDS = 60 * 60 * 24; // 24h — a given IP's country rarely changes

function geoKey(ip: string) {
  return `geo:ip:${ip}`;
}

// Primary: ipwho.is — free, no signup/key, generous rate limits, HTTPS.
async function lookupViaIpwhoIs(ip: string): Promise<string | null> {
  const res = await fetch(`https://ipwho.is/${ip}?fields=success,country_code,message`, {
    signal: AbortSignal.timeout(3000),
  });
  const data = await res.json();

  if (!res.ok || !data.success || !data.country_code) {
    console.warn(`[Geo] ipwho.is failed for IP ${ip}:`, data);
    return null;
  }

  return String(data.country_code).toUpperCase();
}

// Backup, used only if ipwho.is fails — ip-api.com — free, no key, 45
// requests/min per calling server (HTTP only on the free tier, but this
// is a server-to-server call so that's not a mixed-content issue).
async function lookupViaIpApiCom(ip: string): Promise<string | null> {
  const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,countryCode,message`, {
    signal: AbortSignal.timeout(3000),
  });
  const data = await res.json();

  if (!res.ok || data.status !== "success" || !data.countryCode) {
    console.warn(`[Geo] ip-api.com fallback failed for IP ${ip}:`, data);
    return null;
  }

  return String(data.countryCode).toUpperCase();
}

/**
 * Best-effort IP -> 2-letter country code lookup, cached in Redis so we
 * don't hammer either provider or add latency for the same recurring
 * visitor. Tries ipwho.is first, then ip-api.com if that fails, so one
 * provider having an outage or rate-limiting us doesn't take out the
 * whole feature. Returns null if the IP is missing/local, or if BOTH
 * providers fail — callers should treat null as "region unknown," never
 * as a guessed specific country.
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

  let country: string | null = null;

  try {
    country = await lookupViaIpwhoIs(ip);
  } catch (err) {
    console.warn(`[Geo] ipwho.is threw for IP ${ip}:`, err);
  }

  if (!country) {
    try {
      country = await lookupViaIpApiCom(ip);
    } catch (err) {
      console.warn(`[Geo] ip-api.com threw for IP ${ip}:`, err);
    }
  }

  if (!country || !/^[A-Z]{2}$/.test(country)) {
    if (country) {
      console.warn(`[Geo] Got an unexpected country value for IP ${ip}: ${JSON.stringify(country)}`);
    }
    return null;
  }

  await redis.set(geoKey(ip), country, { ex: GEO_TTL_SECONDS }).catch(() => {});
  return country;
}
