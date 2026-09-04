"use client";

import { useState } from "react";
import Image from "next/image";
import { Order, SupportTicket } from "@/types";
import { formatDate } from "@/lib/utils";
import { Lock, ChevronDown, ChevronUp } from "lucide-react";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"deliveries" | "support">("deliveries");

  const [orders, setOrders] = useState<Order[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [sendingReply, setSendingReply] = useState<string | null>(null);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const [ordersRes, ticketsRes] = await Promise.all([
        fetch("/api/admin/orders", { headers: { "x-admin-password": password } }),
        fetch("/api/admin/tickets", { headers: { "x-admin-password": password } }),
      ]);

      if (ordersRes.status === 401 || ticketsRes.status === 401) {
        setError("Wrong password.");
        return;
      }

      const ordersData = await ordersRes.json();
      const ticketsData = await ticketsRes.json();
      setOrders(ordersData.orders ?? []);
      setTickets(ticketsData.tickets ?? []);
      setAuthed(true);
    } catch {
      setError("Something went wrong loading the dashboard.");
    } finally {
      setLoading(false);
    }
  };

  const toggleDelivered = async (order: Order) => {
    if (!order.discordId) return;
    const newValue = !order.delivered;

    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, delivered: newValue } : o))
    );

    try {
      const res = await fetch("/api/admin/orders/deliver", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ orderId: order.id, discordId: order.discordId, delivered: newValue }),
      });
      if (!res.ok) {
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

  const sendReply = async (ticket: SupportTicket, markResolved: boolean) => {
    const message = (replyDrafts[ticket.id] || "").trim();
    if (!message) return;

    setSendingReply(ticket.id);
    try {
      const res = await fetch("/api/admin/tickets/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({
          ticketId: ticket.id,
          discordId: ticket.discordId,
          message,
          status: markResolved ? "RESOLVED" : undefined,
        }),
      });
      const data = await res.json();
      if (data.ticket) {
        setTickets((prev) => prev.map((t) => (t.id === ticket.id ? data.ticket : t)));
        setReplyDrafts((prev) => ({ ...prev, [ticket.id]: "" }));
      }
    } finally {
      setSendingReply(null);
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
          {error && <p className="text-[12px] text-accent-red mb-3">{error}</p>}
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
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setTab("deliveries")}
          className={`px-4 py-2 rounded-lg text-[13px] font-bold tracking-[0.08em] uppercase cursor-pointer transition-colors ${
            tab === "deliveries"
              ? "bg-white text-bg"
              : "bg-bg-card border border-border text-text-secondary hover:text-text-primary"
          }`}
        >
          Deliveries
        </button>
        <button
          onClick={() => setTab("support")}
          className={`px-4 py-2 rounded-lg text-[13px] font-bold tracking-[0.08em] uppercase cursor-pointer transition-colors ${
            tab === "support"
              ? "bg-white text-bg"
              : "bg-bg-card border border-border text-text-secondary hover:text-text-primary"
          }`}
        >
          Support
        </button>
      </div>

      {tab === "deliveries" && (
        <>
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
        </>
      )}

      {tab === "support" && (
        <>
          <h1 className="text-2xl font-bold uppercase tracking-[0.08em] font-heading mb-6">
            Support Tickets
          </h1>

          {tickets.length === 0 ? (
            <p className="text-[13px] text-text-secondary">No tickets yet.</p>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => {
                const isOpen = expandedTicket === ticket.id;
                return (
                  <div
                    key={ticket.id}
                    className="rounded-xl bg-bg-card border border-border overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedTicket(isOpen ? null : ticket.id)}
                      className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer"
                    >
                      <div className="min-w-0 pr-4">
                        <p className="text-[13px] font-semibold text-text-primary truncate">
                          {ticket.message}
                        </p>
                        <p className="text-[11px] text-text-muted mt-1">
                          {ticket.username ?? "Unknown"} &middot; {ticket.discordId} &middot;{" "}
                          {formatDate(ticket.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2.5 py-1 rounded-md border text-[10px] font-bold tracking-[0.06em] uppercase whitespace-nowrap ${
                            ticket.status === "RESOLVED"
                              ? "bg-accent-green/10 text-accent-green border-accent-green/20"
                              : "bg-bg-elevated text-text-secondary border-border"
                          }`}
                        >
                          {ticket.status === "RESOLVED" ? "Resolved" : "Open"}
                        </span>
                        {isOpen ? (
                          <ChevronUp size={16} className="text-text-muted" />
                        ) : (
                          <ChevronDown size={16} className="text-text-muted" />
                        )}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-5 pb-5 space-y-3">
                        <div className="rounded-lg bg-bg-elevated border border-border p-3">
                          <p className="text-[10px] font-bold tracking-[0.1em] text-text-muted uppercase mb-1">
                            {ticket.username ?? "User"}
                          </p>
                          <p className="text-[12px] text-text-secondary leading-relaxed">
                            {ticket.message}
                          </p>
                        </div>

                        {ticket.replies.map((reply) => (
                          <div
                            key={reply.id}
                            className="rounded-lg bg-accent-green/5 border border-accent-green/20 p-3"
                          >
                            <p className="text-[10px] font-bold tracking-[0.1em] text-accent-green uppercase mb-1">
                              Support Team
                            </p>
                            <p className="text-[12px] text-text-secondary leading-relaxed">
                              {reply.message}
                            </p>
                          </div>
                        ))}

                        <textarea
                          value={replyDrafts[ticket.id] || ""}
                          onChange={(e) =>
                            setReplyDrafts((prev) => ({ ...prev, [ticket.id]: e.target.value }))
                          }
                          placeholder="Write a reply..."
                          rows={3}
                          className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-[12px] text-text-primary placeholder-text-muted resize-none focus:outline-none focus:border-border-hover transition-colors"
                        />

                        <div className="flex gap-2">
                          <button
                            onClick={() => sendReply(ticket, false)}
                            disabled={sendingReply === ticket.id}
                            className="px-4 py-2 rounded-lg bg-white text-bg text-[12px] font-bold tracking-[0.06em] uppercase hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            Reply
                          </button>
                          <button
                            onClick={() => sendReply(ticket, true)}
                            disabled={sendingReply === ticket.id}
                            className="px-4 py-2 rounded-lg bg-accent-green/10 text-accent-green border border-accent-green/20 text-[12px] font-bold tracking-[0.06em] uppercase hover:bg-accent-green/20 transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            Reply &amp; Resolve
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
