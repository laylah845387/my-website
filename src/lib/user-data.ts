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
