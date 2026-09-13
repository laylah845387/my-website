"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface SurveyStatusFrameProps {
  appId: string;
  extUserId: string;
  secureHash: string;
  messageId: string;
}

// How long to show CPX's own result message before moving on automatically.
const AUTO_CONTINUE_SECONDS = 6;

export default function SurveyStatusFrame({
  appId,
  extUserId,
  secureHash,
  messageId,
}: SurveyStatusFrameProps) {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(AUTO_CONTINUE_SECONDS);

  const frameUrl =
    `https://wall.cpx-research.com/index.php?app_id=${encodeURIComponent(appId)}` +
    `&ext_user_id=${encodeURIComponent(extUserId)}` +
    `&secure_hash=${encodeURIComponent(secureHash)}` +
    `&subid_1=&subid_2=` +
    `&message_id=${encodeURIComponent(messageId)}`;

  useEffect(() => {
    if (secondsLeft <= 0) {
      router.replace("/earn");
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-bg)",
        padding: "24px",
        gap: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          textAlign: "center",
          color: "#fff",
        }}
      >
        <h1 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>
          Survey result
        </h1>
        <p style={{ color: "#999", fontSize: "14px", marginBottom: "20px" }}>
          Taking you back to the Earn page in {secondsLeft}s...
        </p>
      </div>

      <iframe
        src={frameUrl}
        title="Survey result"
        style={{
          width: "100%",
          maxWidth: "480px",
          height: "420px",
          border: "none",
          borderRadius: "12px",
          background: "#1a1a1a",
        }}
      />

      <button
        onClick={() => router.replace("/earn")}
        style={{
          padding: "10px 24px",
          borderRadius: "8px",
          border: "none",
          background: "var(--color-accent-green)",
          color: "#000",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Continue now
      </button>
    </div>
  );
}
