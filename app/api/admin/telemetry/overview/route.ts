import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { requireAdminUser } from "@/lib/admin/auth";
import { getTelemetryOverview } from "@/domain/telemetry/query";
import { listTelemetryAlertRules, listTelemetryIncidents } from "@/domain/telemetry/alerts";
import { logError } from "@/lib/observability/logger";

function parseHours(value: string | null) {
  const parsed = Number(value ?? "24");
  if (!Number.isFinite(parsed) || parsed <= 0) return 24;
  return Math.min(Math.floor(parsed), 24 * 14);
}

function parseOrganizationId(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

async function _GET(req: NextRequest) {
  try {
    const admin = await requireAdminUser({ req });
    if (!admin.ok) {
      return jsonWrap({ ok: false, error: admin.error }, { status: admin.status, req });
    }

    const organizationId = parseOrganizationId(req.nextUrl.searchParams.get("orgId"));
    const hours = parseHours(req.nextUrl.searchParams.get("hours"));

    const [overview, openIncidents, alertRules] = await Promise.all([
      getTelemetryOverview({ organizationId, hours }),
      listTelemetryIncidents({
        organizationId,
        statuses: ["OPEN", "ACKNOWLEDGED"],
        take: 30,
      }),
      listTelemetryAlertRules({
        organizationId,
        includeGlobal: true,
        activeOnly: true,
        take: 30,
      }),
    ]);

    return jsonWrap(
      {
        ok: true,
        overview,
        incidents: openIncidents,
        rules: alertRules,
      },
      { status: 200, req },
    );
  } catch (err) {
    logError("admin.telemetry.overview_failed", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500, req });
  }
}

export const GET = withApiEnvelope(_GET);
