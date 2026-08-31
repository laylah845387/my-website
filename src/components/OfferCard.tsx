"use client";

import { Offer } from "@/types";
import { Clock } from "lucide-react";

interface OfferCardProps {
  offer: Offer;
  onSelect: (offer: Offer) => void;
  completed?: boolean;
}

export default function OfferCard({ offer, onSelect, completed }: OfferCardProps) {
  return (
    <button
      onClick={() => onSelect(offer)}
      disabled={completed}
      className={`group relative flex flex-col items-center justify-center gap-3 p-5 rounded-lg border transition-all duration-200 text-center ${
        completed
          ? "bg-bg-card border-border opacity-50 cursor-not-allowed"
          : "bg-bg-card border-border hover:border-accent-green/40 hover:bg-bg-card-hover cursor-pointer"
      }`}
    >
      {/* 1. Type */}
      <div className="flex items-center justify-center">
        <span className="text-[11px] font-bold tracking-[0.12em] text-text-secondary group-hover:text-text-primary uppercase px-2.5 py-0.5 rounded-full bg-bg-elevated border border-border transition-colors">
          {offer.type || "TASK"}
        </span>
      </div>

      {/* 2. Points */}
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold text-accent-green font-heading">
          {offer.points}
        </span>
        <span className="text-[12px] font-semibold tracking-[0.08em] text-text-primary uppercase">
          Points
        </span>
      </div>

      {/* 3. Timer */}
      <div className="flex items-center gap-1.5 text-text-muted">
        <Clock size={13} className="text-text-muted" />
        <span className="text-[12px] font-medium tracking-[0.1em] uppercase">
          {offer.duration}
        </span>
      </div>

      {/* Completed overlay */}
      {completed && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-bg/70 backdrop-blur-[1px]">
          <span className="text-[11px] font-bold tracking-wider text-accent-green uppercase px-3 py-1 rounded bg-bg-card border border-accent-green/30">
            Completed
          </span>
        </div>
      )}
    </button>
  );
}
