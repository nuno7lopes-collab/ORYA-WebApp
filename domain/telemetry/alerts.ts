import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAppEnv } from "@/lib/appEnv";
import { sanitizeTelemetryPayload } from "@/domain/telemetry/redaction";
import {
  TELEMETRY_COMPARISON_OPERATORS,
  TELEMETRY_INCIDENT_STATUSES,
  TELEMETRY_METRIC_KEYS,
  TELEMETRY_SEVERITIES,
  type TelemetryComparisonOperator,
  type TelemetryIncidentStatus,
  type TelemetryMetricKey,
  type TelemetrySeverity,
} from "@/domain/telemetry/constants";

type TelemetryAlertRuleDelegate = {
  findMany?: (args: unknown) => Promise<any[]>;
  findUnique?: (args: unknown) => Promise<any | null>;
  findFirst?: (args: unknown) => Promise<any | null>;
  create?: (args: unknown) => Promise<any>;
  update?: (args: unknown) => Promise<any>;
};

type TelemetryAlertIncidentDelegate = {
  findMany?: (args: unknown) => Promise<any[]>;
  findFirst?: (args: unknown) => Promise<any | null>;
  findUnique?: (args: unknown) => Promise<any | null>;
  create?: (args: unknown) => Promise<any>;
  update?: (args: unknown) => Promise<any>;
};

type TelemetryMetricRollupDelegate = {
  findMany?: (args: unknown) => Promise<any[]>;
};

function alertRuleDelegate() {
  return (prisma as unknown as { telemetryAlertRule?: TelemetryAlertRuleDelegate })
    .telemetryAlertRule;
}

function alertIncidentDelegate() {
  return (
    prisma as unknown as { telemetryAlertIncident?: TelemetryAlertIncidentDelegate }
  ).telemetryAlertIncident;
}

function metricRollupDelegate() {
  return (
    prisma as unknown as { telemetryMetricRollup?: TelemetryMetricRollupDelegate }
  ).telemetryMetricRollup;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toNullableText(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function toNullableInt(
  value: unknown,
  options?: { min?: number; max?: number },
): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null;
  if (typeof options?.min === "number" && parsed < options.min) return null;
  if (typeof options?.max === "number" && parsed > options.max) return null;
  return parsed;
}

function toNullableBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
}

function toEnumValue<T extends string>(
  value: unknown,
  values: readonly T[],
): T | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  return (values as readonly string[]).includes(normalized)
    ? (normalized as T)
    : null;
}

export function normalizeTelemetryComparisonOperator(
  value: unknown,
  fallback: TelemetryComparisonOperator = "GTE",
): TelemetryComparisonOperator {
  return (
    toEnumValue(value, TELEMETRY_COMPARISON_OPERATORS) ??
    fallback
  );
}

function compareThreshold(
  operator: TelemetryComparisonOperator,
  observed: number,
  threshold: number,
) {
  switch (operator) {
    case "GTE":
      return observed >= threshold;
    case "GT":
      return observed > threshold;
    case "LTE":
      return observed <= threshold;
    case "LT":
      return observed < threshold;
    case "EQ":
      return observed === threshold;
    case "NEQ":
      return observed !== threshold;
    default:
      return observed >= threshold;
  }
}

