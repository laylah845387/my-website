"use client";

import { useApp } from "@/lib/store";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";

export default function ToastContainer() {
  const { state, removeToast } = useApp();

  if (state.toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 max-w-[360px]">
      {state.toasts.map((toast) => {
        const icon =
          toast.type === "success" ? (
            <CheckCircle size={18} className="text-accent-green shrink-0" />
          ) : toast.type === "error" ? (
            <AlertCircle size={18} className="text-accent-red shrink-0" />
          ) : (
            <Info size={18} className="text-blue-400 shrink-0" />
          );

        const borderColor =
          toast.type === "success"
            ? "border-accent-green/30"
            : toast.type === "error"
            ? "border-accent-red/30"
            : "border-blue-400/30";

        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-lg bg-bg-card border ${borderColor} shadow-xl`}
            style={{
              animation: "slideIn 0.3s ease-out",
            }}
          >
            {icon}
            <p className="text-[13px] text-text-primary flex-1">
              {toast.message}
            </p>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-text-muted hover:text-text-secondary transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
