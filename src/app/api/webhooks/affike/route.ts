import { NextRequest, NextResponse } from "next/server";
import { adjustPoints, markAffikeTransaction, markOfferComplete } from "@/lib/user-data";

/**
 * Affike S2S Postback receiver.
 *
 * IMPORTANT — do not "fix" this back to HMAC-signature verification.
 * Affike's current (redesigned) dashboard has NO Secret Key anywhere in
 * the UI and NO {signature} macro on the Postbacks page — confirmed by
 * checking Profile and the Postbacks page directly. The only real
 * available macros are:
 *   {click_id} {payout} {publisher_earned} {user_reward} {offer_id}
 *   {txn_id} {status} {currency}
 * There is no {user_id} or {signature} macro. A prior pass at this file
 * (via ChatGPT) reverted it to a signature-based version copied from
 * Affike's stale docs page — that version will always 500, since
 * AFFIKE_SECRET_KEY doesn't exist to configure.
 *
 * Instead, this endpoint is protected by our own shared secret embedded
 * directly in the postback URL as a literal query param (NOT one of
 * Affike's `{macro}` tokens) — see AFFIKE_POSTBACK_SECRET below.
 *
 * Paste this exact URL into Affike's dashboard → Postbacks → "Your
 * Postback (S2S) URL" field (swap in your real secret):
 *
 *   https://giveaway-hub-rewards.onrender.com/api/webhooks/affike?secret=YOUR_SECRET&click_id={click_id}&user_reward={user_reward}&txn_id={txn_id}&status={status}&offer_id={offer_id}
 *
 * Required env vars:
 * - AFFIKE_POSTBACK_SECRET — any random string you generate yourself,
 *   must exactly match the `secret=` value in the URL above.
 * - AFFIKE_POINTS_PER_DOLLAR — set to match the "pointsPerDollar" value
 *   from your account's config (confirmed 100 previously). Defaults to
 *   100 if unset.
 *
 * Confirmed via a real "Test Postback": `user_reward` arrives as a plain
 * USD amount (e.g. "1.00"), NOT pre-converted points, so we convert it
 * ourselves. `status` arrives as the literal string "approved" for a
 * successful conversion; rejections/chargebacks aren't confirmed yet, so
 * we treat anything containing reject/declin/cancel/chargeback/
 * revers/fraud (case-insensitive) as a reversal and credit everything
 * else.
 *
 * We identify the user from `click_id`. As of the aff_id-based tracking
 * link switch, confirm this is still how the user gets identified — if
 * the new tracking links don't carry a per-user sub ID, `click_id` on
 * the postback may come back empty or be Affike's own internal click
 * identifier rather than something we control. This needs to be
 * verified against a real Sub ID test before relying on it in
 * production — see the note in affike.ts's startOffer.
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
    return new NextResponse("Postback not configured", { status: 500 });
  }

  const providedSecret = params.get("secret");
  if (!providedSecret || providedSecret !== expectedSecret) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // We don't yet know for certain whether Affike echoes our sub2 value
  // back as {click_id} or as its own {sub2} macro on the postback —
  // check "Available macros" on the Postbacks page again now that a
  // real click has gone through with sub2 set, and add &sub2={sub2} to
  // the postback URL too if that macro exists. Reading both here so
  // whichever one actually carries it still works.
  const userId = params.get("click_id") || params.get("sub2");
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
    if (isReversal && !looksLikeReversal(previous.status)) {
      await adjustPoints(previous.userId, -previous.points);
      return NextResponse.json({ status: "reversed", offerId, txnId });
    }
    return new NextResponse("Duplicate transaction", { status: 409 });
  }

  if (isReversal) {
    return NextResponse.json({ status: "ignored", offerId, txnId });
  }

  await adjustPoints(userId, points);
  if (offerId) {
    await markOfferComplete(userId, `affike-${offerId}`, 0);
  }
  return NextResponse.json({ status: "ok", offerId, txnId });
}
