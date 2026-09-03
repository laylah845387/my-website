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
function offerViewsKey(discordId: string) {
  return `user:${discordId}:offer-views`;
}

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

/**
 * How many times each completed offer has been shown to the user on a
 * fresh page load since they completed it. Used to keep the "completed"
 * label visible for exactly one return visit, then hide the offer
 * entirely on the next one.
 */
export async function getOfferViewCounts(discordId: string): Promise<Record<string, number>> {
  const redis = getRedis();
  const raw = await redis.hgetall<Record<string, number>>(offerViewsKey(discordId));
  if (!raw) return {};
  const parsed: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    parsed[key] = Number(value) || 0;
  }
  return parsed;
}

export async function markOfferViewed(discordId: string, offerId: string): Promise<void> {
  const redis = getRedis();
  await redis.hincrby(offerViewsKey(discordId), offerId, 1);
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
  return { success: true, points: newPoints };
}
