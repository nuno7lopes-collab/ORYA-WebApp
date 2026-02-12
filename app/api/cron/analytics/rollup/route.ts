export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { runAnalyticsRollupJob } from "@/domain/analytics/rollup";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { logError } from "@/lib/observability/logger";
import { recordCronHeartbeat } from "@/lib/cron/heartbeat";

async function _POST(req: NextRequest) {
  const startedAt = new Date();
  try {
    if (!requireInternalSecret(req)) {
      return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const payload = (await req.json().catch(() => null)) as
      | { organizationId?: number; fromDate?: string; toDate?: string; maxDays?: number }
      | null;

    const result = await runAnalyticsRollupJob({
      organizationId: typeof payload?.organizationId === "number" ? payload.organizationId : undefined,
      fromDate: typeof payload?.fromDate === "string" ? payload.fromDate : undefined,
      toDate: typeof payload?.toDate === "string" ? payload.toDate : undefined,
      maxDays: typeof payload?.maxDays === "number" ? payload.maxDays : undefined,
    });

    await recordCronHeartbeat("analytics-rollup", { status: "SUCCESS", startedAt });
    return jsonWrap(result, { status: 200 });
  } catch (err) {
    logError("cron.analytics.rollup_error", err);
    await recordCronHeartbeat("analytics-rollup", { status: "ERROR", startedAt, error: err });
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export const POST = withApiEnvelope(_POST);
