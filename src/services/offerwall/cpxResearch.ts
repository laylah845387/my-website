import crypto from "crypto";
import { Offer } from "@/types";
import { OfferwallProvider } from "./types";

/**
 * CPX Research Provider
 *
 * Real integration with CPX Research's public Surveys API.
 * Docs: https://www.cpx-research.com/main/en/doc.php
 *
 * Required environment variables:
 * - CPX_RESEARCH_APP_ID     (from your CPX Research publisher dashboard)
 * - CPX_RESEARCH_SECURE_HASH (also from the dashboard — used to sign requests)
 *
 * Note: the postback (webhook) side of this integration isn't built yet —
 * CPX Research's postback parameter names are only shown inside your
 * gated publisher dashboard under "Postback Settings", not in their
 * public docs. Once you have that, share it and the webhook can be added
 * the same way the BitcoTasks one was.
 * Note: we use the `href` field (direct single-survey link) rather than
 * `href_new` — CPX's docs recommend href_new as the "mobile optimized"
 * option, but it actually opens a broader searchable list of multiple
 * surveys on CPX's own site rather than the one specific survey the user
 * clicked. Since our cards each promise one specific survey and payout,
 * `href` is the correct match for that UX.
 */

interface CpxSurveyRaw {
  id: string;
  loi: string; // length of interview, in minutes
  payout: number; // payout to the user, in your configured currency
  conversion_rate: string;
  statistics_rating_avg?: string;
  type?: string; // "need_qualification" if extra profiling is required
  top?: number;
  payout_publisher_usd?: string;
  href?: string;
  href_new?: string;
}

interface CpxResponse {
  status: "success" | "error";
  count_available_surveys?: number;
  count_returned_surveys?: number;
  surveys?: CpxSurveyRaw[];
}

function getConfig() {
  const appId = process.env.CPX_RESEARCH_APP_ID;
  const secureHash = process.env.CPX_RESEARCH_SECURE_HASH;
  if (!appId || !secureHash) return null;
  return { appId, secureHash };
}

function buildUrl(appId: string, secureHash: string, userId: string, userIp: string): string {
  const hash = crypto.createHash("md5").update(`${userId}-${secureHash}`).digest("hex");
  const params = new URLSearchParams({
    app_id: appId,
    ext_user_id: userId,
    output_method: "api",
    ip_user: userIp,
    limit: "20",
    secure_hash: hash,
  });
  return `https://live-api.cpx-research.com/api/get-surveys.php?${params.toString()}`;
}

function toOffer(raw: CpxSurveyRaw): Offer {
  const points = Math.max(0, Math.round(raw.payout || 0));
  const minutes = raw.loi ? `${raw.loi} MIN` : "VARIES";

  return {
    id: `cpx-${raw.id}`,
    type: "Survey",
    duration: minutes,
    points,
    rating: raw.statistics_rating_avg ? Number(raw.statistics_rating_avg) : 5,
    title: `Survey #${raw.id}`,
    description:
      raw.type === "need_qualification"
        ? "A few quick profiling questions, then the full survey."
        : "Share your opinion and earn points.",
    provider: "cpx-research",
    // Use the direct single-survey link (not href_new, which opens a
    // broader multi-survey list page on CPX's site rather than this
    // specific survey — see the note at the top of this file).
    url: raw.href || raw.href_new,
  };
}

export class CpxResearchProvider implements OfferwallProvider {
  private isConfigured(): boolean {
    return getConfig() !== null;
  }

  async getOffers(userId: string, userIp: string = "0.0.0.0"): Promise<Offer[]> {
    const config = getConfig();
    if (!config) return [];

    try {
      const res = await fetch(buildUrl(config.appId, config.secureHash, userId, userIp), {
        cache: "no-store",
      });
      if (!res.ok) return [];

      const data: CpxResponse = await res.json();
      if (data.status !== "success") return [];

      return (data.surveys || []).map(toOffer);
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
    userIp: string = "0.0.0.0"
  ): Promise<{ redirectUrl?: string }> {
    const config = getConfig();
    if (!config) return { redirectUrl: undefined };

    // CPX survey links are user-specific and time-sensitive, so re-fetch
    // fresh rather than reusing a cached link from an earlier list call.
    const rawId = offerId.replace(/^cpx-/, "");

    try {
      const res = await fetch(buildUrl(config.appId, config.secureHash, userId, userIp), {
        cache: "no-store",
      });
      if (!res.ok) return { redirectUrl: undefined };

      const data: CpxResponse = await res.json();
      if (data.status !== "success") return { redirectUrl: undefined };

      const match = (data.surveys || []).find((s) => s.id === rawId);
      const link = match?.href || match?.href_new;
      return { redirectUrl: link };
    } catch {
      return { redirectUrl: undefined };
    }
  }

  // Real completions arrive via CPX Research's postback (S2S webhook),
  // not through this method — see the note at the top of this file.
  async onOfferCompleted(): Promise<void> {
    // Not yet implemented — pending exact postback parameter names.
  }
}
