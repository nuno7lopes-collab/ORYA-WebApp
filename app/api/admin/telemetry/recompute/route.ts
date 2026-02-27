import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { requireAdminUser } from "@/lib/admin/auth";
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

function parseOrganizationId(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
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
    const admin = await requireAdminUser({ req });
    if (!admin.ok) {
      return jsonWrap({ ok: false, error: admin.error }, { status: admin.status, req });
    }

    const bucketUnit = parseBucketUnit(req.nextUrl.searchParams.get("bucket"));
    const hours = parseHours(
      req.nextUrl.searchParams.get("hours"),
      bucketUnit === "HOUR" ? 24 : 24 * 14,
    );
    const shouldEvaluate = parseBoolean(req.nextUrl.searchParams.get("evaluate"), true);
    const shouldRecomputeFunnels = parseBoolean(req.nextUrl.searchParams.get("funnels"), true);
    const organizationId = parseOrganizationId(req.nextUrl.searchParams.get("orgId"));
    const to = new Date();
    const from = new Date(to.getTime() - hours * 60 * 60 * 1000);

    const rollup = await recomputeTelemetryMetricRollups({
      from,
      to,
      bucketUnit,
      organizationId,
    });
    const evaluation = shouldEvaluate
      ? await evaluateTelemetryAlertRules({ organizationId })
      : null;
    const funnelResults = shouldRecomputeFunnels
      ? await recomputeTelemetryFunnelResults({
          from,
          to,
          bucketUnit,
          organizationId,
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
        funnels: funnelResults
          ? {
              from: funnelResults.from.toISOString(),
              to: funnelResults.to.toISOString(),
              bucketUnit: funnelResults.bucketUnit,
              organizations: funnelResults.organizations,
              funnels: funnelResults.funnels,
              buckets: funnelResults.buckets,
              rowsDeleted: funnelResults.rowsDeleted,
              rowsWritten: funnelResults.rowsWritten,
              skippedFunnels: funnelResults.skippedFunnels,
              errors: funnelResults.errors,
            }
          : null,
      },
      { status: 200, req },
    );
  } catch (err) {
    logError("admin.telemetry.recompute_failed", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500, req });
  }
}

export const POST = withApiEnvelope(_POST);
