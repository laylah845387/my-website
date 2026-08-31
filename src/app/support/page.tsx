"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import PageContainer from "@/components/PageContainer";
import {
  HelpCircle,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Send,
} from "lucide-react";

const FAQ_ITEMS = [
  {
    q: "How do I earn points?",
    a: "Visit the Claim page to browse available offers. Click on any offer to start a task. Once the task is verified as complete, points are automatically added to your balance.",
  },
  {
    q: "How do I redeem rewards?",
    a: 'Go to the Claim page and click the CASHOUT button on the Balance card. A modal will appear showing available rewards. Select the reward you want and confirm the redemption.',
  },
  {
    q: "Why didn't I receive my points?",
    a: "Points are awarded after task verification. Some tasks may take a few minutes to verify. If you still haven't received points after 30 minutes, please contact support.",
  },
  {
    q: "Can I get a refund on a redeemed reward?",
    a: "Reward redemptions are final once confirmed. Please make sure you have selected the correct reward before confirming.",
  },
  {
    q: "How will Discord integration work?",
    a: "Soon you'll be able to link your Discord account to CapeVerse. This will allow your progress, points, and orders to be saved and accessible across sessions.",
  },
];

export default function SupportPage() {
  const { showToast } = useApp();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [contactMessage, setContactMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactMessage.trim()) {
      showToast("Please enter a message.", "error");
      return;
    }
    // In production, this would send to a support API
    showToast("Support message sent! We'll get back to you soon.", "success");
    setContactMessage("");
  };

  return (
    <PageContainer>
      {/* Title */}
      <div className="pt-4 mb-10">
        <h1
          className="text-4xl md:text-5xl font-bold uppercase font-heading leading-none tracking-tight mb-3"
          style={{
            background: "linear-gradient(180deg, #e0e0e0 0%, #888888 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Support
        </h1>
        <p className="text-[13px] font-medium tracking-[0.18em] text-text-secondary uppercase">
          Need help? We&apos;re here for you.
        </p>
      </div>

      <div className="max-w-3xl grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* FAQ */}
        <div>
          <h2 className="text-[13px] font-bold tracking-[0.15em] text-text-primary uppercase mb-6 flex items-center gap-2">
            <HelpCircle size={16} className="text-accent-green" />
            Frequently Asked Questions
          </h2>

          <div className="space-y-2">
            {FAQ_ITEMS.map((item, index) => (
              <div
                key={index}
                className="rounded-xl bg-bg-card border border-border overflow-hidden"
              >
                <button
                  onClick={() =>
                    setExpandedFaq(expandedFaq === index ? null : index)
                  }
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                >
                  <span className="text-[13px] font-semibold text-text-primary pr-4">
                    {item.q}
                  </span>
                  {expandedFaq === index ? (
                    <ChevronUp size={16} className="text-text-muted shrink-0" />
                  ) : (
                    <ChevronDown
                      size={16}
                      className="text-text-muted shrink-0"
                    />
                  )}
                </button>
                {expandedFaq === index && (
                  <div className="px-5 pb-4">
                    <p className="text-[12px] text-text-secondary leading-relaxed">
                      {item.a}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div>
          <h2 className="text-[13px] font-bold tracking-[0.15em] text-text-primary uppercase mb-6 flex items-center gap-2">
            <MessageCircle size={16} className="text-accent-green" />
            Contact Support
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-xl bg-bg-card border border-border p-5">
              <label
                htmlFor="support-message"
                className="block text-[12px] font-semibold tracking-[0.1em] text-text-secondary uppercase mb-3"
              >
                Your Message
              </label>
              <textarea
                id="support-message"
                value={contactMessage}
                onChange={(e) => setContactMessage(e.target.value)}
                placeholder="Describe your issue or question..."
                rows={6}
                className="w-full bg-bg-elevated border border-border rounded-lg px-4 py-3 text-[13px] text-text-primary placeholder-text-muted resize-none focus:outline-none focus:border-border-hover transition-colors"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-bg font-semibold text-[13px] tracking-[0.08em] uppercase hover:bg-gray-100 transition-colors"
            >
              <Send size={14} />
              Send Message
            </button>
          </form>
        </div>
      </div>
    </PageContainer>
  );
}
