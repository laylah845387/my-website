import { Offer, OfferMilestone } from "@/types";
import { OfferwallProvider } from "./types";

interface AffikeConversionEvent {
  id: string;
  action: string;
  points: number;
}

interface AffikeRawOffer {
  id: number;
  name: string;
  description?: string;
  image?: string | null;
  category?: string;
  payoutAmount?: string;
  countries?: string[];
  devices?: string[];
  epc?: string;
  popularity?: number;
  conversionEvents?: AffikeConversionEvent[];
  points: number;
}

interface AffikeConfig {
  name?: string;
  pointsPerDollar?: number;
  currencyName?: string;
  country?: string;
}

interface AffikeResponse {
  offers: AffikeRawOffer[];
  config?: AffikeConfig;
}

function getApiKey(): string | null {
  return process.env.AFFIKE_API_KEY || null;
}

function getAffId(): string | null {
  return process.env.AFFIKE_AFF_ID || null;
}

// Affike's /api/offerwall/offers catalog lists ~1500 offers marketplace-
// wide, but a given offer_id only actually works with /api/track/click
// once it's been "activated" once through Affike's own dashboard (open
// its "Your Tracking Link" modal / test the link there — confirmed by
// testing: an offer_id fails with {"error":"Invalid tracking link"}
// until visited once via Affike's own UI, and works from our site every
// time after that). So instead of showing the full catalog and letting
// most offers dead-end for real users, we only show offers whose ID is
// in this allowlist.
//
// To add an offer: open it in Affike's dashboard, view/test its
// tracking link once (this activates it), then add its numeric ID here
// (comma-separated in the env var, e.g. "1225,1327,1340").
function getAllowedOfferIds(): Set<string> | null {
  const raw = process.env.AFFIKE_ACTIVATED_OFFER_IDS;
  if (!raw) return null;
  const ids = raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return ids.length ? new Set(ids) : null;
}

function buildOffersUrl(apiKey: string): string {
  const params = new URLSearchParams({
    api_key: apiKey,
  });

  return `https://affike.com/api/offerwall/offers?${params.toString()}`;
}

function normalizeAffikeType(category?: string): string {
  const raw = (category || "").toLowerCase();

  if (!raw) return "Offer";
  if (/(app|download|install|game|mobile)/.test(raw)) return "App Download";
  if (/(subscription|trial|renew|membership)/.test(raw)) return "Subscription";
  if (/(signup|sign up|register|account)/.test(raw)) return "Sign Up";
  if (/(survey|questionnaire)/.test(raw)) return "Survey";
  if (/(freebie|cashback|reward)/.test(raw)) return "Reward";
  if (/(lead|web|visit|landing)/.test(raw)) return "Lead";

  return raw
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Offer";
}

function toOffer(raw: AffikeRawOffer): Offer {
  const points = Math.max(0, Math.round(raw.points || 0));
  const steps = raw.conversionEvents?.length;
  const milestones: OfferMilestone[] = (raw.conversionEvents || []).map((event) => ({
    id: String(event.id),
    action: event.action,
    points: Math.max(0, Math.round(event.points || 0)),
  }));

  return {
    id: `affike-${raw.id}`,
    type: normalizeAffikeType(raw.category),
    duration: steps
      ? `${steps} STEP${steps > 1 ? "S" : ""}`
      : "VARIES",
    points,
    rating: raw.popularity
      ? Math.min(5, Math.max(1, Math.round(raw.popularity / 2)))
      : 5,
    title: raw.name,
    description: raw.description || "",
    provider: "affike",
    milestones,
  };
}

export class AffikeProvider implements OfferwallProvider {
  private isConfigured(): boolean {
    return (
      getApiKey() !== null &&
      getAffId() !== null
    );
  }

  async getOffers(
    _userId?: string,
    _userIp?: string
  ): Promise<Offer[]> {
    const apiKey = getApiKey();

    if (!apiKey) {
      console.error(
        "[Affike] AFFIKE_API_KEY is missing"
      );

      return [];
    }

    try {
      const res = await fetch(
        buildOffersUrl(apiKey),
        {
          cache: "no-store",
        }
      );

      if (!res.ok) {
        const body = await res.text().catch(() => "");

        console.error(
          `[Affike] Offers API failed: ${res.status} ${body}`
        );

        return [];
      }

      const data: AffikeResponse = await res.json();

      const allowedIds = getAllowedOfferIds();
      const rawOffers = (data.offers || []).filter((offer) => {
        if (!offer?.id || !offer?.name) return false;
        if (Number.isFinite(offer.points) && Number(offer.points) <= 0) return false;
        return true;
      });
      const filtered = allowedIds
        ? rawOffers.filter((o) => allowedIds.has(String(o.id)))
        : rawOffers;

      if (!allowedIds) {
        console.warn(
          "[Affike] AFFIKE_ACTIVATED_OFFER_IDS is not set — showing zero Affike offers until you set it, since most offer IDs in the catalog aren't activated for click tracking yet. See the comment on getAllowedOfferIds() in this file."
        );
      }

      return filtered.map(toOffer);
    } catch (error) {
      console.error(
        "[Affike] Failed to fetch offers:",
        error
      );

      return [];
    }
  }

  async getUserProgress(userId: string) {
    return {
      userId,
      completedOffers: [],
      totalPointsEarned: 0,
    };
  }

  async startOffer(
    userId: string,
    offerId: string,
    _userIp?: string
  ): Promise<{ redirectUrl?: string }> {
    const affId = getAffId();

    if (!affId) {
      console.error(
        "[Affike] AFFIKE_AFF_ID is missing"
      );

      return {};
    }

    if (!userId) {
      console.error(
        "[Affike] Missing user ID"
      );

      return {};
    }

    const rawOfferId = offerId.replace(
      /^affike-/,
      ""
    );

    if (!rawOfferId) {
      console.error(
        "[Affike] Missing offer ID"
      );

      return {};
    }

    // sub2 is the confirmed real param name for a custom Sub ID, tested
    // directly against the dashboard's own tracking-link generator (the
    // UI just labels it "Sub ID 2" — the actual query param is `sub2`).
    // We use it to carry our own userId through the click, so the
    // postback can tell us who to credit. Whether it comes back as
    // {click_id} or as its own {sub2} macro on the postback isn't
    // confirmed yet — see the note in the webhook file.
    const params = new URLSearchParams({
      aff_id: affId,
      offer_id: rawOfferId,
      sub2: userId,
    });

    const clickUrl =
      `https://affike.com/api/track/click?${params.toString()}`;

    console.log(`[Affike] Generated click URL: ${clickUrl}`);

    // Return the Affike tracking URL directly.
    // The user's browser will open it and Affike will handle
    // the redirect to the advertiser.
    return {
      redirectUrl: clickUrl,
    };
  }

  async onOfferCompleted(): Promise<void> {
    // Affike conversions are handled
    // by the S2S postback webhook.
  }
}