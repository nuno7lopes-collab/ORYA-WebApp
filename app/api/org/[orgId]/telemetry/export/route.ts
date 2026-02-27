import { NextRequest, NextResponse } from "next/server";
import { requireOrgTelemetryAccess } from "@/app/api/org/[orgId]/telemetry/_access";
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
  buildTelemetryExportCsv,
  buildTelemetryExportPreview,
  parseTelemetryExportDataset,
} from "@/domain/telemetry/export";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { logError } from "@/lib/observability/logger";
import { buildTelemetryExportPdf } from "@/lib/telemetry/exportPdf";

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

function parseTake(value: string | null, fallback = 1500) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), 5000);
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
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

function parseFormat(value: string | null) {
  const normalized = value?.trim().toLowerCase() || "csv";
  if (normalized === "csv" || normalized === "pdf") return normalized;
  return null;
}

async function _GET(req: NextRequest) {
  try {
    const access = await requireOrgTelemetryAccess(req);
    if (!access.ok) return access.response;

    const searchParams = req.nextUrl.searchParams;
    const dataset = parseTelemetryExportDataset(searchParams.get("dataset") ?? "events");
    if (!dataset) {
      return jsonWrap({ ok: false, error: "INVALID_DATASET" }, { status: 400, req });
    }
    const format = parseFormat(searchParams.get("format"));
    if (!format) {
      return jsonWrap({ ok: false, error: "INVALID_FORMAT" }, { status: 400, req });
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

    const generatedAt = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `telemetry_${dataset}_org_${access.organizationId}_${generatedAt}.${format}`;

    if (format === "csv") {
      const result = await buildTelemetryExportCsv({
        dataset,
        organizationId: access.organizationId,
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
        bucketUnit,
        funnelId: searchParams.get("funnelId"),
      });

      return new NextResponse(`\uFEFF${result.csv}`, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    const preview = await buildTelemetryExportPreview({
      dataset,
      organizationId: access.organizationId,
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
      sampleSize: take,
      bucketUnit,
      funnelId: searchParams.get("funnelId"),
    });

    const pdf = await buildTelemetryExportPdf({
      dataset,
      headers: preview.headers,
      rows: preview.rows,
      rowCount: preview.rowCount,
      title: "ORYA Telemetria - Exportacao",
      scopeLabel: `Org ${access.organizationId}`,
      filters: {
        sourceType,
        severity,
        includeGlobal,
        activeOnly,
        from: from?.toISOString() ?? null,
        to: to?.toISOString() ?? null,
      },
      generatedAt: new Date(),
    });

    return new NextResponse(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    logError("org.telemetry.export_failed", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500, req });
  }
}

export const GET = withApiEnvelope(_GET);
