import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { adjustPoints, markCpxTransactionStatus } from "@/lib/user-data";

/**
 * CPX Research Postback receiver.
 *
 * Configured in CPX Research's dashboard under "Postback Settings" as:
 *
 * https://giveaway-hub-rewards.onrender.com/api/webhooks/cpx-research
 *   ?status={status}&trans_id={trans_id}&user_id={user_id}
 *   &amount_local={amount_local}&amount_usd={amount_usd}
 *   &offer_id={offer_ID}&hash={secure_hash}&ip_click={ip_click}&type={type}
 *
 * status: "1" = completed, "2" = canceled/fraud (CPX may call the SAME
 * trans_id again later with status "2" to reverse an earlier "1" —
 * this is not a duplicate, it's a real state change we need to detect
 * and act on, unlike a true resend of the same status.
 *
 * hash: md5(`${trans_id}-${CPX_RESEARCH_SECURE_HASH}`)
 *
 * Required env var: CPX_RESEARCH_SECURE_HASH (same value used for the
 * Offers API — from your CPX Research publisher dashboard)
 */

function md5(input: string): string {
  return crypto.createHash("md5").update(input).digest("hex");
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const secret = process.env.CPX_RESEARCH_SECURE_HASH;
  if (!secret) {
    return new NextResponse("ERROR: Postback not configured", { status: 200 });
  }

  const status = params.get("status");
  const transId = params.get("trans_id");
  const userId = params.get("user_id");
  const amountLocal = params.get("amount_local");
  const hash = params.get("hash");

  if (!status || !transId || !userId || !amountLocal || !hash) {
    return new NextResponse("ERROR: Missing parameters", { status: 200 });
  }

  const expectedHash = md5(`${transId}-${secret}`);
  if (expectedHash !== hash) {
    return new NextResponse("ERROR: Signature doesn't match", { status: 200 });
  }

  const previousStatus = await markCpxTransactionStatus(transId, status);
  const amount = Math.round(parseFloat(amountLocal)) || 0;

  if (previousStatus === status) {
    // Exact resend of a state we've already processed — acknowledge
    // without crediting/reversing again.
  } else if (status === "1" && previousStatus === null) {
    // First time seeing this transaction, and it's a genuine completion.
    await adjustPoints(userId, amount);
  } else if (status === "2" && previousStatus === "1") {
    // A previously-credited transaction is now being reversed.
    await adjustPoints(userId, -amount);
  }
  // Any other transition (e.g. a "2" with no prior "1") is left alone —
  // we never want to deduct points that were never actually credited.

  return new NextResponse("OK", { status: 200 });
}

// CPX Research's postback is documented as a simple URL call, but accept
// POST too in case it's ever sent that way.
export async function POST(request: NextRequest) {
  return GET(request);
}
