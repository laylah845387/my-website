"use client";

import Image from "next/image";
import { Reward } from "@/types";

interface RewardCardProps {
  reward: Reward;
  onSelect: (reward: Reward) => void;
  userPoints: number;
}

export default function RewardCard({
  reward,
  onSelect,
  userPoints,
}: RewardCardProps) {
  const canAfford = userPoints >= reward.points;

  return (
    <button
      onClick={() => onSelect(reward)}
      className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 text-left ${
        canAfford
          ? "bg-bg-card border-border hover:border-accent-green/40 hover:bg-bg-card-hover cursor-pointer"
          : "bg-bg-card/60 border-border opacity-60 cursor-not-allowed"
      }`}
      disabled={!canAfford}
    >
      {/* Reward image */}
      <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-bg-elevated border border-border">
        <Image
          src={reward.image}
          alt={reward.name}
          width={56}
          height={56}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Reward info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-[15px] font-bold text-text-primary truncate">
          {reward.name}
        </h3>
        <p className="text-[11px] font-medium tracking-[0.05em] text-text-secondary uppercase mt-0.5">
          {reward.description} • STOCK:{" "}
          {reward.stock === "UNLIMITED" ? "UNLIMITED" : reward.stock}
        </p>
      </div>

      {/* Action / Point cost */}
      <div className="text-right shrink-0">
        {canAfford ? (
          <div>
            <div className="text-xl font-bold text-accent-green font-heading">
              {reward.points}
            </div>
            <div className="text-[10px] font-semibold tracking-[0.1em] text-text-secondary uppercase">
              Points
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-end gap-1">
            <span className="inline-block text-[11px] font-bold tracking-wider text-text-muted uppercase px-2.5 py-1 rounded bg-bg-elevated border border-border">
              Not enough points
            </span>
            <span className="text-[11px] font-semibold text-text-muted">
              {reward.points} PTS
            </span>
          </div>
        )}
      </div>
    </button>
  );
}
