import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { requireOrgTelemetryAccess } from "@/app/api/org/[orgId]/telemetry/_access";
import { recomputeTelemetryMetricRollups } from "@/domain/telemetry/rollup";
import { evaluateTelemetryAlertRules } from "@/domain/telemetry/alerts";
import { recomputeTelemetryFunnelResults } from "@/domain/telemetry/funnels";
import { type TelemetryBucketUnit } from "@/domain/telemetry/constants";
import { logError } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseBucketUnit(value: string | null): TelemetryBucketUnit {
  if (value?.toUpperCase() === "DAY") return "DAY";
  return "HOUR";
}

function parseHours(value: string | null, fallback: number) {
  const parsed = Number(value ?? fallback);
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

async function _POST(req: NextRequest) {
  try {
    const access = await requireOrgTelemetryAccess(req, { required: "EDIT" });
    if (!access.ok) return access.response;

    const bucketUnit = parseBucketUnit(req.nextUrl.searchParams.get("bucket"));
    const hours = parseHours(
      req.nextUrl.searchParams.get("hours"),
      bucketUnit === "HOUR" ? 24 : 24 * 14,
    );
    const shouldEvaluate = parseBoolean(req.nextUrl.searchParams.get("evaluate"), true);
    const shouldRecomputeFunnels = parseBoolean(req.nextUrl.searchParams.get("funnels"), true);

    const to = new Date();
    const from = new Date(to.getTime() - hours * 60 * 60 * 1000);

    const rollup = await recomputeTelemetryMetricRollups({
      from,
      to,
      bucketUnit,
      organizationId: access.organizationId,
    });
    const evaluation = shouldEvaluate
      ? await evaluateTelemetryAlertRules({ organizationId: access.organizationId })
      : null;
    const funnels = shouldRecomputeFunnels
      ? await recomputeTelemetryFunnelResults({
          from,
          to,
          bucketUnit,
          organizationId: access.organizationId,
        })
      : null;

    return jsonWrap(
      {
        ok: true,
        rollup: {
          bucketUnit: rollup.bucketUnit,
          from: rollup.from.toISOString(),
          to: rollup.to.toISOString(),
          rows: rollup.rows,
          written: rollup.written,
        },
        evaluation,
        funnels: funnels
          ? {
              from: funnels.from.toISOString(),
              to: funnels.to.toISOString(),
              bucketUnit: funnels.bucketUnit,
              organizations: funnels.organizations,
              funnels: funnels.funnels,
              buckets: funnels.buckets,
              rowsDeleted: funnels.rowsDeleted,
              rowsWritten: funnels.rowsWritten,
              skippedFunnels: funnels.skippedFunnels,
              errors: funnels.errors,
            }
          : null,
      },
      { status: 200, req },
    );
  } catch (err) {
    logError("org.telemetry.recompute_failed", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500, req });
  }
}

export const POST = withApiEnvelope(_POST);
