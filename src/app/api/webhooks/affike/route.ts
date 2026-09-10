import { NextRequest, NextResponse } from "next/server";
import { adjustPoints, markAffikeTransaction } from "@/lib/user-data";

/**
 * Affike S2S Postback receiver.
 *
 * Affike's dashboard was redesigned since our first pass at this
 * integration: there is no longer a Secret Key anywhere in the UI
 * (checked Profile — not there either) and no `{signature}` macro is
 * offered on the Postbacks page. So unlike BitcoTasks/CPX, there's no
 * HMAC to verify here. Instead, this endpoint is protected by our own
 * shared secret embedded directly in the postback URL as a literal query
 * param (NOT one of Affike's `{macro}` tokens — just plain text only we
 * and Affike's server know) — see AFFIKE_POSTBACK_SECRET below.
 *
 * Available macros, per the Postbacks page's "Available macros" list:
 *   {click_id} {payout} {publisher_earned} {user_reward} {offer_id}
 *   {txn_id} {status} {currency}
 *
 * Paste this exact URL into Affike's dashboard → Postbacks → "Your
 * Postback (S2S) URL" field (swap in your real secret):
 *
 *   https://giveaway-hub-rewards.onrender.com/api/webhooks/affike?secret=YOUR_SECRET&click_id={click_id}&user_reward={user_reward}&txn_id={txn_id}&status={status}&offer_id={offer_id}
 *
 * Required env var: AFFIKE_POSTBACK_SECRET — any random string you
 * generate yourself, must exactly match the `secret=` value in the URL
 * above. This is the only thing standing between this endpoint and
 * anyone who guesses the URL, since Affike provides no signature here —
 * keep it out of any public repo or client-side code.
 *
 * We identify the user from `click_id` (Affike has no `{user_id}` macro
 * in this version) since it's the value *we* generate and pass to
 * /track/click as the userId — see `buildClickUrl` in
 * src/services/offerwall/affike.ts — and Affike echoes it back unchanged.
 *
 * We credit `user_reward`, not `payout` or `publisher_earned` — those
 * two look like your own affiliate revenue/earnings figures, whereas
 * `user_reward` reads as the one meant for the end user. Confirmed via a
 * real "Test Postback": it arrives as a plain USD amount ("1.00" for a
 * $1 test reward), NOT pre-converted points — unlike the Offers API's
 * `points` field, which Affike converts for you. So here we do the
 * conversion ourselves using AFFIKE_POINTS_PER_DOLLAR (see below).
 *
 * `status` values: confirmed via the same test — approved conversions
 * send the literal string "approved". Rejections/chargebacks aren't
 * confirmed yet; we treat anything containing
 * reject/declin/cancel/chargeback/revers/fraud (case-insensitive) as a
 * reversal of a previous credit, and credit everything else. Tighten
 * this to an exact allow-list once you've seen a real rejection.
 *
 * Env var: AFFIKE_POINTS_PER_DOLLAR — set this to match the
 * "pointsPerDollar" value shown in the `config` object returned
 * alongside your offers (e.g. 100). Defaults to 100 if unset.
 */

function looksLikeReversal(status: string): boolean {
  const s = status.toLowerCase();
  return ["reject", "declin", "cancel", "chargeback", "revers", "fraud"].some((kw) =>
    s.includes(kw)
  );
}

function dollarsToPoints(dollars: number): number {
  const rate = parseFloat(process.env.AFFIKE_POINTS_PER_DOLLAR || "100");
  return Math.max(0, Math.round(dollars * (isNaN(rate) ? 100 : rate)));
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const expectedSecret = process.env.AFFIKE_POSTBACK_SECRET;
  if (!expectedSecret) {
    // Misconfigured on our end — 500 so it's obvious in Affike's delivery
    // log rather than us silently dropping every postback.
    return new NextResponse("Postback not configured", { status: 500 });
  }

  const providedSecret = params.get("secret");
  if (!providedSecret || providedSecret !== expectedSecret) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const userId = params.get("click_id");
  const txnId = params.get("txn_id");
  const rewardRaw = params.get("user_reward");
  const status = params.get("status") || "approved";
  const offerId = params.get("offer_id");

  if (!userId || !txnId || !rewardRaw) {
    return new NextResponse("Missing parameters", { status: 400 });
  }

  const points = dollarsToPoints(parseFloat(rewardRaw) || 0);
  const isReversal = looksLikeReversal(status);

  const previous = await markAffikeTransaction(txnId, { userId, points, status });

  if (previous) {
    // We've seen this exact txn_id before.
    if (isReversal && !looksLikeReversal(previous.status)) {
      // It was credited before and is now being reversed — claw back
      // exactly what was originally given, not the (possibly different)
      // amount on this resend.
      await adjustPoints(previous.userId, -previous.points);
      return NextResponse.json({ status: "reversed", offerId, txnId });
    }
    // Otherwise this is just a duplicate resend of the same state.
    return new NextResponse("Duplicate transaction", { status: 409 });
  }

  if (isReversal) {
    // First time we've seen this txn_id, and it's already a reversal —
    // nothing was ever credited, so there's nothing to claw back.
    return NextResponse.json({ status: "ignored", offerId, txnId });
  }

  await adjustPoints(userId, points);
  return NextResponse.json({ status: "ok", offerId, txnId });
}
