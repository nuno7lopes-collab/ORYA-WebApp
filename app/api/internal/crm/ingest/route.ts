import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { consumeCrmEventLog } from "@/domain/crm/consumer";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { logError } from "@/lib/observability/logger";

async function _POST(req: NextRequest) {
  try {
    if (!requireInternalSecret(req)) {
      return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const payload = (await req.json().catch(() => null)) as {
      eventLogId?: unknown;
    } | null;

    const eventLogId = typeof payload?.eventLogId === "string" ? payload.eventLogId : null;
    if (!eventLogId) {
      return jsonWrap({ ok: false, error: "EVENTLOG_ID_REQUIRED" }, { status: 400 });
    }

    const result = await consumeCrmEventLog(eventLogId);
    if (!result.ok) {
      return jsonWrap({ ok: false, error: result.code ?? "INGEST_FAILED" }, { status: 400 });
    }

    return jsonWrap({ ok: true, deduped: Boolean(result.deduped) });
  } catch (err) {
    logError("internal.crm.ingest_error", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
