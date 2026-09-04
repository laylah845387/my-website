"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { SupportTicket } from "@/types";
import PageContainer from "@/components/PageContainer";
import EmptyState from "@/components/EmptyState";
import {
  HelpCircle,
  MessageCircle,
  Inbox,
  History,
  ChevronDown,
  ChevronUp,
  Send,
  X,
  CheckCircle2,
} from "lucide-react";

const FAQ_ITEMS = [
  {
    q: "How do I earn points?",
    a: "Visit the Earn page to browse available offers. Click on any offer to start a task. Once the task is verified as complete, points are automatically added to your balance.",
  },
  {
    q: "How do I redeem rewards?",
    a: "Go to the Redeem page and select the reward you want. Confirm the redemption and it'll be added to your Redeem History.",
  },
  {
    q: "Why didn't I receive my points?",
    a: "Points are awarded after task verification. Some tasks may take a few minutes to verify. If you still haven't received points after 30 minutes, please contact support.",
  },
  {
    q: "Can I get a refund on a redeemed reward?",
    a: "Reward redemptions are final once confirmed. Please make sure you have selected the correct reward before confirming.",
  },
  {
    q: "I redeemed a reward but haven't received it, what do I do?",
    a: "If your order is marked as \"Undelivered\", send us a message here or open a ticket in our Discord server to receive your reward.",
  },
];

