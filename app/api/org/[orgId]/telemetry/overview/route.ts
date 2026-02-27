import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getTelemetryOverview } from "@/domain/telemetry/query";
import {
  getTelemetryIncidentKpis,
  listTelemetryAlertRules,
  listTelemetryIncidents,
} from "@/domain/telemetry/alerts";
import { requireOrgTelemetryAccess } from "@/app/api/org/[orgId]/telemetry/_access";
import { logError } from "@/lib/observability/logger";

function parseHours(value: string | null) {
  const parsed = Number(value ?? "24");
  if (!Number.isFinite(parsed) || parsed <= 0) return 24;
  return Math.min(Math.floor(parsed), 24 * 7);
}

async function _GET(req: NextRequest) {
  try {
    const access = await requireOrgTelemetryAccess(req);
    if (!access.ok) return access.response;

    const hours = parseHours(req.nextUrl.searchParams.get("hours"));
    const now = new Date();
    const from = new Date(now.getTime() - hours * 60 * 60 * 1000);
    const [overview, incidents, rules, incidentKpis] = await Promise.all([
      getTelemetryOverview({
        organizationId: access.organizationId,
        hours,
      }),
      listTelemetryIncidents({
        organizationId: access.organizationId,
        statuses: ["OPEN", "ACKNOWLEDGED"],
        take: 30,
      }),
      listTelemetryAlertRules({
        organizationId: access.organizationId,
        includeGlobal: true,
        activeOnly: true,
        take: 30,
      }),
      getTelemetryIncidentKpis({
        organizationId: access.organizationId,
        from,
        to: now,
      }),
    ]);

    return jsonWrap({ ok: true, ...overview, incidents, rules, incidentKpis }, { status: 200, req });
  } catch (err) {
    logError("org.telemetry.overview_failed", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500, req });
  }
}

export const GET = withApiEnvelope(_GET);
