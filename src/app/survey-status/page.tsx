import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { verifySessionCookie } from "@/lib/session";
import SurveyStatusFrame from "@/components/SurveyStatusFrame";

/**
 * CPX Research "Message ID System" landing page.
 *
 * CPX redirects here after a survey attempt finishes (completed, failed,
 * OR the user doesn't qualify for anything) with a `message_id` query
 * param. Per CPX's docs, the only reliable way to actually receive and
 * display that outcome — instead of the user sometimes ending up back on
 * CPX's own offerwall — is to embed their wall here with that message_id
 * attached. The user's browser never leaves our domain; this page just
 * briefly shows CPX's own result message inside a small embedded frame,
 * then sends them on to /earn.
 */
export default async function SurveyStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ message_id?: string }>;
}) {
  const { message_id: messageId } = await searchParams;

  const cookieStore = await cookies();
  const user = verifySessionCookie(cookieStore.get("session")?.value);

  // Not signed in (shouldn't normally happen here) — nothing to show, just
  // send them home.
  if (!user) {
    redirect("/earn");
  }

  const appId = process.env.CPX_RESEARCH_APP_ID;
  const secret = process.env.CPX_RESEARCH_SECURE_HASH;

  // If CPX isn't configured for some reason, don't get stuck — just
  // continue to the Earn page.
  if (!appId || !secret || !messageId) {
    redirect("/earn");
  }

  // Same hash formula CPX uses for the get-surveys API: md5(ext_user_id-secret).
  // Computed server-side so the raw secret never reaches the browser —
  // only this one-way hash does.
  const secureHash = crypto
    .createHash("md5")
    .update(`${user.id}-${secret}`)
    .digest("hex");

  return (
    <SurveyStatusFrame
      appId={appId}
      extUserId={user.id}
      secureHash={secureHash}
      messageId={messageId}
    />
  );
}
