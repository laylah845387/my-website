"use client";

import Link from "next/link";
import { useApp } from "@/lib/store";
import { Clock, Gift } from "lucide-react";

interface BalanceCardProps {
  onRedeem?: () => void;
  onCashout?: () => void;
  onHistory?: () => void;
  redeemHref?: string;
}

export default function BalanceCard({
  onRedeem,
  onCashout,
  onHistory,
  redeemHref = "/redeem",
}: BalanceCardProps) {
  const { state } = useApp();

  const handleRedeem = onRedeem || onCashout;

  return (
    <div className="relative bg-bg-card border border-border rounded-xl overflow-hidden">
      {/* Top section - Balance display */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4">
        <span className="text-[13px] font-bold tracking-[0.15em] text-text-primary uppercase">
          Balance
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-accent-green font-heading">
            {state.user.points}
          </span>
          <span className="text-[13px] font-semibold tracking-[0.1em] text-text-secondary uppercase">
            Points
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-6 border-t border-border" />

      {/* Bottom section - Actions */}
      <div className="flex items-center gap-3 px-6 py-4">
        {/* History button */}
        <button
          onClick={onHistory}
          className="flex items-center justify-center w-10 h-10 rounded-lg bg-bg-elevated border border-border hover:border-border-hover transition-colors cursor-pointer"
          aria-label="View history"
        >
          <Clock size={18} className="text-text-secondary" />
        </button>

        {/* Redeem button */}
        {handleRedeem ? (
          <button
            onClick={handleRedeem}
            className="flex-1 flex items-center justify-center gap-2 h-10 rounded-lg bg-white text-bg font-bold text-[13px] tracking-[0.1em] uppercase hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <Gift size={16} />
            <span>REDEEM</span>
          </button>
        ) : (
          <Link
            href={redeemHref}
            className="flex-1 flex items-center justify-center gap-2 h-10 rounded-lg bg-white text-bg font-bold text-[13px] tracking-[0.1em] uppercase hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <Gift size={16} />
            <span>REDEEM</span>
          </Link>
        )}
      </div>

      {/* Green accent line at bottom */}
      <div className="h-[3px] bg-accent-green shadow-[0_0_8px_rgba(74,222,128,0.4)]" />
    </div>
  );
}
