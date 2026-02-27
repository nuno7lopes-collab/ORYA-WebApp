"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  RECHARTS_AXIS_TICK_STYLE,
  RECHARTS_LEGEND_WRAPPER_STYLE,
  RECHARTS_TOOLTIP_CONTENT_STYLE,
  RECHARTS_TOOLTIP_CURSOR_STYLE,
  RECHARTS_TOOLTIP_ITEM_STYLE,
  RECHARTS_TOOLTIP_LABEL_STYLE,
  formatRechartsLegendLabel,
  renderReadablePiePercentLabel,
} from "@/components/ui/rechartsTheme";
import { buildOrgHref } from "@/lib/organizationIdUtils";
import { isAnalyticsAllowedView, type AnalyticsAllowedView } from "@/lib/domainBoundaries";
import { cn } from "@/lib/utils";

type AnalyticsToolClientProps = {
  orgId: number;
  initialView: AnalyticsAllowedView;
};

type RangeOption = "7d" | "30d" | "90d" | "all";
type ScopeOption = "all" | "eventos" | "padel";
type DimensionOption = "MODULE" | "SOURCE_TYPE" | "PAYMENT_PROVIDER" | "CURRENCY";
type MetricOption = "GROSS" | "PLATFORM_FEES" | "PROCESSOR_FEES" | "NET_TO_ORG";

type AnalyticsOverviewResponse = {
  ok?: boolean;
  range: string;
  currency: string | null;
  totalTickets: number;
  grossCents: number;
  feesCents: number;
  netRevenueCents: number;
  eventsWithSalesCount: number;
  activeEventsCount: number;
};

type AnalyticsConversionResponse = {
  ok?: boolean;
  range: string;
  startedCount: number;
  succeededCount: number;
  conversionRateBps: number;
  conversionRatePct: number;
  breakdown: Array<{ sourceType: string; startedCount: number; succeededCount: number; conversionRateBps: number }>;
};

type AnalyticsCohortsResponse = {
  ok?: boolean;
  months: number;
  cohorts: Array<{
    cohortMonth: string;
    buyers: number;
    retention: Array<{ monthOffset: number; retainedBuyers: number; retentionRateBps: number; revenueCents: number }>;
  }>;
};

type AnalyticsTimeSeriesResponse = {
  ok?: boolean;
  currency: string | null;
  points: Array<{ date: string; grossCents: number; feesCents: number; netCents: number; tickets?: number }>;
};

type AnalyticsDimensionsResponse = {
  ok?: boolean;
  bucketDate: string | null;
  items: Record<string, Record<string, number>>;
};

type AnalyticsBuyersResponse = {
  ok?: boolean;
  eventId: number;
  items: Array<{
    id: string;
    buyerName: string;
    buyerEmail: string;
    totalPaidCents: number;
    status: string;
  }>;
};

type AnalyticsEventsResponse = {
  ok?: boolean;
  items: Array<{
    id: number;
    title: string;
    startsAt: string;
    status: string;
    templateType: string | null;
  }>;
};

type TelemetryAlertRuleResponse = {
  id: string;
  organizationId: number | null;
  name: string;
  description: string | null;
  metricKey: string;
  dimensionKey: string | null;
  dimensionValue: string | null;
  comparisonOperator: string;
  threshold: number;
  windowMinutes: number;
  cooldownMinutes: number;
  severity: string;
  isActive: boolean;
};

type TelemetryIncidentResponse = {
  id: string;
  ruleId: string | null;
  organizationId: number | null;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  severity: string;
  title: string;
  description: string | null;
  metricKey: string | null;
  dimensionKey: string | null;
  dimensionValue: string | null;
  observedValue: number | null;
  thresholdValue: number | null;
  triggeredAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  rule?: { id: string; name: string } | null;
};

type TelemetryIncidentKpisResponse = {
  from: string;
  to: string;
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

type TelemetryOverviewResponse = {
  window: { hours: number; from: string; to: string };
  totals: { totalEvents: number; errorEvents: number; uniqueActors: number; errorRateBps: number };
  sourceBreakdown: Array<{ sourceType: string; count: number }>;
  topEvents: Array<{ eventName: string; count: number }>;
  timeline: Array<{ bucketStart: string; total: number; errors: number }>;
  latest: Array<{
    id: string;
    eventName: string;
    sourceType: string;
    severity: string;
    occurredAt: string;
    correlationId: string | null;
    requestId: string | null;
    organizationId: number | null;
  }>;
  incidentKpis?: TelemetryIncidentKpisResponse;
  incidents?: TelemetryIncidentResponse[];
  rules?: TelemetryAlertRuleResponse[];
};

type TelemetryEventsResponse = {
  items: Array<{
    id: string;
    eventName: string;
    sourceType: string;
    severity: string;
    actorType: string;
    correlationId: string | null;
    requestId: string | null;
    occurredAt: string;
  }>;
  pagination: { hasMore: boolean; nextCursor: string | null };
};

type TelemetryIncidentsResponse = {
  items: TelemetryIncidentResponse[];
  pagination?: { hasMore: boolean; nextCursor: string | null };
  sort?: "TRIGGERED_DESC" | "SLA_IMPACT_DESC";
};

type TelemetryFunnelStepResponse = {
  key: string;
  eventName: string;
  required: boolean;
  withinMinutes: number | null;
};

type TelemetryFunnelDraftStep = {
  key: string;
  eventName: string;
  withinMinutes: string;
};

type TelemetryFunnelDefinitionResponse = {
  id: string;
  organizationId: number | null;
  name: string;
  description: string | null;
  steps: TelemetryFunnelStepResponse[];
  isActive: boolean;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

type TelemetryFunnelResultResponse = {
  id: number;
  funnelId: string;
  organizationId: number | null;
  bucketStart: string;
  bucketUnit: "HOUR" | "DAY";
  stepKey: string;
  enteredCount: number;
  convertedCount: number;
  conversionRateBps: number;
  createdAt: string;
  updatedAt: string;
};

type TelemetryFunnelListResponse = {
  items: TelemetryFunnelDefinitionResponse[];
};

type TelemetryFunnelResultsResponse = {
  items: TelemetryFunnelResultResponse[];
};

type TelemetryCatalogEntryResponse = {
  eventName: string;
  eventVersion: string;
  owner: string;
  description: string;
  defaultSeverity: string;
  piiRisk: string;
  aliases: string[];
};

type TelemetryCatalogResponse = {
  total: number;
  items: TelemetryCatalogEntryResponse[];
};

type TelemetryExportDataset = "events" | "incidents" | "rules" | "funnels" | "funnel_results";
type TelemetryExportFormat = "csv" | "pdf";

type TelemetryExportPreviewPayload = {
  dataset: TelemetryExportDataset;
  headers: string[];
  rows: string[][];
  rowCount: number;
  sampleSize: number;
  truncated: boolean;
};

type TelemetryEvaluationResult = {
  evaluatedRules: number;
  evaluatedOrganizations: number;
  openedIncidents: number;
  updatedIncidents: number;
  resolvedIncidents: number;
  skippedByCooldown: number;
  breachesDetected: number;
  errors: number;
};

type TelemetryRecomputeResult = {
  rollup: {
    bucketUnit: "HOUR" | "DAY";
    from: string;
    to: string;
    rows: {
      totalRows?: number;
      eventRows: number;
      sourceRows: number;
      actorRows: number;
    };
    written: number;
  };
  evaluation: TelemetryEvaluationResult | null;
  funnels: {
    from: string;
    to: string;
    bucketUnit: "HOUR" | "DAY";
    organizations: number;
    funnels: number;
    buckets: number;
    rowsDeleted: number;
    rowsWritten: number;
    skippedFunnels: number;
    errors: number;
  } | null;
};

const swrOptions = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  shouldRetryOnError: true,
  errorRetryCount: 2,
} as const;

const CHART_COLORS = ["#5EEAD4", "#60A5FA", "#F472B6", "#F59E0B", "#22C55E", "#A78BFA"];
const DEFAULT_RANGE: RangeOption = "30d";
const DEFAULT_SCOPE: ScopeOption = "all";
const DEFAULT_COHORT_MONTHS = 12;
const DEFAULT_DIMENSION: DimensionOption = "MODULE";
const TELEMETRY_FUNNEL_STEP_KEY_PATTERN = /^[a-z0-9][a-z0-9._:-]{1,63}$/;

function defaultTelemetryFunnelDraftSteps(): TelemetryFunnelDraftStep[] {
  return [
    { key: "start", eventName: "checkout.flow.started", withinMinutes: "" },
    { key: "success", eventName: "checkout.payment.succeeded", withinMinutes: "30" },
  ];
}

function parseView(raw: string | null | undefined, fallback: AnalyticsAllowedView): AnalyticsAllowedView {
  if (isAnalyticsAllowedView(raw)) return raw;
  return fallback;
}

function parseRange(raw: string | null | undefined): RangeOption {
  if (raw === "7d" || raw === "30d" || raw === "90d" || raw === "all") return raw;
  return "30d";
}

function parseScope(raw: string | null | undefined): ScopeOption {
  if (raw === "all" || raw === "eventos" || raw === "padel") return raw;
  return "all";
}

function parseMonths(raw: string | null | undefined) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return 12;
  return Math.max(3, Math.min(24, parsed));
}

function parseDimension(raw: string | null | undefined): DimensionOption {
  if (raw === "MODULE" || raw === "SOURCE_TYPE" || raw === "PAYMENT_PROVIDER" || raw === "CURRENCY") return raw;
  return "MODULE";
}

function parseMetric(raw: string | null | undefined): MetricOption {
  if (raw === "GROSS" || raw === "PLATFORM_FEES" || raw === "PROCESSOR_FEES" || raw === "NET_TO_ORG") return raw;
  return "GROSS";
}

