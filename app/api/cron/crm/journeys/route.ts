export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { logError, logInfo } from "@/lib/observability/logger";
import { recordCronHeartbeat } from "@/lib/cron/heartbeat";
import { processCrmJourneyRuntimeBatch } from "@/lib/crm/journeyRuntime";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parseLimit(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.trunc(parsed), MAX_LIMIT);
}

async function _POST(req: NextRequest) {
  const startedAt = new Date();
  try {
    if (!requireInternalSecret(req)) {
      return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const journeyLimit = parseLimit(req.nextUrl.searchParams.get("journeyLimit"), DEFAULT_LIMIT);
    const enrollmentsPerJourney = parseLimit(req.nextUrl.searchParams.get("enrollmentsPerJourney"), 200);
    const runsPerJourney = parseLimit(req.nextUrl.searchParams.get("runsPerJourney"), 200);

    const runtimeResult = await processCrmJourneyRuntimeBatch({
      journeyLimit,
      enrollmentsPerJourney,
      runsPerJourney,
    });

    logInfo("cron.crm.journeys", {
      journeysScanned: runtimeResult.journeysScanned,
      runsEnrolled: runtimeResult.runsEnrolled,
      runsProcessed: runtimeResult.runsProcessed,
      runsCompleted: runtimeResult.runsCompleted,
      runsSkipped: runtimeResult.runsSkipped,
      runsFailed: runtimeResult.runsFailed,
      runsWaiting: runtimeResult.runsWaiting,
      warnings: runtimeResult.warnings.length,
    });

    await recordCronHeartbeat("crm-journeys", { status: "SUCCESS", startedAt });

    return jsonWrap(
      {
        ok: true,
        ...runtimeResult,
      },
      { status: 200 },
    );
  } catch (err) {
    logError("cron.crm.journeys_error", err);
    await recordCronHeartbeat("crm-journeys", { status: "ERROR", startedAt, error: err });
    return jsonWrap({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export const POST = withApiEnvelope(_POST);