function formatDateShort(dateString: string): string {
  const date = new Date(dateString);
  const datePart = date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
  });
  const timePart = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${datePart}, ${timePart}`;
}

export default function SupportPage() {
  const { session, login, showToast } = useApp();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [contactMessage, setContactMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const [submittedTicket, setSubmittedTicket] = useState<SupportTicket | null>(null);

  useEffect(() => {
    if (!session) {
      setTicketsLoading(false);
      return;
    }

    let cancelled = false;
    fetch("/api/support/tickets")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setTickets(data.tickets ?? []);
      })
      .catch(() => {
        // Fail quietly — the page still works without history loaded.
      })
      .finally(() => {
        if (!cancelled) setTicketsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!session) {
      login();
      return;
    }

    if (!contactMessage.trim()) {
      showToast("Please enter a message.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: contactMessage.trim() }),
      });

      if (res.status === 401) {
        login();
        return;
      }

      const data = await res.json();

      if (!res.ok || !data.ticket) {
        showToast(data.error || "Something went wrong sending your message.", "error");
        return;
      }

      setTickets((prev) => [data.ticket, ...prev]);
      setSubmittedTicket(data.ticket);
      setContactMessage("");
    } catch {
      showToast("Something went wrong sending your message. Try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleExpandTicket = async (ticket: SupportTicket) => {
    const opening = expandedTicket !== ticket.id;
    setExpandedTicket(opening ? ticket.id : null);
    setReplyDraft("");

    if (opening && ticket.unreadForUser) {
      setTickets((prev) =>
        prev.map((t) => (t.id === ticket.id ? { ...t, unreadForUser: false } : t))
      );
      try {
        await fetch("/api/support/tickets/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketId: ticket.id }),
        });
      } catch {
        // Non-critical — worst case the ping reappears next load.
      }
    }
  };

  const handleUserReply = async (ticket: SupportTicket) => {
    const message = replyDraft.trim();
    if (!message) return;

    setSendingReply(true);
    try {
      const res = await fetch("/api/support/tickets/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: ticket.id, message }),
      });
      const data = await res.json();

      if (!res.ok || !data.ticket) {
        showToast(data.error || "Couldn't send your reply.", "error");
        return;
      }

      setTickets((prev) => prev.map((t) => (t.id === ticket.id ? data.ticket : t)));
      setReplyDraft("");
    } catch {
      showToast("Couldn't send your reply. Try again.", "error");
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <PageContainer>
      {/* Title */}
      <div className="pt-4 mb-10">
        <h1
          className="text-4xl md:text-5xl font-bold uppercase font-heading leading-none tracking-tight mb-3"
          style={{
            background: "linear-gradient(180deg, #e0e0e0 0%, #888888 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Support
        </h1>
        <p className="text-[13px] font-medium tracking-[0.18em] text-text-secondary uppercase">
          Need help? We&apos;re here for you.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* FAQ */}
        <div>
          <h2 className="text-[13px] font-bold tracking-[0.15em] text-text-primary uppercase mb-6 flex items-center gap-2">
            <HelpCircle size={16} className="text-accent-green" />
            Frequently Asked Questions
          </h2>

          <div className="space-y-2">
            {FAQ_ITEMS.map((item, index) => (
              <div
                key={index}
                className="rounded-xl bg-bg-card border border-border overflow-hidden"
              >
                <button
                  onClick={() =>
                    setExpandedFaq(expandedFaq === index ? null : index)
                  }
                  className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer"
                >
                  <span className="text-[13px] font-semibold text-text-primary pr-4">
                    {item.q}
                  </span>
                  {expandedFaq === index ? (
                    <ChevronUp size={16} className="text-text-muted shrink-0" />
                  ) : (
                    <ChevronDown size={16} className="text-text-muted shrink-0" />
                  )}
                </button>
                {expandedFaq === index && (
                  <div className="px-5 pb-4">
                    <p className="text-[12px] text-text-secondary leading-relaxed">
                      {item.a}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div>
          <h2 className="text-[13px] font-bold tracking-[0.15em] text-text-primary uppercase mb-6 flex items-center gap-2">
            <MessageCircle size={16} className="text-accent-green" />
            Contact Support
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-xl bg-bg-card border border-border p-5">
              <label
                htmlFor="support-message"
                className="block text-[12px] font-semibold tracking-[0.1em] text-text-secondary uppercase mb-3"
              >
                Your Message
              </label>
              <textarea
                id="support-message"
                value={contactMessage}
                onChange={(e) => setContactMessage(e.target.value)}
                placeholder="Describe your issue or question..."
                rows={6}
                className="w-full bg-bg-elevated border border-border rounded-lg px-4 py-3 text-[13px] text-text-primary placeholder-text-muted resize-none focus:outline-none focus:border-border-hover transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-bg font-semibold text-[13px] tracking-[0.08em] uppercase hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Send size={14} />
              {submitting ? "Sending..." : "Send Message"}
            </button>
          </form>
        </div>

        {/* Request History */}
        <div>
          <h2 className="text-[13px] font-bold tracking-[0.15em] text-text-primary uppercase mb-6 flex items-center gap-2">
            <Inbox size={16} className="text-accent-green" />
            Request History
          </h2>

          {!session ? (
            <EmptyState
              title="Not signed in"
              message="Sign in with Discord to view your past requests."
              icon={<History size={40} className="text-text-muted" />}
            />
          ) : ticketsLoading ? (
            <p className="text-[12px] text-text-muted">Loading...</p>
          ) : tickets.length === 0 ? (
            <EmptyState
              title="No requests yet"
              message="Messages you send will show up here."
              icon={<History size={40} className="text-text-muted" />}
            />
          ) : (
            <div className="space-y-2">
              {tickets.map((ticket) => {
                const isOpen = expandedTicket === ticket.id;
                return (
                  <div
                    key={ticket.id}
                    className="rounded-xl bg-bg-card border border-border overflow-hidden relative"
                  >
                    {ticket.unreadForUser && (
                      <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-accent-red" />
                    )}
                    <button
                      onClick={() => handleExpandTicket(ticket)}
                      className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer"
                    >
                      <div className="min-w-0 pr-4">
                        <p className="text-[13px] font-semibold text-text-primary truncate">
                          {ticket.message}
                        </p>
                        <p className="text-[11px] text-text-muted mt-1">
                          {formatDateShort(ticket.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2.5 py-1 rounded-md border text-[10px] font-bold tracking-[0.06em] uppercase whitespace-nowrap ${
                            ticket.status === "RESOLVED"
                              ? "bg-accent-green/10 text-accent-green border-accent-green/20"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
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
                      <div className="px-5 pb-4 space-y-3">
                        <div className="rounded-lg bg-bg-elevated border border-border p-3">
                          <p className="text-[10px] font-bold tracking-[0.1em] text-text-muted uppercase mb-1">
                            You
                          </p>
                          <p className="text-[12px] text-text-secondary leading-relaxed">
                            {ticket.message}
                          </p>
                        </div>

                        {ticket.replies.map((reply) => (
                          <div
                            key={reply.id}
                            className={
                              reply.from === "admin"
                                ? "rounded-lg bg-accent-green/5 border border-accent-green/20 p-3"
                                : "rounded-lg bg-bg-elevated border border-border p-3"
                            }
                          >
                            <p
                              className={`text-[10px] font-bold tracking-[0.1em] uppercase mb-1 ${
                                reply.from === "admin" ? "text-accent-green" : "text-text-muted"
                              }`}
                            >
                              {reply.from === "admin" ? "Support Team" : "You"}
                            </p>
                            <p className="text-[12px] text-text-secondary leading-relaxed">
                              {reply.message}
                            </p>
                          </div>
                        ))}

                        {ticket.replies.every((r) => r.from !== "admin") && (
                          <p className="text-[11px] text-text-muted italic">
                            No replies yet — we&apos;ll get back to you soon.
                          </p>
                        )}

                        {ticket.status === "OPEN" && (
                          <div className="space-y-2 pt-1">
                            <textarea
                              value={replyDraft}
                              onChange={(e) => setReplyDraft(e.target.value)}
                              placeholder="Reply to this request..."
                              rows={2}
                              className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-[12px] text-text-primary placeholder-text-muted resize-none focus:outline-none focus:border-border-hover transition-colors"
                            />
                            <button
                              onClick={() => handleUserReply(ticket)}
                              disabled={sendingReply || !replyDraft.trim()}
                              className="px-4 py-1.5 rounded-lg bg-white text-bg text-[11px] font-bold tracking-[0.06em] uppercase hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              {sendingReply ? "Sending..." : "Reply"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Ticket submitted confirmation modal */}
      {submittedTicket && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-overlay animate-fade-in"
            onClick={() => setSubmittedTicket(null)}
          />

          <div
            className="relative w-full max-w-[420px] bg-bg-card border border-border rounded-2xl shadow-2xl p-6 z-10"
            style={{ animation: "scaleIn 0.2s ease-out" }}
          >
            <button
              onClick={() => setSubmittedTicket(null)}
              className="absolute top-4 right-4 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X size={20} />
            </button>

            <div className="w-14 h-14 rounded-xl bg-bg-elevated border border-border flex items-center justify-center text-accent-green mx-auto mb-4">
              <CheckCircle2 size={26} />
            </div>

            <h3 className="text-xl font-bold tracking-[0.08em] text-center uppercase font-heading mb-3">
              Message Sent
            </h3>

            <div className="flex items-center justify-center rounded-lg bg-bg-elevated border border-border px-4 py-2.5 mb-4">
              <span className="text-[10px] font-bold tracking-[0.1em] text-text-muted uppercase">
                Support ID:&nbsp;
              </span>
              <span className="text-[12px] font-mono text-text-primary leading-none">
                {submittedTicket.id}
              </span>
            </div>

            <p className="text-[13px] text-text-secondary text-center leading-relaxed mb-6">
              Your message was sent to our support team and will be handled
              shortly. If you would like to speak 1-on-1 with a team member,
              join our Discord server to open a direct support ticket.
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
