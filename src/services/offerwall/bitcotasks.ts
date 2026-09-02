import { Offer, UserProgress } from "@/types";
import { offers as mockOffers } from "@/data/offers";
import { OfferwallProvider } from "./types";

/**
 * BitcotasksProvider
 *
 * Real integration with BitcoTasks' Offer API and Survey API.
 * Falls back to demo mock data if credentials aren't configured, or if
 * BitcoTasks returns no live offers yet (e.g. the app is still pending
 * approval) — so the Earn page is never empty while waiting.
 *
 * Required environment variables:
 * - BITCOTASKS_API_KEY
 * - BITCOTASKS_BEARER_TOKEN
 * (BITCOTASKS_SECRET_KEY is used separately, only by the postback
 * webhook at src/app/api/webhooks/bitcotasks/route.ts)
 */

interface BitcotasksGoal {
  name: string;
  description?: string;
  virtual_currency_value: number;
}

interface BitcotasksRawItem {
  id: string;
  title: string;
  description?: string;
  requirements?: string;
  image?: string;
  reward: string;
  reward_name?: string;
  link?: string;
  goals?: BitcotasksGoal[];
  cpa_type?: string;
}

interface BitcotasksResponse {
  status: string | number;
  message?: string;
  data: BitcotasksRawItem[];
}

// Both endpoints share the same request/response shape — just different
// paths and a category label we attach ourselves for the UI badge.
const ENDPOINTS: { path: string; category: string }[] = [
  { path: "survey-api.php", category: "Survey" },
  { path: "offer-api.php", category: "Offer" },
];

function buildUrl(path: string, apiKey: string, userId: string, userIp: string): string {
  const params = new URLSearchParams({ key: apiKey, sub_id: userId, ip: userIp });
  return `https://bitcotasks.com/${path}?${params.toString()}`;
}

function toOffer(raw: BitcotasksRawItem, category: string): Offer {
  // BitcoTasks converts the underlying USD payout into our own configured
  // currency (Points) before sending it to us, using the exchange rate we
  // set in our app settings — so `reward` here is already in points.
  const points = Math.max(0, Math.round(parseFloat(raw.reward) || 0));
  const steps = raw.goals?.length;

  return {
    id: raw.id,
    type: category,
    duration: steps ? `${steps} STEP${steps > 1 ? "S" : ""}` : "VARIES",
    points,
    rating: 5,
    title: raw.title,
    description: raw.description || raw.requirements || "",
    provider: "bitcotasks",
    url: raw.link,
  };
}

export class BitcotasksProvider implements OfferwallProvider {
  private apiKey: string;
  private bearerToken: string;

  constructor() {
    this.apiKey = process.env.BITCOTASKS_API_KEY || "";
    this.bearerToken = process.env.BITCOTASKS_BEARER_TOKEN || "";
  }

  private isConfigured(): boolean {
    return Boolean(this.apiKey && this.bearerToken);
  }

  async getOffers(userId: string, userIp: string = "0.0.0.0"): Promise<Offer[]> {
    if (!this.isConfigured()) {
      return mockOffers;
    }

    const results = await Promise.all(
      ENDPOINTS.map(async ({ path, category }) => {
        try {
          const res = await fetch(buildUrl(path, this.apiKey, userId, userIp), {
            headers: { Authorization: `Bearer ${this.bearerToken}` },
            cache: "no-store",
          });

          if (!res.ok) return [];

          const data: BitcotasksResponse = await res.json();
          if (String(data.status) !== "200") return [];

          return (data.data || []).map((raw) => toOffer(raw, category));
        } catch {
          return [];
        }
      })
    );

    const combined = results.flat();

    // While pending BitcoTasks' approval (or if the API hiccups), don't
    // leave the page empty — show demo offers instead.
    return combined.length > 0 ? combined : mockOffers;
  }

  async getUserProgress(userId: string): Promise<UserProgress> {
    return {
      userId,
      completedOffers: [],
      totalPointsEarned: 0,
    };
  }

  async startOffer(
    userId: string,
    offerId: string,
    userIp: string = "0.0.0.0"
  ): Promise<{ redirectUrl?: string }> {
    if (!this.isConfigured()) {
      return { redirectUrl: undefined };
    }

    // Re-fetch live data and find this offer's real tracking link —
    // BitcoTasks embeds the sub_id into the link server-side per request,
    // so it can't be cached from the earlier list fetch.
    for (const { path } of ENDPOINTS) {
      try {
        const res = await fetch(buildUrl(path, this.apiKey, userId, userIp), {
          headers: { Authorization: `Bearer ${this.bearerToken}` },
          cache: "no-store",
        });
        if (!res.ok) continue;

        const data: BitcotasksResponse = await res.json();
        if (String(data.status) !== "200") continue;

        const match = (data.data || []).find((raw) => raw.id === offerId);
        if (match?.link) {
          return { redirectUrl: match.link };
        }
      } catch {
        continue;
      }
    }

    return { redirectUrl: undefined };
  }

  // Real completions arrive asynchronously via the S2S postback webhook
  // (src/app/api/webhooks/bitcotasks/route.ts) once BitcoTasks verifies
  // the task — not through this method.
  async onOfferCompleted(): Promise<void> {
    // Intentionally unused for BitcoTasks.
  }
}
