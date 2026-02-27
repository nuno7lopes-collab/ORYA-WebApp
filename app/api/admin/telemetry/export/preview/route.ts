import { NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import { jsonWrap } from "@/lib/api/wrapResponse";
import {
  type TelemetryBucketUnit,
  TELEMETRY_BUCKET_UNITS,
  TELEMETRY_INCIDENT_STATUSES,
  type TelemetryIncidentStatus,
  TELEMETRY_SEVERITIES,
  type TelemetrySeverity,
  TELEMETRY_SOURCE_TYPES,
  type TelemetrySourceType,
} from "@/domain/telemetry/constants";
import {
  buildTelemetryExportPreview,
  parseTelemetryExportDataset,
} from "@/domain/telemetry/export";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { logError } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseBoolean(value: string | null, fallback: boolean) {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

function parseHours(value: string | null, fallback = 24) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), 24 * 14);
}

function parseTake(value: string | null, fallback = 400) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), 5000);
}

function parseSample(value: string | null, fallback = 20) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), 100);
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseOrganizationId(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
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

function parseBucketUnit(value: string | null): TelemetryBucketUnit | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return (TELEMETRY_BUCKET_UNITS as readonly string[]).includes(normalized)
    ? (normalized as TelemetryBucketUnit)
    : null;
}

function parseIncidentStatuses(value: string | null): TelemetryIncidentStatus[] | null {
  if (!value || value.trim().toUpperCase() === "ALL") return [];
  const entries = value
    .split(",")
    .map((entry) => entry.trim().toUpperCase())
    .filter(Boolean);
  if (entries.length === 0) return [];
  for (const entry of entries) {
    if (!(TELEMETRY_INCIDENT_STATUSES as readonly string[]).includes(entry)) {
      return null;
    }
  }
  return entries as TelemetryIncidentStatus[];
}

function parseIncidentSort(value: string | null) {
  if (!value) return "TRIGGERED_DESC" as const;
  const normalized = value.trim().toUpperCase();
  if (normalized === "TRIGGERED_DESC" || normalized === "SLA_IMPACT_DESC") return normalized;
  return null;
}

async function _GET(req: NextRequest) {
  try {
    const admin = await requireAdminUser({ req });
    if (!admin.ok) {
      return jsonWrap({ ok: false, error: admin.error }, { status: admin.status, req });
    }

    const searchParams = req.nextUrl.searchParams;
    const dataset = parseTelemetryExportDataset(searchParams.get("dataset") ?? "events");
    if (!dataset) {
      return jsonWrap({ ok: false, error: "INVALID_DATASET" }, { status: 400, req });
    }

    const organizationId = parseOrganizationId(searchParams.get("orgId"));
    if (searchParams.get("orgId") && !organizationId) {
      return jsonWrap({ ok: false, error: "INVALID_ORG_ID" }, { status: 400, req });
    }

    const sourceType = parseSourceType(searchParams.get("sourceType"));
    if (searchParams.get("sourceType") && !sourceType) {
      return jsonWrap({ ok: false, error: "INVALID_SOURCE_TYPE" }, { status: 400, req });
    }

    const severity = parseSeverity(searchParams.get("severity"));
    if (searchParams.get("severity") && !severity) {
      return jsonWrap({ ok: false, error: "INVALID_SEVERITY" }, { status: 400, req });
    }

    const bucketUnit = parseBucketUnit(searchParams.get("bucketUnit"));
    if (searchParams.get("bucketUnit") && !bucketUnit) {
      return jsonWrap({ ok: false, error: "INVALID_BUCKET_UNIT" }, { status: 400, req });
    }

    const statuses = parseIncidentStatuses(searchParams.get("statuses"));
    if (statuses === null) {
      return jsonWrap({ ok: false, error: "INVALID_STATUSES" }, { status: 400, req });
    }
    const incidentSort = parseIncidentSort(searchParams.get("sort"));
    if (!incidentSort) {
      return jsonWrap({ ok: false, error: "INVALID_INCIDENT_SORT" }, { status: 400, req });
    }

    const take = parseTake(searchParams.get("take"));
    const sampleSize = parseSample(searchParams.get("sample"));
    const includeGlobal = parseBoolean(searchParams.get("includeGlobal"), true);
    const activeOnly = parseBoolean(searchParams.get("activeOnly"), false);

    let from = parseDate(searchParams.get("from"));
    let to = parseDate(searchParams.get("to"));
    if ((searchParams.get("from") && !from) || (searchParams.get("to") && !to)) {
      return jsonWrap({ ok: false, error: "INVALID_DATE_RANGE" }, { status: 400, req });
    }
    if (dataset === "events" && !from && !to) {
      const now = new Date();
      const hours = parseHours(searchParams.get("hours"), 24);
      to = now;
      from = new Date(now.getTime() - hours * 60 * 60 * 1000);
    }
    if (from && to && from.getTime() > to.getTime()) {
      return jsonWrap({ ok: false, error: "INVALID_DATE_RANGE" }, { status: 400, req });
    }

    const result = await buildTelemetryExportPreview({
      dataset,
      organizationId,
      includeGlobal,
      activeOnly,
      statuses: statuses.length > 0 ? statuses : undefined,
      incidentSort,
      sourceType,
      severity,
      eventName: searchParams.get("eventName"),
      query: searchParams.get("q"),
      from,
      to,
      take,
      sampleSize,
      bucketUnit,
      funnelId: searchParams.get("funnelId"),
    });

    return jsonWrap(
      {
        ok: true,
        preview: result,
      },
      { status: 200, req },
    );
  } catch (err) {
    logError("admin.telemetry.export_preview_failed", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500, req });
  }
}

export const GET = withApiEnvelope(_GET);
