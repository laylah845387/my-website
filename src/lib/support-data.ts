import { SupportTicket, SupportReply } from "@/types";
import { getSupabase } from "./supabase";

const MAX_OPEN_TICKETS_PER_USER = 3;

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
  const openCount = (await getTicketsForUser(discordId)).filter((ticket) => ticket.status === "OPEN").length;
  if (openCount >= MAX_OPEN_TICKETS_PER_USER) {
    return {
      ticket: null,
      error: `You can only have ${MAX_OPEN_TICKETS_PER_USER} open requests at a time. Wait for one to be resolved before sending another.`,
    };
  }

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
  const { error } = await getSupabase().from("support_tickets").insert({
    id: ticket.id,
    discord_id: discordId,
    ticket_data: ticket,
    created_at: now,
    updated_at: now,
  });
  if (error) throw error;
  return { ticket };
}

export async function getTicketsForUser(discordId: string): Promise<SupportTicket[]> {
  const { data, error } = await getSupabase()
    .from("support_tickets")
    .select("ticket_data")
    .eq("discord_id", discordId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((row) => row.ticket_data as SupportTicket);
}

export async function getAllTickets(limit = 200): Promise<SupportTicket[]> {
  const { data, error } = await getSupabase()
    .from("support_tickets")
    .select("ticket_data")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => row.ticket_data as SupportTicket);
}

async function mutateTicket(
  discordId: string,
  ticketId: string,
  mutate: (ticket: SupportTicket) => SupportTicket
): Promise<SupportTicket | null> {
  const db = getSupabase();
  const { data: row, error: readError } = await db
    .from("support_tickets")
    .select("ticket_data")
    .eq("discord_id", discordId)
    .eq("id", ticketId)
    .maybeSingle();
  if (readError) throw readError;
  if (!row) return null;

  const updated = mutate(row.ticket_data as SupportTicket);
  const { error } = await db
    .from("support_tickets")
    .update({ ticket_data: updated, updated_at: updated.updatedAt })
    .eq("discord_id", discordId)
    .eq("id", ticketId);
  if (error) throw error;
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

export async function addUserReply(
  discordId: string,
  ticketId: string,
  message: string
): Promise<{ ticket: SupportTicket | null; error?: string }> {
  const existing = (await getTicketsForUser(discordId)).find((ticket) => ticket.id === ticketId);
  if (!existing) return { ticket: null, error: "Ticket not found." };
  if (existing.status !== "OPEN") {
    return { ticket: null, error: "This request is already resolved." };
  }

  const updated = await mutateTicket(discordId, ticketId, (ticket) => ({
    ...ticket,
    replies: [
      ...ticket.replies,
      {
        id: generateReplyId(),
        from: "user",
        message,
        createdAt: new Date().toISOString(),
      },
    ],
    updatedAt: new Date().toISOString(),
  }));
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
