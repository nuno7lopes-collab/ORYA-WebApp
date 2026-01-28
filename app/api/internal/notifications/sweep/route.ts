import { NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { consumeNotificationEventLogBatch } from "@/domain/notifications/consumer";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(req: Request) {
  try {
    if (!requireInternalSecret(req.headers)) {
      return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }
    const url = new URL(req.url);
    const limitRaw = Number(url.searchParams.get("limit") ?? 200);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 200;
    const result = await consumeNotificationEventLogBatch(limit);
    return jsonWrap({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonWrap({ ok: false, error: message }, { status: 401 });
  }
}
export const GET = withApiEnvelope(_GET);