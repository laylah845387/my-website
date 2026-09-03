"use client";

import { useState } from "react";
import Image from "next/image";
import { Order } from "@/types";
import { formatDate } from "@/lib/utils";
import { Lock } from "lucide-react";

export default function AdminOrdersPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchOrders = async (pw: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/orders", {
        headers: { "x-admin-password": pw },
      });
      if (res.status === 401) {
        setError("Wrong password.");
        setAuthed(false);
        return;
      }
      const data = await res.json();
      setOrders(data.orders ?? []);
      setAuthed(true);
    } catch {
      setError("Something went wrong loading orders.");
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders(password);
  };

  const toggleDelivered = async (order: Order) => {
    if (!order.discordId) return;
    const newValue = !order.delivered;

    // Optimistic update
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, delivered: newValue } : o))
    );

    try {
      const res = await fetch("/api/admin/orders/deliver", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
        },
        body: JSON.stringify({
          orderId: order.id,
          discordId: order.discordId,
          delivered: newValue,
        }),
      });
      if (!res.ok) {
        // Revert on failure
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? { ...o, delivered: !newValue } : o))
        );
      }
    } catch {
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, delivered: !newValue } : o))
      );
    }
  };

  if (!authed) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <form
          onSubmit={handleUnlock}
          className="w-full max-w-[360px] bg-bg-card border border-border rounded-2xl p-6"
        >
          <div className="w-12 h-12 rounded-xl bg-bg-elevated border border-border flex items-center justify-center text-accent-green mx-auto mb-4">
            <Lock size={20} />
          </div>
          <h1 className="text-lg font-bold text-center uppercase tracking-[0.08em] font-heading mb-4">
            Admin Access
          </h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            className="w-full h-10 px-3 rounded-lg bg-bg-elevated border border-border text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-green/50 mb-3"
            autoFocus
          />
          {error && (
            <p className="text-[12px] text-accent-red mb-3">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full h-10 rounded-lg bg-white text-bg text-[13px] font-bold tracking-[0.08em] uppercase hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Checking..." : "Unlock"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold uppercase tracking-[0.08em] font-heading mb-6">
        Manage Deliveries
      </h1>

      {orders.length === 0 ? (
        <p className="text-[13px] text-text-secondary">No orders yet.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div
              key={order.id}
              className="flex items-center gap-4 p-4 rounded-xl bg-bg-card border border-border"
            >
              <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-bg-elevated">
                <Image
                  src={order.rewardImage}
                  alt={order.rewardName}
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-[14px] font-bold text-text-primary truncate">
                  {order.rewardName}
                </h3>
                <p className="text-[11px] text-text-secondary mt-0.5">
                  {formatDate(order.createdAt)}
                </p>
                <p className="text-[11px] text-text-muted mt-0.5 truncate">
                  Discord ID: {order.discordId ?? "unknown"}
                </p>
              </div>

              <div className="text-right shrink-0">
                <div className="text-[14px] font-bold text-accent-green">
                  {order.points}
                </div>
                <div className="text-[10px] font-semibold tracking-[0.1em] text-text-secondary uppercase">
                  Points
                </div>
              </div>

              <button
                onClick={() => toggleDelivered(order)}
                className={`px-3 py-1.5 rounded-md border text-[10px] font-bold tracking-[0.1em] uppercase shrink-0 transition-colors cursor-pointer ${
                  order.delivered
                    ? "bg-accent-green/10 text-accent-green border-accent-green/20 hover:bg-accent-green/20"
                    : "bg-accent-red/10 text-accent-red border-accent-red/20 hover:bg-accent-red/20"
                }`}
              >
                {order.delivered ? "Delivered" : "Undelivered"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
