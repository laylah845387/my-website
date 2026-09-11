"use client";

import { Gift } from "lucide-react";

interface RedirectNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RedirectNoticeModal({ isOpen, onClose }: RedirectNoticeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-overlay animate-fade-in" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative w-full max-w-[420px] bg-bg-card border border-border rounded-2xl shadow-2xl animate-scale-in px-6 pt-8 pb-6 text-center"
        style={{ animation: "scaleIn 0.2s ease-out" }}
      >
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-accent-green/10 text-accent-green">
          <Gift size={24} strokeWidth={1.8} aria-hidden="true" />
        </div>
        <p className="text-[15px] font-semibold text-text-primary leading-relaxed">
          You are being redirected to a new window to complete your offer.
        </p>
        <p className="text-[12px] text-text-secondary mt-3">
          When you have finished the offer, return back here to receive your
          points. Points are only rewarded for fully completed offers. Some
          offers may require you to sign up for a subscription or download an
          app.
        </p>

        <button
          onClick={onClose}
          className="mt-6 w-full h-10 rounded-lg bg-accent-green text-bg text-[13px] font-bold tracking-[0.08em] hover:bg-accent-green/90 transition-colors uppercase"
        >
          Got it
        </button>
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
