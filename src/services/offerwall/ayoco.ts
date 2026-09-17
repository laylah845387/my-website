import { Offer } from "@/types";
import { OfferwallProvider } from "./types";

type AyocoRawOffer = Record<string, unknown>;

function config() {
  const offersUrl = process.env.AYOCO_OFFERS_URL;
  const trackingUrl = process.env.AYOCO_TRACKING_URL;
  const apiKey = process.env.AYOCO_API_KEY;
  if (!offersUrl || !trackingUrl) return null;
  return { offersUrl, trackingUrl, apiKey };
}

function value(raw: AyocoRawOffer, ...keys: string[]): string {
  for (const key of keys) {
    const candidate = raw[key];
    if (candidate !== undefined && candidate !== null && String(candidate).trim()) {
      return String(candidate);
    }
  }
  return "";
}

function replaceMacros(template: string, values: Record<string, string>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) =>
    encodeURIComponent(values[key] ?? "")
  );
}

function normalizeOffers(payload: unknown): AyocoRawOffer[] {
  if (Array.isArray(payload)) return payload as AyocoRawOffer[];
  if (!payload || typeof payload !== "object") return [];
  const body = payload as Record<string, unknown>;
  for (const key of ["offers", "data", "results"]) {
    if (Array.isArray(body[key])) return body[key] as AyocoRawOffer[];
  }
  return [];
}

function toOffer(raw: AyocoRawOffer): Offer | null {
  const rawId = value(raw, "id", "offer_id", "offerId");
  const title = value(raw, "title", "name", "offer_name");
  const points = Math.round(Number(value(raw, "points", "reward", "payout", "user_reward")) || 0);
  if (!rawId || !title || points <= 0) return null;

  return {
    id: `ayoco-${rawId}`,
    type: value(raw, "type", "category") || "Offer",
    duration: value(raw, "duration", "time", "estimated_time") || "VARIES",
    points,
    rating: Math.min(5, Math.max(1, Math.round(Number(value(raw, "rating", "popularity")) || 5))),
    title,
    description: value(raw, "description", "requirements", "details"),
    provider: "ayoco",
  };
}

export class AyocoProvider implements OfferwallProvider {
  async getOffers(userId: string, userIp = "0.0.0.0"): Promise<Offer[]> {
    const settings = config();
    if (!settings) return [];

    const url = new URL(settings.offersUrl);
    url.searchParams.set("user_id", userId);
    url.searchParams.set("user_ip", userIp);
    const headers: HeadersInit = settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {};

    try {
      const response = await fetch(url, { headers, cache: "no-store" });
      if (!response.ok) return [];
      const payload = await response.json();
      return normalizeOffers(payload).map(toOffer).filter((offer): offer is Offer => !!offer);
    } catch {
      return [];
    }
  }

  async getUserProgress(userId: string) {
    return { userId, completedOffers: [], totalPointsEarned: 0 };
  }

  async startOffer(userId: string, offerId: string, userIp = "0.0.0.0") {
    const settings = config();
    if (!settings) return {};

    const rawOfferId = offerId.replace(/^ayoco-/, "");
    return {
      redirectUrl: replaceMacros(settings.trackingUrl, {
        user_id: userId,
        sub_id: userId,
        offer_id: rawOfferId,
        user_ip: userIp,
      }),
    };
  }
}