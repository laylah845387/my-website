import { Redis } from "@upstash/redis";

let client: Redis | null = null;

/**
 * Lazily creates a single shared Redis client, configured from
 * UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars.
 */
export function getRedis(): Redis {
  if (!client) {
    client = Redis.fromEnv();
  }
  return client;
}
