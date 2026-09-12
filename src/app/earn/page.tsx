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
import { History } from "lucide-react";

export default function EarnPage() {
  const router = useRouter();
  const { session, login, refreshUserData, showToast } = useApp();
  const [offers, setOffers] = useState<Offer[]>([]);
  // Tracks which currently-visible offers should show the "completed"
  // label — this is intentionally separate from the account's full
  // lifetime completed-offers history, since already-acknowledged
  // completions get dropped from the list entirely (see /api/offers).
  const [visibleCompleted, setVisibleCompleted] = useState<string[]>([]);
  const [inProgressOffers, setInProgressOffers] = useState<Record<string, string[]>>({});
  const [offersLoading, setOffersLoading] = useState(true);
  const [redirectNoticeOpen, setRedirectNoticeOpen] = useState(false);
  const [pendingOfferId, setPendingOfferId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch("/api/offers", { cache: "no-store" }).then((res) => res.json()),
      fetch("/api/offers/progress", { cache: "no-store" }).then((res) => res.json()),
    ])
      .then(([offersData, progressData]) => {
        if (!cancelled) {
          setOffers(offersData.offers ?? []);
          setVisibleCompleted(offersData.completedOffers ?? []);
          setInProgressOffers(progressData.progress ?? {});
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

  const continueOffers = offers.filter((offer) => (inProgressOffers[offer.id] ?? []).length > 0);
  const newOffers = offers.filter((offer) => (inProgressOffers[offer.id] ?? []).length === 0);

  const renderOfferSection = (title: string, items: Offer[]) => {
    if (items.length === 0) return null;

    return (
      <div className="mb-8">
        <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em] text-text-secondary">
          {title}
        </h2>
        <OfferGrid
          offers={items}
          completedOffers={visibleCompleted}
          activeOfferId={redirectNoticeOpen ? pendingOfferId : null}
          onSelectOffer={handleSelectOffer}
        />
      </div>
    );
  };

  const handleSelectOffer = async (offer: Offer) => {
    if (!session) {
      login();
      return;
    }

    if (visibleCompleted.includes(offer.id)) {
      showToast("You have already completed this offer.", "info");
      return;
    }

    showToast(`Starting task: ${offer.title || offer.duration}...`, "info");

      if (offer.provider === "affike") {
        router.push(`/earn/affike/${encodeURIComponent(offer.id)}`);
        return;
      }

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
          {renderOfferSection("Continue", continueOffers)}
          {renderOfferSection("New", newOffers)}
        </>
      )}

      <RedirectNoticeModal
        isOpen={redirectNoticeOpen}
        onClose={() => setRedirectNoticeOpen(false)}
      />
    </PageContainer>
  );
}
