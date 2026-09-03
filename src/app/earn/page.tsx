"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { Offer } from "@/types";
import PageContainer from "@/components/PageContainer";
import BalanceCard from "@/components/BalanceCard";
import OfferGrid from "@/components/OfferGrid";
import LoadingState from "@/components/LoadingState";

export default function EarnPage() {
  const router = useRouter();
  const { session, login, completeOffer, showToast } = useApp();
  const [offers, setOffers] = useState<Offer[]>([]);
  // Tracks which currently-visible offers should show the "completed"
  // label — this is intentionally separate from the account's full
  // lifetime completed-offers history, since already-acknowledged
  // completions get dropped from the list entirely (see /api/offers).
  const [visibleCompleted, setVisibleCompleted] = useState<string[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/offers")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setOffers(data.offers ?? []);
          setVisibleCompleted(data.completedOffers ?? []);
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

    try {
      const res = await fetch("/api/offers/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId: offer.id }),
      });

      if (res.status === 401) {
        login();
        return;
      }

      const data = await res.json();

      if (data.redirectUrl) {
        // Real Bitcotasks task — send the user to it in a new tab.
        window.open(data.redirectUrl, "_blank", "noopener,noreferrer");
        return;
      }
    } catch {
      // Fall through to the local demo simulation below if the request fails.
    }

    // No live Bitcotasks connection yet — simulate completion locally so
    // the rest of the app (points, balance, redeem flow) is testable.
    setTimeout(async () => {
      await completeOffer(offer.id, offer.points);
      setVisibleCompleted((prev) =>
        prev.includes(offer.id) ? prev : [...prev, offer.id]
      );
    }, 1500);
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
      ) : (
        <OfferGrid
          offers={offers}
          completedOffers={visibleCompleted}
          onSelectOffer={handleSelectOffer}
        />
      )}
    </PageContainer>
  );
}
