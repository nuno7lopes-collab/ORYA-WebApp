import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { recordCronHeartbeat } from "@/lib/cron/heartbeat";
import { recomputeTelemetryMetricRollups } from "@/domain/telemetry/rollup";
import { evaluateTelemetryAlertRules } from "@/domain/telemetry/alerts";
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

function parseBoolean(value: string | null, fallback: boolean) {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
}

function parseOrganizationId(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

async function _POST(req: NextRequest) {
  const startedAt = new Date();
  if (!requireInternalSecret(req)) {
    return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401, req });
  }

  const bucketUnit = parseBucketUnit(req.nextUrl.searchParams.get("bucket"));
  const hours = parseHours(req.nextUrl.searchParams.get("hours"), bucketUnit === "HOUR" ? 24 : 24 * 14);
  const shouldEvaluate = parseBoolean(req.nextUrl.searchParams.get("evaluate"), true);
  const organizationId = parseOrganizationId(req.nextUrl.searchParams.get("orgId"));
  const to = new Date();
  const from = new Date(to.getTime() - hours * 60 * 60 * 1000);

  try {
    const rollup = await recomputeTelemetryMetricRollups({
      from,
      to,
      bucketUnit,
      organizationId,
    });
    const evaluation =
      shouldEvaluate
        ? await evaluateTelemetryAlertRules({ organizationId })
        : null;

    await recordCronHeartbeat(JOB_KEY, {
      status: "SUCCESS",
      startedAt,
      metadata: {
        from: rollup.from.toISOString(),
        to: rollup.to.toISOString(),
        written: rollup.written,
        evaluate: shouldEvaluate,
        organizationId,
        evaluation,
      },
    });

    return jsonWrap(
      {
        ok: true,
        bucketUnit: rollup.bucketUnit,
        from: rollup.from.toISOString(),
        to: rollup.to.toISOString(),
        rows: rollup.rows,
        written: rollup.written,
        evaluation,
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
