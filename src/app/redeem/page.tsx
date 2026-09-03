"use client";

import { useState } from "react";
import Image from "next/image";
import { useApp } from "@/lib/store";
import { rewards } from "@/data/rewards";
import { Reward } from "@/types";
import PageContainer from "@/components/PageContainer";
import RewardCard from "@/components/RewardCard";
import OrderCard from "@/components/OrderCard";
import EmptyState from "@/components/EmptyState";
import { X, Gift, History } from "lucide-react";

export default function RedeemPage() {
  const { state, session, login, redeemReward } = useApp();
  const [confirming, setConfirming] = useState<Reward | null>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);

  const handleSelectReward = (reward: Reward) => {
    if (!session) {
      login();
      return;
    }
    setConfirming(reward);
  };

  const handleConfirmRedeem = async () => {
    if (!confirming) return;
    const success = await redeemReward(
      confirming.id,
      confirming.name,
      confirming.image,
      confirming.points
    );
    if (success) {
      setConfirming(null);
    }
  };

  return (
    <PageContainer>
      {/* Top section: Heading + Balance Info */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start mb-12">
        {/* Left - Redeem Hero */}
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
            REDEEM
          </h1>
          <p className="mt-3 text-[13px] font-medium tracking-[0.18em] text-text-secondary uppercase">
            Exchange your points for exclusive digital rewards.
          </p>
        </div>

        {/* Right - Balance summary */}
        <div className="bg-bg-card border border-border rounded-xl p-6 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[12px] font-bold tracking-[0.15em] text-text-secondary uppercase">
                Available Balance
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-4xl font-bold text-accent-green font-heading">
                  {state.user.points}
                </span>
                <span className="text-[13px] font-semibold tracking-[0.1em] text-text-secondary uppercase">
                  Points
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowTicketModal(true)}
              className="w-12 h-12 rounded-xl bg-white text-bg flex items-center justify-center hover:bg-gray-100 transition-colors cursor-pointer"
              aria-label="Claim an undelivered prize"
              title="Claim an undelivered prize"
            >
              <Gift size={22} />
            </button>
          </div>
          {/* Green accent line at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-accent-green shadow-[0_0_8px_rgba(74,222,128,0.4)]" />
        </div>
      </div>

      {/* Rewards + History side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start">
        {/* Left - Available Rewards */}
        <div className="space-y-4">
          <h2 className="text-[13px] font-bold tracking-[0.15em] text-text-secondary uppercase mb-2">
            Available Rewards
          </h2>

          <div className="space-y-3">
            {rewards.map((reward) => (
              <RewardCard
                key={reward.id}
                reward={reward}
                onSelect={handleSelectReward}
                userPoints={state.user.points}
              />
            ))}
          </div>
        </div>

        {/* Right - Redeem History */}
        <div className="space-y-4">
          <h2 className="text-[13px] font-bold tracking-[0.15em] text-text-secondary uppercase mb-2">
            Redeem History
          </h2>

          {state.orders.length === 0 ? (
            <EmptyState
              title="No redemptions yet"
              message="Rewards you redeem will show up here."
              icon={<History size={40} className="text-text-muted" />}
            />
          ) : (
            <div className="space-y-3">
              {state.orders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirming && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-overlay animate-fade-in"
            onClick={() => setConfirming(null)}
          />

          <div
            className="relative w-full max-w-[460px] bg-bg-card border border-border rounded-2xl shadow-2xl p-6 z-10"
            style={{ animation: "scaleIn 0.2s ease-out" }}
          >
            <button
              onClick={() => setConfirming(null)}
              className="absolute top-4 right-4 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X size={20} />
            </button>

            <h3 className="text-xl font-bold tracking-[0.08em] text-center uppercase font-heading mb-6">
              Confirm Redemption
            </h3>

            <div className="flex flex-col items-center text-center py-2">
              <div className="w-20 h-20 rounded-xl overflow-hidden bg-bg-elevated border border-border mb-4">
                <Image
                  src={confirming.image}
                  alt={confirming.name}
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              </div>

              <p className="text-[14px] text-text-secondary mb-1">
                Are you sure you want to redeem:
              </p>
              <p className="text-[18px] font-bold text-text-primary">
                {confirming.name}
              </p>
              <p className="text-[15px] font-bold text-accent-green mt-1">
                {confirming.points} Points
              </p>

              <div className="mt-4 px-4 py-2 rounded-lg bg-bg-elevated border border-border/60 text-[12px] text-text-secondary">
                Balance after redemption:{" "}
                <span className="text-text-primary font-bold">
                  {state.user.points - confirming.points} PTS
                </span>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setConfirming(null)}
                className="flex-1 h-10 rounded-lg border border-border text-[13px] font-semibold tracking-[0.08em] text-text-secondary hover:text-text-primary hover:border-border-hover transition-colors uppercase cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRedeem}
                className="flex-1 h-10 rounded-lg bg-accent-green text-bg text-[13px] font-bold tracking-[0.08em] hover:bg-accent-green/90 transition-colors uppercase cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Claim / Undelivered Prize Modal */}
      {showTicketModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-overlay animate-fade-in"
            onClick={() => setShowTicketModal(false)}
          />

          <div
            className="relative w-full max-w-[420px] bg-bg-card border border-border rounded-2xl shadow-2xl p-6 z-10"
            style={{ animation: "scaleIn 0.2s ease-out" }}
          >
            <button
              onClick={() => setShowTicketModal(false)}
              className="absolute top-4 right-4 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X size={20} />
            </button>

            <div className="w-14 h-14 rounded-xl bg-bg-elevated border border-border flex items-center justify-center text-accent-green mx-auto mb-4">
              <Gift size={26} />
            </div>

            <h3 className="text-xl font-bold tracking-[0.08em] text-center uppercase font-heading mb-3">
              Claim Your Prize
            </h3>

            <p className="text-[13px] text-text-secondary text-center leading-relaxed mb-6">
              Open a ticket in our Discord server to receive your redeemed rewards.
            </p>

            <a
              href="https://discord.gg/SKFuVVqpSV"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center h-10 rounded-lg bg-white text-bg text-[13px] font-bold tracking-[0.08em] uppercase hover:bg-gray-100 transition-colors"
            >
              Open Discord
            </a>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .animate-fade-in {
          animation: fadeIn 0.15s ease-out;
        }
      `}</style>
    </PageContainer>
  );
}
