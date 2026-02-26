import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { listTelemetryEvents } from "@/domain/telemetry/query";
import { requireOrgTelemetryAccess } from "@/app/api/org/[orgId]/telemetry/_access";
import {
  TELEMETRY_SEVERITIES,
  TELEMETRY_SOURCE_TYPES,
  type TelemetrySeverity,
  type TelemetrySourceType,
} from "@/domain/telemetry/constants";
import { logError } from "@/lib/observability/logger";

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseTake(value: string | null) {
  const parsed = Number(value ?? "50");
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
  return Math.min(Math.floor(parsed), 200);
}

function parseSourceType(value: string | null): TelemetrySourceType | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return (TELEMETRY_SOURCE_TYPES as readonly string[]).includes(normalized)
    ? (normalized as TelemetrySourceType)
    : null;
}

function parseSeverity(value: string | null): TelemetrySeverity | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return (TELEMETRY_SEVERITIES as readonly string[]).includes(normalized)
    ? (normalized as TelemetrySeverity)
    : null;
}

async function _GET(req: NextRequest) {
  try {
    const access = await requireOrgTelemetryAccess(req);
    if (!access.ok) return access.response;

    const searchParams = req.nextUrl.searchParams;
    const result = await listTelemetryEvents({
      organizationId: access.organizationId,
      from: parseDate(searchParams.get("from")),
      to: parseDate(searchParams.get("to")),
      sourceType: parseSourceType(searchParams.get("sourceType")),
      severity: parseSeverity(searchParams.get("severity")),
      eventName: searchParams.get("eventName"),
      query: searchParams.get("q"),
      cursor: searchParams.get("cursor"),
      take: parseTake(searchParams.get("take")),
    });

    return jsonWrap(
      {
        ok: true,
        items: result.items,
        pagination: result.pagination,
      },
      { status: 200, req },
    );
  } catch (err) {
    logError("org.telemetry.events_failed", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500, req });
  }
}

export const GET = withApiEnvelope(_GET);
