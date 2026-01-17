import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/auth/rateLimit";

type RateLimitConfig = {
  windowMs?: number;
  max?: number;
  keyPrefix?: string;
  identifier?: string | null;
};

export async function enforcePublicRateLimit(req: NextRequest, config?: RateLimitConfig) {
  const limiter = await rateLimit(req, {
    windowMs: config?.windowMs ?? 60_000,
    max: config?.max ?? 120,
    keyPrefix: config?.keyPrefix ?? "padel_public",
    identifier: config?.identifier ?? null,
  });
  if (limiter.allowed) return null;
  return NextResponse.json(
    { ok: false, error: "RATE_LIMITED", retryAfter: limiter.retryAfter },
    {
      status: 429,
      headers: {
        "Retry-After": String(limiter.retryAfter),
      },
    },
  );
}
