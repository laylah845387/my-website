"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface SurveyStatusFrameProps {
  appId: string;
  extUserId: string;
  secureHash: string;
  messageId: string;
}

const CPX_RETURN_OFFER_KEY = "cpx-return-offer-id";
const CPX_DISMISSED_OFFER_EVENT = "cpx-dismissed-offer-id";
const CPX_STARTED_OFFERS_KEY = "cpx-started-offer-ids";

export default function SurveyStatusFrame({
  appId,
  extUserId,
  secureHash,
  messageId,
}: SurveyStatusFrameProps) {
  const router = useRouter();
  const frameUrl =
    `https://wall.cpx-research.com/index.php?app_id=${encodeURIComponent(appId)}` +
    `&ext_user_id=${encodeURIComponent(extUserId)}` +
    `&secure_hash=${encodeURIComponent(secureHash)}` +
    `&subid_1=&subid_2=` +
    `&message_id=${encodeURIComponent(messageId)}`;

  useEffect(() => {
    const offerId = window.localStorage.getItem(CPX_RETURN_OFFER_KEY);
    if (!offerId) return;

    window.localStorage.removeItem(CPX_RETURN_OFFER_KEY);
    try {
      const stored = window.localStorage.getItem(CPX_STARTED_OFFERS_KEY);
      const startedOffers = stored ? JSON.parse(stored) : [];
      if (Array.isArray(startedOffers)) {
        window.localStorage.setItem(
          CPX_STARTED_OFFERS_KEY,
          JSON.stringify(
            startedOffers.filter((startedOffer) => (
              typeof startedOffer === "string"
                ? startedOffer !== offerId
                : startedOffer?.id !== offerId
            ))
          )
        );
      }
    } catch {
      // Ignore malformed browser state and let the server-side dismissal stand.
    }
    window.localStorage.setItem(CPX_DISMISSED_OFFER_EVENT, offerId);
    void fetch("/api/offers/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offerId }),
    });
  }, []);

  return (
    <div
      style={{
        minHeight: "calc(100vh - 64px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-bg)",
        padding: "12px 24px 24px",
        gap: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "680px",
          textAlign: "center",
          color: "#fff",
        }}
      >
        <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "10px" }}>
          Unfortunately, you were not a match for this survey.
        </h1>
        <p style={{ color: "#999", fontSize: "14px", lineHeight: 1.6, marginBottom: "4px" }}>
          Select another survey from our partner below to earn your points or return to view other available offers.
        </p>
      </div>

      <iframe
        src={frameUrl}
        title="Survey result"
        style={{
          width: "100%",
          maxWidth: "680px",
          height: "620px",
          border: "none",
          borderRadius: "16px",
          background: "#1a1a1a",
        }}
      />

      <button
        onClick={() => router.replace("/earn")}
        className="h-10 w-full max-w-[680px] rounded-lg bg-accent-green px-5 text-[13px] font-bold uppercase tracking-[0.08em] text-bg transition-colors hover:bg-accent-green/90"
      >
        Return to Offers
      </button>
    </div>
  );
}
