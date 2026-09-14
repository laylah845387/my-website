import { Offer, OfferMilestone } from "@/types";
import { OfferwallProvider } from "./types";
import { getCountryForIp } from "@/lib/geo";

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
function getAllowedOfferIds(): Set<string> {
  const raw = process.env.AFFIKE_ACTIVATED_OFFER_IDS;
  if (!raw) return new Set();
  const ids = raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return new Set(ids);
}

// Fallback only for when a visitor's country genuinely can't be
// determined (lookup failure, local dev, etc.) — NOT the default path.
// Real filtering uses the visitor's actual detected country; when that's
// unknown, unrestricted offers still show, and this env var (if set)
// additionally allows region-restricted offers matching it too. Leave
// unset to just show unrestricted-only offers when detection fails.
function getFallbackCountry(): string | null {
  const raw = process.env.AFFIKE_TARGET_COUNTRY;
  return raw ? raw.toUpperCase() : null;
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
  const steps = raw.conversionEvents?.length;
  const milestones: OfferMilestone[] = (raw.conversionEvents || [])
    .map((event) => ({
      id: String(event.id),
      action: event.action,
      points: Math.max(0, Math.round(event.points || 0)),
    }))
    .sort((first, second) => first.points - second.points);
  const milestoneTotal = milestones.reduce((total, milestone) => total + milestone.points, 0);
  const points = milestones.length > 0
    ? milestoneTotal
    : Math.max(0, Math.round(raw.points || 0));

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
    userIp?: string
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
      const visitorCountry = await getCountryForIp(userIp);
      const effectiveCountry = visitorCountry || getFallbackCountry();
      console.log(
        `[Affike] userIp=${JSON.stringify(userIp)}, detected country=${JSON.stringify(
          visitorCountry
        )}, effective country used for filtering=${JSON.stringify(effectiveCountry)}`
      );

      const passesQuality = (offer: AffikeRawOffer) =>
        !!offer?.id &&
        !!offer?.name &&
        !(Number.isFinite(offer.points) && Number(offer.points) <= 0);

      const passesRegion = (offer: AffikeRawOffer) =>
        !offer.countries ||
        offer.countries.length === 0 ||
        (!!effectiveCountry && offer.countries.some((c) => c.toUpperCase() === effectiveCountry));

      const passesSingleStep = (offer: AffikeRawOffer) =>
        (offer.conversionEvents?.length ?? 1) <= 1;

      const allowlisted = (data.offers || []).filter(
        (o) => passesQuality(o) && allowedIds.has(String(o.id))
      );
      const inRegion = allowlisted.filter(passesRegion);
      const finalOffers = inRegion.filter(passesSingleStep);

      if (allowedIds.size === 0) {
        console.warn(
          "[Affike] AFFIKE_ACTIVATED_OFFER_IDS is empty — showing zero Affike offers until you add activated offer IDs."
        );
      } else {
        // Diagnose every configured ID that didn't make it into the
        // final list, in pipeline order, instead of silently dropping
        // it — distinguishes "not in today's catalog at all" from
        // "present but filtered out" and exactly which stage did it
        // (quality check / wrong region / too many steps), so this
        // doesn't need another guessing round next time an ID goes
        // missing.
        const finalIds = new Set(finalOffers.map((o) => String(o.id)));
        for (const id of allowedIds) {
          if (finalIds.has(id)) continue;

          const rawMatch = (data.offers || []).find((o) => String(o?.id) === id);
          if (!rawMatch) {
            console.warn(
              `[Affike] Configured offer ID ${id} is not present in today's /api/offerwall/offers catalog at all — it may have expired or been rotated out on Affike's side.`
            );
            continue;
          }

          if (!passesQuality(rawMatch)) {
            console.warn(
              `[Affike] Configured offer ID ${id} was filtered out — name=${JSON.stringify(
                rawMatch.name
              )}, points=${JSON.stringify(rawMatch.points)}.`
            );
            continue;
          }

          // Region mismatches aren't logged here on purpose — they're
          // expected, per-visitor, and don't mean the offer ID itself is
          // bad (it may work fine for visitors from a supported
          // country), so they'd just be noise next to the genuine
          // failure reasons below.
          if (!passesRegion(rawMatch)) {
            continue;
          }

          if (!passesSingleStep(rawMatch)) {
            const steps = rawMatch.conversionEvents?.length ?? 1;
            console.warn(
              `[Affike] Configured offer ID ${id} ("${rawMatch.name}") has ${steps} steps — skipping since individual steps can't be tracked. Remove it from AFFIKE_ACTIVATED_OFFER_IDS.`
            );
          }
        }
      }

      return finalOffers.map(toOffer);
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