export type TelemetryAlertRuleRecord = {
  id: string;
  organizationId: number | null;
  name: string;
  description: string | null;
  metricKey: TelemetryMetricKey;
  dimensionKey: string | null;
  dimensionValue: string | null;
  comparisonOperator: TelemetryComparisonOperator;
  threshold: number;
  windowMinutes: number;
  cooldownMinutes: number;
  severity: TelemetrySeverity;
  isActive: boolean;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TelemetryAlertIncidentRecord = {
  id: string;
  ruleId: string | null;
  organizationId: number | null;
  status: TelemetryIncidentStatus;
  severity: TelemetrySeverity;
  title: string;
  description: string | null;
  metricKey: TelemetryMetricKey | null;
  dimensionKey: string | null;
  dimensionValue: string | null;
  observedValue: number | null;
  thresholdValue: number | null;
  triggeredAt: Date;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  acknowledgedByUserId: string | null;
  resolvedByUserId: string | null;
  context: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  rule?: { id: string; name: string } | null;
};

function mapRule(row: any): TelemetryAlertRuleRecord {
  return {
    id: String(row.id),
    organizationId:
      typeof row.organizationId === "number" ? row.organizationId : null,
    name: String(row.name ?? ""),
    description: toNullableText(row.description, 1000),
    metricKey: toEnumValue(row.metricKey, TELEMETRY_METRIC_KEYS) ?? "EVENT_COUNT",
    dimensionKey: toNullableText(row.dimensionKey, 80),
    dimensionValue: toNullableText(row.dimensionValue, 180),
    comparisonOperator: normalizeTelemetryComparisonOperator(row.comparisonOperator),
    threshold: Number(row.threshold ?? 0),
    windowMinutes: Number(row.windowMinutes ?? 15),
    cooldownMinutes: Number(row.cooldownMinutes ?? 30),
    severity: toEnumValue(row.severity, TELEMETRY_SEVERITIES) ?? "WARN",
    isActive: Boolean(row.isActive),
    createdByUserId: toNullableText(row.createdByUserId, 64),
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(),
  };
}

function mapIncident(row: any): TelemetryAlertIncidentRecord {
  return {
    id: String(row.id),
    ruleId: toNullableText(row.ruleId, 64),
    organizationId:
      typeof row.organizationId === "number" ? row.organizationId : null,
    status:
      toEnumValue(row.status, TELEMETRY_INCIDENT_STATUSES) ?? "OPEN",
    severity: toEnumValue(row.severity, TELEMETRY_SEVERITIES) ?? "WARN",
    title: String(row.title ?? ""),
    description: toNullableText(row.description, 2000),
    metricKey: toEnumValue(row.metricKey, TELEMETRY_METRIC_KEYS),
    dimensionKey: toNullableText(row.dimensionKey, 80),
    dimensionValue: toNullableText(row.dimensionValue, 180),
    observedValue:
      typeof row.observedValue === "number" ? row.observedValue : null,
    thresholdValue:
      typeof row.thresholdValue === "number" ? row.thresholdValue : null,
    triggeredAt: row.triggeredAt instanceof Date ? row.triggeredAt : new Date(),
    acknowledgedAt: row.acknowledgedAt instanceof Date ? row.acknowledgedAt : null,
    resolvedAt: row.resolvedAt instanceof Date ? row.resolvedAt : null,
    acknowledgedByUserId: toNullableText(row.acknowledgedByUserId, 64),
    resolvedByUserId: toNullableText(row.resolvedByUserId, 64),
    context: isRecord(row.context) ? row.context : {},
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(),
    rule:
      row.rule && isRecord(row.rule)
        ? {
            id: String(row.rule.id ?? ""),
            name: String(row.rule.name ?? ""),
          }
        : null,
  };
}

export type ListTelemetryAlertRulesParams = {
  organizationId?: number | null;
  includeGlobal?: boolean;
  activeOnly?: boolean;
  take?: number;
};

export async function listTelemetryAlertRules(
  params: ListTelemetryAlertRulesParams = {},
): Promise<TelemetryAlertRuleRecord[]> {
  const delegate = alertRuleDelegate();
  if (!delegate?.findMany) return [];

  const where: Record<string, unknown> = {};
  if (params.activeOnly) {
    where.isActive = true;
  }

  if (typeof params.organizationId === "number") {
    if (params.includeGlobal) {
      where.OR = [
        { organizationId: params.organizationId },
        { organizationId: null },
      ];
    } else {
      where.organizationId = params.organizationId;
    }
  }

  const rows = await delegate.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take:
      typeof params.take === "number" && params.take > 0
        ? Math.min(Math.floor(params.take), 200)
        : 100,
    select: {
      id: true,
      organizationId: true,
      name: true,
      description: true,
      metricKey: true,
      dimensionKey: true,
      dimensionValue: true,
      comparisonOperator: true,
      threshold: true,
      windowMinutes: true,
      cooldownMinutes: true,
      severity: true,
      isActive: true,
      createdByUserId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return rows.map(mapRule);
}

export type ListTelemetryIncidentsParams = {
  organizationId?: number | null;
  statuses?: TelemetryIncidentStatus[];
  severities?: TelemetrySeverity[];
  ruleId?: string | null;
  query?: string | null;
  take?: number;
};

export async function listTelemetryIncidents(
  params: ListTelemetryIncidentsParams = {},
): Promise<TelemetryAlertIncidentRecord[]> {
  const delegate = alertIncidentDelegate();
  if (!delegate?.findMany) return [];

  const where: Record<string, unknown> = {
    ...(typeof params.organizationId === "number"
      ? { organizationId: params.organizationId }
      : {}),
    ...(params.ruleId ? { ruleId: params.ruleId } : {}),
    ...(params.statuses?.length
      ? { status: { in: params.statuses } }
      : {}),
    ...(params.severities?.length
      ? { severity: { in: params.severities } }
      : {}),
    ...(toNullableText(params.query, 120)
      ? {
          OR: [
            { title: { contains: toNullableText(params.query, 120), mode: "insensitive" } },
            { description: { contains: toNullableText(params.query, 120), mode: "insensitive" } },
            { dimensionKey: { contains: toNullableText(params.query, 120), mode: "insensitive" } },
            { dimensionValue: { contains: toNullableText(params.query, 120), mode: "insensitive" } },
            { rule: { name: { contains: toNullableText(params.query, 120), mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const rows = await delegate.findMany({
    where,
    orderBy: [{ triggeredAt: "desc" }, { id: "desc" }],
    take:
      typeof params.take === "number" && params.take > 0
        ? Math.min(Math.floor(params.take), 200)
        : 100,
    select: {
      id: true,
      ruleId: true,
      organizationId: true,
      status: true,
      severity: true,
      title: true,
      description: true,
      metricKey: true,
      dimensionKey: true,
      dimensionValue: true,
      observedValue: true,
      thresholdValue: true,
      triggeredAt: true,
      acknowledgedAt: true,
      resolvedAt: true,
      acknowledgedByUserId: true,
      resolvedByUserId: true,
      context: true,
      createdAt: true,
      updatedAt: true,
      rule: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return rows.map(mapIncident);
}

function normalizeNumericValue(value: unknown) {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function normalizeNullableNumericValue(value: unknown) {
  if (value === null || value === undefined) return null;
  const parsed = normalizeNumericValue(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export type TelemetryIncidentKpis = {
  from: Date;
  to: Date;
  windowMinutes: number;
  totalIncidents: number;
  openIncidents: number;
  acknowledgedIncidents: number;
  resolvedIncidents: number;
  acknowledgedSamples: number;
  resolvedSamples: number;
  mttaMinutes: number | null;
  mttrMinutes: number | null;
  ackSlaMinutes: number;
  resolveSlaMinutes: number;
  ackSlaBreaches: number;
  resolveSlaBreaches: number;
};

export async function getTelemetryIncidentKpis(params: {
  organizationId?: number | null;
  from: Date;
  to: Date;
  ackSlaMinutes?: number;
  resolveSlaMinutes?: number;
}): Promise<TelemetryIncidentKpis> {
  const from = params.from;
  const to = params.to;
  const ackSlaMinutes = toNullableInt(params.ackSlaMinutes, { min: 1, max: 24 * 60 }) ?? 15;
  const resolveSlaMinutes = toNullableInt(params.resolveSlaMinutes, { min: 1, max: 7 * 24 * 60 }) ?? 120;
  const env = getAppEnv();
  const orgFilter =
    typeof params.organizationId === "number"
      ? Prisma.sql`AND organization_id = ${params.organizationId}`
      : Prisma.empty;

  const [row] = await prisma.$queryRaw<
    Array<{
      total_incidents: bigint | number | string;
      open_incidents: bigint | number | string;
      acknowledged_incidents: bigint | number | string;
      resolved_incidents: bigint | number | string;
      acknowledged_samples: bigint | number | string;
      resolved_samples: bigint | number | string;
      mtta_minutes: number | string | null;
      mttr_minutes: number | string | null;
      ack_sla_breaches: bigint | number | string;
      resolve_sla_breaches: bigint | number | string;
    }>
  >(
    Prisma.sql`
      SELECT
        COUNT(*) AS total_incidents,
        COUNT(*) FILTER (WHERE status = 'OPEN') AS open_incidents,
        COUNT(*) FILTER (WHERE status = 'ACKNOWLEDGED') AS acknowledged_incidents,
        COUNT(*) FILTER (WHERE status = 'RESOLVED') AS resolved_incidents,
        COUNT(*) FILTER (
          WHERE acknowledged_at IS NOT NULL
            AND acknowledged_at >= triggered_at
        ) AS acknowledged_samples,
        COUNT(*) FILTER (
          WHERE resolved_at IS NOT NULL
            AND resolved_at >= triggered_at
        ) AS resolved_samples,
        AVG(EXTRACT(EPOCH FROM (acknowledged_at - triggered_at)) / 60.0) FILTER (
          WHERE acknowledged_at IS NOT NULL
            AND acknowledged_at >= triggered_at
        ) AS mtta_minutes,
        AVG(EXTRACT(EPOCH FROM (resolved_at - triggered_at)) / 60.0) FILTER (
          WHERE resolved_at IS NOT NULL
            AND resolved_at >= triggered_at
        ) AS mttr_minutes,
        COUNT(*) FILTER (
          WHERE acknowledged_at IS NOT NULL
            AND acknowledged_at >= triggered_at
            AND EXTRACT(EPOCH FROM (acknowledged_at - triggered_at)) > ${ackSlaMinutes * 60}
        ) AS ack_sla_breaches,
        COUNT(*) FILTER (
          WHERE resolved_at IS NOT NULL
            AND resolved_at >= triggered_at
            AND EXTRACT(EPOCH FROM (resolved_at - triggered_at)) > ${resolveSlaMinutes * 60}
        ) AS resolve_sla_breaches
      FROM app_v3.telemetry_alert_incidents
      WHERE env = ${env}
        AND triggered_at >= ${from}
        AND triggered_at <= ${to}
        ${orgFilter}
    `,
  );

  return {
    from,
    to,
    windowMinutes: Math.max(1, Math.round((to.getTime() - from.getTime()) / (60 * 1000))),
    totalIncidents: normalizeNumericValue(row?.total_incidents),
    openIncidents: normalizeNumericValue(row?.open_incidents),
    acknowledgedIncidents: normalizeNumericValue(row?.acknowledged_incidents),
    resolvedIncidents: normalizeNumericValue(row?.resolved_incidents),
    acknowledgedSamples: normalizeNumericValue(row?.acknowledged_samples),
    resolvedSamples: normalizeNumericValue(row?.resolved_samples),
    mttaMinutes: normalizeNullableNumericValue(row?.mtta_minutes),
    mttrMinutes: normalizeNullableNumericValue(row?.mttr_minutes),
    ackSlaMinutes,
    resolveSlaMinutes,
    ackSlaBreaches: normalizeNumericValue(row?.ack_sla_breaches),
    resolveSlaBreaches: normalizeNumericValue(row?.resolve_sla_breaches),
  };
}

export async function getTelemetryAlertRuleById(
  ruleId: string,
): Promise<TelemetryAlertRuleRecord | null> {
  const delegate = alertRuleDelegate();
  if (!delegate?.findUnique) return null;

  const row = await delegate.findUnique({
    where: { id: ruleId },
    select: {
      id: true,
      organizationId: true,
      name: true,
      description: true,
      metricKey: true,
      dimensionKey: true,
      dimensionValue: true,
      comparisonOperator: true,
      threshold: true,
      windowMinutes: true,
      cooldownMinutes: true,
      severity: true,
      isActive: true,
      createdByUserId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return row ? mapRule(row) : null;
}

export async function getTelemetryIncidentById(
  incidentId: string,
): Promise<TelemetryAlertIncidentRecord | null> {
  const delegate = alertIncidentDelegate();
  if (!delegate?.findUnique) return null;

  const row = await delegate.findUnique({
    where: { id: incidentId },
    select: {
      id: true,
      ruleId: true,
      organizationId: true,
      status: true,
      severity: true,
      title: true,
      description: true,
      metricKey: true,
      dimensionKey: true,
      dimensionValue: true,
      observedValue: true,
      thresholdValue: true,
      triggeredAt: true,
      acknowledgedAt: true,
      resolvedAt: true,
      acknowledgedByUserId: true,
      resolvedByUserId: true,
      context: true,
      createdAt: true,
      updatedAt: true,
      rule: { select: { id: true, name: true } },
    },
  });

  return row ? mapIncident(row) : null;
}

export type CreateTelemetryAlertRuleInput = {
  organizationId: number | null;
  name: string;
  description: string | null;
  metricKey: TelemetryMetricKey;
  dimensionKey: string | null;
  dimensionValue: string | null;
  comparisonOperator: TelemetryComparisonOperator;
  threshold: number;
  windowMinutes: number;
  cooldownMinutes: number;
  severity: TelemetrySeverity;
  isActive: boolean;
};

export async function createTelemetryAlertRule(
  input: CreateTelemetryAlertRuleInput,
  createdByUserId: string | null,
): Promise<TelemetryAlertRuleRecord | null> {
  const delegate = alertRuleDelegate();
  if (!delegate?.create) return null;

  const created = await delegate.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      description: input.description,
      metricKey: input.metricKey,
      dimensionKey: input.dimensionKey,
      dimensionValue: input.dimensionValue,
      comparisonOperator: input.comparisonOperator,
      threshold: input.threshold,
      windowMinutes: input.windowMinutes,
      cooldownMinutes: input.cooldownMinutes,
      severity: input.severity,
      isActive: input.isActive,
      createdByUserId,
    },
    select: {
      id: true,
      organizationId: true,
      name: true,
      description: true,
      metricKey: true,
      dimensionKey: true,
      dimensionValue: true,
      comparisonOperator: true,
      threshold: true,
      windowMinutes: true,
      cooldownMinutes: true,
      severity: true,
      isActive: true,
      createdByUserId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return mapRule(created);
}

export type UpdateTelemetryAlertRuleInput = Partial<
  Omit<CreateTelemetryAlertRuleInput, "organizationId">
>;

export async function updateTelemetryAlertRule(
  ruleId: string,
  patch: UpdateTelemetryAlertRuleInput,
): Promise<TelemetryAlertRuleRecord | null> {
  const delegate = alertRuleDelegate();
  if (!delegate?.update) return null;

  const updated = await delegate.update({
    where: { id: ruleId },
    data: {
      ...(typeof patch.name === "string" ? { name: patch.name } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description }
        : {}),
      ...(patch.metricKey ? { metricKey: patch.metricKey } : {}),
      ...(patch.dimensionKey !== undefined
        ? { dimensionKey: patch.dimensionKey }
        : {}),
      ...(patch.dimensionValue !== undefined
        ? { dimensionValue: patch.dimensionValue }
        : {}),
      ...(patch.comparisonOperator
        ? { comparisonOperator: patch.comparisonOperator }
        : {}),
      ...(typeof patch.threshold === "number"
        ? { threshold: patch.threshold }
        : {}),
      ...(typeof patch.windowMinutes === "number"
        ? { windowMinutes: patch.windowMinutes }
        : {}),
      ...(typeof patch.cooldownMinutes === "number"
        ? { cooldownMinutes: patch.cooldownMinutes }
        : {}),
      ...(patch.severity ? { severity: patch.severity } : {}),
      ...(typeof patch.isActive === "boolean"
        ? { isActive: patch.isActive }
        : {}),
    },
    select: {
      id: true,
      organizationId: true,
      name: true,
      description: true,
      metricKey: true,
      dimensionKey: true,
      dimensionValue: true,
      comparisonOperator: true,
      threshold: true,
      windowMinutes: true,
      cooldownMinutes: true,
      severity: true,
      isActive: true,
      createdByUserId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return mapRule(updated);
}

export async function updateTelemetryIncidentStatus(params: {
  incidentId: string;
  status: TelemetryIncidentStatus;
  actorUserId: string | null;
}): Promise<TelemetryAlertIncidentRecord | null> {
  const delegate = alertIncidentDelegate();
  if (!delegate?.update) return null;

  const now = new Date();
  const data: Record<string, unknown> = { status: params.status };

  if (params.status === "ACKNOWLEDGED") {
    data.acknowledgedAt = now;
    data.acknowledgedByUserId = params.actorUserId;
  }

  if (params.status === "RESOLVED") {
    data.resolvedAt = now;
    data.resolvedByUserId = params.actorUserId;
    if (!params.actorUserId) {
      data.acknowledgedAt = now;
    }
  }

  const updated = await delegate.update({
    where: { id: params.incidentId },
    data,
    select: {
      id: true,
      ruleId: true,
      organizationId: true,
      status: true,
      severity: true,
      title: true,
      description: true,
      metricKey: true,
      dimensionKey: true,
      dimensionValue: true,
      observedValue: true,
      thresholdValue: true,
      triggeredAt: true,
      acknowledgedAt: true,
      resolvedAt: true,
      acknowledgedByUserId: true,
      resolvedByUserId: true,
      context: true,
      createdAt: true,
      updatedAt: true,
      rule: { select: { id: true, name: true } },
    },
  });

  return mapIncident(updated);
}

function parseMetricKey(value: unknown): TelemetryMetricKey | null {
  return toEnumValue(value, TELEMETRY_METRIC_KEYS);
}

function parseSeverity(value: unknown): TelemetrySeverity | null {
  return toEnumValue(value, TELEMETRY_SEVERITIES);
}

function parseRuleName(value: unknown): string | null {
  const name = toNullableText(value, 160);
  if (!name) return null;
  return name.length >= 2 ? name : null;
}

function parseDimensionKey(value: unknown): string | null {
  const normalized = toNullableText(value, 80);
  if (!normalized) return null;
  return normalized.toUpperCase();
}

function parseDimensionValue(value: unknown): string | null {
  return toNullableText(value, 180);
}

function parseThreshold(value: unknown): number | null {
  return toNullableInt(value, { min: 0, max: 1_000_000_000 });
}

function parseWindowMinutes(value: unknown): number | null {
  return toNullableInt(value, { min: 5, max: 24 * 60 });
}

function parseCooldownMinutes(value: unknown): number | null {
  return toNullableInt(value, { min: 1, max: 7 * 24 * 60 });
}

function parseOrganizationId(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  return toNullableInt(value, { min: 1 });
}

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function parseTelemetryAlertRuleCreateInput(
  raw: unknown,
  options?: { forcedOrganizationId?: number | null },
): ParseResult<CreateTelemetryAlertRuleInput> {
  if (!isRecord(raw)) {
    return { ok: false, error: "INVALID_PAYLOAD" };
  }

  const name = parseRuleName(raw.name);
  if (!name) {
    return { ok: false, error: "INVALID_RULE_NAME" };
  }

  const metricKey = parseMetricKey(raw.metricKey);
  if (!metricKey) {
    return { ok: false, error: "INVALID_METRIC_KEY" };
  }

  const threshold = parseThreshold(raw.threshold);
  if (threshold === null) {
    return { ok: false, error: "INVALID_THRESHOLD" };
  }

  const dimensionKey = parseDimensionKey(raw.dimensionKey);
  const dimensionValue = parseDimensionValue(raw.dimensionValue);
  if (dimensionValue && !dimensionKey) {
    return {
      ok: false,
      error: "DIMENSION_KEY_REQUIRED_WHEN_DIMENSION_VALUE_IS_PROVIDED",
    };
  }

  const organizationId =
    options?.forcedOrganizationId !== undefined
      ? options.forcedOrganizationId
      : parseOrganizationId(raw.organizationId);

  const parsed: CreateTelemetryAlertRuleInput = {
    organizationId,
    name,
    description: toNullableText(raw.description, 500),
    metricKey,
    dimensionKey,
    dimensionValue,
    comparisonOperator: normalizeTelemetryComparisonOperator(raw.comparisonOperator),
    threshold,
    windowMinutes: parseWindowMinutes(raw.windowMinutes) ?? 15,
    cooldownMinutes: parseCooldownMinutes(raw.cooldownMinutes) ?? 30,
    severity: parseSeverity(raw.severity) ?? "WARN",
    isActive: toNullableBoolean(raw.isActive) ?? true,
  };

  return { ok: true, value: parsed };
}

export function parseTelemetryAlertRulePatchInput(
  raw: unknown,
): ParseResult<UpdateTelemetryAlertRuleInput> {
  if (!isRecord(raw)) {
    return { ok: false, error: "INVALID_PAYLOAD" };
  }

  const patch: UpdateTelemetryAlertRuleInput = {};

  if ("name" in raw) {
    const name = parseRuleName(raw.name);
    if (!name) return { ok: false, error: "INVALID_RULE_NAME" };
    patch.name = name;
  }

  if ("description" in raw) {
    patch.description = toNullableText(raw.description, 500);
  }

  if ("metricKey" in raw) {
    const metricKey = parseMetricKey(raw.metricKey);
    if (!metricKey) return { ok: false, error: "INVALID_METRIC_KEY" };
    patch.metricKey = metricKey;
  }

  if ("dimensionKey" in raw) {
    patch.dimensionKey = parseDimensionKey(raw.dimensionKey);
  }

  if ("dimensionValue" in raw) {
    patch.dimensionValue = parseDimensionValue(raw.dimensionValue);
  }

  if ("comparisonOperator" in raw) {
    patch.comparisonOperator = normalizeTelemetryComparisonOperator(
      raw.comparisonOperator,
    );
  }

  if ("threshold" in raw) {
    const threshold = parseThreshold(raw.threshold);
    if (threshold === null) return { ok: false, error: "INVALID_THRESHOLD" };
    patch.threshold = threshold;
  }

  if ("windowMinutes" in raw) {
    const windowMinutes = parseWindowMinutes(raw.windowMinutes);
    if (windowMinutes === null) {
      return { ok: false, error: "INVALID_WINDOW_MINUTES" };
    }
    patch.windowMinutes = windowMinutes;
  }

  if ("cooldownMinutes" in raw) {
    const cooldownMinutes = parseCooldownMinutes(raw.cooldownMinutes);
    if (cooldownMinutes === null) {
      return { ok: false, error: "INVALID_COOLDOWN_MINUTES" };
    }
    patch.cooldownMinutes = cooldownMinutes;
  }

  if ("severity" in raw) {
    const severity = parseSeverity(raw.severity);
    if (!severity) return { ok: false, error: "INVALID_SEVERITY" };
    patch.severity = severity;
  }

  if ("isActive" in raw) {
    const isActive = toNullableBoolean(raw.isActive);
    if (isActive === null) return { ok: false, error: "INVALID_IS_ACTIVE" };
    patch.isActive = isActive;
  }

  if (
    "dimensionValue" in raw &&
    patch.dimensionValue &&
    !("dimensionKey" in raw)
  ) {
    return {
      ok: false,
      error: "DIMENSION_KEY_REQUIRED_WHEN_DIMENSION_VALUE_IS_PROVIDED",
    };
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "NO_FIELDS_TO_UPDATE" };
  }

  return { ok: true, value: patch };
}

export function parseTelemetryIncidentStatusAction(
  raw: unknown,
): ParseResult<TelemetryIncidentStatus> {
  if (!isRecord(raw)) {
    return { ok: false, error: "INVALID_PAYLOAD" };
  }

  const action = toNullableText(raw.action, 30)?.toUpperCase();
  if (action === "ACK" || action === "ACKNOWLEDGE") {
    return { ok: true, value: "ACKNOWLEDGED" };
  }
  if (action === "RESOLVE" || action === "RESOLVED") {
    return { ok: true, value: "RESOLVED" };
  }
  return { ok: false, error: "INVALID_ACTION" };
}

type RuleObservation = {
  organizationId: number;
  observedValue: number;
  bucketCount: number;
  latestBucketStart: Date | null;
};

type RawObservationRow = {
  organization_id: number;
  observed_value: bigint | number;
};

function normalizeObservedValue(value: bigint | number | undefined) {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  return 0;
}

async function buildRuleObservationsFromRawEvents(params: {
  rule: TelemetryAlertRuleRecord;
  from: Date;
  now: Date;
}): Promise<RuleObservation[]> {
  const metricExpr =
    params.rule.metricKey === "ERROR_COUNT"
      ? Prisma.sql`COUNT(*) FILTER (WHERE severity IN ('ERROR', 'CRITICAL'))`
      : params.rule.metricKey === "UNIQUE_ACTORS"
        ? Prisma.sql`COUNT(DISTINCT COALESCE(actor_key, actor_user_id::text))`
        : Prisma.sql`COUNT(*)`;
  const orgFilter =
    typeof params.rule.organizationId === "number"
      ? Prisma.sql`AND organization_id = ${params.rule.organizationId}`
      : Prisma.empty;
  const env = getAppEnv();

  const rows = await prisma.$queryRaw<RawObservationRow[]>(Prisma.sql`
    SELECT
      organization_id,
      ${metricExpr} AS observed_value
    FROM app_v3.telemetry_events
    WHERE env = ${env}
      AND organization_id IS NOT NULL
      AND occurred_at >= ${params.from}
      AND occurred_at <= ${params.now}
      ${orgFilter}
    GROUP BY organization_id
  `);

  return rows
    .map((row) => ({
      organizationId: Number(row.organization_id),
      observedValue: normalizeObservedValue(row.observed_value),
      bucketCount: 0,
      latestBucketStart: null,
    }))
    .filter((item) => Number.isFinite(item.organizationId) && item.organizationId > 0);
}

async function buildRuleObservations(
  rule: TelemetryAlertRuleRecord,
  now: Date,
): Promise<{ from: Date; observations: RuleObservation[] }> {
  const delegate = metricRollupDelegate();
  const from = new Date(now.getTime() - rule.windowMinutes * 60 * 1000);
  const isGlobalDimension = !rule.dimensionKey;
  const effectiveDimensionKey = rule.dimensionKey ?? "GLOBAL";
  const effectiveDimensionValue = rule.dimensionValue ?? (isGlobalDimension ? "ALL" : null);
  if (!delegate?.findMany) {
    return { from, observations: [] };
  }

  const rows = await delegate.findMany({
    where: {
      metricKey: rule.metricKey,
      ...(typeof rule.organizationId === "number"
        ? { organizationId: rule.organizationId }
        : {}),
      dimensionKey: effectiveDimensionKey,
      ...(effectiveDimensionValue ? { dimensionValue: effectiveDimensionValue } : {}),
      bucketStart: {
        gte: from,
        lte: now,
      },
    },
    select: {
      organizationId: true,
      value: true,
      bucketStart: true,
    },
  });

  const aggregated = new Map<number, RuleObservation>();

  for (const row of rows) {
    const organizationId = Number(row.organizationId);
    if (!Number.isFinite(organizationId) || organizationId <= 0) continue;

    const existing = aggregated.get(organizationId) ?? {
      organizationId,
      observedValue: 0,
      bucketCount: 0,
      latestBucketStart: null,
    };

    existing.observedValue += Number(row.value ?? 0);
    existing.bucketCount += 1;

    const bucketStart = row.bucketStart instanceof Date ? row.bucketStart : null;
    if (
      bucketStart &&
      (!existing.latestBucketStart || bucketStart > existing.latestBucketStart)
    ) {
      existing.latestBucketStart = bucketStart;
    }

    aggregated.set(organizationId, existing);
  }

  if (aggregated.size === 0 && isGlobalDimension) {
    const rawFallback = await buildRuleObservationsFromRawEvents({
      rule,
      from,
      now,
    });
    for (const item of rawFallback) {
      aggregated.set(item.organizationId, item);
    }
  }

  if (aggregated.size === 0 && typeof rule.organizationId === "number") {
    aggregated.set(rule.organizationId, {
      organizationId: rule.organizationId,
      observedValue: 0,
      bucketCount: 0,
      latestBucketStart: null,
    });
  }

  return {
    from,
    observations: Array.from(aggregated.values()),
  };
}

function buildIncidentScopeWhere(params: {
  ruleId: string;
  organizationId: number;
  dimensionKey: string | null;
  dimensionValue: string | null;
}) {
  return {
    ruleId: params.ruleId,
    organizationId: params.organizationId,
    dimensionKey: params.dimensionKey,
    dimensionValue: params.dimensionValue,
  };
}

export type TelemetryAlertEvaluationResult = {
  evaluatedRules: number;
  evaluatedOrganizations: number;
  openedIncidents: number;
  updatedIncidents: number;
  resolvedIncidents: number;
  skippedByCooldown: number;
  breachesDetected: number;
  errors: number;
};

export async function evaluateTelemetryAlertRules(params?: {
  organizationId?: number | null;
  now?: Date;
  maxRules?: number;
}): Promise<TelemetryAlertEvaluationResult> {
  const ruleDelegate = alertRuleDelegate();
  const incidentDelegate = alertIncidentDelegate();
  if (!ruleDelegate?.findMany || !incidentDelegate?.findFirst) {
    return {
      evaluatedRules: 0,
      evaluatedOrganizations: 0,
      openedIncidents: 0,
      updatedIncidents: 0,
      resolvedIncidents: 0,
      skippedByCooldown: 0,
      breachesDetected: 0,
      errors: 0,
    };
  }

  const now = params?.now ?? new Date();
  const rules = await listTelemetryAlertRules({
    organizationId:
      typeof params?.organizationId === "number" ? params.organizationId : null,
    includeGlobal: typeof params?.organizationId === "number",
    activeOnly: true,
    take:
      typeof params?.maxRules === "number" && params.maxRules > 0
        ? Math.min(Math.floor(params.maxRules), 500)
        : 250,
  });

  let openedIncidents = 0;
  let updatedIncidents = 0;
  let resolvedIncidents = 0;
  let skippedByCooldown = 0;
  let breachesDetected = 0;
  let errors = 0;
  let evaluatedOrganizations = 0;

  for (const rule of rules) {
    try {
      const { from, observations } = await buildRuleObservations(rule, now);
      for (const observation of observations) {
        evaluatedOrganizations += 1;

        const scopeWhere = buildIncidentScopeWhere({
          ruleId: rule.id,
          organizationId: observation.organizationId,
          dimensionKey: rule.dimensionKey,
          dimensionValue: rule.dimensionValue,
        });

        const existingOpen = await incidentDelegate.findFirst({
          where: {
            ...scopeWhere,
            status: { in: ["OPEN", "ACKNOWLEDGED"] },
          },
          orderBy: [{ triggeredAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            status: true,
            triggeredAt: true,
          },
        });

        const breached = compareThreshold(
          rule.comparisonOperator,
          observation.observedValue,
          rule.threshold,
        );

        if (breached) {
          breachesDetected += 1;

          const context = sanitizeTelemetryPayload({
            ruleId: rule.id,
            ruleName: rule.name,
            metricKey: rule.metricKey,
            comparisonOperator: rule.comparisonOperator,
            threshold: rule.threshold,
            observedValue: observation.observedValue,
            bucketCount: observation.bucketCount,
            latestBucketStart: observation.latestBucketStart?.toISOString() ?? null,
            windowMinutes: rule.windowMinutes,
            windowFrom: from.toISOString(),
            windowTo: now.toISOString(),
          });

          if (existingOpen && incidentDelegate.update) {
            await incidentDelegate.update({
              where: { id: existingOpen.id },
              data: {
                observedValue: observation.observedValue,
                thresholdValue: rule.threshold,
                context,
                updatedAt: now,
              },
            });
            updatedIncidents += 1;
            continue;
          }

          const latest = await incidentDelegate.findFirst?.({
            where: scopeWhere,
            orderBy: [{ triggeredAt: "desc" }, { id: "desc" }],
            select: {
              id: true,
              triggeredAt: true,
            },
          });

          if (
            latest?.triggeredAt instanceof Date &&
            latest.triggeredAt.getTime() >
              now.getTime() - rule.cooldownMinutes * 60 * 1000
          ) {
            skippedByCooldown += 1;
            continue;
          }

          if (incidentDelegate.create) {
            await incidentDelegate.create({
              data: {
                ruleId: rule.id,
                organizationId: observation.organizationId,
                status: "OPEN",
                severity: rule.severity,
                title: `Alerta: ${rule.name}`,
                description: `Valor observado ${observation.observedValue} (${rule.comparisonOperator} ${rule.threshold}) na janela de ${rule.windowMinutes} minutos.`,
                metricKey: rule.metricKey,
                dimensionKey: rule.dimensionKey,
                dimensionValue: rule.dimensionValue,
                observedValue: observation.observedValue,
                thresholdValue: rule.threshold,
                triggeredAt: now,
                context,
              },
            });
            openedIncidents += 1;
          }

          continue;
        }

        if (existingOpen && incidentDelegate.update) {
          await incidentDelegate.update({
            where: { id: existingOpen.id },
            data: {
              status: "RESOLVED",
              resolvedAt: now,
              resolvedByUserId: null,
              observedValue: observation.observedValue,
              thresholdValue: rule.threshold,
              context: sanitizeTelemetryPayload({
                ...(isRecord(existingOpen) ? existingOpen : {}),
                autoResolved: true,
                resolvedAt: now.toISOString(),
                observedValue: observation.observedValue,
              }),
            },
          });
          resolvedIncidents += 1;
        }
      }
    } catch {
      errors += 1;
    }
  }

  return {
    evaluatedRules: rules.length,
    evaluatedOrganizations,
    openedIncidents,
    updatedIncidents,
    resolvedIncidents,
    skippedByCooldown,
    breachesDetected,
    errors,
  };
}
