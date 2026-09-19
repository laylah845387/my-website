import { Order } from "@/types";
import { getSupabase } from "./supabase";

export async function getPoints(discordId: string): Promise<number> {
  const { data, error } = await getSupabase()
    .from("user_accounts")
    .select("points")
    .eq("discord_id", discordId)
    .maybeSingle();
  if (error) throw error;
  return data?.points ?? 0;
}

export async function getCompletedOffers(discordId: string): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from("completed_offers")
    .select("offer_id")
    .eq("discord_id", discordId);
  if (error) throw error;
  return (data ?? []).map((row) => row.offer_id);
}

export async function getDismissedOffers(discordId: string): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from("dismissed_offers")
    .select("offer_id")
    .eq("discord_id", discordId);
  if (error) throw error;
  return (data ?? []).map((row) => row.offer_id);
}

export async function dismissOffer(discordId: string, offerId: string): Promise<boolean> {
  const completed = await getSupabase()
    .from("completed_offers")
    .select("offer_id")
    .eq("discord_id", discordId)
    .eq("offer_id", offerId)
    .maybeSingle();
  if (completed.error) throw completed.error;
  if (completed.data) return false;

  const { error } = await getSupabase()
    .from("dismissed_offers")
    .upsert({ discord_id: discordId, offer_id: offerId }, { onConflict: "discord_id,offer_id" });
  if (error) throw error;
  return true;
}

