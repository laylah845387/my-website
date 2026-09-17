import crypto from "crypto";
import { Offer } from "@/types";
import { getCountryForIp } from "@/lib/geo";
import { OfferwallProvider } from "./types";

type OfferwallRawOffer = Record<string, unknown>;

function getConfig() {
  const publicKey = process.env.OFFERWALL_ME_PUBLIC_KEY;
  const bearerToken = process.env.OFFERWALL_ME_BEARER_TOKEN;
  const privateSecret = process.env.OFFERWALL_ME_SECRET_KEY;
  if (!publicKey || !bearerToken || !privateSecret) return null;
  return { publicKey, bearerToken, privateSecret };
}

function signIdentity(publicKey: string, userId: string, privateSecret: string) {
  const expires = String(Math.floor(Date.now() / 1000) + 3600);
  const message = `offerwall-user-v1\n${publicKey}\n${userId}\n${expires}`;
  const signature = crypto.createHmac("sha256", privateSecret).update(message, "utf8").digest("hex");
  return { expires, signature };
}

function value(raw: OfferwallRawOffer, ...keys: string[]): string {
  for (const key of keys) {
    const candidate = raw[key];
    if (candidate !== undefined && candidate !== null && String(candidate).trim()) return String(candidate);
  }
  return "";
}

function offerType(raw: OfferwallRawOffer): string {
  const explicit = value(raw, "offer_type", "type").toLowerCase();
  const searchable = `${explicit} ${value(raw, "title", "name", "offer_name")} ${value(raw, "description")}`.toLowerCase();

  if (searchable.includes("survey")) return "Survey";
  if (searchable.includes("shortlink")) return "Visit & Earn";
  if (searchable.includes("ptc") || searchable.includes("visit advertiser")) return "Visit & Earn";
  if (/(install|app|game)/.test(searchable)) return "App Download";
  if (explicit) return explicit.charAt(0).toUpperCase() + explicit.slice(1);
  return "Offer";
}

function toOffer(raw: OfferwallRawOffer): Offer | null {
  const rawId = value(raw, "id", "offer_id");
  const title = value(raw, "title", "name", "offer_name");
  const url = value(raw, "url", "link");
  const points = Math.round(Number(value(raw, "reward", "points")) || 0);
  if (!rawId || !title || !url || points <= 0) return null;

  return {
    id: `offerwall-me-${rawId}`,
    type: offerType(raw),
    duration: value(raw, "duration") ? `${value(raw, "duration")} SEC` : "VARIES",
    points,
    rating: 5,
    title,
    description: value(raw, "description", "requirements"),
    provider: "offerwall-me",
    url,
  };
}

export class OfferwallMeProvider implements OfferwallProvider {
  private async fetchOffers(userId: string, userIp: string): Promise<Offer[]> {
    const config = getConfig();
    if (!config) return [];

    const country = (await getCountryForIp(userIp)) || "US";
    const identity = signIdentity(config.publicKey, userId, config.privateSecret);
    const params = new URLSearchParams({
      api: config.publicKey,
      id: userId,
      ip: userIp,
      token: config.bearerToken,
      country,
      identityExpires: identity.expires,
      identitySignature: identity.signature,
    });

    try {
      const response = await fetch(`https://offerwall.me/offerapi.php?${params.toString()}`, {
        headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
        cache: "no-store",
      });
      if (!response.ok) {
        console.error(`[Offerwall.me] API returned HTTP ${response.status}`);
        return [];
      }

      const payload = await response.json();
      if (String(payload?.status) !== "200") {
        console.error(`[Offerwall.me] API returned status ${String(payload?.status)}: ${String(payload?.message || "unknown error")}`);
        return [];
      }
      return (payload.data || [])
        .map((raw: OfferwallRawOffer) => toOffer(raw))
        .filter((offer: Offer | null): offer is Offer => !!offer);
    } catch {
      console.error("[Offerwall.me] Offer API request failed");
      return [];
    }
  }

  async getOffers(userId: string, userIp = "0.0.0.0"): Promise<Offer[]> {
    return this.fetchOffers(userId, userIp);
  }

  async getUserProgress(userId: string) {
    return { userId, completedOffers: [], totalPointsEarned: 0 };
  }

  async startOffer(userId: string, offerId: string, userIp = "0.0.0.0") {
    const offers = await this.fetchOffers(userId, userIp);
    return { redirectUrl: offers.find((offer) => offer.id === offerId)?.url };
  }
}
