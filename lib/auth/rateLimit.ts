import type { NextRequest } from "next/server";
import { getClientIp } from "@/lib/auth/requestValidation";
import { getRedisCommandClient, isRedisConfigured } from "@/lib/redis/client";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix?: string;
  identifier?: string | null;
  requireDistributed?: boolean;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfter: number;
  backend: "redis" | "memory";
  degraded: boolean;
};

type MemoryBucket = {
  hits: number[];
  expiresAt: number;
};

const buckets = new Map<string, MemoryBucket>();
const MEMORY_BUCKET_CLEANUP_INTERVAL_MS = 30_000;
let nextMemoryCleanupAt = 0;

export class RateLimitBackendUnavailableError extends Error {
  readonly code = "RATE_LIMIT_BACKEND_UNAVAILABLE";

  constructor(message = "Distributed rate limit backend unavailable.") {
    super(message);
    this.name = "RateLimitBackendUnavailableError";
  }
}

export function isRateLimitBackendUnavailableError(err: unknown): err is RateLimitBackendUnavailableError {
  return err instanceof RateLimitBackendUnavailableError;
}

function shouldFailFastDistributed(requireDistributed: boolean) {
  return requireDistributed;
}

function cleanupExpiredMemoryBuckets(now: number) {
  if (now < nextMemoryCleanupAt) return;
  nextMemoryCleanupAt = now + MEMORY_BUCKET_CLEANUP_INTERVAL_MS;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.expiresAt <= now) {
      buckets.delete(key);
    }
  }
}

export async function rateLimit(
  req: NextRequest,
  { windowMs, max, keyPrefix = "rl", identifier, requireDistributed = false }: RateLimitOptions
): Promise<RateLimitResult> {
  const mustUseDistributed = shouldFailFastDistributed(requireDistributed);

  const ip = getClientIp(req);
  const keyParts = [keyPrefix, ip];
  const id = identifier?.trim().toLowerCase();
  if (id) keyParts.push(id);
  const key = keyParts.join(":");

  if (isRedisConfigured()) {
    try {
      const redis = await getRedisCommandClient();
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.pExpire(key, windowMs);
      }
      const ttl = await redis.pTTL(key);
      const limitOk = count <= max;
      const effectiveTtl = ttl > 0 ? ttl : windowMs;
      const retryAfter = limitOk ? 0 : Math.max(1, Math.ceil(effectiveTtl / 1000));
      return { allowed: limitOk, retryAfter, backend: "redis", degraded: false };
    } catch (err) {
      if (mustUseDistributed) {
        throw new RateLimitBackendUnavailableError("Redis indisponível para rate limit distribuído.");
      }
      console.warn(
        "[rateLimit] redis falhou, a usar memória.",
        err
      );
    }
  }

  const now = Date.now();
  cleanupExpiredMemoryBuckets(now);

  const windowStart = now - windowMs;
  const hits = (buckets.get(key)?.hits ?? []).filter((ts) => ts > windowStart);
  hits.push(now);
  buckets.set(key, { hits, expiresAt: now + windowMs });

  const limitOk = hits.length <= max;
  const retryAfter = limitOk
    ? 0
    : Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000));

  return { allowed: limitOk, retryAfter, backend: "memory", degraded: true };
}
