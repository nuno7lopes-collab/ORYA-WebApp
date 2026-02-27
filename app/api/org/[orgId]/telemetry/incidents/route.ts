import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { requireOrgTelemetryAccess } from "@/app/api/org/[orgId]/telemetry/_access";
import {
  TELEMETRY_SEVERITIES,
  TELEMETRY_INCIDENT_STATUSES,
  type TelemetrySeverity,
  type TelemetryIncidentStatus,
} from "@/domain/telemetry/constants";
import { listTelemetryIncidents } from "@/domain/telemetry/alerts";
import { logError } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseTake(value: string | null) {
  const parsed = Number(value ?? "100");
  if (!Number.isFinite(parsed) || parsed <= 0) return 100;
  return Math.min(Math.floor(parsed), 300);
}

function parseStatuses(value: string | null): TelemetryIncidentStatus[] | undefined {
  if (!value) return undefined;
  const tokens = value
    .split(",")
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);

  const valid = tokens.filter((token): token is TelemetryIncidentStatus =>
    (TELEMETRY_INCIDENT_STATUSES as readonly string[]).includes(token),
  );

  return valid.length ? valid : undefined;
}

function parseSeverities(value: string | null): TelemetrySeverity[] | undefined {
  if (!value) return undefined;
  const tokens = value
    .split(",")
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);

  const valid = tokens.filter((token): token is TelemetrySeverity =>
    (TELEMETRY_SEVERITIES as readonly string[]).includes(token),
  );

  return valid.length ? valid : undefined;
}

async function _GET(req: NextRequest) {
  try {
    const access = await requireOrgTelemetryAccess(req);
    if (!access.ok) return access.response;

    const searchParams = req.nextUrl.searchParams;
    const statuses = parseStatuses(searchParams.get("statuses"));
    const severities = parseSeverities(searchParams.get("severities"));
    const ruleId = searchParams.get("ruleId")?.trim() || null;
    const query = searchParams.get("q")?.trim() || null;

    const items = await listTelemetryIncidents({
      organizationId: access.organizationId,
      statuses,
      severities,
      ruleId,
      query,
      take: parseTake(searchParams.get("take")),
    });

    return jsonWrap({ ok: true, items }, { status: 200, req });
  } catch (err) {
    logError("org.telemetry.incidents_list_failed", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500, req });
  }
}

export const GET = withApiEnvelope(_GET);
