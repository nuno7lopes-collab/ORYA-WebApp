import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { recordCronHeartbeat } from "@/lib/cron/heartbeat";
import { recomputeTelemetryMetricRollups } from "@/domain/telemetry/rollup";
import { type TelemetryBucketUnit } from "@/domain/telemetry/constants";
import { logError } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JOB_KEY = "telemetry-rollup";

function parseBucketUnit(value: string | null): TelemetryBucketUnit {
  if (value?.toUpperCase() === "DAY") return "DAY";
  return "HOUR";
}

function parseHours(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), 24 * 31);
}

async function _POST(req: NextRequest) {
  const startedAt = new Date();
  if (!requireInternalSecret(req)) {
    return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401, req });
  }

  const bucketUnit = parseBucketUnit(req.nextUrl.searchParams.get("bucket"));
  const hours = parseHours(req.nextUrl.searchParams.get("hours"), bucketUnit === "HOUR" ? 24 : 24 * 14);
  const to = new Date();
  const from = new Date(to.getTime() - hours * 60 * 60 * 1000);

  try {
    const result = await recomputeTelemetryMetricRollups({
      from,
      to,
      bucketUnit,
    });

    await recordCronHeartbeat(JOB_KEY, {
      status: "SUCCESS",
      startedAt,
      metadata: {
        from: result.from.toISOString(),
        to: result.to.toISOString(),
        written: result.written,
      },
    });

    return jsonWrap(
      {
        ok: true,
        bucketUnit: result.bucketUnit,
        from: result.from.toISOString(),
        to: result.to.toISOString(),
        rows: result.rows,
        written: result.written,
      },
      { status: 200, req },
    );
  } catch (err) {
    await recordCronHeartbeat(JOB_KEY, {
      status: "ERROR",
      startedAt,
      error: err,
    });
    logError("cron.telemetry.rollup_error", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500, req });
  }
}

export const POST = withApiEnvelope(_POST);
