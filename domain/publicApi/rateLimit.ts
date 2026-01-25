import type { NextRequest } from "next/server";
import { rateLimit } from "@/lib/auth/rateLimit";

export async function enforcePublicApiRateLimit(params: {
  req: NextRequest;
  apiKeyId: string;
  organizationId: number;
}) {
  const { req, apiKeyId, organizationId } = params;
  const limiter = await rateLimit(req, {
    windowMs: 60 * 1000,
    max: 120,
    keyPrefix: "public_api_key",
    identifier: `${apiKeyId}:${organizationId}`,
  });
  if (!limiter.allowed) {
    return { allowed: false as const, retryAfter: limiter.retryAfter };
  }

  const ipLimiter = await rateLimit(req, {
    windowMs: 60 * 1000,
    max: 300,
    keyPrefix: "public_api_ip",
  });
  if (!ipLimiter.allowed) {
    return { allowed: false as const, retryAfter: ipLimiter.retryAfter };
  }

  return { allowed: true as const, retryAfter: 0 };
}
