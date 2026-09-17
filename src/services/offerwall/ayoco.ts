import { Offer } from "@/types";
import { OfferwallProvider } from "./types";

type AoycoRawOffer = Record<string, unknown>;
type AoycoEndpoint = "ptc" | "sl-api";

function getConfig() {
  const apiKey = process.env.AOYCO_API_KEY;
  const bearerToken = process.env.AOYCO_BEARER_TOKEN;
  if (!apiKey || !bearerToken) {
    console.error("[AoyCo] Missing AOYCO_API_KEY or AOYCO_BEARER_TOKEN");
    return null;
  }
  return { apiKey, bearerToken };
}

function getValue(raw: AoycoRawOffer, ...keys: string[]): string {
  for (const key of keys) {
    const candidate = raw[key];
    if (candidate !== undefined && candidate !== null && String(candidate).trim()) {
      return String(candidate);
    }
  }
  return "";
}

function buildUrl(endpoint: AoycoEndpoint, apiKey: string, userId: string, userIp: string): string {
  return `https://aoyco.in/api/v1/${endpoint}/${encodeURIComponent(apiKey)}/${encodeURIComponent(userId)}/${encodeURIComponent(userIp)}`;
}

function toOffer(raw: AoycoRawOffer, endpoint: AoycoEndpoint): Offer | null {
  const rawId = getValue(raw, "id", "offer_id");
  const title = getValue(raw, "title", "name", "offer_name");
  const points = Math.round(Number(getValue(raw, "reward", "points")) || 0);
  const url = getValue(raw, "url", "link");
  if (!rawId || !title || points <= 0 || !url) return null;

  return {
    id: `aoyco-${endpoint}-${rawId}`,
    type: endpoint === "ptc" ? "PTC" : "Shortlink",
    duration: getValue(raw, "duration") ? `${getValue(raw, "duration")} SEC` : "VARIES",
    points,
    rating: 5,
    title,
    description: getValue(raw, "description", "requirements"),
    provider: "aoyco",
    url,
  };
}

export class AoycoProvider implements OfferwallProvider {
  private async fetchOffers(endpoint: AoycoEndpoint, userId: string, userIp: string): Promise<Offer[]> {
    const config = getConfig();
    if (!config) return [];

    try {
      const response = await fetch(buildUrl(endpoint, config.apiKey, userId, userIp), {
        headers: {
          Authorization: `Bearer ${config.bearerToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
      });
      if (!response.ok) {
        console.error(`[AoyCo] ${endpoint} API returned HTTP ${response.status}`);
        return [];
      }

      const payload = await response.json();
      if (String(payload?.status) !== "200") {
        console.error(`[AoyCo] ${endpoint} API returned status ${String(payload?.status)}: ${String(payload?.message || "unknown error")}`);
        return [];
      }
      const offers = (payload.data || [])
        .map((raw: AoycoRawOffer) => toOffer(raw, endpoint))
        .filter((offer: Offer | null): offer is Offer => !!offer);
      console.log(`[AoyCo] ${endpoint} returned ${offers.length} usable offers`);
      return offers;
    } catch {
      console.error(`[AoyCo] ${endpoint} request failed`);
      return [];
    }
  }

  async getOffers(userId: string, userIp = "0.0.0.0"): Promise<Offer[]> {
    const results = await Promise.all([
      this.fetchOffers("ptc", userId, userIp),
      this.fetchOffers("sl-api", userId, userIp),
    ]);
    return results.flat();
  }

  async getUserProgress(userId: string) {
    return { userId, completedOffers: [], totalPointsEarned: 0 };
  }

  async startOffer(userId: string, offerId: string, userIp = "0.0.0.0") {
    const match = /^(?:aoyco-)(ptc|sl-api)-(.+)$/.exec(offerId);
    if (!match) return {};

    const endpoint = match[1] as AoycoEndpoint;
    const offers = await this.fetchOffers(endpoint, userId, userIp);
    const offer = offers.find((item) => item.id === offerId);
    return { redirectUrl: offer?.url };
  }
}
