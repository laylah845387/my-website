"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { Offer } from "@/types";
import PageContainer from "@/components/PageContainer";
import BalanceCard from "@/components/BalanceCard";
import OfferGrid from "@/components/OfferGrid";
import LoadingState from "@/components/LoadingState";
import EmptyState from "@/components/EmptyState";
import RedirectNoticeModal from "@/components/RedirectNoticeModal";
import { Clock, History } from "lucide-react";

export default function EarnPage() {
  const router = useRouter();
  const { session, login, refreshUserData, showToast } = useApp();
  const [offers, setOffers] = useState<Offer[]>([]);
  // Tracks which currently-visible offers should show the "completed"
  // label — this is intentionally separate from the account's full
  // lifetime completed-offers history, since already-acknowledged
  // completions get dropped from the list entirely (see /api/offers).
  const [visibleCompleted, setVisibleCompleted] = useState<string[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [redirectNoticeOpen, setRedirectNoticeOpen] = useState(false);
  const [pendingOfferId, setPendingOfferId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/offers", { cache: "no-store" })
      .then((res) => res.json())
      .then((offersData) => {
        if (!cancelled) {
          setOffers(offersData.offers ?? []);
          setVisibleCompleted(offersData.completedOffers ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          showToast("Couldn't load offers right now. Try refreshing.", "error");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setOffersLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!redirectNoticeOpen || !pendingOfferId) return;

    let cancelled = false;
    const checkCompletion = async () => {
      try {
        const res = await fetch(
          `/api/offers/status?offerId=${encodeURIComponent(pendingOfferId)}`,
          { cache: "no-store" }
        );
        if (!res.ok || cancelled) return;

        const data = await res.json();
        if (data.completed) {
          setVisibleCompleted((current) => [...new Set([...current, pendingOfferId])]);
          setRedirectNoticeOpen(false);
          setPendingOfferId(null);
          await refreshUserData();
          showToast("Offer completed. Your points have been added.", "success");
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
  }, [pendingOfferId, redirectNoticeOpen, refreshUserData, showToast]);

  const handleSelectOffer = async (offer: Offer) => {
    if (!session) {
      login();
      return;
    }

    if (visibleCompleted.includes(offer.id)) {
      showToast("You have already completed this offer.", "info");
      return;
    }

    if (offer.provider === "affike") {
      router.push(`/earn/affike/${encodeURIComponent(offer.id)}`);
      return;
    }

    showToast(`Starting task: ${offer.title || offer.duration}...`, "info");

    try {
      const res = await fetch("/api/offers/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId: offer.id, provider: offer.provider }),
      });

      if (res.status === 401) {
        login();
        return;
      }

      const data = await res.json();

      if (data.redirectUrl) {
        // Send the user to the real task in a new tab. Points are only
        // ever credited by the provider's own postback webhook once the
        // task is actually verified — never by anything happening here.
        window.open(data.redirectUrl, "_blank", "noopener,noreferrer");
        setPendingOfferId(offer.id);
        setRedirectNoticeOpen(true);
        return;
      }

      // No redirect link came back — do NOT credit points under any
      // circumstances. Just tell the user and stop.
      showToast("Couldn't start this offer right now. Please try again in a moment.", "error");
    } catch {
      showToast("Couldn't start this offer right now. Please try again in a moment.", "error");
    }
  };

  return (
    <PageContainer>
      {/* Top section: OFFERS heading + Balance Card */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start mb-12">
        {/* Left - Offers Hero */}
        <div className="pt-4">
          <h1
            className="text-5xl md:text-6xl font-bold uppercase font-heading leading-none tracking-tight"
            style={{
              background: "linear-gradient(180deg, #e0e0e0 0%, #888888 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            OFFERS
          </h1>
          <p className="mt-3 text-[13px] font-medium tracking-[0.18em] text-text-secondary uppercase">
            Complete tasks to earn points.
          </p>
        </div>

        {/* Right - Balance Card */}
        <div>
          <BalanceCard
            onRedeem={() => router.push("/redeem")}
            onHistory={() => router.push("/redeem")}
          />
        </div>
      </div>

      {/* Offer Grid */}
      {offersLoading ? (
        <LoadingState />
      ) : offers.length === 0 ? (
        <EmptyState
          title="No offers available right now"
          message="Please check back in a few minutes."
          icon={<History size={40} className="text-text-muted" />}
        />
      ) : (
        <>
          <section className="mb-8">
            <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em] text-text-secondary">
              Continue
            </h2>
            <div className="flex flex-col items-center justify-center gap-3 border-y border-border py-10">
              <Clock size={28} className="text-text-muted" aria-hidden="true" />
              <p className="text-[13px] text-text-muted">Choose an offer to get started.</p>
            </div>
          </section>
          <section>
            <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em] text-text-secondary">
              New
            </h2>
            <OfferGrid
              offers={offers}
              completedOffers={visibleCompleted}
              activeOfferId={redirectNoticeOpen ? pendingOfferId : null}
              onSelectOffer={handleSelectOffer}
            />
          </section>
        </>
      )}

      <RedirectNoticeModal
        isOpen={redirectNoticeOpen}
        onClose={() => setRedirectNoticeOpen(false)}
      />
    </PageContainer>
  );
}
