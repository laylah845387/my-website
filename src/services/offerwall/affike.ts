import { Offer } from "@/types";
import { OfferwallProvider } from "./types";

/**
 * AffikeProvider
 *
 * Real integration with Affike's Offers API.
 * Docs: https://affike.com/docs
 *
 * Required environment variables:
 * - AFFIKE_API_KEY         (from your Affike Publisher Dashboard)
 * - AFFIKE_POSTBACK_SECRET (used separately, only by the postback webhook
 *                           at src/app/api/webhooks/affike/route.ts —
 *                           see that file for why this replaced the
 *                           HMAC-signature approach the other providers
 *                           use: Affike's current dashboard has no
 *                           Secret Key or {signature} macro at all)
 *
 * Notes on the API shape (confirmed by hitting the live endpoint):
 * - GET https://affike.com/api/offerwall/offers?api_key=API_KEY returns
 *   `{ offers: [...], config: {...} }`. The docs page's fetch snippet uses
 *   `apiKey` as the query param name, but the key that Affike's servers
 *   actually accept is `api_key` — that's what's used below.
 * - Unlike BitcoTasks/CPX, this endpoint is NOT personalized by user or
 *   IP — it's just the publisher's whole live catalog for the placement.
 *   There's also no per-offer tracking link in the response (no `link`/
 *   `trk_url` field), so the personalized/trackable link has to be built
 *   ourselves from the documented click-tracking endpoint instead (see
 *   `buildClickUrl` below).
 * - `points` on each offer is already the *total* points across every
 *   conversionEvent (i.e. the full multi-step payout), pre-converted from
 *   USD using the `pointsPerDollar` rate configured in the Affike
 *   dashboard (see `config.pointsPerDollar` in the raw response) — so it
 *   can be used directly with no extra math, same as the other providers.
 */

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
  const apiKey = process.env.AFFIKE_API_KEY;
  return apiKey ? apiKey : null;
}

function buildOffersUrl(apiKey: string): string {
  const params = new URLSearchParams({ api_key: apiKey });
  return `https://affike.com/api/offerwall/offers?${params.toString()}`;
}

// Affike's Offers API has no per-offer tracking link, so we build one
// ourselves from their documented click-tracking endpoint. `click_id` is
// ours to choose and gets echoed straight back on the postback as
// `{publisher_click_id}` (see the webhook), so we set it to the userId —
// that's how the webhook knows who to credit, the same way BitcoTasks
// uses `subId` and CPX uses `ext_user_id`.
function buildClickUrl(offerId: string, userId: string): string {
  const params = new URLSearchParams({
    offer_id: offerId,
    click_id: userId,
  });
  // NOTE: the prose example on Affike's docs page shows
  // "affike.com/track/click" (no /api/ prefix), but their own API
  // reference table lists the real endpoint as "GET /api/track/click" —
  // matching every other endpoint's /api/ prefix. The prose version 404s.
  return `https://affike.com/api/track/click?${params.toString()}`;
}

// Calling /api/track/click straight from the visitor's browser (a plain
// <a href>) kept returning {"error":"Missing required parameters"} even
// with offer_id + click_id both present, and even with api_key added or
// removed as a query param. Affike's docs say "All endpoints use your
// publisher credentials" — which a plain browser link can never satisfy,
// since a redirect link can't carry an Authorization header. So instead
// we register the click from OUR server (where we can send the API key
// as a header the same way BitcoTasks' provider already does) and hand
// the user's browser the *resulting* destination URL — the offer's real
// landing page — instead of Affike's click-tracking URL directly.
//
// If this still comes back with the same error, the problem isn't
// missing auth — check Render's logs for the exact status/body this
// logs, which tells us far more than the browser's bare JSON ever will.
async function registerClick(
  apiKey: string,
  offerId: string,
  userId: string
): Promise<string | null> {
  const url = buildClickUrl(offerId, userId);

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-API-Key": apiKey,
      },
      redirect: "manual",
      cache: "no-store",
    });

    // A successful click is documented to return a 302 redirect to the
    // advertiser's real destination.
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get("location");
      if (location) return location;
    }

    const bodyText = await res.text().catch(() => "");

    // Some integrations return the destination as JSON instead of a
    // redirect — check for that shape too before giving up.
    try {
      const data = JSON.parse(bodyText);
      const destination =
        data?.redirect_url || data?.url || data?.destination || data?.click_url;
      if (destination) return destination;
    } catch {
      // Not JSON — fall through to logging below.
    }

    console.error(
      `[Affike] click registration failed — status ${res.status}, offer_id=${offerId}, click_id=${userId}, body=${bodyText}`
    );
    return null;
  } catch (err) {
    console.error("[Affike] click registration threw:", err);
    return null;
  }
}

function toOffer(raw: AffikeRawOffer): Offer {
  const points = Math.max(0, Math.round(raw.points || 0));
  const steps = raw.conversionEvents?.length;

  return {
    id: `affike-${raw.id}`,
    type: raw.category ? raw.category.toUpperCase() : "OFFER",
    duration: steps ? `${steps} STEP${steps > 1 ? "S" : ""}` : "VARIES",
    points,
    rating: raw.popularity ? Math.min(5, Math.max(1, Math.round(raw.popularity / 2))) : 5,
    title: raw.name,
    description: raw.description || "",
    provider: "affike",
  };
}

export class AffikeProvider implements OfferwallProvider {
  private isConfigured(): boolean {
    return getApiKey() !== null;
  }

  async getOffers(_userId?: string, _userIp?: string): Promise<Offer[]> {
    if (!this.isConfigured()) return [];

    const apiKey = getApiKey();
    if (!apiKey) return [];

    try {
      const res = await fetch(buildOffersUrl(apiKey), { cache: "no-store" });
      if (!res.ok) return [];

      const data: AffikeResponse = await res.json();
      return (data.offers || []).map(toOffer);
    } catch {
      return [];
    }
  }

  async getUserProgress(userId: string) {
    return { userId, completedOffers: [], totalPointsEarned: 0 };
  }

  async startOffer(
    userId: string,
    offerId: string,
    _userIp?: string
  ): Promise<{ redirectUrl?: string }> {
    const apiKey = getApiKey();
    if (!apiKey) return { redirectUrl: undefined };

    const rawId = offerId.replace(/^affike-/, "");
    const destination = await registerClick(apiKey, rawId, userId);

    // Fall back to sending the browser straight to Affike's click URL if
    // server-side registration didn't yield anything — matches the
    // previous (broken) behavior rather than a dead end, and if the
    // real fix is something other than auth headers, this keeps the
    // click_id at least still getting sent.
    return { redirectUrl: destination ?? buildClickUrl(rawId, userId) };
  }

  // Real completions arrive asynchronously via the S2S postback webhook
  // (src/app/api/webhooks/affike/route.ts) once Affike verifies the
  // conversion — not through this method.
  async onOfferCompleted(): Promise<void> {
    // Intentionally unused for Affike.
  }
}
