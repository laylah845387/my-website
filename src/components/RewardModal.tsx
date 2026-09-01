"use client";

import { useEffect, useCallback, useState } from "react";
import { X } from "lucide-react";
import { Reward } from "@/types";
import { useApp } from "@/lib/store";
import { rewards } from "@/data/rewards";
import RewardCard from "./RewardCard";

interface RewardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RewardModal({ isOpen, onClose }: RewardModalProps) {
  const { state, session, login, redeemReward } = useApp();
  const [confirming, setConfirming] = useState<Reward | null>(null);

  // Close on ESC
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirming) {
          setConfirming(null);
        } else {
          onClose();
        }
      }
    },
    [onClose, confirming]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  const handleSelectReward = (reward: Reward) => {
    if (!session) {
      login();
      return;
    }
    setConfirming(reward);
  };

  const handleConfirmRedeem = () => {
    if (!confirming) return;
    const success = redeemReward(
      confirming.id,
      confirming.name,
      confirming.image,
      confirming.points
    );
    if (success) {
      setConfirming(null);
      onClose();
    }
  };

  const handleCancelConfirm = () => {
    setConfirming(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-overlay animate-fade-in"
        onClick={() => {
          if (confirming) {
            setConfirming(null);
          } else {
            onClose();
          }
        }}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-[480px] bg-bg-card border border-border rounded-2xl shadow-2xl animate-scale-in"
        style={{
          animation: "scaleIn 0.2s ease-out",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-text-secondary hover:text-text-primary transition-colors z-10"
          aria-label="Close modal"
        >
          <X size={20} />
        </button>

        {/* Title */}
        <div className="pt-6 pb-4 px-6">
          <h2 className="text-xl font-bold tracking-[0.08em] text-center uppercase font-heading">
            Select Reward
          </h2>
        </div>

        {/* Reward list or Confirmation */}
        <div className="px-5 pb-6 space-y-3">
          {confirming ? (
            <div className="space-y-4">
              <div className="text-center py-4">
                <p className="text-[14px] text-text-secondary mb-2">
                  Are you sure you want to redeem:
                </p>
                <p className="text-[16px] font-bold text-text-primary">
                  {confirming.name}
                </p>
                <p className="text-[14px] text-accent-green mt-1">
                  {confirming.points} Points
                </p>
                <p className="text-[12px] text-text-secondary mt-2">
                  Your balance after:{" "}
                  <span className="text-text-primary font-semibold">
                    {state.user.points - confirming.points} points
                  </span>
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCancelConfirm}
                  className="flex-1 h-10 rounded-lg border border-border text-[13px] font-semibold tracking-[0.08em] text-text-secondary hover:text-text-primary hover:border-border-hover transition-colors uppercase"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmRedeem}
                  className="flex-1 h-10 rounded-lg bg-accent-green text-bg text-[13px] font-bold tracking-[0.08em] hover:bg-accent-green/90 transition-colors uppercase"
                >
                  Confirm
                </button>
              </div>
            </div>
          ) : (
            rewards.map((reward) => (
              <RewardCard
                key={reward.id}
                reward={reward}
                onSelect={handleSelectReward}
                userPoints={state.user.points}
              />
            ))
          )}
        </div>
      </div>

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
        .animate-scale-in {
          animation: scaleIn 0.2s ease-out;
        }
        .animate-fade-in {
          animation: fadeIn 0.15s ease-out;
        }
      `}</style>
    </div>
  );
}
