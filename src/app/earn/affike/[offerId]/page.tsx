"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, ExternalLink, Gift, ListChecks } from "lucide-react";
import { useApp } from "@/lib/store";
import { Offer } from "@/types";
import PageContainer from "@/components/PageContainer";
import LoadingState from "@/components/LoadingState";
import RedirectNoticeModal from "@/components/RedirectNoticeModal";

export default function AffikeOfferPage() {
  const router = useRouter();
  const params = useParams<{ offerId: string }>();
  const { session, login, refreshUserData, showToast } = useApp();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [redirectNoticeOpen, setRedirectNoticeOpen] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [trackingStarted, setTrackingStarted] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<string | null>(null);

  useEffect(() => {
    const offerId = params.offerId ? decodeURIComponent(params.offerId) : "";
    if (!offerId) return;

    let cancelled = false;
    fetch("/api/offers", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) {
          setOffer((data.offers ?? []).find((item: Offer) => item.id === offerId) ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) showToast("Couldn't load this offer right now.", "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [params.offerId, showToast]);

  const startOffer = async () => {
    if (!offer) return;
    if (!session) {
      login();
      return;
    }

    showToast(`Starting task: ${offer.title || offer.duration}...`, "info");
    setStarting(true);

    try {
      const response = await fetch("/api/offers/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId: offer.id, provider: offer.provider }),
      });

      if (response.status === 401) {
        login();
        return;
      }

      const data = await response.json();
      if (data.redirectUrl) {
        window.open(data.redirectUrl, "_blank", "noopener,noreferrer");
        setTrackingStarted(true);
        setTransactionStatus("pending");
        setRedirectNoticeOpen(true);
      } else {
        showToast("Couldn't start this offer right now. Please try again in a moment.", "error");
      }
    } catch {
      showToast("Couldn't start this offer right now. Please try again in a moment.", "error");
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    if (!trackingStarted || !offer) return;

    let cancelled = false;
    const checkCompletion = async () => {
      try {
        const response = await fetch(
          `/api/offers/status?offerId=${encodeURIComponent(offer.id)}`,
          { cache: "no-store" }
        );
        if (!response.ok || cancelled) return;

        const data = await response.json();
        const latestTransaction = data.affikeTransactions?.[0];
        if (latestTransaction?.status) {
          setTransactionStatus(latestTransaction.status);
        }

        if (latestTransaction && /reject|declin|cancel|chargeback|revers|fraud/i.test(latestTransaction.status)) {
          showToast(`${offer.provider === "offerwall-me" ? "Offerwall.me" : "Affike"} reported that this offer was not approved.`, "error");
          return;
        }

        if (data.completed && latestTransaction?.status === "approved") {
          setCompleted(true);
          setRedirectNoticeOpen(false);
          await refreshUserData();
          showToast("Offer completed. Your points have been added.", "success");
        } else if (data.completed && latestTransaction?.status === "pending") {
          await refreshUserData();
          showToast("Points added while the provider finishes verifying your offer.", "info");
        }
      } catch {
        // The next poll will retry while the provider processes the offer.
      }
    };

    checkCompletion();
    const intervalId = window.setInterval(checkCompletion, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [offer, refreshUserData, showToast, trackingStarted]);

  if (loading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  if (!offer) {
    return (
      <PageContainer>
        <div className="py-16 text-center">
          <p className="text-sm text-text-secondary">This offer is no longer available.</p>
          <button
            onClick={() => router.push("/earn")}
            className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-accent-green hover:text-accent-green-light transition-colors"
          >
            Back to offers
          </button>
        </div>
      </PageContainer>
    );
  }

  const milestones = offer.milestones ?? [];
  const instructionText = offer.description?.trim() ||
    "Complete the offer description outside of this site. Once it is finished and verified, the points for that step will be added to your balance.";

  return (
    <PageContainer>
      <div className="mx-auto max-w-3xl py-2">
        <button
          onClick={() => router.push("/earn")}
          className="mb-8 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={15} />
          Back to offers
        </button>

        <div className="border border-border bg-bg-card rounded-lg overflow-hidden">
          <div className="border-b border-border px-6 py-7 sm:px-8">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-accent-green/10 text-accent-green">
              <Gift size={24} strokeWidth={1.8} aria-hidden="true" />
            </div>
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-text-secondary">
                  {offer.type || "Offer"}
                </p>
                <h1 className="font-heading text-3xl font-bold uppercase leading-tight text-text-primary">
                  {offer.title || "Complete this offer"}
                </h1>
              </div>
              <div className="shrink-0 text-left sm:text-right">
                <p className="text-3xl font-bold text-accent-green font-heading">{offer.points}</p>
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-secondary">
                  total points
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-8 px-6 py-7 sm:px-8">
            <div>
              <div className="mb-3 flex items-center gap-2 text-text-primary">
                <ListChecks size={16} className="text-accent-green" />
                <h2 className="text-xs font-bold uppercase tracking-[0.12em]">Offer Description</h2>
              </div>
              <p className="text-sm leading-6 text-text-secondary">{instructionText}</p>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2 text-text-primary">
                <CheckCircle2 size={16} className="text-accent-green" />
                <h2 className="text-xs font-bold uppercase tracking-[0.12em]">
                  Steps to complete & rewards
                </h2>
              </div>
              {milestones.length > 0 ? (
                <div className="divide-y divide-border border-y border-border">
                  {milestones.map((milestone, index) => (
                    <div key={milestone.id || index} className="flex items-center justify-between gap-5 py-4">
                      <p className="min-w-0 text-sm leading-5 text-text-primary">{milestone.action}</p>
                      <p className="shrink-0 text-sm font-bold text-accent-green">+{milestone.points}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="border-y border-border py-4 text-sm leading-6 text-text-secondary">
                  Complete the offer description outside of this site. Once the task is verified, the points will be added to your balance.
                </p>
              )}
            </div>

            <button
              onClick={startOffer}
              disabled={starting || completed || trackingStarted}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent-green px-5 text-xs font-bold uppercase tracking-[0.1em] text-bg transition-colors hover:bg-accent-green/90 disabled:cursor-wait disabled:opacity-60"
            >
              <ExternalLink size={15} />
              {completed
                ? "Offer completed"
                : trackingStarted
                  ? "Verification pending"
                  : starting
                    ? "Opening offer..."
                    : "Start offer"}
            </button>
            {trackingStarted && !completed ? (
              <p className="text-center text-xs leading-5 text-text-secondary">
                {transactionStatus && /reject|declin|cancel|chargeback|revers|fraud/i.test(transactionStatus)
                  ? `${offer.provider === "offerwall-me" ? "Offerwall.me" : "Affike"} did not approve this conversion.`
                  : transactionStatus === "approved"
                    ? "The provider approved the conversion. Refreshing your points..."
                    : "Waiting for the provider to verify your completion. This can take a few minutes."}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <RedirectNoticeModal
        isOpen={redirectNoticeOpen}
        onClose={() => setRedirectNoticeOpen(false)}
      />
    </PageContainer>
  );
}