function parseEventId(raw: string | null | undefined) {
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function parseTelemetryHours(raw: string | null | undefined) {
  const parsed = Number(raw ?? "24");
  if (!Number.isFinite(parsed) || parsed <= 0) return 24;
  if (parsed <= 6) return 6;
  if (parsed <= 24) return 24;
  if (parsed <= 72) return 72;
  return 168;
}

function parseTelemetrySource(raw: string | null | undefined) {
  if (!raw) return "";
  const normalized = raw.trim().toUpperCase();
  if (["WEB", "MOBILE", "API", "WORKER", "CRON", "INTERNAL"].includes(normalized)) return normalized;
  return "";
}

function parseTelemetrySeverity(raw: string | null | undefined) {
  if (!raw) return "";
  const normalized = raw.trim().toUpperCase();
  if (["INFO", "WARN", "ERROR", "CRITICAL"].includes(normalized)) return normalized;
  return "";
}

function parseTelemetryIncidentStatuses(raw: string | null | undefined) {
  if (!raw) return "OPEN,ACKNOWLEDGED";
  const normalized = raw
    .split(",")
    .map((token) => token.trim().toUpperCase())
    .filter(Boolean);
  if (normalized.includes("ALL")) return "ALL";
  const valid = normalized.filter((token) => ["OPEN", "ACKNOWLEDGED", "RESOLVED"].includes(token));
  if (!valid.length) return "OPEN,ACKNOWLEDGED";
  return Array.from(new Set(valid)).join(",");
}

function parseTelemetrySearch(raw: string | null | undefined) {
  if (!raw) return "";
  return raw.trim().slice(0, 120);
}

function parseTelemetryIncidentSort(raw: string | null | undefined) {
  const normalized = raw?.trim().toUpperCase();
  if (normalized === "SLA_IMPACT_DESC") return "SLA_IMPACT_DESC" as const;
  return "TRIGGERED_DESC" as const;
}

function parseTelemetryFunnelWithinMinutes(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null;
  if (parsed < 1 || parsed > 7 * 24 * 60) return null;
  return parsed;
}

function toCurrency(cents: number | null | undefined, currency = "EUR") {
  const value = (cents ?? 0) / 100;
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function toPctFromBps(bps: number | null | undefined) {
  return `${(((bps ?? 0) / 100) as number).toFixed(2)}%`;
}

function toEuroChartLabel(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return `${numeric.toFixed(2)} €`;
}

function compactDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit" }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatTelemetryMinutes(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  if (value >= 120) return `${(value / 60).toFixed(1)} h`;
  return `${value.toFixed(1)} min`;
}

function formatTelemetryStatus(status: TelemetryIncidentResponse["status"]) {
  if (status === "OPEN") return "Aberto";
  if (status === "ACKNOWLEDGED") return "Reconhecido";
  return "Resolvido";
}

function formatTelemetryMetricKey(value: string | null | undefined) {
  if (!value) return "Métrica";
  if (value === "EVENT_COUNT") return "Total de eventos";
  if (value === "ERROR_COUNT") return "Total de erros";
  if (value === "UNIQUE_ACTORS") return "Actores únicos";
  return value;
}

function minutesBetween(fromIso: string, toIso: string) {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return (to.getTime() - from.getTime()) / (60 * 1000);
}

function buildTelemetryIncidentSlaHint(
  incident: TelemetryIncidentResponse,
  kpis: TelemetryIncidentKpisResponse | null,
) {
  const ackSlaMinutes = kpis?.ackSlaMinutes ?? 15;
  const resolveSlaMinutes = kpis?.resolveSlaMinutes ?? 120;
  const nowIso = new Date().toISOString();
  const elapsedMinutes = minutesBetween(incident.triggeredAt, nowIso);
  if (elapsedMinutes === null) return null;

  if (incident.status === "OPEN") {
    const delta = ackSlaMinutes - elapsedMinutes;
    if (delta >= 0) {
      return {
        label: `ACK SLA: ${Math.ceil(delta)}m restantes`,
        breached: false,
      };
    }
    return {
      label: `ACK SLA excedido em ${Math.ceil(Math.abs(delta))}m`,
      breached: true,
    };
  }

  if (incident.status === "ACKNOWLEDGED") {
    const delta = resolveSlaMinutes - elapsedMinutes;
    if (delta >= 0) {
      return {
        label: `Resolve SLA: ${Math.ceil(delta)}m restantes`,
        breached: false,
      };
    }
    return {
      label: `Resolve SLA excedido em ${Math.ceil(Math.abs(delta))}m`,
      breached: true,
    };
  }

  if (incident.status === "RESOLVED" && incident.resolvedAt) {
    const resolvedMinutes = minutesBetween(incident.triggeredAt, incident.resolvedAt);
    if (resolvedMinutes === null) return null;
    if (resolvedMinutes <= resolveSlaMinutes) {
      return {
        label: `Resolvido em ${Math.round(resolvedMinutes)}m`,
        breached: false,
      };
    }
    return {
      label: `Resolvido fora SLA (+${Math.ceil(resolvedMinutes - resolveSlaMinutes)}m)`,
      breached: true,
    };
  }

  return null;
}

function prettyMetricKey(value: MetricOption) {
  switch (value) {
    case "GROSS":
      return "Bruto";
    case "PLATFORM_FEES":
      return "Taxas plataforma";
    case "PROCESSOR_FEES":
      return "Taxas processamento";
    case "NET_TO_ORG":
      return "Líquido";
    default:
      return value;
  }
}

function prettyDimensionKey(value: DimensionOption) {
  switch (value) {
    case "MODULE":
      return "Ferramenta";
    case "SOURCE_TYPE":
      return "Origem";
    case "PAYMENT_PROVIDER":
      return "Fornecedor";
    case "CURRENCY":
      return "Moeda";
    default:
      return value;
  }
}

function prettyScope(scope: ScopeOption) {
  if (scope === "eventos") return "Eventos";
  if (scope === "padel") return "Padel";
  return "Tudo";
}

function unwrapEnvelope(payload: unknown) {
  if (!payload || typeof payload !== "object") return payload;
  const asRecord = payload as Record<string, unknown>;
  if (asRecord.data && typeof asRecord.data === "object") return asRecord.data;
  if (asRecord.result && typeof asRecord.result === "object") return asRecord.result;
  return payload;
}

async function apiFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const payload = await res.json().catch(() => null);
  const unwrapped = unwrapEnvelope(payload) as Record<string, unknown> | null;
  const topLevel = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  const hasErrorFlag = topLevel?.ok === false || unwrapped?.ok === false;
  if (!res.ok || hasErrorFlag) {
    const errorCode =
      (unwrapped?.error as string | undefined) ??
      (topLevel?.error as string | undefined) ??
      `HTTP_${res.status}`;
    throw new Error(errorCode);
  }
  return (unwrapped ?? payload) as T;
}

function formatAnalyticsError(error: unknown) {
  const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
  if (code === "NOT_ORGANIZATION") {
    return "Não tens acesso à organização selecionada.";
  }
  if (code === "NO_ANALYTICS_ACCESS") {
    return "Ferramenta Analytics inativa ou sem permissões para esta organização.";
  }
  if (code === "UNAUTHENTICATED") {
    return "Sessão expirada. Volta a iniciar sessão.";
  }
  if (code.startsWith("HTTP_")) {
    return "Falha ao carregar analytics. Tenta novamente.";
  }
  return code;
}

function buildScopeQuery(scope: ScopeOption) {
  if (scope === "padel") return { templateType: "PADEL" as const };
  if (scope === "eventos") return { excludeTemplateType: "PADEL" as const };
  return {};
}

function buildQueryString(query: Record<string, string | number | undefined | null>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || typeof value === "undefined" || value === "") continue;
    params.set(key, String(value));
  }
  return params.toString();
}

