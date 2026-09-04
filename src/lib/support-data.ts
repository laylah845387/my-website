import { getRedis } from "./redis";
import { SupportTicket, SupportReply } from "@/types";

function ticketsKey(discordId: string) {
  return `user:${discordId}:tickets`;
}
// Global index of every ticket ever created, across all accounts — powers
// the admin support inbox, mirroring the same pattern as orders.
const GLOBAL_TICKETS_KEY = "tickets:all";

const MAX_OPEN_TICKETS_PER_USER = 3;

// Plain 14-digit numeric ID — easy to read/type/reference, no prefix or letters.
function generateTicketId(): string {
  return `${Date.now()}${Math.floor(Math.random() * 10)}`;
}

function generateReplyId(): string {
  return `reply_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function createTicket(
  discordId: string,
  username: string | undefined,
  message: string
): Promise<{ ticket: SupportTicket | null; error?: string }> {
  const openCount = (await getTicketsForUser(discordId)).filter(
    (t) => t.status === "OPEN"
  ).length;

  if (openCount >= MAX_OPEN_TICKETS_PER_USER) {
    return {
      ticket: null,
      error: `You can only have ${MAX_OPEN_TICKETS_PER_USER} open requests at a time. Wait for one to be resolved before sending another.`,
    };
  }

  const redis = getRedis();
  const now = new Date().toISOString();

  const ticket: SupportTicket = {
    id: generateTicketId(),
    discordId,
    username,
    message,
    status: "OPEN",
    replies: [],
    unreadForUser: false,
    createdAt: now,
    updatedAt: now,
  };

  await redis.lpush(ticketsKey(discordId), ticket);
  await redis.lpush(GLOBAL_TICKETS_KEY, ticket);
  return { ticket };
}

export async function getTicketsForUser(discordId: string): Promise<SupportTicket[]> {
  const redis = getRedis();
  const raw = await redis.lrange<SupportTicket>(ticketsKey(discordId), 0, 49);
  return raw ?? [];
}

export async function getAllTickets(limit = 200): Promise<SupportTicket[]> {
  const redis = getRedis();
  const raw = await redis.lrange<SupportTicket>(GLOBAL_TICKETS_KEY, 0, limit - 1);
  return raw ?? [];
}

/**
 * Redis lists don't support "update by field", so mutating a ticket means
 * finding its slot by id (in both the personal list and the global index)
 * and rewriting that slot with LSET.
 */
async function mutateTicket(
  discordId: string,
  ticketId: string,
  mutate: (ticket: SupportTicket) => SupportTicket
): Promise<SupportTicket | null> {
  const redis = getRedis();

  const personalList = (await redis.lrange<SupportTicket>(ticketsKey(discordId), 0, -1)) ?? [];
  const personalIndex = personalList.findIndex((t) => t.id === ticketId);
  if (personalIndex === -1) return null;

  const updated = mutate(personalList[personalIndex]);
  await redis.lset(ticketsKey(discordId), personalIndex, updated);

  const globalList = (await redis.lrange<SupportTicket>(GLOBAL_TICKETS_KEY, 0, -1)) ?? [];
  const globalIndex = globalList.findIndex((t) => t.id === ticketId);
  if (globalIndex !== -1) {
    await redis.lset(GLOBAL_TICKETS_KEY, globalIndex, updated);
  }

  return updated;
}

export async function addAdminReply(
  discordId: string,
  ticketId: string,
  message: string,
  newStatus?: "OPEN" | "RESOLVED"
): Promise<SupportTicket | null> {
  return mutateTicket(discordId, ticketId, (ticket) => {
    const reply: SupportReply = {
      id: generateReplyId(),
      from: "admin",
      message,
      createdAt: new Date().toISOString(),
    };
    return {
      ...ticket,
      replies: [...ticket.replies, reply],
      status: newStatus ?? ticket.status,
      unreadForUser: true,
      updatedAt: new Date().toISOString(),
    };
  });
}

/**
 * Adds a reply from the ticket owner themself — only allowed while the
 * ticket is still OPEN, so people can't keep bumping a resolved ticket
 * forever (they'd open a new one instead).
 */
export async function addUserReply(
  discordId: string,
  ticketId: string,
  message: string
): Promise<{ ticket: SupportTicket | null; error?: string }> {
  const list = await getTicketsForUser(discordId);
  const existing = list.find((t) => t.id === ticketId);

  if (!existing) {
    return { ticket: null, error: "Ticket not found." };
  }
  if (existing.status !== "OPEN") {
    return { ticket: null, error: "This request is already resolved." };
  }

  const updated = await mutateTicket(discordId, ticketId, (ticket) => {
    const reply: SupportReply = {
      id: generateReplyId(),
      from: "user",
      message,
      createdAt: new Date().toISOString(),
    };
    return {
      ...ticket,
      replies: [...ticket.replies, reply],
      updatedAt: new Date().toISOString(),
    };
  });

  return { ticket: updated };
}

export async function markTicketRead(
  discordId: string,
  ticketId: string
): Promise<SupportTicket | null> {
  return mutateTicket(discordId, ticketId, (ticket) => ({
    ...ticket,
    unreadForUser: false,
  }));
}
