import { listTelemetryAlertRules, listTelemetryIncidents } from "@/domain/telemetry/alerts";
import {
  type TelemetryBucketUnit,
  type TelemetryIncidentStatus,
  type TelemetrySeverity,
  type TelemetrySourceType,
} from "@/domain/telemetry/constants";
import { listTelemetryFunnelDefinitions, listTelemetryFunnelResults } from "@/domain/telemetry/funnels";
import { listTelemetryEvents } from "@/domain/telemetry/query";
import { toCsv } from "@/lib/exports/csv";

const DEFAULT_EXPORT_TAKE = 1500;
const MAX_EXPORT_TAKE = 5000;

export const TELEMETRY_EXPORT_DATASETS = [
  "events",
  "incidents",
  "rules",
  "funnels",
  "funnel_results",
] as const;

export type TelemetryExportDataset = (typeof TELEMETRY_EXPORT_DATASETS)[number];

type CsvCell = string | number | Date | null | undefined;

export type BuildTelemetryExportCsvParams = {
  dataset: TelemetryExportDataset;
  organizationId?: number | null;
  includeGlobal?: boolean;
  activeOnly?: boolean;
  statuses?: TelemetryIncidentStatus[];
  sourceType?: TelemetrySourceType | null;
  severity?: TelemetrySeverity | null;
  eventName?: string | null;
  query?: string | null;
  from?: Date | null;
  to?: Date | null;
  take?: number;
  bucketUnit?: TelemetryBucketUnit | null;
  funnelId?: string | null;
};

export type BuildTelemetryExportCsvResult = {
  dataset: TelemetryExportDataset;
  csv: string;
  rowCount: number;
};

export type BuildTelemetryExportPreviewParams = BuildTelemetryExportCsvParams & {
  sampleSize?: number;
};

export type BuildTelemetryExportPreviewResult = {
  dataset: TelemetryExportDataset;
  headers: string[];
  rows: string[][];
  rowCount: number;
  sampleSize: number;
  truncated: boolean;
};

export function parseTelemetryExportDataset(value: string | null | undefined): TelemetryExportDataset | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return (TELEMETRY_EXPORT_DATASETS as readonly string[]).includes(normalized)
    ? (normalized as TelemetryExportDataset)
    : null;
}

function normalizeTake(value: number | undefined) {
  const parsed = Number(value ?? DEFAULT_EXPORT_TAKE);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_EXPORT_TAKE;
  return Math.min(Math.floor(parsed), MAX_EXPORT_TAKE);
}

