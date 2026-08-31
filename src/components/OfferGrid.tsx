"use client";

import { Offer } from "@/types";
import OfferCard from "./OfferCard";

interface OfferGridProps {
  offers: Offer[];
  completedOffers: string[];
  onSelectOffer: (offer: Offer) => void;
}

export default function OfferGrid({
  offers,
  completedOffers,
  onSelectOffer,
}: OfferGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {offers.map((offer) => (
        <OfferCard
          key={offer.id}
          offer={offer}
          onSelect={onSelectOffer}
          completed={completedOffers.includes(offer.id)}
        />
      ))}
    </div>
  );
}
