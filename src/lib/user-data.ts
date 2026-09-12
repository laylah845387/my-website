import { getRedis } from "./redis";
import { Order } from "@/types";

/**
 * Per-account persistent data (points, completed offers, order history),
 * stored in Redis and keyed by the visitor's Discord ID. This replaces
 * the old localStorage-based storage, so progress now actually belongs
 * to the signed-in Discord account rather than to a single browser.
 */

function pointsKey(discordId: string) {
  return `user:${discordId}:points`;
}
function completedKey(discordId: string) {
  return `user:${discordId}:completed`;
}
function ordersKey(discordId: string) {
  return `user:${discordId}:orders`;
}
// A single global list of every order ever placed, across all accounts —
// this is what powers the admin "manage deliveries" view, since orders
// otherwise only live inside each individual user's own list.
const GLOBAL_ORDERS_KEY = "orders:all";

export async function getPoints(discordId: string): Promise<number> {
  const redis = getRedis();
  const value = await redis.get<number>(pointsKey(discordId));
  return value ?? 0;
}

export async function getCompletedOffers(discordId: string): Promise<string[]> {
  const redis = getRedis();
  const members = await redis.smembers(completedKey(discordId));
  return members ?? [];
}

function offerProgressKey(discordId: string, offerId: string) {
  return `user:${discordId}:offer-progress:${offerId}`;
}

export async function getOfferProgress(discordId: string, offerId: string): Promise<string[]> {
  const redis = getRedis();
  const members = await redis.smembers(offerProgressKey(discordId, offerId));
  return members ?? [];
}

export async function getUserOfferProgress(discordId: string): Promise<Record<string, string[]>> {
  const redis = getRedis();
  const keys = await redis.keys(`user:${discordId}:offer-progress:*`);
  const progress: Record<string, string[]> = {};

  for (const key of keys) {
    const offerId = key.replace(`user:${discordId}:offer-progress:`, "");
    progress[offerId] = (await redis.smembers(key)) ?? [];
  }

  return progress;
}

export async function toggleOfferMilestone(
  discordId: string,
  offerId: string,
  milestoneId: string,
  points: number,
  completed: boolean
): Promise<{ points: number; completedMilestones: string[] }> {
  const redis = getRedis();
  const key = offerProgressKey(discordId, offerId);
  const current = new Set((await redis.smembers(key)) ?? []);

  if (completed && !current.has(milestoneId)) {
    await redis.sadd(key, milestoneId);
    await adjustPoints(discordId, points);
  }

  if (!completed && current.has(milestoneId)) {
    await redis.srem(key, milestoneId);
    await adjustPoints(discordId, -points);
  }

  const updated = (await redis.smembers(key)) ?? [];
  return { points: await getPoints(discordId), completedMilestones: updated };
}

export async function getOrders(discordId: string): Promise<Order[]> {
  const redis = getRedis();
  const raw = await redis.lrange<Order>(ordersKey(discordId), 0, 49);
  return raw ?? [];
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
  const redis = getRedis();
  return redis.incrby(pointsKey(discordId), delta);
}

/**
 * CPX Research reuses the same trans_id for a transaction's entire
 * lifecycle — first calling with status "1" (completed), and possibly
 * calling again later with status "2" (canceled/fraud) for the SAME
 * trans_id if it's later reversed. Records the last known status for a
 * transaction and returns whatever the previous status was (or null if
 * this is the first time we've seen it), so the caller can tell a
 * genuine state change from a duplicate resend.
 */
export async function markCpxTransactionStatus(
  transId: string,
  newStatus: string
): Promise<string | null> {
  const redis = getRedis();
  const key = "cpx:transaction-status";
  const previous = await redis.hget<string>(key, transId);
  await redis.hset(key, { [transId]: newStatus });
  return previous ?? null;
}

export interface AffikeTransactionRecord {
  userId: string;
  points: number;
  status: string;
}

/**
 * Affike's postback can, in principle, resend the same txn_id with a
 * different status later (e.g. an approved conversion reversed as a
 * chargeback) — the same lifecycle CPX Research has. Unlike CPX, Affike
 * doesn't echo back how many points it thinks we credited, so we record
 * that ourselves here ({userId, points, status}) the first time we see a
 * txn_id, so a later status change can be reversed by exactly the amount
 * originally credited instead of guessing. Returns the previous record
 * (or null if this is the first time we've seen this txn_id).
 */
export async function markAffikeTransaction(
  txnId: string,
  record: AffikeTransactionRecord
): Promise<AffikeTransactionRecord | null> {
  const redis = getRedis();
  const key = "affike:transactions";
  const previous = await redis.hget<AffikeTransactionRecord>(key, txnId);
  await redis.hset(key, { [txnId]: record });
  return previous ?? null;
}

/**
 * Marks an offer complete and credits points, unless it was already
 * completed by this account (SADD returns 0 if the member already
 * existed in the set, which we use to detect that atomically).
 */
export async function markOfferComplete(
  discordId: string,
  offerId: string,
  points: number
): Promise<{ alreadyCompleted: boolean; points: number }> {
  const redis = getRedis();
  const added = await redis.sadd(completedKey(discordId), offerId);

  if (added === 0) {
    const current = await getPoints(discordId);
    return { alreadyCompleted: true, points: current };
  }

  const newPoints = await redis.incrby(pointsKey(discordId), points);
  return { alreadyCompleted: false, points: newPoints };
}

/**
 * Attempts to redeem a reward. Returns success: false without changing
 * anything if the account doesn't have enough points.
 */
export async function redeemRewardForUser(
  discordId: string,
  order: Order
): Promise<{ success: boolean; points: number }> {
  const redis = getRedis();
  const current = await getPoints(discordId);

  if (current < order.points) {
    return { success: false, points: current };
  }

  const newPoints = await redis.decrby(pointsKey(discordId), order.points);
  await redis.lpush(ordersKey(discordId), order);
  await redis.lpush(GLOBAL_ORDERS_KEY, order);
  return { success: true, points: newPoints };
}

/**
 * All orders ever placed, across every account — for the admin
 * delivery-management view. Most recent first.
 */
export async function getAllOrders(limit = 200): Promise<Order[]> {
  const redis = getRedis();
  const raw = await redis.lrange<Order>(GLOBAL_ORDERS_KEY, 0, limit - 1);
  return raw ?? [];
}

/**
 * Flips an order's delivered flag, updating both the owning account's
 * personal order list and the global admin index so they stay in sync.
 * Redis lists don't support "update by field", so we find the matching
 * entry by id and rewrite that one slot with LSET.
 */
export async function setOrderDelivered(
  discordId: string,
  orderId: string,
  delivered: boolean
): Promise<Order | null> {
  const redis = getRedis();

  const personalList = (await redis.lrange<Order>(ordersKey(discordId), 0, -1)) ?? [];
  const personalIndex = personalList.findIndex((o) => o.id === orderId);
  if (personalIndex === -1) return null;

  const updated: Order = { ...personalList[personalIndex], delivered };
  await redis.lset(ordersKey(discordId), personalIndex, updated);

  const globalList = (await redis.lrange<Order>(GLOBAL_ORDERS_KEY, 0, -1)) ?? [];
  const globalIndex = globalList.findIndex((o) => o.id === orderId);
  if (globalIndex !== -1) {
    await redis.lset(GLOBAL_ORDERS_KEY, globalIndex, updated);
  }

  return updated;
}
