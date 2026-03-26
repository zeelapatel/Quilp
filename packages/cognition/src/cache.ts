import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error("REDIS_URL is required");
}

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;
const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

export function buildCacheKey(messageId: string, format: string, platform: string): string {
  return `quilp:generation:${messageId}:${platform}:${format}`;
}

export async function getCachedGeneration(key: string): Promise<string | null> {
  return redis.get(key);
}

export async function setCachedGeneration(key: string, content: string): Promise<void> {
  await redis.setex(key, CACHE_TTL_SECONDS, content);
}
