import { Offer } from "@/types";
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

  // Keep these in case Affike adds/returns a tracking URL.
  url?: string;
  link?: string;
  click_url?: string;
  tracking_url?: string;
  redirect_url?: string;
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

function buildOffersUrl(apiKey: string): string {
  const params = new URLSearchParams({
    api_key: apiKey,
  });

  return `https://affike.com/api/offerwall/offers?${params.toString()}`;
}

function toOffer(raw: AffikeRawOffer): Offer {
  const points = Math.max(0, Math.round(raw.points || 0));
  const steps = raw.conversionEvents?.length;

  return {
    id: `affike-${raw.id}`,
    type: raw.category
      ? raw.category.toUpperCase()
      : "OFFER",
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

    // If Affike ever returns a direct URL, preserve it.
    url:
      raw.url ||
      raw.link ||
      raw.click_url ||
      raw.tracking_url ||
      raw.redirect_url,
  };
}

export class AffikeProvider implements OfferwallProvider {
  private isConfigured(): boolean {
    return getApiKey() !== null;
  }

  async getOffers(
    _userId?: string,
    _userIp?: string
  ): Promise<Offer[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const apiKey = getApiKey();

    if (!apiKey) {
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

      return (data.offers || []).map(toOffer);
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
    if (!userId) {
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

    /*
     * IMPORTANT:
     *
     * Do NOT send the browser to:
     *
     *   /api/track/click
     *
     * We confirmed that endpoint is not the
     * individual-offer redirect mechanism for
     * the Affike account you're using.
     *
     * Your Affike account provides the official
     * Offerwall iframe instead.
     *
     * Since the Offers API does not return an
     * individual tracking URL, we cannot safely
     * manufacture one here.
     */

    console.warn(
      `[Affike] No direct tracking URL available for offer ${rawOfferId}`
    );

    return {};
  }

  async onOfferCompleted(): Promise<void> {
    // Affike conversions are delivered through
    // the S2S postback webhook.
  }
}