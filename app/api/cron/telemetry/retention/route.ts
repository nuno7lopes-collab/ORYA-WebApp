import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { recordCronHeartbeat } from "@/lib/cron/heartbeat";
import { purgeTelemetryRetention } from "@/domain/telemetry/retention";
import { logError } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JOB_KEY = "telemetry-retention";

async function _POST(req: NextRequest) {
  const startedAt = new Date();
  if (!requireInternalSecret(req)) {
    return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401, req });
  }

  try {
    const result = await purgeTelemetryRetention();

    await recordCronHeartbeat(JOB_KEY, {
      status: "SUCCESS",
      startedAt,
      metadata: result,
    });

    return jsonWrap({ ok: true, result }, { status: 200, req });
  } catch (err) {
    await recordCronHeartbeat(JOB_KEY, {
      status: "ERROR",
      startedAt,
      error: err,
    });
    logError("cron.telemetry.retention_error", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500, req });
  }
}

export const POST = withApiEnvelope(_POST);
