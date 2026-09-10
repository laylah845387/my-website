import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { adjustPoints, markAffikeTransaction } from "@/lib/user-data";

function verifySignature(
  userId: string,
  payout: string,
  transactionId: string,
  signature: string,
  secret: string
): boolean {
  const stringToSign = userId + payout + transactionId;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(stringToSign)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

function dollarsToPoints(dollars: number): number {
  const rate = parseFloat(
    process.env.AFFIKE_POINTS_PER_DOLLAR || "100"
  );

  return Math.max(
    0,
    Math.round(dollars * (Number.isFinite(rate) ? rate : 100))
  );
}

function isReversal(status: string): boolean {
  const value = status.toLowerCase();

  return [
    "reject",
    "declin",
    "cancel",
    "chargeback",
    "revers",
    "fraud",
  ].some((keyword) => value.includes(keyword));
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const secret = process.env.AFFIKE_SECRET_KEY;

  if (!secret) {
    console.error("[Affike] AFFIKE_SECRET_KEY is not configured");

    return new NextResponse(
      "Affike webhook is not configured",
      { status: 500 }
    );
  }

  const userId = params.get("user_id");
  const clickId = params.get("publisher_click_id");
  const payoutRaw = params.get("payout");
  const offerId = params.get("offer_id");
  const transactionId = params.get("transaction_id");
  const signature = params.get("signature");
  const status = params.get("status") || "approved";

  if (
    !userId ||
    !transactionId ||
    !payoutRaw ||
    !signature
  ) {
    return new NextResponse(
      "Missing required parameters",
      { status: 400 }
    );
  }

  const payout = parseFloat(payoutRaw);

  if (!Number.isFinite(payout) || payout < 0) {
    return new NextResponse(
      "Invalid payout",
      { status: 400 }
    );
  }

  const validSignature = verifySignature(
    userId,
    payoutRaw,
    transactionId,
    signature,
    secret
  );

  if (!validSignature) {
    console.warn(
      `[Affike] Invalid signature for transaction ${transactionId}`
    );

    return new NextResponse(
      "Invalid signature",
      { status: 401 }
    );
  }

  const points = dollarsToPoints(payout);
  const reversal = isReversal(status);

  const previous = await markAffikeTransaction(
    transactionId,
    {
      userId,
      points,
      status,
    }
  );

  /*
   * Duplicate transaction.
   */
  if (previous) {
    /*
     * Approved -> reversal/chargeback.
     */
    if (
      reversal &&
      !isReversal(previous.status)
    ) {
      await adjustPoints(
        previous.userId,
        -previous.points
      );

      return NextResponse.json({
        status: "reversed",
        transactionId,
        offerId,
        clickId,
      });
    }

    return new NextResponse(
      "Duplicate transaction",
      { status: 409 }
    );
  }

  /*
   * A reversal that we have never seen before
   * should not create negative points.
   */
  if (reversal) {
    return NextResponse.json({
      status: "ignored",
      transactionId,
      offerId,
    });
  }

  /*
   * Credit the user.
   */
  await adjustPoints(userId, points);

  return NextResponse.json({
    status: "credited",
    userId,
    transactionId,
    offerId,
    points,
  });
}