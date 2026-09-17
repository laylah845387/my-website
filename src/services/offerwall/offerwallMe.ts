import crypto from "crypto";
import { Offer, OfferMilestone } from "@/types";
import { getCountryForIp } from "@/lib/geo";
import { OfferwallProvider } from "./types";

type RawOffer = Record<string, unknown>;
type Endpoint = "offerapi.php" | "api.php" | "slapi.php";

function config() {
  const publicKey = process.env.OFFERWALL_ME_PUBLIC_KEY;
  const bearerToken = process.env.OFFERWALL_ME_BEARER_TOKEN;
  const privateSecret = process.env.OFFERWALL_ME_SECRET_KEY;
  return publicKey && bearerToken && privateSecret ? { publicKey, bearerToken, privateSecret } : null;
}

function get(raw: RawOffer, ...keys: string[]): string {
  for (const key of keys) {
    const item = raw[key];
    if (item !== undefined && item !== null && String(item).trim()) return String(item);
  }
  return "";
}

function signedIdentity(publicKey: string, userId: string, secret: string) {
  const expires = String(Math.floor(Date.now() / 1000) + 3600);
  const message = `offerwall-user-v1\n${publicKey}\n${userId}\n${expires}`;
  const signature = crypto.createHmac("sha256", secret).update(message, "utf8").digest("hex");
  return { expires, signature };
}

function typeFor(raw: RawOffer, endpoint: Endpoint): string {
  if (endpoint === "api.php" || endpoint === "slapi.php") return "Visit & Earn";
  const explicit = get(raw, "offer_type", "type", "category").toLowerCase();
  if (explicit === "survey" || explicit === "surveys") return "Survey";
  const text = `${get(raw, "title", "name", "offer_name")} ${get(raw, "description")}`.toLowerCase();
  const devices = get(raw, "devices").toLowerCase();
  if (/(install|download|app|game|play|castle|puzzle|simulator)/.test(text) || /android|mobile/.test(devices) || (Array.isArray(raw.steps) && raw.steps.length > 0)) {
    return "App Download";
  }
  return "Offer";
}

function normalize(raw: RawOffer, endpoint: Endpoint): Offer | null {
  const id = get(raw, "id", "offer_id");
  const title = get(raw, "title", "name", "offer_name");
  const url = get(raw, "url", "link");
  const points = Math.round(Number(get(raw, "reward", "points")) || 0);
  if (!id || !title || !url || points <= 0) return null;
  const milestones: OfferMilestone[] = Array.isArray(raw.steps)
    ? raw.steps
        .map((step: RawOffer, index: number) => ({
          id: get(step, "id") || `${id}-step-${index + 1}`,
          action: get(step, "label", "title", "name") || `Complete step ${index + 1}`,
          points: Math.round(Number(get(step, "reward", "points")) || 0),
        }))
        .filter((step) => step.points > 0)
    : [];
  return {
    id: `offerwall-me-${endpoint}-${id}`,
    type: typeFor(raw, endpoint),
    duration: milestones.length > 0 ? `${milestones.length} STEP${milestones.length > 1 ? "S" : ""}` : get(raw, "duration") ? `${get(raw, "duration")} SEC` : "VARIES",
    points,
    rating: 5,
    title,
    description: get(raw, "description", "requirements"),
    provider: "offerwall-me",
    url,
    milestones,
  };
}

export class OfferwallMeProvider implements OfferwallProvider {
  private async fetchEndpoint(endpoint: Endpoint, userId: string, userIp: string): Promise<Offer[]> {
    const settings = config();
    if (!settings) return [];
    const country = (await getCountryForIp(userIp)) || "US";
    const identity = signedIdentity(settings.publicKey, userId, settings.privateSecret);
    const params = new URLSearchParams({
      api: settings.publicKey,
      id: userId,
      ip: userIp,
      token: settings.bearerToken,
      country,
      identityExpires: identity.expires,
      identitySignature: identity.signature,
    });

    try {
      const response = await fetch(`https://offerwall.me/${endpoint}?${params}`, {
        headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
        cache: "no-store",
      });
      if (!response.ok) return [];
      const payload = await response.json();
      if (String(payload?.status) !== "200") return [];
      const offers = (payload.data || [])
        .map((raw: RawOffer) => normalize(raw, endpoint))
        .filter((offer: Offer | null): offer is Offer => !!offer);
      console.log(`[Offerwall.me] ${endpoint}: ${offers.length} usable cards`);
      return offers;
    } catch {
      return [];
    }
  }

  async getOffers(userId: string, userIp = "0.0.0.0"): Promise<Offer[]> {
    const results = await Promise.all([
      this.fetchEndpoint("offerapi.php", userId, userIp),
      this.fetchEndpoint("api.php", userId, userIp),
      this.fetchEndpoint("slapi.php", userId, userIp),
    ]);
    return results.flat();
  }

  async getUserProgress(userId: string) {
    return { userId, completedOffers: [], totalPointsEarned: 0 };
  }

  async startOffer(userId: string, offerId: string, userIp = "0.0.0.0") {
    const offers = await this.getOffers(userId, userIp);
    return { redirectUrl: offers.find((offer) => offer.id === offerId)?.url };
  }
}