export default function AnalyticsToolClient({ orgId, initialView }: AnalyticsToolClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = parseView(searchParams?.get("view") ?? null, initialView);
  const range = parseRange(searchParams?.get("range") ?? null);
  const scope = parseScope(searchParams?.get("scope") ?? null);
  const months = parseMonths(searchParams?.get("months") ?? null);
  const dimensionKey = parseDimension(searchParams?.get("dimensionKey") ?? null);
  const metricKey = parseMetric(searchParams?.get("metricKey") ?? null);
  const selectedEventId = parseEventId(searchParams?.get("eventId") ?? null);
  const telemetryHours = parseTelemetryHours(searchParams?.get("telemetryHours") ?? null);
  const telemetrySource = parseTelemetrySource(searchParams?.get("telemetrySource") ?? null);
  const telemetrySeverity = parseTelemetrySeverity(searchParams?.get("telemetrySeverity") ?? null);
  const telemetryIncidentStatuses = parseTelemetryIncidentStatuses(
    searchParams?.get("telemetryIncidentStatuses") ?? null,
  );
  const telemetryIncidentSeverity = parseTelemetrySeverity(
    searchParams?.get("telemetryIncidentSeverity") ?? null,
  );
  const telemetryIncidentQuery = parseTelemetrySearch(
    searchParams?.get("telemetryIncidentQuery") ?? null,
  );
  const telemetryIncidentSort = parseTelemetryIncidentSort(
    searchParams?.get("telemetryIncidentSort") ?? null,
  );
  const orgApiBase = `/api/org/${orgId}`;
  const scopeQuery = buildScopeQuery(scope);

  const updateQuery = useCallback(
    (updates: Record<string, string | number | null | undefined>) => {
      const next = new URLSearchParams(searchParams?.toString() ?? "");
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || typeof value === "undefined" || value === "") {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }
      next.set("view", view);
      router.replace(buildOrgHref(orgId, "/analytics", next));
    },
    [orgId, router, searchParams, view],
  );

  const overviewKey =
    view === "overview"
      ? `${orgApiBase}/analytics/overview?${buildQueryString({ range, ...scopeQuery })}`
      : null;
  const conversionKey =
    view === "conversion"
      ? `${orgApiBase}/analytics/conversion?${buildQueryString({ range })}`
      : null;
  const cohortsKey =
    view === "cohorts"
      ? `${orgApiBase}/analytics/cohorts?${buildQueryString({ months, ...scopeQuery })}`
      : null;
  const eventsKey =
    view === "buyers"
      ? `${orgApiBase}/analytics/events?${buildQueryString({ limit: 120, ...scopeQuery })}`
      : null;

  const { data: eventsData, error: eventsError, isLoading: eventsLoading, mutate: mutateEvents } = useSWR<AnalyticsEventsResponse>(
    eventsKey,
    apiFetcher,
    swrOptions,
  );

  const effectiveEventId = selectedEventId ?? eventsData?.items?.[0]?.id ?? null;
  const buyersKey =
    view === "buyers" && effectiveEventId
      ? `${orgApiBase}/analytics/buyers?${buildQueryString({ eventId: effectiveEventId })}`
      : null;
  const seriesKey =
    view === "overview" || view === "time-series"
      ? `${orgApiBase}/analytics/time-series?${buildQueryString({ range, ...scopeQuery })}`
      : null;
  const dimensionsKey =
    view === "dimensions"
      ? `${orgApiBase}/analytics/dimensoes?${buildQueryString({ dimensionKey })}`
      : null;
  const telemetryOverviewKey =
    view === "telemetry"
      ? `${orgApiBase}/telemetry/overview?${buildQueryString({ hours: telemetryHours })}`
      : null;
  const telemetryEventsKey =
    view === "telemetry"
      ? `${orgApiBase}/telemetry/events?${buildQueryString({
          take: 80,
          sourceType: telemetrySource || null,
          severity: telemetrySeverity || null,
        })}`
      : null;
  const telemetryIncidentsKey =
    view === "telemetry"
      ? `${orgApiBase}/telemetry/incidents?${buildQueryString({
          take: 120,
          statuses:
            telemetryIncidentStatuses === "ALL"
              ? null
              : telemetryIncidentStatuses,
          severities: telemetryIncidentSeverity || null,
          q: telemetryIncidentQuery || null,
          sort: telemetryIncidentSort,
        })}`
      : null;
  const telemetryFunnelsKey =
    view === "telemetry"
      ? `${orgApiBase}/telemetry/funnels?${buildQueryString({
          includeGlobal: "true",
          activeOnly: "false",
        })}`
      : null;
  const telemetryFunnelResultsKey =
    view === "telemetry"
      ? `${orgApiBase}/telemetry/funnels/results?${buildQueryString({
          take: 120,
          bucketUnit: "HOUR",
        })}`
      : null;
  const telemetryCatalogKey =
    view === "telemetry"
      ? `${orgApiBase}/telemetry/catalog`
      : null;

  const { data: overview, error: overviewError, isLoading: overviewLoading, mutate: mutateOverview } = useSWR<AnalyticsOverviewResponse>(
    overviewKey,
    apiFetcher,
    swrOptions,
  );
  const { data: conversion, error: conversionError, isLoading: conversionLoading, mutate: mutateConversion } =
    useSWR<AnalyticsConversionResponse>(conversionKey, apiFetcher, swrOptions);
  const { data: cohorts, error: cohortsError, isLoading: cohortsLoading, mutate: mutateCohorts } = useSWR<AnalyticsCohortsResponse>(
    cohortsKey,
    apiFetcher,
    swrOptions,
  );
  const { data: buyers, error: buyersError, isLoading: buyersLoading, mutate: mutateBuyers } = useSWR<AnalyticsBuyersResponse>(
    buyersKey,
    apiFetcher,
    swrOptions,
  );
  const { data: series, error: seriesError, isLoading: seriesLoading, mutate: mutateSeries } = useSWR<AnalyticsTimeSeriesResponse>(
    seriesKey,
    apiFetcher,
    swrOptions,
  );
  const { data: dimensions, error: dimensionsError, isLoading: dimensionsLoading, mutate: mutateDimensions } =
    useSWR<AnalyticsDimensionsResponse>(dimensionsKey, apiFetcher, swrOptions);
  const {
    data: telemetryOverview,
    error: telemetryOverviewError,
    isLoading: telemetryOverviewLoading,
    mutate: mutateTelemetryOverview,
  } = useSWR<TelemetryOverviewResponse>(telemetryOverviewKey, apiFetcher, swrOptions);
  const {
    data: telemetryEvents,
    error: telemetryEventsError,
    isLoading: telemetryEventsLoading,
    mutate: mutateTelemetryEvents,
  } = useSWR<TelemetryEventsResponse>(telemetryEventsKey, apiFetcher, swrOptions);
  const {
    data: telemetryIncidents,
    error: telemetryIncidentsError,
    isLoading: telemetryIncidentsLoading,
    mutate: mutateTelemetryIncidents,
  } = useSWR<TelemetryIncidentsResponse>(
    telemetryIncidentsKey,
    apiFetcher,
    swrOptions,
  );
  const {
    data: telemetryFunnels,
    error: telemetryFunnelsError,
    isLoading: telemetryFunnelsLoading,
    mutate: mutateTelemetryFunnels,
  } = useSWR<TelemetryFunnelListResponse>(telemetryFunnelsKey, apiFetcher, swrOptions);
  const {
    data: telemetryFunnelResults,
    error: telemetryFunnelResultsError,
    isLoading: telemetryFunnelResultsLoading,
    mutate: mutateTelemetryFunnelResults,
  } = useSWR<TelemetryFunnelResultsResponse>(telemetryFunnelResultsKey, apiFetcher, swrOptions);
  const {
    data: telemetryCatalog,
    error: telemetryCatalogError,
    isLoading: telemetryCatalogLoading,
    mutate: mutateTelemetryCatalog,
  } = useSWR<TelemetryCatalogResponse>(telemetryCatalogKey, apiFetcher, swrOptions);
  const [telemetryActionBusyKey, setTelemetryActionBusyKey] = useState<string | null>(null);
  const [telemetryActionError, setTelemetryActionError] = useState<string | null>(null);
  const [telemetryActionInfo, setTelemetryActionInfo] = useState<string | null>(null);
  const [telemetryEvaluateBusy, setTelemetryEvaluateBusy] = useState(false);
  const [telemetryRecomputeBusy, setTelemetryRecomputeBusy] = useState(false);
  const [telemetryFunnelBusyKey, setTelemetryFunnelBusyKey] = useState<string | null>(null);
  const [telemetryFunnelSaveBusy, setTelemetryFunnelSaveBusy] = useState(false);
  const [telemetryFunnelEditingId, setTelemetryFunnelEditingId] = useState<string | null>(null);
  const [telemetryFunnelName, setTelemetryFunnelName] = useState("");
  const [telemetryFunnelDescription, setTelemetryFunnelDescription] = useState("");
  const [telemetryFunnelIsActive, setTelemetryFunnelIsActive] = useState(true);
  const [telemetryFunnelSteps, setTelemetryFunnelSteps] = useState<TelemetryFunnelDraftStep[]>(
    () => defaultTelemetryFunnelDraftSteps(),
  );
  const [telemetryLastEvaluation, setTelemetryLastEvaluation] = useState<TelemetryEvaluationResult | null>(null);
  const [telemetryLastRecompute, setTelemetryLastRecompute] = useState<TelemetryRecomputeResult | null>(null);
  const [telemetryExportDataset, setTelemetryExportDataset] = useState<TelemetryExportDataset>("events");
  const [telemetryExportFormat, setTelemetryExportFormat] = useState<TelemetryExportFormat>("csv");
  const [telemetryExportPreviewBusy, setTelemetryExportPreviewBusy] = useState(false);
  const [telemetryExportPreview, setTelemetryExportPreview] = useState<TelemetryExportPreviewPayload | null>(null);
  const [telemetryIncidentRows, setTelemetryIncidentRows] = useState<TelemetryIncidentResponse[]>([]);
  const [telemetryIncidentHasMore, setTelemetryIncidentHasMore] = useState(false);
  const [telemetryIncidentNextCursor, setTelemetryIncidentNextCursor] = useState<string | null>(null);
  const [telemetryIncidentLoadMoreBusy, setTelemetryIncidentLoadMoreBusy] = useState(false);

  useEffect(() => {
    if (view !== "telemetry") return;
    const items = telemetryIncidents?.items ?? [];
    setTelemetryIncidentRows(items);
    setTelemetryIncidentHasMore(Boolean(telemetryIncidents?.pagination?.hasMore));
    setTelemetryIncidentNextCursor(telemetryIncidents?.pagination?.nextCursor ?? null);
  }, [telemetryIncidents?.items, telemetryIncidents?.pagination?.hasMore, telemetryIncidents?.pagination?.nextCursor, view]);

  const applyTelemetryIncidentAction = useCallback(
    async (incidentId: string, action: "ACK" | "RESOLVE") => {
      setTelemetryActionError(null);
      setTelemetryActionInfo(null);
      const busyKey = `${incidentId}:${action}`;
      setTelemetryActionBusyKey(busyKey);
      try {
        const res = await fetch(`${orgApiBase}/telemetry/incidents/${incidentId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const payload = await res.json().catch(() => null);
        const body = unwrapEnvelope(payload) as Record<string, unknown> | null;
        const ok = res.ok && body?.ok !== false;
        if (!ok) {
          const errorCode =
            (body?.error as string | undefined) ??
            (payload && typeof payload === "object" ? (payload as Record<string, unknown>).error : undefined) ??
            `HTTP_${res.status}`;
          throw new Error(String(errorCode));
        }
        setTelemetryActionInfo(action === "ACK" ? "Incidente reconhecido." : "Incidente resolvido.");
        await Promise.all([mutateTelemetryOverview(), mutateTelemetryIncidents()]);
      } catch (error) {
        setTelemetryActionError(formatAnalyticsError(error));
      } finally {
        setTelemetryActionBusyKey((current) => (current === busyKey ? null : current));
      }
    },
    [mutateTelemetryIncidents, mutateTelemetryOverview, orgApiBase],
  );

  const runTelemetryEvaluate = useCallback(async () => {
    setTelemetryActionError(null);
    setTelemetryActionInfo(null);
    setTelemetryEvaluateBusy(true);
    try {
      const res = await fetch(`${orgApiBase}/telemetry/evaluate`, {
        method: "POST",
      });
      const payload = await res.json().catch(() => null);
      const body = unwrapEnvelope(payload) as Record<string, unknown> | null;
      const result =
        (body?.result as TelemetryEvaluationResult | undefined) ??
        (payload && typeof payload === "object" ? ((payload as Record<string, unknown>).result as TelemetryEvaluationResult | undefined) : undefined);
      const ok = res.ok && body?.ok !== false;
      if (!ok || !result) {
        const errorCode =
          (body?.error as string | undefined) ??
          (payload && typeof payload === "object" ? (payload as Record<string, unknown>).error : undefined) ??
          `HTTP_${res.status}`;
        throw new Error(String(errorCode));
      }
      setTelemetryLastEvaluation(result);
      setTelemetryActionInfo("Avaliação de alertas concluída.");
      await Promise.all([mutateTelemetryOverview(), mutateTelemetryIncidents()]);
    } catch (error) {
      setTelemetryActionError(formatAnalyticsError(error));
    } finally {
      setTelemetryEvaluateBusy(false);
    }
  }, [mutateTelemetryIncidents, mutateTelemetryOverview, orgApiBase]);

  const runTelemetryRecompute = useCallback(async () => {
    setTelemetryActionError(null);
    setTelemetryActionInfo(null);
    setTelemetryRecomputeBusy(true);
    try {
      const params = new URLSearchParams();
      params.set("bucket", "HOUR");
      params.set("hours", String(telemetryHours));
      params.set("evaluate", "true");
      params.set("funnels", "true");

      const res = await fetch(`${orgApiBase}/telemetry/recompute?${params.toString()}`, {
        method: "POST",
      });
      const payload = await res.json().catch(() => null);
      const body = unwrapEnvelope(payload) as Record<string, unknown> | null;
      const result =
        (body as TelemetryRecomputeResult | null) ??
        (payload && typeof payload === "object"
          ? ((payload as Record<string, unknown>) as unknown as TelemetryRecomputeResult)
          : null);
      const ok = res.ok && body?.ok !== false;
      if (!ok || !result?.rollup) {
        const errorCode =
          (body?.error as string | undefined) ??
          (payload && typeof payload === "object"
            ? (payload as Record<string, unknown>).error
            : undefined) ??
          `HTTP_${res.status}`;
        throw new Error(String(errorCode));
      }

      setTelemetryLastRecompute(result);
      if (result.evaluation) setTelemetryLastEvaluation(result.evaluation);
      setTelemetryActionInfo("Recompute de telemetria executado com sucesso.");
      await Promise.all([
        mutateTelemetryOverview(),
        mutateTelemetryIncidents(),
        mutateTelemetryEvents(),
        mutateTelemetryFunnels(),
        mutateTelemetryFunnelResults(),
        mutateTelemetryCatalog(),
      ]);
    } catch (error) {
      setTelemetryActionError(formatAnalyticsError(error));
    } finally {
      setTelemetryRecomputeBusy(false);
    }
  }, [
    telemetryHours,
    mutateTelemetryIncidents,
    mutateTelemetryOverview,
    mutateTelemetryEvents,
    mutateTelemetryFunnels,
    mutateTelemetryFunnelResults,
    mutateTelemetryCatalog,
    orgApiBase,
  ]);

  const runTelemetryExport = useCallback(() => {
    setTelemetryActionError(null);
    setTelemetryActionInfo(null);
    setTelemetryExportPreview(null);

    const params = new URLSearchParams();
    params.set("dataset", telemetryExportDataset);
    params.set("format", telemetryExportFormat);
    params.set("take", "2500");

    if (telemetryExportDataset === "events") {
      params.set("hours", String(telemetryHours));
      if (telemetrySource) params.set("sourceType", telemetrySource);
      if (telemetrySeverity) params.set("severity", telemetrySeverity);
    } else if (telemetryExportDataset === "incidents") {
      params.set(
        "statuses",
        telemetryIncidentStatuses === "ALL"
          ? "ALL"
          : telemetryIncidentStatuses,
      );
      params.set("sort", telemetryIncidentSort);
      if (telemetryIncidentSeverity) params.set("severity", telemetryIncidentSeverity);
      if (telemetryIncidentQuery) params.set("q", telemetryIncidentQuery);
    } else if (telemetryExportDataset === "rules" || telemetryExportDataset === "funnels") {
      params.set("includeGlobal", "true");
      params.set("activeOnly", "false");
    } else if (telemetryExportDataset === "funnel_results") {
      params.set("bucketUnit", "HOUR");
    }

    window.open(`${orgApiBase}/telemetry/export?${params.toString()}`, "_blank", "noopener,noreferrer");
    setTelemetryActionInfo(telemetryExportFormat === "pdf" ? "Exportação PDF iniciada." : "Exportação CSV iniciada.");
  }, [
    orgApiBase,
    telemetryExportDataset,
    telemetryExportFormat,
    telemetryHours,
    telemetryIncidentQuery,
    telemetryIncidentSeverity,
    telemetryIncidentSort,
    telemetryIncidentStatuses,
    telemetrySeverity,
    telemetrySource,
  ]);

  const runTelemetryExportPreview = useCallback(async () => {
    setTelemetryActionError(null);
    setTelemetryActionInfo(null);
    setTelemetryExportPreviewBusy(true);
    try {
      const params = new URLSearchParams();
      params.set("dataset", telemetryExportDataset);
      params.set("take", "300");
      params.set("sample", "20");

      if (telemetryExportDataset === "events") {
        params.set("hours", String(telemetryHours));
        if (telemetrySource) params.set("sourceType", telemetrySource);
        if (telemetrySeverity) params.set("severity", telemetrySeverity);
      } else if (telemetryExportDataset === "incidents") {
        params.set(
          "statuses",
          telemetryIncidentStatuses === "ALL"
            ? "ALL"
            : telemetryIncidentStatuses,
        );
        params.set("sort", telemetryIncidentSort);
        if (telemetryIncidentSeverity) params.set("severity", telemetryIncidentSeverity);
        if (telemetryIncidentQuery) params.set("q", telemetryIncidentQuery);
      } else if (telemetryExportDataset === "rules" || telemetryExportDataset === "funnels") {
        params.set("includeGlobal", "true");
        params.set("activeOnly", "false");
      } else if (telemetryExportDataset === "funnel_results") {
        params.set("bucketUnit", "HOUR");
      }

      const payload = await apiFetcher<{ preview: TelemetryExportPreviewPayload }>(
        `${orgApiBase}/telemetry/export/preview?${params.toString()}`,
      );
      setTelemetryExportPreview(payload.preview);
      setTelemetryActionInfo("Pré-visualização de exportação carregada.");
    } catch (error) {
      setTelemetryActionError(formatAnalyticsError(error));
      setTelemetryExportPreview(null);
    } finally {
      setTelemetryExportPreviewBusy(false);
    }
  }, [
    orgApiBase,
    telemetryExportDataset,
    telemetryHours,
    telemetryIncidentQuery,
    telemetryIncidentSeverity,
    telemetryIncidentSort,
    telemetryIncidentStatuses,
    telemetrySeverity,
    telemetrySource,
  ]);

  const loadMoreTelemetryIncidents = useCallback(async () => {
    if (!telemetryIncidentHasMore || !telemetryIncidentNextCursor) return;
    setTelemetryActionError(null);
    setTelemetryIncidentLoadMoreBusy(true);
    try {
      const params = new URLSearchParams();
      params.set("take", "120");
      params.set("cursor", telemetryIncidentNextCursor);
      params.set("sort", telemetryIncidentSort);
      if (telemetryIncidentStatuses !== "ALL") params.set("statuses", telemetryIncidentStatuses);
      if (telemetryIncidentSeverity) params.set("severities", telemetryIncidentSeverity);
      if (telemetryIncidentQuery) params.set("q", telemetryIncidentQuery);
      const payload = await apiFetcher<TelemetryIncidentsResponse>(
        `${orgApiBase}/telemetry/incidents?${params.toString()}`,
      );
      setTelemetryIncidentRows((prev) => [...prev, ...(payload.items ?? [])]);
      setTelemetryIncidentHasMore(Boolean(payload.pagination?.hasMore));
      setTelemetryIncidentNextCursor(payload.pagination?.nextCursor ?? null);
    } catch (error) {
      setTelemetryActionError(formatAnalyticsError(error));
    } finally {
      setTelemetryIncidentLoadMoreBusy(false);
    }
  }, [
    orgApiBase,
    telemetryIncidentHasMore,
    telemetryIncidentNextCursor,
    telemetryIncidentQuery,
    telemetryIncidentSeverity,
    telemetryIncidentSort,
    telemetryIncidentStatuses,
  ]);

  const resetTelemetryFunnelDraft = useCallback(() => {
    setTelemetryFunnelEditingId(null);
    setTelemetryFunnelName("");
    setTelemetryFunnelDescription("");
    setTelemetryFunnelIsActive(true);
    setTelemetryFunnelSteps(defaultTelemetryFunnelDraftSteps());
  }, []);

  const startEditTelemetryFunnel = useCallback((funnel: TelemetryFunnelDefinitionResponse) => {
    setTelemetryFunnelEditingId(funnel.id);
    setTelemetryFunnelName(funnel.name);
    setTelemetryFunnelDescription(funnel.description ?? "");
    setTelemetryFunnelIsActive(Boolean(funnel.isActive));
    setTelemetryFunnelSteps(
      funnel.steps.map((step) => ({
        key: step.key,
        eventName: step.eventName,
        withinMinutes:
          typeof step.withinMinutes === "number" && step.withinMinutes > 0
            ? String(step.withinMinutes)
            : "",
      })),
    );
  }, []);

  const updateTelemetryFunnelStep = useCallback(
    (index: number, patch: Partial<TelemetryFunnelDraftStep>) => {
      setTelemetryFunnelSteps((prev) =>
        prev.map((step, currentIndex) =>
          currentIndex === index ? { ...step, ...patch } : step,
        ),
      );
    },
    [],
  );

  const addTelemetryFunnelStep = useCallback(() => {
    setTelemetryFunnelSteps((prev) => [
      ...prev,
      { key: `step${prev.length + 1}`, eventName: "", withinMinutes: "" },
    ]);
  }, []);

  const removeTelemetryFunnelStep = useCallback((index: number) => {
    setTelemetryFunnelSteps((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  }, []);

  const saveTelemetryFunnel = useCallback(async () => {
    setTelemetryActionError(null);
    setTelemetryActionInfo(null);

    const name = telemetryFunnelName.trim();
    if (name.length < 2) {
      setTelemetryActionError("Nome do funil inválido (mínimo 2 caracteres).");
      return;
    }

    if (telemetryFunnelSteps.length < 2) {
      setTelemetryActionError("Define pelo menos 2 passos no funil.");
      return;
    }

    const keys = new Set<string>();
    const catalogEventNames = new Set(
      (telemetryCatalog?.items ?? []).map((entry) => entry.eventName),
    );
    const normalizedSteps: Array<{
      key: string;
      eventName: string;
      required: boolean;
      withinMinutes: number | null;
    }> = [];

    for (const step of telemetryFunnelSteps) {
      const key = step.key.trim().toLowerCase();
      if (!TELEMETRY_FUNNEL_STEP_KEY_PATTERN.test(key)) {
        setTelemetryActionError(
          `Chave de passo inválida (${step.key || "vazio"}). Usa minúsculas, números e . _ : -`,
        );
        return;
      }
      if (keys.has(key)) {
        setTelemetryActionError(`Chave de passo duplicada: ${key}`);
        return;
      }
      keys.add(key);

      const eventName = step.eventName.trim();
      if (!eventName) {
        setTelemetryActionError(`Evento em falta no passo ${key}.`);
        return;
      }
      if (catalogEventNames.size > 0 && !catalogEventNames.has(eventName)) {
        setTelemetryActionError(
          `Evento fora do catálogo no passo ${key}: ${eventName}. Usa um evento canónico ORYA.`,
        );
        return;
      }

      const withinMinutes = parseTelemetryFunnelWithinMinutes(step.withinMinutes);
      if (step.withinMinutes.trim() && withinMinutes === null) {
        setTelemetryActionError(
          `withinMinutes inválido no passo ${key}. Usa inteiro entre 1 e ${7 * 24 * 60}.`,
        );
        return;
      }

      normalizedSteps.push({
        key,
        eventName,
        required: true,
        withinMinutes,
      });
    }

    setTelemetryFunnelSaveBusy(true);
    try {
      const editingId = telemetryFunnelEditingId;
      const url = editingId
        ? `${orgApiBase}/telemetry/funnels/${editingId}`
        : `${orgApiBase}/telemetry/funnels`;
      const method = editingId ? "PATCH" : "POST";

      const payloadBody = editingId
        ? {
            name,
            description: telemetryFunnelDescription.trim() || null,
            isActive: telemetryFunnelIsActive,
            steps: normalizedSteps,
          }
        : {
            name,
            description: telemetryFunnelDescription.trim() || null,
            isActive: telemetryFunnelIsActive,
            steps: normalizedSteps,
          };

      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payloadBody),
      });

      const payload = await res.json().catch(() => null);
      const body = unwrapEnvelope(payload) as Record<string, unknown> | null;
      const ok = res.ok && body?.ok !== false;
      if (!ok) {
        const errorCode =
          (body?.error as string | undefined) ??
          (payload && typeof payload === "object"
            ? (payload as Record<string, unknown>).error
            : undefined) ??
          `HTTP_${res.status}`;
        throw new Error(String(errorCode));
      }

      setTelemetryActionInfo(editingId ? "Funil atualizado." : "Funil criado.");
      resetTelemetryFunnelDraft();
      await Promise.all([mutateTelemetryFunnels(), mutateTelemetryFunnelResults()]);
    } catch (error) {
      setTelemetryActionError(formatAnalyticsError(error));
    } finally {
      setTelemetryFunnelSaveBusy(false);
    }
  }, [
    telemetryFunnelName,
    telemetryFunnelSteps,
    telemetryFunnelEditingId,
    telemetryFunnelDescription,
    telemetryFunnelIsActive,
    telemetryCatalog,
    orgApiBase,
    resetTelemetryFunnelDraft,
    mutateTelemetryFunnels,
    mutateTelemetryFunnelResults,
  ]);

  const toggleTelemetryFunnelActive = useCallback(
    async (funnel: TelemetryFunnelDefinitionResponse) => {
      setTelemetryActionError(null);
      setTelemetryActionInfo(null);
      const busyKey = `funnel:${funnel.id}`;
      setTelemetryFunnelBusyKey(busyKey);
      try {
        const res = await fetch(`${orgApiBase}/telemetry/funnels/${funnel.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ isActive: !funnel.isActive }),
        });
        const payload = await res.json().catch(() => null);
        const body = unwrapEnvelope(payload) as Record<string, unknown> | null;
        const ok = res.ok && body?.ok !== false;
        if (!ok) {
          const errorCode =
            (body?.error as string | undefined) ??
            (payload && typeof payload === "object"
              ? (payload as Record<string, unknown>).error
              : undefined) ??
            `HTTP_${res.status}`;
          throw new Error(String(errorCode));
        }

        setTelemetryActionInfo(funnel.isActive ? "Funil desativado." : "Funil ativado.");
        await Promise.all([mutateTelemetryFunnels(), mutateTelemetryFunnelResults()]);
      } catch (error) {
        setTelemetryActionError(formatAnalyticsError(error));
      } finally {
        setTelemetryFunnelBusyKey((current) => (current === busyKey ? null : current));
      }
    },
    [mutateTelemetryFunnelResults, mutateTelemetryFunnels, orgApiBase],
  );

  const refreshCurrentView = useCallback(async () => {
    if (view === "overview") await Promise.all([mutateOverview(), mutateSeries()]);
    if (view === "conversion") await mutateConversion();
    if (view === "cohorts") await mutateCohorts();
    if (view === "buyers") await Promise.all([mutateEvents(), mutateBuyers()]);
    if (view === "time-series") await mutateSeries();
    if (view === "dimensions") await mutateDimensions();
    if (view === "telemetry") {
      await Promise.all([
        mutateTelemetryOverview(),
        mutateTelemetryIncidents(),
        mutateTelemetryEvents(),
        mutateTelemetryFunnels(),
        mutateTelemetryFunnelResults(),
        mutateTelemetryCatalog(),
      ]);
    }
  }, [
    mutateBuyers,
    mutateCohorts,
    mutateConversion,
    mutateDimensions,
    mutateEvents,
    mutateOverview,
    mutateSeries,
    mutateTelemetryFunnelResults,
    mutateTelemetryFunnels,
    mutateTelemetryIncidents,
    mutateTelemetryEvents,
    mutateTelemetryOverview,
    mutateTelemetryCatalog,
    view,
  ]);

  const headerByView = useMemo<Record<AnalyticsAllowedView, string>>(
    () => ({
      overview: "Resumo BI financeiro",
      conversion: "Conversão de checkout",
      cohorts: "Coortes financeiras",
      buyers: "Compradores",
      "time-series": "Séries temporais",
      dimensions: "Dimensões financeiras",
      telemetry: "Telemetria operacional",
    }),
    [],
  );

  const seriesChartData = useMemo(
    () =>
      (series?.points ?? []).map((point) => ({
        date: compactDate(point.date),
        gross: (point.grossCents ?? 0) / 100,
        fees: (point.feesCents ?? 0) / 100,
        net: (point.netCents ?? 0) / 100,
      })),
    [series?.points],
  );

  const conversionChartData = useMemo(
    () =>
      (conversion?.breakdown ?? []).map((item) => ({
        sourceType: item.sourceType,
        started: item.startedCount,
        succeeded: item.succeededCount,
      })),
    [conversion?.breakdown],
  );

  const dimensionsMetricOptions = useMemo(() => {
    const options = new Set<MetricOption>();
    for (const metrics of Object.values(dimensions?.items ?? {})) {
      const keys = Object.keys(metrics) as MetricOption[];
      keys.forEach((key) => options.add(key));
    }
    if (options.size === 0) {
      options.add("GROSS");
      options.add("PLATFORM_FEES");
      options.add("PROCESSOR_FEES");
      options.add("NET_TO_ORG");
    }
    return Array.from(options);
  }, [dimensions?.items]);

  const effectiveMetricKey = dimensionsMetricOptions.includes(metricKey) ? metricKey : dimensionsMetricOptions[0];

  const dimensionsChartData = useMemo(() => {
    return Object.entries(dimensions?.items ?? {})
      .map(([dimensionValue, metrics]) => ({
        dimensionValue,
        value: (metrics[effectiveMetricKey] ?? 0) / 100,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [dimensions?.items, effectiveMetricKey]);

  const buyersStatusChartData = useMemo(() => {
    const map = new Map<string, { count: number; amount: number }>();
    for (const item of buyers?.items ?? []) {
      const current = map.get(item.status) ?? { count: 0, amount: 0 };
      current.count += 1;
      current.amount += item.totalPaidCents;
      map.set(item.status, current);
    }
    return Array.from(map.entries()).map(([status, values]) => ({
      status,
      count: values.count,
      amount: values.amount / 100,
    }));
  }, [buyers?.items]);

  const cohortsHeatmapRows = useMemo(() => (cohorts?.cohorts ?? []).slice(-12), [cohorts?.cohorts]);
  const visibleCohortOffsets = useMemo(
    () => Array.from({ length: Math.min(8, Math.max(1, months)) }, (_, index) => index),
    [months],
  );
  const buyersSortedByPaid = useMemo(
    () => [...(buyers?.items ?? [])].sort((a, b) => (b.totalPaidCents ?? 0) - (a.totalPaidCents ?? 0)),
    [buyers?.items],
  );
  const buyersTotalPaidCents = useMemo(
    () => buyersSortedByPaid.reduce((sum, item) => sum + (item.totalPaidCents ?? 0), 0),
    [buyersSortedByPaid],
  );
  const telemetryTimelineData = useMemo(
    () =>
      (telemetryOverview?.timeline ?? []).map((point) => ({
        date: compactDate(point.bucketStart),
        total: point.total,
        errors: point.errors,
      })),
    [telemetryOverview?.timeline],
  );
  const telemetryTopEvents = useMemo(
    () => (telemetryOverview?.topEvents ?? []).slice(0, 10),
    [telemetryOverview?.topEvents],
  );
  const telemetrySourceBreakdown = useMemo(
    () => telemetryOverview?.sourceBreakdown ?? [],
    [telemetryOverview?.sourceBreakdown],
  );
  const telemetryIncidentItems = useMemo(
    () => telemetryIncidentRows,
    [telemetryIncidentRows],
  );
  const telemetryOpenIncidents = useMemo(
    () => telemetryIncidentItems.filter((item) => item.status !== "RESOLVED"),
    [telemetryIncidentItems],
  );
  const telemetryIncidentKpis = telemetryOverview?.incidentKpis ?? null;
  const telemetryActiveRules = useMemo(
    () => (telemetryOverview?.rules ?? []).filter((item) => item.isActive),
    [telemetryOverview?.rules],
  );
  const telemetryFunnelsById = useMemo(() => {
    const map = new Map<string, TelemetryFunnelDefinitionResponse>();
    for (const item of telemetryFunnels?.items ?? []) {
      map.set(item.id, item);
    }
    return map;
  }, [telemetryFunnels?.items]);
  const telemetryActiveFunnels = useMemo(
    () => (telemetryFunnels?.items ?? []).filter((item) => item.isActive),
    [telemetryFunnels?.items],
  );
  const telemetryOwnFunnels = useMemo(
    () => (telemetryFunnels?.items ?? []).filter((item) => item.organizationId === orgId),
    [orgId, telemetryFunnels?.items],
  );
  const telemetryCatalogEventNames = useMemo(
    () => new Set((telemetryCatalog?.items ?? []).map((item) => item.eventName)),
    [telemetryCatalog?.items],
  );
  const telemetryDraftUnknownEvents = useMemo(() => {
    const unknown = new Set<string>();
    for (const step of telemetryFunnelSteps) {
      const eventName = step.eventName.trim();
      if (!eventName) continue;
      if (!telemetryCatalogEventNames.has(eventName)) {
        unknown.add(eventName);
      }
    }
    return Array.from(unknown);
  }, [telemetryCatalogEventNames, telemetryFunnelSteps]);
  const telemetryFunnelRows = useMemo(
    () =>
      (telemetryFunnelResults?.items ?? []).slice(0, 40).map((item) => ({
        ...item,
        funnelName: telemetryFunnelsById.get(item.funnelId)?.name ?? item.funnelId,
      })),
    [telemetryFunnelResults?.items, telemetryFunnelsById],
  );
  const activeFilters = useMemo(() => {
    const chips = [
      { id: "range", label: `Período: ${range}` },
      { id: "scope", label: `Âmbito: ${prettyScope(scope)}` },
    ];
    if (view === "cohorts") chips.push({ id: "months", label: `Janela: ${months}m` });
    if (view === "dimensions") {
      chips.push({ id: "dimension", label: `Dimensão: ${prettyDimensionKey(dimensionKey)}` });
      chips.push({ id: "metric", label: `Métrica: ${prettyMetricKey(effectiveMetricKey)}` });
    }
    if (view === "buyers" && effectiveEventId) chips.push({ id: "event", label: `Evento #${effectiveEventId}` });
    if (view === "telemetry") {
      chips.push({ id: "telemetry-hours", label: `Telemetria: ${telemetryHours}h` });
      if (telemetrySource) chips.push({ id: "telemetry-source", label: `Source: ${telemetrySource}` });
      if (telemetrySeverity) chips.push({ id: "telemetry-severity", label: `Sev: ${telemetrySeverity}` });
      if (telemetryIncidentStatuses !== "OPEN,ACKNOWLEDGED") {
        chips.push({ id: "telemetry-incident-statuses", label: `Incidentes: ${telemetryIncidentStatuses}` });
      }
      if (telemetryIncidentSeverity) {
        chips.push({ id: "telemetry-incident-severity", label: `Sev incidente: ${telemetryIncidentSeverity}` });
      }
      if (telemetryIncidentQuery) {
        chips.push({ id: "telemetry-incident-query", label: `Pesquisa incidente: ${telemetryIncidentQuery}` });
      }
      if (telemetryIncidentSort !== "TRIGGERED_DESC") {
        chips.push({ id: "telemetry-incident-sort", label: "Ordenação incidente: impacto SLA" });
      }
    }
    return chips;
  }, [
    dimensionKey,
    effectiveEventId,
    effectiveMetricKey,
    months,
    range,
    scope,
    telemetryHours,
    telemetryIncidentQuery,
    telemetryIncidentSeverity,
    telemetryIncidentSort,
    telemetryIncidentStatuses,
    telemetrySeverity,
    telemetrySource,
    view,
  ]);

  const resetGlobalFilters = useCallback(() => {
    updateQuery({
      range: DEFAULT_RANGE,
      scope: DEFAULT_SCOPE,
      months: DEFAULT_COHORT_MONTHS,
      dimensionKey: DEFAULT_DIMENSION,
      metricKey: null,
      eventId: null,
      telemetryHours: 24,
      telemetrySource: null,
      telemetrySeverity: null,
      telemetryIncidentStatuses: null,
      telemetryIncidentSeverity: null,
      telemetryIncidentQuery: null,
      telemetryIncidentSort: null,
    });
  }, [updateQuery]);

  return (
    <section className="space-y-5 text-white sm:space-y-6">
      <div className="rounded-3xl border border-white/16 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(20,20,20,0.92))] px-4 py-4 sm:px-6 sm:py-5 backdrop-blur-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{headerByView[view]}</h1>
            <p className="text-sm text-white/70">Analytics focado em BI/performance monetária, sem CRM.</p>
          </div>
          <div className="rounded-xl border border-emerald-300/45 bg-emerald-300/12 px-3 py-2 text-xs text-emerald-100">
            Domínio de dados: <span className="font-semibold">BI financeiro</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/12 bg-[#141414]/88 p-4 backdrop-blur-xl">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <FilterSelect
            label="Período"
            value={range}
            onChange={(value) => updateQuery({ range: value })}
            options={[
              { label: "7 dias", value: "7d" },
              { label: "30 dias", value: "30d" },
              { label: "90 dias", value: "90d" },
              { label: "Sem limite", value: "all" },
            ]}
          />
          <FilterSelect
            label="Âmbito"
            value={scope}
            onChange={(value) => updateQuery({ scope: value })}
            options={[
              { label: "Tudo", value: "all" },
              { label: "Eventos", value: "eventos" },
              { label: "Padel", value: "padel" },
            ]}
          />
          {view === "cohorts" && (
            <FilterSelect
              label="Janela coortes"
              value={String(months)}
              onChange={(value) => updateQuery({ months: Number(value) })}
              options={[
                { label: "6 meses", value: "6" },
                { label: "12 meses", value: "12" },
                { label: "18 meses", value: "18" },
                { label: "24 meses", value: "24" },
              ]}
            />
          )}
          {view === "dimensions" && (
            <FilterSelect
              label="Dimensão"
              value={dimensionKey}
              onChange={(value) => updateQuery({ dimensionKey: value })}
              options={[
                { label: "Ferramenta", value: "MODULE" },
                { label: "Tipo de origem", value: "SOURCE_TYPE" },
                { label: "Fornecedor", value: "PAYMENT_PROVIDER" },
                { label: "Moeda", value: "CURRENCY" },
              ]}
            />
          )}
          {view === "dimensions" && (
            <FilterSelect
              label="Métrica"
              value={effectiveMetricKey}
              onChange={(value) => updateQuery({ metricKey: value })}
              options={dimensionsMetricOptions.map((option) => ({ label: prettyMetricKey(option), value: option }))}
            />
          )}
          {view === "buyers" && (
            <FilterSelect
              label="Evento"
              value={effectiveEventId ? String(effectiveEventId) : ""}
              onChange={(value) => updateQuery({ eventId: Number(value) })}
              disabled={eventsLoading || Boolean(eventsError) || (eventsData?.items?.length ?? 0) === 0}
              options={(eventsData?.items ?? []).map((item) => ({
                label: `${item.title} · ${compactDate(item.startsAt)}`,
                value: String(item.id),
              }))}
              placeholder={eventsLoading ? "A carregar eventos..." : "Sem eventos"}
            />
          )}
          {view === "telemetry" && (
            <FilterSelect
              label="Janela telemetria"
              value={String(telemetryHours)}
              onChange={(value) => updateQuery({ telemetryHours: Number(value) })}
              options={[
                { label: "6 horas", value: "6" },
                { label: "24 horas", value: "24" },
                { label: "72 horas", value: "72" },
                { label: "7 dias", value: "168" },
              ]}
            />
          )}
          {view === "telemetry" && (
            <FilterSelect
              label="Source"
              value={telemetrySource}
              onChange={(value) => updateQuery({ telemetrySource: value || null })}
              options={[
                { label: "Todos", value: "" },
                { label: "WEB", value: "WEB" },
                { label: "MOBILE", value: "MOBILE" },
                { label: "API", value: "API" },
                { label: "WORKER", value: "WORKER" },
                { label: "CRON", value: "CRON" },
                { label: "INTERNAL", value: "INTERNAL" },
              ]}
            />
          )}
          {view === "telemetry" && (
            <FilterSelect
              label="Severidade"
              value={telemetrySeverity}
              onChange={(value) => updateQuery({ telemetrySeverity: value || null })}
              options={[
                { label: "Todas", value: "" },
                { label: "INFO", value: "INFO" },
                { label: "WARN", value: "WARN" },
                { label: "ERROR", value: "ERROR" },
                { label: "CRITICAL", value: "CRITICAL" },
              ]}
            />
          )}
          {view === "telemetry" && (
            <FilterSelect
              label="Estados incidente"
              value={telemetryIncidentStatuses}
              onChange={(value) =>
                updateQuery({
                  telemetryIncidentStatuses:
                    value === "OPEN,ACKNOWLEDGED" ? null : value,
                })
              }
              options={[
                { label: "Abertos + reconhecidos", value: "OPEN,ACKNOWLEDGED" },
                { label: "Abertos", value: "OPEN" },
                { label: "Reconhecidos", value: "ACKNOWLEDGED" },
                { label: "Resolvidos", value: "RESOLVED" },
                { label: "Todos", value: "ALL" },
              ]}
            />
          )}
          {view === "telemetry" && (
            <FilterSelect
              label="Sev incidente"
              value={telemetryIncidentSeverity}
              onChange={(value) => updateQuery({ telemetryIncidentSeverity: value || null })}
              options={[
                { label: "Todas", value: "" },
                { label: "INFO", value: "INFO" },
                { label: "WARN", value: "WARN" },
                { label: "ERROR", value: "ERROR" },
                { label: "CRITICAL", value: "CRITICAL" },
              ]}
            />
          )}
          {view === "telemetry" && (
            <FilterSelect
              label="Ordenação incidente"
              value={telemetryIncidentSort}
              onChange={(value) =>
                updateQuery({
                  telemetryIncidentSort:
                    value === "TRIGGERED_DESC" ? null : value,
                })
              }
              options={[
                { label: "Mais recentes", value: "TRIGGERED_DESC" },
                { label: "Impacto SLA", value: "SLA_IMPACT_DESC" },
              ]}
            />
          )}
          {view === "telemetry" && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/65">Pesquisa incidente</span>
              <input
                key={`telemetry-incident-query-${telemetryIncidentQuery}`}
                defaultValue={telemetryIncidentQuery}
                className="h-10 rounded-xl border border-white/20 bg-[#141414] px-3 text-sm text-white outline-none transition focus:border-cyan-300/80"
                placeholder="título, regra, dimensão..."
                onBlur={(event) => updateQuery({ telemetryIncidentQuery: event.target.value.trim() || null })}
              />
            </label>
          )}
          <div className="flex items-end">
            <button
              type="button"
              className="h-10 w-full rounded-xl border border-[#22D3EE]/45 bg-[#22D3EE]/14 px-3 text-sm font-semibold text-white transition hover:border-[#22D3EE]/70 hover:bg-[#22D3EE]/22"
              onClick={() => void refreshCurrentView()}
            >
              Atualizar dados
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {activeFilters.map((filter) => (
            <span key={filter.id} className="rounded-md border border-white/24 bg-white/[0.08] px-2 py-1 text-xs text-white/85">
              {filter.label}
            </span>
          ))}
          <button
            type="button"
            className="rounded-md border border-[#22D3EE]/40 bg-transparent px-2 py-1 text-xs font-semibold text-white transition hover:bg-[#22D3EE]/14"
            onClick={resetGlobalFilters}
          >
            Repor filtros
          </button>
          {view === "conversion" && scope !== "all" && (
            <span className="rounded-md border border-amber-300/40 bg-amber-300/10 px-2 py-1 text-amber-200">
              A conversão ainda não está segmentada por âmbito.
            </span>
          )}
          {view === "dimensions" && scope !== "all" && (
            <span className="rounded-md border border-cyan-300/40 bg-cyan-300/10 px-2 py-1 text-cyan-200">
              O âmbito pode não refletir todas as dimensões nesta versão.
            </span>
          )}
        </div>
      </div>

      {view === "overview" && (
        <ViewSection
          loading={overviewLoading || seriesLoading}
          error={overviewError ?? seriesError}
          onRetry={() => void Promise.all([mutateOverview(), mutateSeries()])}
          empty={!overview && !series}
          emptyLabel="Sem dados para o período selecionado."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label={`Bruto (${range})`}
              value={toCurrency(overview?.grossCents, overview?.currency ?? "EUR")}
            />
            <MetricCard
              label={`Taxas (${range})`}
              value={toCurrency(overview?.feesCents, overview?.currency ?? "EUR")}
            />
            <MetricCard
              label={`Líquido (${range})`}
              value={toCurrency(overview?.netRevenueCents, overview?.currency ?? "EUR")}
            />
            <MetricCard label="Eventos com vendas" value={String(overview?.eventsWithSalesCount ?? 0)} />
            <MetricCard label="Bilhetes totais" value={String(overview?.totalTickets ?? 0)} />
          </div>
          <Panel title="Tendência financeira" subtitle="Bruto, taxas e líquido no tempo">
            {seriesChartData.length > 0 ? (
              <ChartWrap>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={seriesChartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gGross" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#60A5FA" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gNet" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22C55E" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#22C55E" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff18" />
                    <XAxis dataKey="date" tick={RECHARTS_AXIS_TICK_STYLE} tickLine={false} />
                    <YAxis tick={RECHARTS_AXIS_TICK_STYLE} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={RECHARTS_TOOLTIP_CONTENT_STYLE}
                      itemStyle={RECHARTS_TOOLTIP_ITEM_STYLE}
                      labelStyle={RECHARTS_TOOLTIP_LABEL_STYLE}
                      cursor={RECHARTS_TOOLTIP_CURSOR_STYLE}
                      formatter={(value, key) => [toEuroChartLabel(value), String(key ?? "")]}
                    />
                    <Legend formatter={formatRechartsLegendLabel} wrapperStyle={RECHARTS_LEGEND_WRAPPER_STYLE} />
                    <Area type="monotone" dataKey="gross" stroke="#60A5FA" fill="url(#gGross)" name="Bruto" strokeWidth={2} />
                    <Area type="monotone" dataKey="fees" stroke="#F59E0B" fillOpacity={0.06} fill="#F59E0B" name="Taxas" strokeWidth={2} />
                    <Area type="monotone" dataKey="net" stroke="#22C55E" fill="url(#gNet)" name="Líquido" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartWrap>
            ) : (
              <EmptyState label="Sem série temporal disponível para este período." />
            )}
          </Panel>
        </ViewSection>
      )}

      {view === "conversion" && (
        <ViewSection
          loading={conversionLoading}
          error={conversionError}
          onRetry={() => void mutateConversion()}
          empty={!conversion}
          emptyLabel="Sem dados de conversão para o período selecionado."
        >
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard label="Checkouts iniciados" value={String(conversion?.startedCount ?? 0)} />
            <MetricCard label="Pagamentos concluídos" value={String(conversion?.succeededCount ?? 0)} />
            <MetricCard label="Taxa de conversão" value={toPctFromBps(conversion?.conversionRateBps)} />
          </div>
          <Panel title="Funil por tipo de origem" subtitle="Iniciados vs concluídos">
            {conversionChartData.length > 0 ? (
              <ChartWrap>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={conversionChartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff18" />
                    <XAxis dataKey="sourceType" tick={RECHARTS_AXIS_TICK_STYLE} tickLine={false} />
                    <YAxis tick={RECHARTS_AXIS_TICK_STYLE} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={RECHARTS_TOOLTIP_CONTENT_STYLE}
                      itemStyle={RECHARTS_TOOLTIP_ITEM_STYLE}
                      labelStyle={RECHARTS_TOOLTIP_LABEL_STYLE}
                      cursor={RECHARTS_TOOLTIP_CURSOR_STYLE}
                    />
                    <Legend formatter={formatRechartsLegendLabel} wrapperStyle={RECHARTS_LEGEND_WRAPPER_STYLE} />
                    <Bar dataKey="started" name="Iniciados" radius={[6, 6, 0, 0]} fill="#64748B" />
                    <Bar dataKey="succeeded" name="Concluídos" radius={[6, 6, 0, 0]} fill="#22C55E" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartWrap>
            ) : (
              <EmptyState label="Sem desagregação de conversão." />
            )}
          </Panel>
        </ViewSection>
      )}

      {view === "cohorts" && (
        <ViewSection
          loading={cohortsLoading}
          error={cohortsError}
          onRetry={() => void mutateCohorts()}
          empty={!cohorts || cohorts.cohorts.length === 0}
          emptyLabel="Sem coortes financeiras para mostrar."
        >
          <Panel title="Heatmap de retenção" subtitle={`Janela M+0..M+${Math.max(0, months - 1)}`}>
            <div className="space-y-2 overflow-auto">
              <p className="text-[11px] text-white/55">
                Deslize horizontalmente no mobile para ver todos os meses visíveis.
              </p>
              <div
                className="grid min-w-[760px] gap-1 text-[11px] uppercase tracking-wide text-white/60"
                style={{ gridTemplateColumns: `140px repeat(${visibleCohortOffsets.length}, minmax(86px, 1fr))` }}
              >
                <div>Coorte</div>
                {visibleCohortOffsets.map((offset) => (
                  <div key={`cohort-header-${offset}`}>{`M+${offset}`}</div>
                ))}
              </div>
              {cohortsHeatmapRows.map((cohort) => (
                <div
                  key={cohort.cohortMonth}
                  className="grid min-w-[760px] gap-1 text-xs"
                  style={{ gridTemplateColumns: `140px repeat(${visibleCohortOffsets.length}, minmax(86px, 1fr))` }}
                >
                  <div className="rounded-md border border-white/10 bg-black/35 px-2 py-2 text-white">
                    {cohort.cohortMonth}
                    <div className="text-[11px] text-white/65">{cohort.buyers} compradores</div>
                  </div>
                  {visibleCohortOffsets.map((offset) => {
                    const row = cohort.retention[offset];
                    if (!row) {
                      return (
                        <div key={`${cohort.cohortMonth}-${offset}`} className="rounded-md border border-white/10 bg-black/20 px-2 py-2" />
                      );
                    }
                    const rate = (row.retentionRateBps ?? 0) / 10000;
                    const bg = `rgba(34,197,94,${Math.max(0.08, Math.min(0.8, rate))})`;
                    return (
                      <div key={`${cohort.cohortMonth}-${row.monthOffset}`} className="rounded-md border border-white/10 px-2 py-2" style={{ background: bg }}>
                        <div className="font-semibold text-white">{toPctFromBps(row.retentionRateBps)}</div>
                        <div className="text-[11px] text-white/75">{row.retainedBuyers} compradores</div>
                        <div className="text-[11px] text-white/75">{toCurrency(row.revenueCents)}</div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </Panel>
        </ViewSection>
      )}

      {view === "buyers" && (
        <ViewSection
          loading={buyersLoading || eventsLoading}
          error={buyersError ?? eventsError}
          onRetry={() => void Promise.all([mutateEvents(), mutateBuyers()])}
          empty={!effectiveEventId || !buyers || buyers.items.length === 0}
          emptyLabel="Sem compradores para o evento selecionado."
        >
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard label="Compradores" value={String(buyersSortedByPaid.length)} />
            <MetricCard label="Total pago" value={toCurrency(buyersTotalPaidCents)} />
            <MetricCard label="Estados ativos" value={String(buyersStatusChartData.length)} />
          </div>
          <div className="grid gap-3 lg:grid-cols-[340px_1fr]">
            <Panel title="Distribuição de estados" subtitle={`Evento #${effectiveEventId ?? "—"}`}>
              {buyersStatusChartData.length > 0 ? (
                <ChartWrap className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={buyersStatusChartData}
                        dataKey="count"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        outerRadius={86}
                        label={renderReadablePiePercentLabel}
                        labelLine={{ stroke: "rgba(226, 232, 240, 0.4)", strokeWidth: 1 }}
                      >
                        {buyersStatusChartData.map((entry, index) => (
                          <Cell key={`${entry.status}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={RECHARTS_TOOLTIP_CONTENT_STYLE}
                        itemStyle={RECHARTS_TOOLTIP_ITEM_STYLE}
                        labelStyle={RECHARTS_TOOLTIP_LABEL_STYLE}
                        formatter={(value, key, item) => {
                          const count = Number(value ?? 0);
                          const payload = (item as { payload?: { amount?: number } } | undefined)?.payload;
                          const amountCents = Number(payload?.amount ?? 0) * 100;
                          return [`${count} compras · ${toCurrency(amountCents)}`, String(key ?? "estado")];
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartWrap>
              ) : (
                <EmptyState label="Sem distribuição para mostrar." />
              )}
            </Panel>
            <Panel title="Tabela de compradores" subtitle="Ordenada por valor pago">
              <div className="space-y-2 md:hidden">
                {buyersSortedByPaid.map((item) => (
                  <div key={`mobile-${item.id}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="text-sm font-semibold text-white">{item.buyerName}</div>
                    <div className="text-xs text-white/70">{item.buyerEmail}</div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="rounded-md border border-white/15 bg-white/[0.08] px-2 py-1 text-white/85">{item.status}</span>
                      <span className="font-semibold text-emerald-200">{toCurrency(item.totalPaidCents)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden overflow-auto rounded-xl border border-white/10 md:block">
                <table className="min-w-full text-sm">
                  <thead className="bg-white/5 text-left text-[11px] uppercase tracking-wide text-white/60">
                    <tr>
                      <th className="px-3 py-2">Comprador</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2 text-right">Pago</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {buyersSortedByPaid.map((item) => (
                      <tr key={item.id} className="bg-black/10">
                        <td className="px-3 py-2">{item.buyerName}</td>
                        <td className="px-3 py-2">{item.buyerEmail}</td>
                        <td className="px-3 py-2">{item.status}</td>
                        <td className="px-3 py-2 text-right">{toCurrency(item.totalPaidCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </ViewSection>
      )}

      {view === "time-series" && (
        <ViewSection
          loading={seriesLoading}
          error={seriesError}
          onRetry={() => void mutateSeries()}
          empty={!series || series.points.length === 0}
          emptyLabel="Sem série temporal disponível."
        >
          <Panel title="Série temporal" subtitle="Leitura diária de bruto, taxas e líquido">
            <ChartWrap className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={seriesChartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff18" />
                  <XAxis dataKey="date" tick={RECHARTS_AXIS_TICK_STYLE} tickLine={false} />
                  <YAxis tick={RECHARTS_AXIS_TICK_STYLE} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={RECHARTS_TOOLTIP_CONTENT_STYLE}
                    itemStyle={RECHARTS_TOOLTIP_ITEM_STYLE}
                    labelStyle={RECHARTS_TOOLTIP_LABEL_STYLE}
                    cursor={RECHARTS_TOOLTIP_CURSOR_STYLE}
                    formatter={(value, key) => [toEuroChartLabel(value), String(key ?? "")]}
                  />
                  <Legend formatter={formatRechartsLegendLabel} wrapperStyle={RECHARTS_LEGEND_WRAPPER_STYLE} />
                  <Area type="monotone" dataKey="gross" stroke="#60A5FA" fill="#60A5FA33" name="Bruto" strokeWidth={2} />
                  <Area type="monotone" dataKey="fees" stroke="#F59E0B" fill="#F59E0B22" name="Taxas" strokeWidth={2} />
                  <Area type="monotone" dataKey="net" stroke="#22C55E" fill="#22C55E22" name="Líquido" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartWrap>
          </Panel>
        </ViewSection>
      )}

      {view === "dimensions" && (
        <ViewSection
          loading={dimensionsLoading}
          error={dimensionsError}
          onRetry={() => void mutateDimensions()}
          empty={!dimensions || Object.keys(dimensions.items).length === 0}
          emptyLabel="Sem dimensões para mostrar."
        >
          <Panel
            title={`Top dimensões (${prettyMetricKey(effectiveMetricKey)})`}
            subtitle={dimensions?.bucketDate ? `Agregado: ${dimensions.bucketDate}` : "Sem agregado definido"}
          >
            {dimensionsChartData.length > 0 ? (
              <ChartWrap>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dimensionsChartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff18" />
                    <XAxis dataKey="dimensionValue" tick={RECHARTS_AXIS_TICK_STYLE} tickLine={false} />
                    <YAxis tick={RECHARTS_AXIS_TICK_STYLE} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={RECHARTS_TOOLTIP_CONTENT_STYLE}
                      itemStyle={RECHARTS_TOOLTIP_ITEM_STYLE}
                      labelStyle={RECHARTS_TOOLTIP_LABEL_STYLE}
                      cursor={RECHARTS_TOOLTIP_CURSOR_STYLE}
                      formatter={(value) => [toEuroChartLabel(value), prettyMetricKey(effectiveMetricKey)]}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#38BDF8" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartWrap>
            ) : (
              <EmptyState label="Sem dados suficientes nesta dimensão." />
            )}
          </Panel>
        </ViewSection>
      )}

      {view === "telemetry" && (
        <ViewSection
          loading={
            telemetryOverviewLoading ||
            telemetryIncidentsLoading ||
            telemetryEventsLoading ||
            telemetryFunnelsLoading ||
            telemetryFunnelResultsLoading ||
            telemetryCatalogLoading
          }
          error={
            telemetryOverviewError ??
            telemetryIncidentsError ??
            telemetryEventsError ??
            telemetryFunnelsError ??
            telemetryFunnelResultsError ??
            telemetryCatalogError
          }
          onRetry={() =>
            void Promise.all([
              mutateTelemetryOverview(),
              mutateTelemetryIncidents(),
              mutateTelemetryEvents(),
              mutateTelemetryFunnels(),
              mutateTelemetryFunnelResults(),
              mutateTelemetryCatalog(),
            ])
          }
          empty={!telemetryOverview}
          emptyLabel="Sem telemetria para o período selecionado."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard label="Eventos" value={String(telemetryOverview?.totals.totalEvents ?? 0)} />
            <MetricCard label="Erros" value={String(telemetryOverview?.totals.errorEvents ?? 0)} />
            <MetricCard
              label="Taxa de erro"
              value={toPctFromBps(telemetryOverview?.totals.errorRateBps)}
            />
            <MetricCard
              label="Actores únicos"
              value={String(telemetryOverview?.totals.uniqueActors ?? 0)}
            />
            <MetricCard label="Incidentes activos" value={String(telemetryOpenIncidents.length)} />
            <MetricCard label="Funis activos" value={String(telemetryActiveFunnels.length)} />
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="MTTA" value={formatTelemetryMinutes(telemetryIncidentKpis?.mttaMinutes)} />
            <MetricCard label="MTTR" value={formatTelemetryMinutes(telemetryIncidentKpis?.mttrMinutes)} />
            <MetricCard
              label={`Breaches ACK (${telemetryIncidentKpis?.ackSlaMinutes ?? 15}m)`}
              value={String(telemetryIncidentKpis?.ackSlaBreaches ?? 0)}
            />
            <MetricCard
              label={`Breaches Resolve (${telemetryIncidentKpis?.resolveSlaMinutes ?? 120}m)`}
              value={String(telemetryIncidentKpis?.resolveSlaBreaches ?? 0)}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
            <Panel title="Incidentes" subtitle="Acompanhar, filtrar e fechar alertas desta organização">
              {telemetryActionInfo ? (
                <div className="mb-3 rounded-lg border border-emerald-300/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                  {telemetryActionInfo}
                </div>
              ) : null}
              {telemetryActionError ? (
                <div className="mb-3 rounded-lg border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                  {telemetryActionError}
                </div>
              ) : null}
              <div className="space-y-2">
                {telemetryIncidentItems.map((incident) => {
                  const canAck = incident.status === "OPEN";
                  const canResolve = incident.status !== "RESOLVED";
                  const ackBusy = telemetryActionBusyKey === `${incident.id}:ACK`;
                  const resolveBusy = telemetryActionBusyKey === `${incident.id}:RESOLVE`;
                  const slaHint = buildTelemetryIncidentSlaHint(incident, telemetryIncidentKpis);
                  return (
                    <div key={incident.id} className="rounded-xl border border-white/12 bg-black/20 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-white">{incident.title}</p>
                        <span className="rounded-md border border-white/20 bg-white/[0.08] px-2 py-1 text-[11px] text-white/80">
                          {formatTelemetryStatus(incident.status)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-white/70">
                        {formatTelemetryMetricKey(incident.metricKey)} · Observado {incident.observedValue ?? 0} / Limite {incident.thresholdValue ?? 0}
                      </p>
                      <p className="mt-1 text-[11px] text-white/55">{formatDateTime(incident.triggeredAt)}</p>
                      {slaHint ? (
                        <p
                          className={`mt-1 text-[11px] ${slaHint.breached ? "text-rose-200" : "text-emerald-200"}`}
                        >
                          {slaHint.label}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {canAck ? (
                          <button
                            type="button"
                            className="rounded-md border border-cyan-300/45 bg-cyan-300/10 px-2 py-1 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-300/20 disabled:opacity-50"
                            disabled={ackBusy || Boolean(telemetryActionBusyKey)}
                            onClick={() => void applyTelemetryIncidentAction(incident.id, "ACK")}
                          >
                            {ackBusy ? "A processar..." : "Reconhecer"}
                          </button>
                        ) : null}
                        {canResolve ? (
                          <button
                            type="button"
                            className="rounded-md border border-emerald-300/45 bg-emerald-300/10 px-2 py-1 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-300/20 disabled:opacity-50"
                            disabled={resolveBusy || Boolean(telemetryActionBusyKey)}
                            onClick={() => void applyTelemetryIncidentAction(incident.id, "RESOLVE")}
                          >
                            {resolveBusy ? "A processar..." : "Resolver"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                {telemetryIncidentItems.length === 0 ? (
                  <EmptyState label="Sem incidentes para os filtros atuais." />
                ) : null}
                {telemetryIncidentHasMore ? (
                  <div className="pt-1">
                    <button
                      type="button"
                      className="rounded-md border border-white/20 bg-white/[0.08] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/[0.15] disabled:opacity-60"
                      onClick={() => void loadMoreTelemetryIncidents()}
                      disabled={telemetryIncidentLoadMoreBusy || !telemetryIncidentNextCursor}
                    >
                      {telemetryIncidentLoadMoreBusy ? "A carregar..." : "Carregar mais incidentes"}
                    </button>
                  </div>
                ) : null}
              </div>
            </Panel>

            <Panel title="Regras e avaliação" subtitle="Regras activas e avaliação manual imediata">
              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-md border border-[#22D3EE]/45 bg-[#22D3EE]/14 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-[#22D3EE]/70 hover:bg-[#22D3EE]/24 disabled:opacity-60"
                  onClick={() => void runTelemetryEvaluate()}
                  disabled={telemetryEvaluateBusy}
                >
                  {telemetryEvaluateBusy ? "A avaliar..." : "Avaliar alertas agora"}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-emerald-300/45 bg-emerald-300/12 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:border-emerald-300/70 hover:bg-emerald-300/24 disabled:opacity-60"
                  onClick={() => void runTelemetryRecompute()}
                  disabled={telemetryRecomputeBusy}
                >
                  {telemetryRecomputeBusy ? "A recomputar..." : "Recompute org"}
                </button>
                <select
                  className="rounded-md border border-white/20 bg-black/25 px-2 py-1.5 text-xs text-white outline-none transition focus:border-cyan-300/80"
                  value={telemetryExportDataset}
                  onChange={(event) => setTelemetryExportDataset(event.target.value as TelemetryExportDataset)}
                >
                  <option value="events">Exportar: eventos</option>
                  <option value="incidents">Exportar: incidentes</option>
                  <option value="rules">Exportar: regras</option>
                  <option value="funnels">Exportar: funis</option>
                  <option value="funnel_results">Exportar: resultados funil</option>
                </select>
                <select
                  className="rounded-md border border-white/20 bg-black/25 px-2 py-1.5 text-xs text-white outline-none transition focus:border-cyan-300/80"
                  value={telemetryExportFormat}
                  onChange={(event) => setTelemetryExportFormat(event.target.value as TelemetryExportFormat)}
                >
                  <option value="csv">CSV</option>
                  <option value="pdf">PDF</option>
                </select>
                <button
                  type="button"
                  className="rounded-md border border-[#22D3EE]/40 bg-[#22D3EE]/10 px-3 py-1.5 text-xs font-semibold text-[#CFFAFE] transition hover:bg-[#22D3EE]/20 disabled:opacity-60"
                  onClick={() => void runTelemetryExportPreview()}
                  disabled={telemetryExportPreviewBusy}
                >
                  {telemetryExportPreviewBusy ? "A gerar preview..." : "Pré-visualizar"}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-white/25 bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/[0.16]"
                  onClick={() => runTelemetryExport()}
                >
                  {telemetryExportFormat === "pdf" ? "Exportar PDF" : "Exportar CSV"}
                </button>
              </div>
              {telemetryLastEvaluation ? (
                <div className="mb-3 rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-[11px] text-white/75">
                  {telemetryLastEvaluation.evaluatedRules} regras · {telemetryLastEvaluation.openedIncidents} novos incidentes ·{" "}
                  {telemetryLastEvaluation.resolvedIncidents} resolvidos
                </div>
              ) : null}
              {telemetryLastRecompute ? (
                <div className="mb-3 rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-[11px] text-emerald-100">
                  Recompute: {telemetryLastRecompute.rollup.written} linhas rollup ·{" "}
                  {telemetryLastRecompute.funnels?.rowsWritten ?? 0} linhas de funil.
                </div>
              ) : null}
              {telemetryExportPreview ? (
                <div className="mb-3 rounded-xl border border-white/14 bg-black/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-white">
                      Preview exportação ({telemetryExportPreview.dataset})
                    </p>
                    <p className="text-[11px] text-white/60">
                      {telemetryExportPreview.rowCount} linhas
                      {telemetryExportPreview.truncated ? ` · amostra ${telemetryExportPreview.sampleSize}` : ""}
                    </p>
                  </div>
                  <div className="mt-2 overflow-auto rounded-lg border border-white/10">
                    <table className="min-w-full text-[11px]">
                      <thead className="bg-white/5 text-left uppercase tracking-[0.12em] text-white/50">
                        <tr>
                          {telemetryExportPreview.headers.map((header) => (
                            <th key={`telemetry-preview-head-${header}`} className="px-2 py-1.5">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {telemetryExportPreview.rows.map((row, rowIndex) => (
                          <tr key={`telemetry-preview-row-${rowIndex}`} className="bg-black/15">
                            {telemetryExportPreview.headers.map((header, colIndex) => (
                              <td
                                key={`telemetry-preview-cell-${rowIndex}-${header}`}
                                className="max-w-[260px] truncate px-2 py-1.5 text-white/80"
                              >
                                {row[colIndex] || "-"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
              <div className="space-y-2">
                {telemetryActiveRules.map((rule) => (
                  <div key={rule.id} className="rounded-xl border border-white/12 bg-black/20 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{rule.name}</span>
                      <span className="rounded-md border border-white/20 bg-white/[0.08] px-2 py-0.5 text-[11px] text-white/70">
                        {rule.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-white/65">
                      {formatTelemetryMetricKey(rule.metricKey)} · {rule.comparisonOperator} {rule.threshold} · janela {rule.windowMinutes}m
                    </p>
                  </div>
                ))}
                {telemetryActiveRules.length === 0 ? (
                  <EmptyState label="Sem regras activas disponíveis." />
                ) : null}
              </div>
            </Panel>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="Funis activos" subtitle="Definições activas para análise desta organização">
              <div className="space-y-2">
                {telemetryActiveFunnels.map((funnel) => (
                  <div key={funnel.id} className="rounded-xl border border-white/12 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{funnel.name}</p>
                      <span className="rounded-md border border-white/20 bg-white/[0.08] px-2 py-0.5 text-[11px] text-white/70">
                        {funnel.steps.length} passos
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-white/60">
                      {funnel.steps
                        .slice(0, 4)
                        .map((step) => step.key)
                        .join(" → ")}
                      {funnel.steps.length > 4 ? " → ..." : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {funnel.organizationId === orgId ? (
                        <>
                          <button
                            type="button"
                            className="rounded-md border border-[#22D3EE]/40 bg-[#22D3EE]/10 px-2 py-1 text-[11px] font-semibold text-[#CFFAFE] transition hover:bg-[#22D3EE]/20 disabled:opacity-60"
                            onClick={() => startEditTelemetryFunnel(funnel)}
                            disabled={telemetryFunnelSaveBusy}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-white/20 bg-white/[0.08] px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-white/[0.15] disabled:opacity-60"
                            onClick={() => void toggleTelemetryFunnelActive(funnel)}
                            disabled={telemetryFunnelBusyKey === `funnel:${funnel.id}` || telemetryFunnelSaveBusy}
                          >
                            {telemetryFunnelBusyKey === `funnel:${funnel.id}`
                              ? "A atualizar..."
                              : "Desativar"}
                          </button>
                        </>
                      ) : (
                        <span className="text-[11px] text-white/50">Funil global (só leitura)</span>
                      )}
                    </div>
                  </div>
                ))}
                {telemetryActiveFunnels.length === 0 ? (
                  <EmptyState label="Sem funis activos definidos para esta organização." />
                ) : null}
              </div>
            </Panel>

            <Panel title="Resultados de funil" subtitle="Conversões recentes por passo (hora)">
              <div className="space-y-2">
                {telemetryFunnelRows.map((item) => (
                  <div key={item.id} className="rounded-xl border border-white/12 bg-black/20 px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="truncate text-white">{item.funnelName}</p>
                      <span className="text-[11px] text-white/60">{formatDateTime(item.bucketStart)}</span>
                    </div>
                    <p className="mt-1 text-xs text-white/65">
                      Passo <span className="font-semibold text-white">{item.stepKey}</span> · entraram {item.enteredCount} · converteram {item.convertedCount} · taxa{" "}
                      {toPctFromBps(item.conversionRateBps)}
                    </p>
                  </div>
                ))}
                {telemetryFunnelRows.length === 0 ? (
                  <EmptyState label="Sem resultados de funil para esta janela." />
                ) : null}
              </div>
            </Panel>
          </div>

          <Panel
            title="Gestão de funis da organização"
            subtitle="Cria e mantém funis próprios para análises de conversão"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-[0.16em] text-white/60">Nome</span>
                <input
                  className="h-10 rounded-xl border border-white/20 bg-[#141414] px-3 text-sm text-white outline-none transition focus:border-cyan-300/80"
                  value={telemetryFunnelName}
                  onChange={(event) => setTelemetryFunnelName(event.target.value)}
                  placeholder="ex: Checkout principal"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-[0.16em] text-white/60">Estado</span>
                <select
                  className="h-10 rounded-xl border border-white/20 bg-[#141414] px-3 text-sm text-white outline-none transition focus:border-cyan-300/80"
                  value={telemetryFunnelIsActive ? "true" : "false"}
                  onChange={(event) => setTelemetryFunnelIsActive(event.target.value === "true")}
                >
                  <option value="true">Ativo</option>
                  <option value="false">Inativo</option>
                </select>
              </label>
            </div>

            <label className="mt-3 flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-[0.16em] text-white/60">Descrição</span>
              <textarea
                className="min-h-20 rounded-xl border border-white/20 bg-[#141414] px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/80"
                value={telemetryFunnelDescription}
                onChange={(event) => setTelemetryFunnelDescription(event.target.value)}
                placeholder="Descrição operacional do funil."
              />
            </label>

            <div className="mt-3 rounded-xl border border-white/12 bg-black/20 px-3 py-2 text-[11px] text-white/70">
              Catálogo ORYA disponível: {telemetryCatalog?.total ?? telemetryCatalog?.items?.length ?? 0} eventos canónicos.
              {telemetryDraftUnknownEvents.length > 0 ? (
                <p className="mt-1 text-amber-200">
                  Eventos fora de catálogo no draft: {telemetryDraftUnknownEvents.join(", ")}
                </p>
              ) : null}
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/65">Passos</p>
                <button
                  type="button"
                  className="rounded-md border border-emerald-300/40 bg-emerald-300/10 px-2 py-1 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-300/20"
                  onClick={addTelemetryFunnelStep}
                >
                  + Adicionar passo
                </button>
              </div>
              {telemetryFunnelSteps.map((step, index) => (
                <div
                  key={`draft-step-${index}`}
                  className="rounded-xl border border-white/12 bg-black/20 p-3"
                >
                  <div className="grid gap-2 md:grid-cols-[1fr_2fr_1fr_auto]">
                    <input
                      className="h-9 rounded-lg border border-white/20 bg-[#121212] px-2 text-sm text-white outline-none transition focus:border-cyan-300/80"
                      value={step.key}
                      onChange={(event) =>
                        updateTelemetryFunnelStep(index, { key: event.target.value })
                      }
                      placeholder="key (ex: start)"
                    />
                    <input
                      className="h-9 rounded-lg border border-white/20 bg-[#121212] px-2 text-sm text-white outline-none transition focus:border-cyan-300/80"
                      value={step.eventName}
                      onChange={(event) =>
                        updateTelemetryFunnelStep(index, { eventName: event.target.value })
                      }
                      list="telemetry-catalog-event-names"
                      placeholder="eventName (ex: checkout.flow.started)"
                    />
                    <input
                      className="h-9 rounded-lg border border-white/20 bg-[#121212] px-2 text-sm text-white outline-none transition focus:border-cyan-300/80"
                      value={step.withinMinutes}
                      onChange={(event) =>
                        updateTelemetryFunnelStep(index, { withinMinutes: event.target.value })
                      }
                      inputMode="numeric"
                      placeholder="within min"
                    />
                    <button
                      type="button"
                      className="rounded-lg border border-rose-300/35 bg-rose-500/10 px-2 text-[11px] font-semibold text-rose-100 transition hover:bg-rose-500/20 disabled:opacity-50"
                      onClick={() => removeTelemetryFunnelStep(index)}
                      disabled={telemetryFunnelSteps.length <= 2}
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <datalist id="telemetry-catalog-event-names">
              {(telemetryCatalog?.items ?? []).map((entry) => (
                <option key={`catalog-${entry.eventName}`} value={entry.eventName}>
                  {entry.owner}
                </option>
              ))}
            </datalist>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md border border-[#22D3EE]/45 bg-[#22D3EE]/14 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-[#22D3EE]/70 hover:bg-[#22D3EE]/24 disabled:opacity-60"
                onClick={() => void saveTelemetryFunnel()}
                disabled={telemetryFunnelSaveBusy}
              >
                {telemetryFunnelSaveBusy
                  ? "A gravar..."
                  : telemetryFunnelEditingId
                    ? "Guardar alterações"
                    : "Criar funil"}
              </button>
              {telemetryFunnelEditingId ? (
                <button
                  type="button"
                  className="rounded-md border border-white/25 bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/[0.16]"
                  onClick={resetTelemetryFunnelDraft}
                  disabled={telemetryFunnelSaveBusy}
                >
                  Cancelar edição
                </button>
              ) : null}
            </div>

            <div className="mt-4 rounded-xl border border-white/12 bg-black/20 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/65">
                Funis próprios existentes
              </p>
              <div className="mt-2 space-y-2">
                {telemetryOwnFunnels.map((funnel) => (
                  <div key={`own-${funnel.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm">
                    <div>
                      <p className="font-semibold text-white">{funnel.name}</p>
                      <p className="text-[11px] text-white/60">{funnel.steps.length} passos</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded-md border border-[#22D3EE]/40 bg-[#22D3EE]/10 px-2 py-1 text-[11px] font-semibold text-[#CFFAFE] transition hover:bg-[#22D3EE]/20"
                        onClick={() => startEditTelemetryFunnel(funnel)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-white/20 bg-white/[0.08] px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-white/[0.15] disabled:opacity-60"
                        onClick={() => void toggleTelemetryFunnelActive(funnel)}
                        disabled={telemetryFunnelBusyKey === `funnel:${funnel.id}`}
                      >
                        {telemetryFunnelBusyKey === `funnel:${funnel.id}`
                          ? "A atualizar..."
                          : funnel.isActive
                            ? "Desativar"
                            : "Ativar"}
                      </button>
                    </div>
                  </div>
                ))}
                {telemetryOwnFunnels.length === 0 ? (
                  <p className="text-xs text-white/60">
                    Ainda não existem funis próprios nesta organização.
                  </p>
                ) : null}
              </div>
            </div>
          </Panel>

          <Panel title="Timeline de telemetria" subtitle="Eventos totais vs erros">
            {telemetryTimelineData.length > 0 ? (
              <ChartWrap className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={telemetryTimelineData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff18" />
                    <XAxis dataKey="date" tick={RECHARTS_AXIS_TICK_STYLE} tickLine={false} />
                    <YAxis tick={RECHARTS_AXIS_TICK_STYLE} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={RECHARTS_TOOLTIP_CONTENT_STYLE}
                      itemStyle={RECHARTS_TOOLTIP_ITEM_STYLE}
                      labelStyle={RECHARTS_TOOLTIP_LABEL_STYLE}
                      cursor={RECHARTS_TOOLTIP_CURSOR_STYLE}
                    />
                    <Legend formatter={formatRechartsLegendLabel} wrapperStyle={RECHARTS_LEGEND_WRAPPER_STYLE} />
                    <Bar dataKey="total" name="Total" radius={[6, 6, 0, 0]} fill="#38BDF8" />
                    <Bar dataKey="errors" name="Erros" radius={[6, 6, 0, 0]} fill="#F87171" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartWrap>
            ) : (
              <EmptyState label="Sem pontos de timeline." />
            )}
          </Panel>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="Top eventos" subtitle="Mais frequentes na janela selecionada">
              <div className="space-y-2">
                {telemetryTopEvents.map((item) => (
                  <div key={item.eventName} className="flex items-center justify-between rounded-xl border border-white/12 bg-black/20 px-3 py-2 text-sm">
                    <span className="truncate pr-3">{item.eventName}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))}
                {telemetryTopEvents.length === 0 && <EmptyState label="Sem eventos agregados." />}
              </div>
            </Panel>

            <Panel title="Breakdown por source" subtitle="Distribuição da origem de eventos">
              <div className="space-y-2">
                {telemetrySourceBreakdown.map((item) => (
                  <div key={item.sourceType} className="flex items-center justify-between rounded-xl border border-white/12 bg-black/20 px-3 py-2 text-sm">
                    <span>{item.sourceType}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))}
                {telemetrySourceBreakdown.length === 0 && <EmptyState label="Sem breakdown por source." />}
              </div>
            </Panel>
          </div>

          <Panel title="Eventos recentes" subtitle="Feed operativo de telemetria">
            <div className="space-y-2 md:hidden">
              {(telemetryEvents?.items ?? []).map((item) => (
                <div key={`telemetry-mobile-${item.id}`} className="rounded-xl border border-white/12 bg-black/20 p-3">
                  <p className="text-sm font-semibold text-white">{item.eventName}</p>
                  <p className="text-xs text-white/65">{formatDateTime(item.occurredAt)}</p>
                  <div className="mt-2 flex items-center gap-2 text-[11px]">
                    <span className="rounded-md border border-white/15 bg-white/[0.08] px-2 py-1">{item.sourceType}</span>
                    <span className="rounded-md border border-white/15 bg-white/[0.08] px-2 py-1">{item.severity}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-auto rounded-xl border border-white/10 md:block">
              <table className="min-w-full text-sm">
                <thead className="bg-white/5 text-left text-[11px] uppercase tracking-wide text-white/60">
                  <tr>
                    <th className="px-3 py-2">Data</th>
                    <th className="px-3 py-2">Evento</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Sev</th>
                    <th className="px-3 py-2">Actor</th>
                    <th className="px-3 py-2">Correlation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {(telemetryEvents?.items ?? []).map((item) => (
                    <tr key={item.id} className="bg-black/10">
                      <td className="px-3 py-2">{formatDateTime(item.occurredAt)}</td>
                      <td className="px-3 py-2">{item.eventName}</td>
                      <td className="px-3 py-2">{item.sourceType}</td>
                      <td className="px-3 py-2">{item.severity}</td>
                      <td className="px-3 py-2">{item.actorType}</td>
                      <td className="px-3 py-2 max-w-[220px] truncate">{item.correlationId || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </ViewSection>
      )}

    </section>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-[0.16em] text-white/60">{label}</span>
      <select
        className="h-10 rounded-xl border border-white/20 bg-[#141414] px-3 text-sm text-white outline-none transition focus:border-cyan-300/80"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        {!options.length && (
          <option value="">{placeholder ?? "Sem opções"}</option>
        )}
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ViewSection({
  loading,
  error,
  onRetry,
  empty,
  emptyLabel,
  children,
}: {
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  empty: boolean;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-white/12 bg-gradient-to-br from-white/[0.08] via-white/[0.04] to-transparent p-4">
        <p className="mb-1 text-xs uppercase tracking-[0.14em] text-white/55">A carregar dados da vista</p>
        <p className="mb-3 text-[12px] text-white/65">A sincronizar métricas e séries em tempo real.</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-300/50 bg-gradient-to-br from-rose-500/16 via-rose-500/10 to-transparent p-4 text-sm text-rose-100">
        <p className="font-semibold">Falha ao carregar dados desta vista.</p>
        <p className="mt-1 rounded-md border border-rose-200/30 bg-black/15 px-2 py-1 text-rose-100/85">
          {formatAnalyticsError(error)}
        </p>
        <p className="mt-1 text-xs text-rose-100/65">Se persistir, valide filtros e permissoes de ferramenta.</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg border border-rose-200/50 bg-rose-200/20 px-3 py-1.5 text-xs font-semibold text-rose-50 transition hover:bg-rose-200/35"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (empty) {
    return <EmptyState label={emptyLabel} />;
  }

  return <div className="space-y-3">{children}</div>;
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/[0.05] p-4 shadow-[0_16px_46px_rgba(0,0,0,0.28)]">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {subtitle ? <p className="text-xs text-white/60">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

function ChartWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("h-72 w-full", className)}>{children}</div>;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/14 bg-gradient-to-br from-white/12 via-[#0b1124]/72 to-[#050810]/95 p-3 shadow-[0_20px_62px_rgba(0,0,0,0.5)]">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/70">{label}</p>
      <p className="mt-1 text-[24px] font-bold leading-tight text-white">{value}</p>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="h-44 animate-pulse rounded-2xl border border-white/10 bg-white/[0.05] p-3">
      <div className="h-3 w-2/5 rounded bg-white/20" />
      <div className="mt-4 h-7 w-3/5 rounded bg-white/15" />
      <div className="mt-6 h-20 w-full rounded bg-white/10" />
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/[0.05] p-4 text-sm text-white/75">
      <p className="font-semibold text-white/90">Sem dados disponíveis</p>
      <p className="mt-1">{label}</p>
    </div>
  );
}
