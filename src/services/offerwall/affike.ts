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

/**
 * Affike's publisher click URL.
 *
 * IMPORTANT:
 * This is intentionally /track/click, NOT /api/track/click.
 */
function buildClickUrl(offerId: string, clickId: string): string {
  const params = new URLSearchParams({
    offer_id: offerId,
    click_id: clickId,
  });

  return `https://affike.com/track/click?${params.toString()}`;
}

function toOffer(raw: AffikeRawOffer): Offer {
  const points = Math.max(0, Math.round(raw.points || 0));
  const steps = raw.conversionEvents?.length;

  return {
    id: `affike-${raw.id}`,
    type: raw.category ? raw.category.toUpperCase() : "OFFER",
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
      const res = await fetch(buildOffersUrl(apiKey), {
        cache: "no-store",
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");

        console.error(
          `[Affike] offers request failed: ${res.status} ${body}`
        );

        return [];
      }

      const data: AffikeResponse = await res.json();

      return (data.offers || []).map(toOffer);
    } catch (error) {
      console.error("[Affike] failed to fetch offers:", error);
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

    const rawOfferId = offerId.replace(/^affike-/, "");

    if (!rawOfferId) {
      console.error("[Affike] Missing offer ID");
      return {};
    }

    /*
     * IMPORTANT:
     *
     * Do NOT call /api/track/click from our server.
     * Do NOT fall back to /api/track/click.
     *
     * Affike's publisher-facing tracking URL is /track/click.
     */
    const redirectUrl = buildClickUrl(rawOfferId, userId);

    console.log(
      `[Affike] starting offer: offer_id=${rawOfferId}, click_id=${userId}`
    );

    return {
      redirectUrl,
    };
  }

  async onOfferCompleted(): Promise<void> {
    // Affike completions are handled by the S2S postback webhook.
  }
}