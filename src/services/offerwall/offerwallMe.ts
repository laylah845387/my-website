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

  // Trusting offerwall.me's own offer_type/category field turned out to
  // be unreliable in practice — their per-advertiser tagging is too
  // inconsistent to use directly for App vs Sign Up. Survey is the one
  // value that's held up, so that's the only thing still trusted
  // straight from their field. Everything else uses signals actually
  // observed in their real data, in order of how confident each one is:
  //   1. A literal price tag ("$X.XX") in the title — these are
  //      purchase-based lead/signup flows, not app installs.
  //   2. The word "signup"/"sign up" anywhere in the title or
  //      description.
  //   3. Clear install/app/game keywords, or a mobile/android/ios
  //      device tag — a real app-download signal.
  //   4. Only when NONE of the above give a signal: step count as a
  //      last resort (single-step offers tend to be Sign Ups, multi-step
  //      ones tend to be Apps) — weakest signal, so it only applies once
  //      everything stronger has been ruled out.
  const explicitRaw = get(raw, "offer_type", "type", "category").toLowerCase();
  if (/survey/.test(explicitRaw)) return "Survey";

  const title = get(raw, "title", "name", "offer_name");
  const description = get(raw, "description");
  const text = `${title} ${description}`.toLowerCase();
  const devices = get(raw, "devices").toLowerCase();
  const stepCount = Array.isArray(raw.steps) ? raw.steps.length : 0;

  if (/\$\d/.test(title)) return "Sign Up";
  if (/sign[\s-]?up/.test(text)) return "Sign Up";

  if (
    /(install|download|app|game|play|castle|puzzle|simulator)/.test(text) ||
    /android|mobile|ios/.test(devices)
  ) {
    return "App Download";
  }

  if (stepCount === 1) return "Sign Up";
  if (stepCount > 1) return "App Download";

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
        .map((step: RawOffer, index: number) => {
          const label = get(step, "label", "title", "name") || `Complete step ${index + 1}`;
          // Check ALL of the step's text together, not just whichever
          // field happens to be non-empty first (get() only returns one)
          // — a purchase or urgency cue can live in description even
          // when label/title/name is already populated with something
          // else, and would otherwise never get examined at all.
          const stepText = `${label} ${get(step, "description")}`;
          return {
            id: get(step, "id") || `${id}-step-${index + 1}`,
            action: label,
            points: Math.round(Number(get(step, "reward", "points")) || 0),
            // Flags real-money purchases (a literal "$X.XX" price, or the
            // word "buy"/"purchase"/"spend"/"subscribe") and time-limited
            // urgency ("within 3 days", "before Friday", "expires",
            // "limited time", etc.) — both observed in real offer data as
            // the two categories that actually deserve the flame.
            priority: /(\$\d|\bbuy\b|purchase|payment|\bspend\b|subscri|\bbefore\b|\bwithin\b|deadline|expir|hurry|limited[\s-]?time|\bhours?\b|\bdays?\b|\bminutes?\b)/i.test(
              stepText
            ),
          };
        })
        .filter((step) => step.points > 0)
    : [];
  milestones.sort((first, second) => Number(second.priority) - Number(first.priority));
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
    qrCodeUrl: get(raw, "qr_code", "qrCode", "qr_url", "qrUrl") || undefined,
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

      // One-time sample log: print the full raw JSON of the first offer
      // that has multiple steps, so we can see every field offerwall.me
      // actually sends per step — specifically whether there's an exact
      // event/step identifier we can match a postback's event_name
      // against, instead of fuzzy-matching text.
      const sampleWithSteps = (payload.data || []).find(
        (raw: RawOffer) => Array.isArray(raw.steps) && raw.steps.length > 1
      );
      if (sampleWithSteps) {
        console.log(
          `[Offerwall.me] ${endpoint}: sample multi-step offer raw JSON:`,
          JSON.stringify(sampleWithSteps)
        );
      }

      const offers = (payload.data || [])
        .map((raw: RawOffer) => normalize(raw, endpoint))
        .filter((offer: Offer | null): offer is Offer => !!offer);
      const surveyCount = offers.filter((offer: Offer) => offer.type === "Survey").length;
      const visitCount = offers.filter((offer: Offer) => offer.type === "Visit & Earn").length;
      const appCount = offers.filter((offer: Offer) => offer.type === "App Download").length;
      const signUpCount = offers.filter((offer: Offer) => offer.type === "Sign Up").length;
      console.log(`[Offerwall.me] ${endpoint}: ${offers.length} usable cards (surveys=${surveyCount}, visit=${visitCount}, apps=${appCount}, signups=${signUpCount})`);
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
