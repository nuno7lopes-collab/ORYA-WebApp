import type { NextRequest } from "next/server";
import { getClientIp } from "@/lib/auth/requestValidation";
import { Redis } from "@upstash/redis";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix?: string;
  identifier?: string | null;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfter: number;
};

const buckets = new Map<string, number[]>();
let redisClient: Redis | null | undefined;

function getRedisClient(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    redisClient = null;
    return null;
  }
  redisClient = Redis.fromEnv();
  return redisClient;
}

export async function rateLimit(
  req: NextRequest,
  { windowMs, max, keyPrefix = "rl", identifier }: RateLimitOptions
): Promise<RateLimitResult> {
  const ip = getClientIp(req);
  const keyParts = [keyPrefix, ip];
  const id = identifier?.trim().toLowerCase();
  if (id) keyParts.push(id);
  const key = keyParts.join(":");

  const redis = getRedisClient();
  if (redis) {
    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.pexpire(key, windowMs);
      }
      const ttl = await redis.pttl(key);
      const limitOk = count <= max;
      const effectiveTtl = ttl > 0 ? ttl : windowMs;
      const retryAfter = limitOk ? 0 : Math.max(1, Math.ceil(effectiveTtl / 1000));
      return { allowed: limitOk, retryAfter };
    } catch (err) {
      console.warn("[rateLimit] redis falhou, a usar memória.", err);
    }
  }

  const now = Date.now();
  const windowStart = now - windowMs;
  const hits = (buckets.get(key) ?? []).filter((ts) => ts > windowStart);
  hits.push(now);
  buckets.set(key, hits);

  const limitOk = hits.length <= max;
  const retryAfter = limitOk
    ? 0
    : Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000));

  return { allowed: limitOk, retryAfter };
}
