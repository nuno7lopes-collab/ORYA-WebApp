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
};

const buckets = new Map<string, number[]>();

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
  return requireDistributed && process.env.NODE_ENV === "production";
}

function unavailableError(message: string) {
  return new RateLimitBackendUnavailableError(message);
}

export async function rateLimit(
  req: NextRequest,
  { windowMs, max, keyPrefix = "rl", identifier, requireDistributed = false }: RateLimitOptions
): Promise<RateLimitResult> {
  const mustUseDistributed = shouldFailFastDistributed(requireDistributed);
  if (mustUseDistributed && !isRedisConfigured()) {
    throw unavailableError("REDIS_URL missing for distributed rate limiting.");
  }

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
      return { allowed: limitOk, retryAfter, backend: "redis" };
    } catch (err) {
      if (mustUseDistributed) {
        throw unavailableError("Distributed rate limiting backend unavailable.");
      }
      console.warn("[rateLimit] redis falhou, a usar memória.", err);
    }
  } else if (mustUseDistributed) {
    throw unavailableError("Distributed rate limiting backend unavailable.");
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

  return { allowed: limitOk, retryAfter, backend: "memory" };
}
