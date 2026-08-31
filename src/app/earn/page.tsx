"use client";

import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { offers } from "@/data/offers";
import { Offer } from "@/types";
import PageContainer from "@/components/PageContainer";
import BalanceCard from "@/components/BalanceCard";
import OfferGrid from "@/components/OfferGrid";

export default function EarnPage() {
  const router = useRouter();
  const { state, completeOffer, showToast } = useApp();

  const handleSelectOffer = (offer: Offer) => {
    if (state.completedOffers.includes(offer.id)) {
      showToast("You have already completed this offer.", "info");
      return;
    }

    // In the demo, simulate immediate completion
    // In production, this would redirect to Bitcotasks
    showToast(`Starting task: ${offer.title || offer.duration}...`, "info");

    // Simulate task completion after a brief delay
    setTimeout(() => {
      completeOffer(offer.id, offer.points);
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
            onHistory={() =>
              showToast("Transaction history coming soon.", "info")
            }
          />
        </div>
      </div>

      {/* Offer Grid */}
      <OfferGrid
        offers={offers}
        completedOffers={state.completedOffers}
        onSelectOffer={handleSelectOffer}
      />
    </PageContainer>
  );
}
