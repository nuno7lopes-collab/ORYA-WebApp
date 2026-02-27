import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { requireOrgTelemetryAccess } from "@/app/api/org/[orgId]/telemetry/_access";
import { listTelemetryFunnelResults } from "@/domain/telemetry/funnels";
import { logError } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseTake(value: string | null) {
  const parsed = Number(value ?? "200");
  if (!Number.isFinite(parsed) || parsed <= 0) return 200;
  return Math.min(Math.floor(parsed), 500);
}

function parseBucketUnit(value: string | null): "HOUR" | "DAY" | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === "HOUR" || normalized === "DAY") return normalized;
  return null;
}

async function _GET(req: NextRequest) {
  try {
    const access = await requireOrgTelemetryAccess(req);
    if (!access.ok) return access.response;

    const searchParams = req.nextUrl.searchParams;
    const items = await listTelemetryFunnelResults({
      organizationId: access.organizationId,
      funnelId: searchParams.get("funnelId")?.trim() || null,
      bucketUnit: parseBucketUnit(searchParams.get("bucketUnit")),
      take: parseTake(searchParams.get("take")),
    });

    return jsonWrap({ ok: true, items }, { status: 200, req });
  } catch (err) {
    logError("org.telemetry.funnel_results_failed", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500, req });
  }
}

export const GET = withApiEnvelope(_GET);
