import { getRedis } from "./redis";
import { SupportTicket, SupportReply } from "@/types";

function ticketsKey(discordId: string) {
  return `user:${discordId}:tickets`;
}
// Global index of every ticket ever created, across all accounts — powers
// the admin support inbox, mirroring the same pattern as orders.
const GLOBAL_TICKETS_KEY = "tickets:all";

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function createTicket(
  discordId: string,
  username: string | undefined,
  message: string
): Promise<SupportTicket> {
  const redis = getRedis();
  const now = new Date().toISOString();

  const ticket: SupportTicket = {
    id: generateId("ticket"),
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
  return ticket;
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
      id: generateId("reply"),
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

export async function markTicketRead(
  discordId: string,
  ticketId: string
): Promise<SupportTicket | null> {
  return mutateTicket(discordId, ticketId, (ticket) => ({
    ...ticket,
    unreadForUser: false,
  }));
}