export async function getOrders(discordId: string): Promise<Order[]> {
  const { data, error } = await getSupabase()
    .from("orders")
    .select("order_data")
    .eq("discord_id", discordId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((row) => row.order_data as Order);
}

export async function getUserSnapshot(discordId: string) {
  const [points, completedOffers, orders] = await Promise.all([
    getPoints(discordId),
    getCompletedOffers(discordId),
    getOrders(discordId),
  ]);
  return { points, completedOffers, orders };
}

export async function adjustPoints(discordId: string, delta: number): Promise<number> {
  const { data, error } = await getSupabase().rpc("adjust_user_points", {
    p_discord_id: discordId,
    p_delta: delta,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function markCpxTransactionStatus(
  transId: string,
  newStatus: string
): Promise<string | null> {
  const db = getSupabase();
  const { data: previous, error: readError } = await db
    .from("cpx_transaction_status")
    .select("status")
    .eq("transaction_id", transId)
    .maybeSingle();
  if (readError) throw readError;

  const { error } = await db.from("cpx_transaction_status").upsert({
    transaction_id: transId,
    status: newStatus,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return previous?.status ?? null;
}

export interface AffikeTransactionRecord {
  userId: string;
  points: number;
  status: string;
  offerId?: string | null;
  credited?: boolean;
}

export async function markAffikeTransaction(
  txnId: string,
  record: AffikeTransactionRecord
): Promise<AffikeTransactionRecord | null> {
  const db = getSupabase();
  const { data: previous, error: readError } = await db
    .from("affike_transactions")
    .select("user_id, points, status, offer_id, credited")
    .eq("transaction_id", txnId)
    .maybeSingle();
  if (readError) throw readError;

  const next = {
    user_id: record.userId,
    points: record.points,
    status: record.status,
    offer_id: record.offerId ?? previous?.offer_id ?? null,
    credited: record.credited ?? previous?.credited ?? false,
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from("affike_transactions").upsert({ transaction_id: txnId, ...next });
  if (error) throw error;
  return previous
    ? {
        userId: previous.user_id,
        points: previous.points,
        status: previous.status,
        offerId: previous.offer_id,
        credited: previous.credited,
      }
    : null;
}

export async function getAffikeTransactions(
  discordId: string,
  offerId?: string
): Promise<AffikeTransactionRecord[]> {
  let query = getSupabase()
    .from("affike_transactions")
    .select("user_id, points, status, offer_id, credited, updated_at")
    .eq("user_id", discordId)
    .order("updated_at", { ascending: false });
  if (offerId) query = query.eq("offer_id", offerId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({
    userId: row.user_id,
    points: row.points,
    status: row.status,
    offerId: row.offer_id,
    credited: row.credited,
  }));
}

export interface OfferwallMeTransactionRecord {
  userId: string;
  points: number;
  status: string;
  offerId?: string | null;
  offerName?: string | null;
  credited?: boolean;
}

export async function markOfferwallMeTransaction(
  transactionId: string,
  record: OfferwallMeTransactionRecord
): Promise<OfferwallMeTransactionRecord | null> {
  const db = getSupabase();
  const { data: previous, error: readError } = await db
    .from("offerwall_me_transactions")
    .select("user_id, points, status, offer_id, offer_name, credited")
    .eq("transaction_id", transactionId)
    .maybeSingle();
  if (readError) throw readError;

  const { error } = await db.from("offerwall_me_transactions").upsert({
    transaction_id: transactionId,
    user_id: record.userId,
    points: record.points,
    status: record.status,
    offer_id: record.offerId ?? previous?.offer_id ?? null,
    offer_name: record.offerName ?? previous?.offer_name ?? null,
    credited: record.credited ?? previous?.credited ?? false,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return previous
    ? {
        userId: previous.user_id,
        points: previous.points,
        status: previous.status,
        offerId: previous.offer_id,
        offerName: previous.offer_name,
        credited: previous.credited,
      }
    : null;
}

export async function recordOfferwallMeMilestone(
  discordId: string,
  offerId: string,
  reward: number,
  transactionId: string
): Promise<void> {
  const { error } = await getSupabase().from("offerwall_me_milestones").upsert(
    { discord_id: discordId, offer_id: offerId, reward, transaction_id: transactionId },
    { onConflict: "discord_id,offer_id,reward,transaction_id" }
  );
  if (error) throw error;
}

export async function removeOfferwallMeMilestone(
  discordId: string,
  offerId: string,
  reward: number,
  transactionId: string
): Promise<void> {
  const { error } = await getSupabase()
    .from("offerwall_me_milestones")
    .delete()
    .match({ discord_id: discordId, offer_id: offerId, reward, transaction_id: transactionId });
  if (error) throw error;
}

export async function recordOfferwallMeMilestoneByName(
  discordId: string,
  offerName: string,
  reward: number,
  transactionId: string
): Promise<void> {
  const { error } = await getSupabase().from("offerwall_me_milestone_names").upsert(
    { discord_id: discordId, offer_name: offerName, reward, transaction_id: transactionId },
    { onConflict: "discord_id,offer_name,reward,transaction_id" }
  );
  if (error) throw error;
}

export async function removeOfferwallMeMilestoneByName(
  discordId: string,
  offerName: string,
  reward: number,
  transactionId: string
): Promise<void> {
  const { error } = await getSupabase()
    .from("offerwall_me_milestone_names")
    .delete()
    .match({ discord_id: discordId, offer_name: offerName, reward, transaction_id: transactionId });
  if (error) throw error;
}

export async function getOfferwallMeMilestoneRewards(
  discordId: string,
  offerId: string
): Promise<number[]> {
  const { data, error } = await getSupabase()
    .from("offerwall_me_milestones")
    .select("reward")
    .eq("discord_id", discordId)
    .eq("offer_id", offerId);
  if (error) throw error;
  return (data ?? []).map((row) => row.reward);
}

export async function getOfferwallMeMilestoneRewardsForOffers(
  discordId: string,
  offerIds: string[]
): Promise<Map<string, number[]>> {
  if (offerIds.length === 0) return new Map();
  const { data, error } = await getSupabase()
    .from("offerwall_me_milestones")
    .select("offer_id, reward")
    .eq("discord_id", discordId)
    .in("offer_id", [...new Set(offerIds)]);
  if (error) throw error;
  const result = new Map<string, number[]>();
  for (const row of data ?? []) {
    result.set(row.offer_id, [...(result.get(row.offer_id) ?? []), row.reward]);
  }
  return result;
}

export async function getOfferwallMeMilestoneRewardsByName(
  discordId: string,
  offerName: string
): Promise<number[]> {
  const records = await getOfferwallMeMilestoneNameRecords(discordId);
  const normalizedName = offerName.trim().toLowerCase();
  return records
    .filter((record) => record.offerName.trim().toLowerCase() === normalizedName)
    .map((record) => record.reward)
    .filter((value) => Number.isFinite(value));
}

export async function getOfferwallMeMilestoneNameRecords(
  discordId: string
): Promise<Array<{ offerName: string; reward: number }>> {
  const { data, error } = await getSupabase()
    .from("offerwall_me_milestone_names")
    .select("offer_name, reward")
    .eq("discord_id", discordId);
  if (error) throw error;
  return (data ?? []).map((row) => ({ offerName: row.offer_name, reward: row.reward }));
}

export async function markOfferComplete(
  discordId: string,
  offerId: string,
  points: number
): Promise<{ alreadyCompleted: boolean; points: number }> {
  const { data, error } = await getSupabase().rpc("mark_offer_complete_and_credit", {
    p_discord_id: discordId,
    p_offer_id: offerId,
    p_points: points,
  });
  if (error) throw error;
  return {
    alreadyCompleted: Boolean(data?.alreadyCompleted),
    points: Number(data?.points ?? 0),
  };
}

export async function redeemRewardForUser(
  discordId: string,
  order: Order
): Promise<{ success: boolean; points: number }> {
  const { data, error } = await getSupabase().rpc("redeem_user_reward", {
    p_discord_id: discordId,
    p_order: order,
    p_points: order.points,
  });
  if (error) throw error;
  return { success: Boolean(data?.success), points: Number(data?.points ?? 0) };
}

export async function getAllOrders(limit = 200): Promise<Order[]> {
  const { data, error } = await getSupabase()
    .from("orders")
    .select("order_data")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => row.order_data as Order);
}

export async function setOrderDelivered(
  discordId: string,
  orderId: string,
  delivered: boolean
): Promise<Order | null> {
  const db = getSupabase();
  const { data: row, error: readError } = await db
    .from("orders")
    .select("order_data")
    .eq("discord_id", discordId)
    .eq("id", orderId)
    .maybeSingle();
  if (readError) throw readError;
  if (!row) return null;

  const updated = { ...(row.order_data as Order), delivered };
  const { error } = await db
    .from("orders")
    .update({ order_data: updated })
    .eq("discord_id", discordId)
    .eq("id", orderId);
  if (error) throw error;
  return updated;
}
