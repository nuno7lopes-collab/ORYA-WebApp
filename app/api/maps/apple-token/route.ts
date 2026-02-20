import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { getAppleMapsConfig } from "@/lib/maps/appleConfig";
import { mintAppleMapsToken } from "@/lib/maps/appleToken";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { rateLimit } from "@/lib/auth/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APPLE_TOKEN_RATE_WINDOW_MS = 60 * 1000;
const APPLE_TOKEN_RATE_MAX = 45;

async function _GET(req: NextRequest) {
  try {
    const limiter = await rateLimit(req, {
      windowMs: APPLE_TOKEN_RATE_WINDOW_MS,
      max: APPLE_TOKEN_RATE_MAX,
      keyPrefix: "maps:apple-token",
    });
    if (!limiter.allowed) {
      return jsonWrap(
        { ok: false, errorCode: "THROTTLED", message: "RATE_LIMITED", retryable: true },
        { status: 429, headers: { "Retry-After": String(limiter.retryAfter) } },
      );
    }

    const cfg = getAppleMapsConfig({ allowMissingInDev: true });
    if (!cfg) {
      return jsonWrap(
        { ok: true, result: { provider: "apple_maps_unconfigured" } },
        { status: 200 },
      );
    }
    const { token, expiresAt } = mintAppleMapsToken();
    return jsonWrap({ ok: true, token, expiresAt }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Apple Maps creds missing";
    return jsonWrap(
      { ok: false, errorCode: "APPLE_MAPS_TOKEN_FAILED", message, retryable: false },
      { status: 500 },
    );
  }
}
export const GET = withApiEnvelope(_GET);
