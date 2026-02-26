"use client";

import { useCallback, useMemo, useState } from "react";
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
  const [telemetryActionBusyKey, setTelemetryActionBusyKey] = useState<string | null>(null);
  const [telemetryActionError, setTelemetryActionError] = useState<string | null>(null);
  const [telemetryActionInfo, setTelemetryActionInfo] = useState<string | null>(null);
  const [telemetryEvaluateBusy, setTelemetryEvaluateBusy] = useState(false);
  const [telemetryLastEvaluation, setTelemetryLastEvaluation] = useState<TelemetryEvaluationResult | null>(null);

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
        await mutateTelemetryOverview();
      } catch (error) {
        setTelemetryActionError(formatAnalyticsError(error));
      } finally {
        setTelemetryActionBusyKey((current) => (current === busyKey ? null : current));
      }
    },
    [mutateTelemetryOverview, orgApiBase],
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
      await mutateTelemetryOverview();
    } catch (error) {
      setTelemetryActionError(formatAnalyticsError(error));
    } finally {
      setTelemetryEvaluateBusy(false);
    }
  }, [mutateTelemetryOverview, orgApiBase]);

  const refreshCurrentView = useCallback(async () => {
    if (view === "overview") await Promise.all([mutateOverview(), mutateSeries()]);
    if (view === "conversion") await mutateConversion();
    if (view === "cohorts") await mutateCohorts();
    if (view === "buyers") await Promise.all([mutateEvents(), mutateBuyers()]);
    if (view === "time-series") await mutateSeries();
    if (view === "dimensions") await mutateDimensions();
    if (view === "telemetry") await Promise.all([mutateTelemetryOverview(), mutateTelemetryEvents()]);
  }, [
    mutateBuyers,
    mutateCohorts,
    mutateConversion,
    mutateDimensions,
    mutateEvents,
    mutateOverview,
    mutateSeries,
    mutateTelemetryEvents,
    mutateTelemetryOverview,
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
  const telemetryOpenIncidents = useMemo(
    () => (telemetryOverview?.incidents ?? []).filter((item) => item.status !== "RESOLVED"),
    [telemetryOverview?.incidents],
  );
  const telemetryActiveRules = useMemo(
    () => (telemetryOverview?.rules ?? []).filter((item) => item.isActive),
    [telemetryOverview?.rules],
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
          loading={telemetryOverviewLoading || telemetryEventsLoading}
          error={telemetryOverviewError ?? telemetryEventsError}
          onRetry={() => void Promise.all([mutateTelemetryOverview(), mutateTelemetryEvents()])}
          empty={!telemetryOverview}
          emptyLabel="Sem telemetria para o período selecionado."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
            <Panel title="Incidentes activos" subtitle="Acompanhar e fechar alertas desta organização">
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
                {telemetryOpenIncidents.map((incident) => {
                  const canAck = incident.status === "OPEN";
                  const canResolve = incident.status !== "RESOLVED";
                  const ackBusy = telemetryActionBusyKey === `${incident.id}:ACK`;
                  const resolveBusy = telemetryActionBusyKey === `${incident.id}:RESOLVE`;
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
                {telemetryOpenIncidents.length === 0 ? (
                  <EmptyState label="Sem incidentes abertos para esta janela." />
                ) : null}
              </div>
            </Panel>

            <Panel title="Regras e avaliação" subtitle="Regras activas e avaliação manual imediata">
              <div className="mb-3">
                <button
                  type="button"
                  className="rounded-md border border-[#22D3EE]/45 bg-[#22D3EE]/14 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-[#22D3EE]/70 hover:bg-[#22D3EE]/24 disabled:opacity-60"
                  onClick={() => void runTelemetryEvaluate()}
                  disabled={telemetryEvaluateBusy}
                >
                  {telemetryEvaluateBusy ? "A avaliar..." : "Avaliar alertas agora"}
                </button>
              </div>
              {telemetryLastEvaluation ? (
                <div className="mb-3 rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-[11px] text-white/75">
                  {telemetryLastEvaluation.evaluatedRules} regras · {telemetryLastEvaluation.openedIncidents} novos incidentes ·{" "}
                  {telemetryLastEvaluation.resolvedIncidents} resolvidos
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
