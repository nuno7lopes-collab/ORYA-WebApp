import { NextRequest } from "next/server";
import { parseOrganizationId } from "@/lib/organizationIdUtils";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { requireAdminUser } from "@/lib/admin/auth";
import {
  TELEMETRY_SEVERITIES,
  TELEMETRY_INCIDENT_STATUSES,
  type TelemetrySeverity,
  type TelemetryIncidentStatus,
} from "@/domain/telemetry/constants";
import {
  listTelemetryIncidentsPage,
  type TelemetryIncidentSort,
} from "@/domain/telemetry/alerts";
import { logError } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseTake(value: string | null) {
  const parsed = Number(value ?? "100");
  if (!Number.isFinite(parsed) || parsed <= 0) return 100;
  return Math.min(Math.floor(parsed), 300);
}

function parseMinutes(value: string | null, min: number, max: number): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return undefined;
  if (parsed < min || parsed > max) return undefined;
  return parsed;
}

function parseSort(value: string | null): TelemetryIncidentSort {
  const normalized = value?.trim().toUpperCase();
  if (normalized === "SLA_IMPACT_DESC") return "SLA_IMPACT_DESC";
  return "TRIGGERED_DESC";
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
    const admin = await requireAdminUser({ req });
    if (!admin.ok) {
      return jsonWrap({ ok: false, error: admin.error }, { status: admin.status, req });
    }

    const searchParams = req.nextUrl.searchParams;
    const organizationId = parseOrganizationId(searchParams.get("orgId"));
    const statuses = parseStatuses(searchParams.get("statuses"));
    const severities = parseSeverities(searchParams.get("severities"));
    const ruleId = searchParams.get("ruleId")?.trim() || null;
    const query = searchParams.get("q")?.trim() || null;
    const sort = parseSort(searchParams.get("sort"));

    const result = await listTelemetryIncidentsPage({
      organizationId,
      statuses,
      severities,
      ruleId,
      query,
      cursor: searchParams.get("cursor"),
      sort,
      ackSlaMinutes: parseMinutes(searchParams.get("ackSlaMinutes"), 1, 24 * 60),
      resolveSlaMinutes: parseMinutes(searchParams.get("resolveSlaMinutes"), 1, 7 * 24 * 60),
      take: parseTake(searchParams.get("take")),
    });

    return jsonWrap(
      { ok: true, items: result.items, pagination: result.pagination, sort: result.sort },
      { status: 200, req },
    );
  } catch (err) {
    logError("admin.telemetry.incidents_list_failed", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500, req });
  }
}

export const GET = withApiEnvelope(_GET);