function toJsonCell(value: unknown) {
  if (value === null || typeof value === "undefined") return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function toIsoCell(value: Date | null | undefined) {
  if (!(value instanceof Date)) return "";
  if (Number.isNaN(value.getTime())) return "";
  return value.toISOString();
}

function toNullableString(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeSampleSize(value: number | undefined) {
  const parsed = Number(value ?? 20);
  if (!Number.isFinite(parsed) || parsed <= 0) return 20;
  return Math.min(Math.floor(parsed), 100);
}

function stringifyCell(value: CsvCell) {
  if (value === null || typeof value === "undefined") return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return value.toISOString();
  }
  return String(value);
}

async function buildTelemetryExportTableData(params: BuildTelemetryExportCsvParams): Promise<{
  headers: string[];
  rows: CsvCell[][];
}> {
  const take = normalizeTake(params.take);
  let headers: string[] = [];
  let rows: CsvCell[][] = [];

  if (params.dataset === "events") {
    const result = await listTelemetryEvents({
      organizationId: params.organizationId,
      sourceType: params.sourceType ?? null,
      severity: params.severity ?? null,
      eventName: toNullableString(params.eventName),
      query: toNullableString(params.query),
      from: params.from ?? null,
      to: params.to ?? null,
      take,
    });

    headers = [
      "id",
      "organizationId",
      "eventName",
      "eventVersion",
      "sourceType",
      "severity",
      "actorType",
      "actorUserId",
      "actorKey",
      "requestId",
      "correlationId",
      "idempotencyKey",
      "sessionId",
      "surface",
      "outcome",
      "occurredAt",
      "ingestedAt",
      "payload",
      "tags",
    ];
    rows = result.items.map((item) => [
      item.id,
      item.organizationId ?? "",
      item.eventName,
      item.eventVersion,
      item.sourceType,
      item.severity,
      item.actorType,
      item.actorUserId ?? "",
      item.actorKey ?? "",
      item.requestId ?? "",
      item.correlationId ?? "",
      item.idempotencyKey ?? "",
      item.sessionId ?? "",
      item.surface ?? "",
      item.outcome ?? "",
      toIsoCell(item.occurredAt),
      toIsoCell(item.ingestedAt),
      toJsonCell(item.payload),
      toJsonCell(item.tags),
    ]);
  } else if (params.dataset === "incidents") {
    const items = await listTelemetryIncidents({
      organizationId: params.organizationId,
      statuses: params.statuses,
      take,
    });

    headers = [
      "id",
      "organizationId",
      "ruleId",
      "ruleName",
      "status",
      "severity",
      "title",
      "description",
      "metricKey",
      "dimensionKey",
      "dimensionValue",
      "observedValue",
      "thresholdValue",
      "triggeredAt",
      "acknowledgedAt",
      "resolvedAt",
      "acknowledgedByUserId",
      "resolvedByUserId",
      "context",
      "createdAt",
      "updatedAt",
    ];
    rows = items.map((item) => [
      item.id,
      item.organizationId ?? "",
      item.ruleId ?? "",
      item.rule?.name ?? "",
      item.status,
      item.severity,
      item.title,
      item.description ?? "",
      item.metricKey ?? "",
      item.dimensionKey ?? "",
      item.dimensionValue ?? "",
      item.observedValue ?? "",
      item.thresholdValue ?? "",
      toIsoCell(item.triggeredAt),
      toIsoCell(item.acknowledgedAt),
      toIsoCell(item.resolvedAt),
      item.acknowledgedByUserId ?? "",
      item.resolvedByUserId ?? "",
      toJsonCell(item.context),
      toIsoCell(item.createdAt),
      toIsoCell(item.updatedAt),
    ]);
  } else if (params.dataset === "rules") {
    const items = await listTelemetryAlertRules({
      organizationId: params.organizationId,
      includeGlobal:
        typeof params.includeGlobal === "boolean"
          ? params.includeGlobal
          : typeof params.organizationId === "number",
      activeOnly: params.activeOnly ?? false,
      take,
    });

    headers = [
      "id",
      "organizationId",
      "name",
      "description",
      "metricKey",
      "dimensionKey",
      "dimensionValue",
      "comparisonOperator",
      "threshold",
      "windowMinutes",
      "cooldownMinutes",
      "severity",
      "isActive",
      "createdByUserId",
      "createdAt",
      "updatedAt",
    ];
    rows = items.map((item) => [
      item.id,
      item.organizationId ?? "",
      item.name,
      item.description ?? "",
      item.metricKey,
      item.dimensionKey ?? "",
      item.dimensionValue ?? "",
      item.comparisonOperator,
      item.threshold,
      item.windowMinutes,
      item.cooldownMinutes,
      item.severity,
      item.isActive ? "true" : "false",
      item.createdByUserId ?? "",
      toIsoCell(item.createdAt),
      toIsoCell(item.updatedAt),
    ]);
  } else if (params.dataset === "funnels") {
    const items = await listTelemetryFunnelDefinitions({
      organizationId: params.organizationId,
      includeGlobal:
        typeof params.includeGlobal === "boolean"
          ? params.includeGlobal
          : typeof params.organizationId === "number",
      activeOnly: params.activeOnly ?? false,
      take,
    });

    headers = [
      "id",
      "organizationId",
      "name",
      "description",
      "isActive",
      "steps",
      "createdByUserId",
      "createdAt",
      "updatedAt",
    ];
    rows = items.map((item) => [
      item.id,
      item.organizationId ?? "",
      item.name,
      item.description ?? "",
      item.isActive ? "true" : "false",
      toJsonCell(item.steps),
      item.createdByUserId ?? "",
      toIsoCell(item.createdAt),
      toIsoCell(item.updatedAt),
    ]);
  } else {
    const items = await listTelemetryFunnelResults({
      organizationId: params.organizationId,
      funnelId: params.funnelId ?? null,
      bucketUnit: params.bucketUnit ?? null,
      take,
    });

    headers = [
      "id",
      "funnelId",
      "organizationId",
      "bucketStart",
      "bucketUnit",
      "stepKey",
      "enteredCount",
      "convertedCount",
      "conversionRateBps",
      "createdAt",
      "updatedAt",
    ];
    rows = items.map((item) => [
      item.id,
      item.funnelId,
      item.organizationId ?? "",
      toIsoCell(item.bucketStart),
      item.bucketUnit,
      item.stepKey,
      item.enteredCount,
      item.convertedCount,
      item.conversionRateBps,
      toIsoCell(item.createdAt),
      toIsoCell(item.updatedAt),
    ]);
  }

  return { headers, rows };
}

export async function buildTelemetryExportCsv(
  params: BuildTelemetryExportCsvParams,
): Promise<BuildTelemetryExportCsvResult> {
  const table = await buildTelemetryExportTableData(params);
  return {
    dataset: params.dataset,
    csv: toCsv([table.headers, ...table.rows]),
    rowCount: table.rows.length,
  };
}

export async function buildTelemetryExportPreview(
  params: BuildTelemetryExportPreviewParams,
): Promise<BuildTelemetryExportPreviewResult> {
  const sampleSize = normalizeSampleSize(params.sampleSize);
  const table = await buildTelemetryExportTableData(params);
  const sampleRows = table.rows.slice(0, sampleSize).map((row) => row.map(stringifyCell));
  return {
    dataset: params.dataset,
    headers: table.headers,
    rows: sampleRows,
    rowCount: table.rows.length,
    sampleSize,
    truncated: table.rows.length > sampleSize,
  };
}
