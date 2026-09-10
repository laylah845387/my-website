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

function getAffId(): string | null {
  return process.env.AFFIKE_AFF_ID || null;
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

    const params = new URLSearchParams({
      aff_id: affId,
      offer_id: rawOfferId,
    });

    const clickUrl =
      `https://affike.com/api/track/click?${params.toString()}`;

    console.log(
      `[Affike] Returning tracking URL: offer=${rawOfferId}, user=${userId}`
    );

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