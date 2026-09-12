"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, ExternalLink, Gift, ListChecks } from "lucide-react";
import { useApp } from "@/lib/store";
import { Offer } from "@/types";
import PageContainer from "@/components/PageContainer";
import LoadingState from "@/components/LoadingState";

export default function AffikeOfferPage() {
  const router = useRouter();
  const params = useParams<{ offerId: string }>();
  const { session, login, showToast } = useApp();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [progress, setProgress] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const offerId = params.offerId;
    if (!offerId) return;

    let cancelled = false;
    Promise.all([
      fetch("/api/offers", { cache: "no-store" }).then((response) => response.json()),
      fetch(`/api/offers/progress?offerId=${encodeURIComponent(offerId)}`, {
        cache: "no-store",
      }).then((response) => response.json()),
    ])
      .then(([offersData, progressData]) => {
        if (!cancelled) {
          const nextOffer = (offersData.offers ?? []).find((item: Offer) => item.id === offerId) ?? null;
          setOffer(nextOffer);
          setProgress(progressData.progress ?? []);
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
        showToast("Offer opened in a new tab. Complete the milestones to earn points.", "info");
      } else {
        showToast("Couldn't start this offer right now. Please try again in a moment.", "error");
      }
    } catch {
      showToast("Couldn't start this offer right now. Please try again in a moment.", "error");
    } finally {
      setStarting(false);
    }
  };

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
  const instructionText =
    offer.description && offer.description.trim()
      ? offer.description
      : "Complete the required action outside of this site, such as downloading the app, signing up, or reaching the required in-app milestone. Once it is finished and verified, return here to receive your reward.";

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
                  {milestones.map((milestone, index) => {
                    const checked = progress.includes(String(milestone.id));

                    return (
                      <div key={milestone.id || index} className="flex items-center justify-between gap-5 py-4">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-green/70" />
                          <p
                            className={`text-sm leading-5 transition-colors ${
                              checked
                                ? "text-text-muted line-through decoration-accent-green/70 decoration-2"
                                : "text-text-primary"
                            }`}
                          >
                            {milestone.action}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-bold text-accent-green">+{milestone.points}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="border-y border-border py-4 text-sm leading-6 text-text-secondary">
                  Complete the action shown in the offer outside of this site. Once the task is verified, the points for that step will be added to your balance.
                </p>
              )}
            </div>

            <button
              onClick={startOffer}
              disabled={starting}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent-green px-5 text-xs font-bold uppercase tracking-[0.1em] text-bg transition-colors hover:bg-accent-green/90 disabled:cursor-wait disabled:opacity-60"
            >
              <ExternalLink size={15} />
              {starting ? "Opening offer..." : "Start offer"}
            </button>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
