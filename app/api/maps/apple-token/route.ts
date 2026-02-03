import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { getAppleMapsConfig } from "@/lib/maps/appleConfig";
import { mintAppleMapsToken } from "@/lib/maps/appleToken";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function _GET(_req: NextRequest) {
  try {
    const cfg = getAppleMapsConfig({ allowMissingInDev: true });
    if (!cfg) {
      return jsonWrap(
        { ok: false, errorCode: "APPLE_MAPS_MISSING", message: "Apple Maps não configurado." },
        { status: 503 },
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
