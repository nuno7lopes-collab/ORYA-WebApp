"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/app/admin/components/AdminLayout";
import { AdminPageHeader } from "@/app/admin/components/AdminPageHeader";

type OverviewPayload = {
  window: { hours: number; from: string; to: string };
  totals: {
    totalEvents: number;
    errorEvents: number;
    uniqueActors: number;
    errorRateBps: number;
  };
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
};

type TelemetryRule = {
  id: string;
  organizationId: number | null;
  name: string;
  description: string | null;
  metricKey: "EVENT_COUNT" | "ERROR_COUNT" | "UNIQUE_ACTORS";
  dimensionKey: string | null;
  dimensionValue: string | null;
  comparisonOperator: "GTE" | "GT" | "LTE" | "LT" | "EQ" | "NEQ";
  threshold: number;
  windowMinutes: number;
  cooldownMinutes: number;
  severity: "INFO" | "WARN" | "ERROR" | "CRITICAL";
  isActive: boolean;
};

type TelemetryIncident = {
  id: string;
  ruleId: string | null;
  organizationId: number | null;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  severity: "INFO" | "WARN" | "ERROR" | "CRITICAL";
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

type TelemetryIncidentKpis = {
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

type RecomputePayload = {
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

type TelemetryFunnelStep = {
  key: string;
  eventName: string;
  required: boolean;
  withinMinutes: number | null;
};

type TelemetryFunnelDefinition = {
  id: string;
  organizationId: number | null;
  name: string;
  description: string | null;
  steps: TelemetryFunnelStep[];
  isActive: boolean;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

type TelemetryFunnelResult = {
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

type EventsPayload = {
  items: Array<{
    id: string;
    organizationId: number | null;
    eventName: string;
    sourceType: string;
    severity: string;
    actorType: string;
    actorUserId: string | null;
    actorKey: string | null;
    correlationId: string | null;
    requestId: string | null;
    surface: string | null;
    outcome: string | null;
    occurredAt: string;
    organization?: { id: number; publicName: string | null } | null;
    actor?: { id: string; name: string | null; email: string | null } | null;
  }>;
  pagination: { hasMore: boolean; nextCursor: string | null };
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

type RuleDraft = {
  scope: "ORG" | "GLOBAL";
  name: string;
  description: string;
  metricKey: "EVENT_COUNT" | "ERROR_COUNT" | "UNIQUE_ACTORS";
  comparisonOperator: "GTE" | "GT" | "LTE" | "LT" | "EQ" | "NEQ";
  threshold: string;
  windowMinutes: string;
  cooldownMinutes: string;
  severity: "WARN" | "ERROR" | "CRITICAL";
  dimensionKey: string;
  dimensionValue: string;
};

const DEFAULT_RULE_DRAFT: RuleDraft = {
  scope: "ORG",
  name: "",
  description: "",
  metricKey: "ERROR_COUNT",
  comparisonOperator: "GTE",
  threshold: "10",
  windowMinutes: "15",
  cooldownMinutes: "30",
  severity: "WARN",
  dimensionKey: "",
  dimensionValue: "",
};

function unwrapPayload<T>(input: unknown): T {
  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;
    if (record.data && typeof record.data === "object") return record.data as T;
    if (record.result && typeof record.result === "object") return record.result as T;
  }
  return input as T;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const json = await res.json().catch(() => null);
  const payload = unwrapPayload<Record<string, unknown>>(json);
  const topLevel = json && typeof json === "object" ? (json as Record<string, unknown>) : null;
  const hasErrorFlag = payload?.ok === false || topLevel?.ok === false;
  if (!res.ok || hasErrorFlag) {
    const errorCode =
      (payload?.error as string | undefined) ??
      (topLevel?.error as string | undefined) ??
      `HTTP_${res.status}`;
    throw new Error(errorCode);
  }
  return payload as T;
}

function formatApiError(error: unknown) {
  const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
  if (code.startsWith("HTTP_")) return "Falha de rede/API. Tenta novamente.";
  return code;
}

function formatBpsToPct(bps: number) {
  return `${(bps / 100).toFixed(2)}%`;
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function formatDurationMinutes(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  if (value >= 120) return `${(value / 60).toFixed(1)} h`;
  return `${value.toFixed(1)} min`;
}

function parseScopedOrgId(raw: string) {
  const parsed = Number(raw.trim());
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function metricLabel(metricKey: string | null | undefined) {
  if (metricKey === "EVENT_COUNT") return "Eventos";
  if (metricKey === "ERROR_COUNT") return "Erros";
  if (metricKey === "UNIQUE_ACTORS") return "Actores únicos";
  return metricKey || "Métrica";
}

function incidentStatusLabel(status: TelemetryIncident["status"]) {
  if (status === "OPEN") return "Aberto";
  if (status === "ACKNOWLEDGED") return "Reconhecido";
  return "Resolvido";
}

export default function AdminTelemetryPage() {
  const [hours, setHours] = useState(24);
  const [orgId, setOrgId] = useState("");
  const [query, setQuery] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [severity, setSeverity] = useState("");
  const [incidentStatuses, setIncidentStatuses] = useState("OPEN,ACKNOWLEDGED");
  const [exportDataset, setExportDataset] = useState<TelemetryExportDataset>("events");
  const [exportFormat, setExportFormat] = useState<TelemetryExportFormat>("csv");
  const [exportPreviewBusy, setExportPreviewBusy] = useState(false);
  const [exportPreview, setExportPreview] = useState<TelemetryExportPreviewPayload | null>(null);

  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [incidentKpis, setIncidentKpis] = useState<TelemetryIncidentKpis | null>(null);
  const [events, setEvents] = useState<EventsPayload["items"]>([]);
  const [incidents, setIncidents] = useState<TelemetryIncident[]>([]);
  const [rules, setRules] = useState<TelemetryRule[]>([]);
  const [funnels, setFunnels] = useState<TelemetryFunnelDefinition[]>([]);
  const [funnelResults, setFunnelResults] = useState<TelemetryFunnelResult[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingIncidents, setLoadingIncidents] = useState(false);
  const [loadingRules, setLoadingRules] = useState(false);
  const [loadingFunnels, setLoadingFunnels] = useState(false);
  const [loadingFunnelResults, setLoadingFunnelResults] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [opsError, setOpsError] = useState<string | null>(null);
  const [opsInfo, setOpsInfo] = useState<string | null>(null);

  const [actionBusyKey, setActionBusyKey] = useState<string | null>(null);
  const [evaluateBusy, setEvaluateBusy] = useState(false);
  const [lastEvaluation, setLastEvaluation] = useState<TelemetryEvaluationResult | null>(null);
  const [recomputeBusy, setRecomputeBusy] = useState(false);
  const [lastRecompute, setLastRecompute] = useState<RecomputePayload | null>(null);

  const [ruleDraft, setRuleDraft] = useState<RuleDraft>(DEFAULT_RULE_DRAFT);
  const [createRuleBusy, setCreateRuleBusy] = useState(false);
  const [createRuleError, setCreateRuleError] = useState<string | null>(null);

  const scopedOrgId = useMemo(() => parseScopedOrgId(orgId), [orgId]);

  const buildBaseParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set("hours", String(hours));
    if (scopedOrgId) params.set("orgId", String(scopedOrgId));
    return params;
  }, [hours, scopedOrgId]);

  const buildEventsParams = useCallback(
    (cursor?: string | null) => {
      const params = buildBaseParams();
      if (query.trim()) params.set("q", query.trim());
      if (sourceType) params.set("sourceType", sourceType);
      if (severity) params.set("severity", severity);
      params.set("take", "50");
      if (cursor) params.set("cursor", cursor);
      return params;
    },
    [buildBaseParams, query, sourceType, severity],
  );

  const buildIncidentsParams = useCallback(() => {
    const params = new URLSearchParams();
    if (scopedOrgId) params.set("orgId", String(scopedOrgId));
    if (incidentStatuses !== "ALL") params.set("statuses", incidentStatuses);
    if (severity) params.set("severities", severity);
    if (query.trim()) params.set("q", query.trim());
    params.set("take", "150");
    return params;
  }, [incidentStatuses, query, scopedOrgId, severity]);

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const params = buildBaseParams();
      const payload = await fetchJson<{
        overview: OverviewPayload;
        incidentKpis?: TelemetryIncidentKpis;
      }>(
        `/api/admin/telemetry/overview?${params.toString()}`,
      );
      setOverview(payload.overview);
      setIncidentKpis(payload.incidentKpis ?? null);
    } finally {
      setLoadingOverview(false);
    }
  }, [buildBaseParams]);

  const loadEvents = useCallback(
    async (opts?: { reset?: boolean; cursor?: string | null }) => {
      setLoadingEvents(true);
      try {
        const params = buildEventsParams(opts?.cursor ?? null);
        const payload = await fetchJson<EventsPayload>(`/api/admin/telemetry/events?${params.toString()}`);
        setEvents((prev) => (opts?.reset ? payload.items : [...prev, ...payload.items]));
        setHasMore(Boolean(payload.pagination.hasMore));
        setNextCursor(payload.pagination.nextCursor ?? null);
      } finally {
        setLoadingEvents(false);
      }
    },
    [buildEventsParams],
  );

  const loadIncidents = useCallback(async () => {
    setLoadingIncidents(true);
    try {
      const params = buildIncidentsParams();
      const payload = await fetchJson<{ items: TelemetryIncident[] }>(
        `/api/admin/telemetry/incidents?${params.toString()}`,
      );
      setIncidents(payload.items);
    } finally {
      setLoadingIncidents(false);
    }
  }, [buildIncidentsParams]);

  const loadRules = useCallback(async () => {
    setLoadingRules(true);
    try {
      const params = new URLSearchParams();
      params.set("includeGlobal", "true");
      params.set("activeOnly", "false");
      if (scopedOrgId) params.set("orgId", String(scopedOrgId));
      const payload = await fetchJson<{ items: TelemetryRule[] }>(
        `/api/admin/telemetry/rules?${params.toString()}`,
      );
      setRules(payload.items);
    } finally {
      setLoadingRules(false);
    }
  }, [scopedOrgId]);

  const loadFunnels = useCallback(async () => {
    setLoadingFunnels(true);
    try {
      const params = new URLSearchParams();
      params.set("includeGlobal", "true");
      params.set("activeOnly", "false");
      if (scopedOrgId) params.set("orgId", String(scopedOrgId));
      const payload = await fetchJson<{ items: TelemetryFunnelDefinition[] }>(
        `/api/admin/telemetry/funnels?${params.toString()}`,
      );
      setFunnels(payload.items);
    } finally {
      setLoadingFunnels(false);
    }
  }, [scopedOrgId]);

  const loadFunnelResults = useCallback(async () => {
    setLoadingFunnelResults(true);
    try {
      const params = new URLSearchParams();
      params.set("take", "150");
      params.set("bucketUnit", "HOUR");
      if (scopedOrgId) params.set("orgId", String(scopedOrgId));
      const payload = await fetchJson<{ items: TelemetryFunnelResult[] }>(
        `/api/admin/telemetry/funnels/results?${params.toString()}`,
      );
      setFunnelResults(payload.items);
    } finally {
      setLoadingFunnelResults(false);
    }
  }, [scopedOrgId]);

  const reloadAll = useCallback(async () => {
    setError(null);
    try {
      await Promise.all([
        loadOverview(),
        loadEvents({ reset: true }),
        loadIncidents(),
        loadRules(),
        loadFunnels(),
        loadFunnelResults(),
      ]);
    } catch (err) {
      setError(formatApiError(err));
    }
  }, [loadEvents, loadFunnelResults, loadFunnels, loadIncidents, loadOverview, loadRules]);

  useEffect(() => {
    void reloadAll();
  }, [reloadAll]);

  const runEvaluate = useCallback(async () => {
    setOpsError(null);
    setOpsInfo(null);
    setEvaluateBusy(true);
    try {
      const params = new URLSearchParams();
      if (scopedOrgId) params.set("orgId", String(scopedOrgId));
      const payload = await fetchJson<{ result: TelemetryEvaluationResult }>(
        `/api/admin/telemetry/evaluate?${params.toString()}`,
        { method: "POST" },
      );
      setLastEvaluation(payload.result);
      setOpsInfo("Avaliação de alertas concluída.");
      await Promise.all([loadOverview(), loadIncidents()]);
    } catch (err) {
      setOpsError(formatApiError(err));
    } finally {
      setEvaluateBusy(false);
    }
  }, [loadIncidents, loadOverview, scopedOrgId]);

  const runRecompute = useCallback(async () => {
    setOpsError(null);
    setOpsInfo(null);
    setRecomputeBusy(true);
    try {
      const params = new URLSearchParams();
      params.set("bucket", "HOUR");
      params.set("hours", String(hours));
      params.set("evaluate", "true");
      params.set("funnels", "true");
      if (scopedOrgId) params.set("orgId", String(scopedOrgId));

      const payload = await fetchJson<RecomputePayload>(
        `/api/admin/telemetry/recompute?${params.toString()}`,
        { method: "POST" },
      );
      setLastRecompute(payload);
      if (payload.evaluation) setLastEvaluation(payload.evaluation);
      setOpsInfo(
        payload.funnels
          ? "Rollup, avaliação e recompute de funis executados com sucesso."
          : "Rollup e avaliação executados com sucesso.",
      );
      await reloadAll();
    } catch (err) {
      setOpsError(formatApiError(err));
    } finally {
      setRecomputeBusy(false);
    }
  }, [hours, reloadAll, scopedOrgId]);

  const runExportCsv = useCallback(() => {
    setOpsError(null);
    setOpsInfo(null);
    setExportPreview(null);

    const params = buildBaseParams();
    params.set("dataset", exportDataset);
    params.set("format", exportFormat);
    params.set("take", "2500");

    if (exportDataset === "events") {
      if (query.trim()) params.set("q", query.trim());
      if (sourceType) params.set("sourceType", sourceType);
      if (severity) params.set("severity", severity);
    } else if (exportDataset === "incidents") {
      params.set("statuses", incidentStatuses === "ALL" ? "ALL" : incidentStatuses);
    } else if (exportDataset === "rules" || exportDataset === "funnels") {
      params.set("includeGlobal", "true");
      params.set("activeOnly", "false");
    } else if (exportDataset === "funnel_results") {
      params.set("bucketUnit", "HOUR");
    }

    window.open(`/api/admin/telemetry/export?${params.toString()}`, "_blank", "noopener,noreferrer");
    setOpsInfo(exportFormat === "pdf" ? "Exportação PDF iniciada." : "Exportação CSV iniciada.");
  }, [buildBaseParams, exportDataset, exportFormat, incidentStatuses, query, severity, sourceType]);

  const runPreviewExport = useCallback(async () => {
    setOpsError(null);
    setOpsInfo(null);
    setExportPreviewBusy(true);
    try {
      const params = buildBaseParams();
      params.set("dataset", exportDataset);
      params.set("take", "300");
      params.set("sample", "20");

      if (exportDataset === "events") {
        if (query.trim()) params.set("q", query.trim());
        if (sourceType) params.set("sourceType", sourceType);
        if (severity) params.set("severity", severity);
      } else if (exportDataset === "incidents") {
        params.set("statuses", incidentStatuses === "ALL" ? "ALL" : incidentStatuses);
      } else if (exportDataset === "rules" || exportDataset === "funnels") {
        params.set("includeGlobal", "true");
        params.set("activeOnly", "false");
      } else if (exportDataset === "funnel_results") {
        params.set("bucketUnit", "HOUR");
      }

      const payload = await fetchJson<{ preview: TelemetryExportPreviewPayload }>(
        `/api/admin/telemetry/export/preview?${params.toString()}`,
      );
      setExportPreview(payload.preview);
      setOpsInfo("Pré-visualização carregada.");
    } catch (err) {
      setOpsError(formatApiError(err));
      setExportPreview(null);
    } finally {
      setExportPreviewBusy(false);
    }
  }, [buildBaseParams, exportDataset, incidentStatuses, query, severity, sourceType]);

  const applyIncidentAction = useCallback(
    async (incidentId: string, action: "ACK" | "RESOLVE") => {
      setOpsError(null);
      setOpsInfo(null);
      const busyKey = `incident:${incidentId}:${action}`;
      setActionBusyKey(busyKey);
      try {
        await fetchJson<{ item: TelemetryIncident }>(`/api/admin/telemetry/incidents/${incidentId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action }),
        });
        setOpsInfo(action === "ACK" ? "Incidente reconhecido." : "Incidente resolvido.");
        await Promise.all([loadOverview(), loadIncidents()]);
      } catch (err) {
        setOpsError(formatApiError(err));
      } finally {
        setActionBusyKey((current) => (current === busyKey ? null : current));
      }
    },
    [loadIncidents, loadOverview],
  );

  const toggleRule = useCallback(
    async (rule: TelemetryRule) => {
      setOpsError(null);
      setOpsInfo(null);
      const busyKey = `rule:${rule.id}`;
      setActionBusyKey(busyKey);
      try {
        await fetchJson<{ item: TelemetryRule }>(`/api/admin/telemetry/rules/${rule.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ isActive: !rule.isActive }),
        });
        setOpsInfo(rule.isActive ? "Regra desativada." : "Regra ativada.");
        await Promise.all([loadOverview(), loadRules()]);
      } catch (err) {
        setOpsError(formatApiError(err));
      } finally {
        setActionBusyKey((current) => (current === busyKey ? null : current));
      }
    },
    [loadOverview, loadRules],
  );

  const toggleFunnel = useCallback(
    async (funnel: TelemetryFunnelDefinition) => {
      setOpsError(null);
      setOpsInfo(null);
      const busyKey = `funnel:${funnel.id}`;
      setActionBusyKey(busyKey);
      try {
        await fetchJson<{ item: TelemetryFunnelDefinition }>(`/api/admin/telemetry/funnels/${funnel.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ isActive: !funnel.isActive }),
        });
        setOpsInfo(funnel.isActive ? "Funil desativado." : "Funil ativado.");
        await Promise.all([loadFunnels(), loadFunnelResults()]);
      } catch (err) {
        setOpsError(formatApiError(err));
      } finally {
        setActionBusyKey((current) => (current === busyKey ? null : current));
      }
    },
    [loadFunnelResults, loadFunnels],
  );

  const createRule = useCallback(async () => {
    setCreateRuleError(null);
    setOpsError(null);
    setOpsInfo(null);

    const threshold = Number(ruleDraft.threshold);
    const windowMinutes = Number(ruleDraft.windowMinutes);
    const cooldownMinutes = Number(ruleDraft.cooldownMinutes);
    if (!ruleDraft.name.trim()) {
      setCreateRuleError("Nome da regra é obrigatório.");
      return;
    }
    if (!Number.isFinite(threshold) || threshold < 0) {
      setCreateRuleError("Threshold inválido.");
      return;
    }
    if (!Number.isFinite(windowMinutes) || windowMinutes < 5) {
      setCreateRuleError("Janela mínima: 5 minutos.");
      return;
    }
    if (!Number.isFinite(cooldownMinutes) || cooldownMinutes < 1) {
      setCreateRuleError("Cooldown mínimo: 1 minuto.");
      return;
    }

    const organizationId =
      ruleDraft.scope === "GLOBAL" ? null : scopedOrgId;

    if (ruleDraft.scope === "ORG" && !organizationId) {
      setCreateRuleError("Para regra de organização, define primeiro o Org ID no filtro.");
      return;
    }

    setCreateRuleBusy(true);
    try {
      await fetchJson<{ item: TelemetryRule }>("/api/admin/telemetry/rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId,
          name: ruleDraft.name.trim(),
          description: ruleDraft.description.trim() || null,
          metricKey: ruleDraft.metricKey,
          comparisonOperator: ruleDraft.comparisonOperator,
          threshold: Math.floor(threshold),
          windowMinutes: Math.floor(windowMinutes),
          cooldownMinutes: Math.floor(cooldownMinutes),
          severity: ruleDraft.severity,
          dimensionKey: ruleDraft.dimensionKey.trim() || null,
          dimensionValue: ruleDraft.dimensionValue.trim() || null,
          isActive: true,
        }),
      });
      setRuleDraft((prev) => ({ ...DEFAULT_RULE_DRAFT, scope: prev.scope }));
      setOpsInfo("Regra criada com sucesso.");
      await Promise.all([loadOverview(), loadRules()]);
    } catch (err) {
      setCreateRuleError(formatApiError(err));
    } finally {
      setCreateRuleBusy(false);
    }
  }, [loadOverview, loadRules, ruleDraft, scopedOrgId]);

  const summaryText = useMemo(() => {
    if (!overview) return "Sem dados";
    return `${overview.totals.totalEvents} eventos nas últimas ${overview.window.hours}h`;
  }, [overview]);

  const openIncidentsCount = useMemo(
    () => incidents.filter((item) => item.status !== "RESOLVED").length,
    [incidents],
  );
  const activeRulesCount = useMemo(
    () => rules.filter((item) => item.isActive).length,
    [rules],
  );
  const activeFunnelsCount = useMemo(
    () => funnels.filter((item) => item.isActive).length,
    [funnels],
  );
  const funnelsById = useMemo(() => {
    const map = new Map<string, TelemetryFunnelDefinition>();
    for (const item of funnels) map.set(item.id, item);
    return map;
  }, [funnels]);

  return (
    <AdminLayout
      title="Telemetria"
      subtitle="Observabilidade nativa ORYA: eventos, alertas, incidentes e operações em tempo real."
    >
      <section className="space-y-6">
        <AdminPageHeader
          title="Telemetria"
          subtitle="Controlo operacional total: ingestão, análise, regras e incidentes sem providers externos."
          eyebrow="Admin • Observabilidade"
        />

        <div className="admin-card p-4">
          <div className="grid gap-3 md:grid-cols-7">
            <label className="md:col-span-1">
              <span className="text-[11px] uppercase tracking-[0.2em] text-white/50">Janela</span>
              <select
                className="admin-select mt-2"
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
              >
                <option value={24}>24h</option>
                <option value={72}>72h</option>
                <option value={168}>7 dias</option>
                <option value={336}>14 dias</option>
              </select>
            </label>

            <label className="md:col-span-1">
              <span className="text-[11px] uppercase tracking-[0.2em] text-white/50">Org ID</span>
              <input
                className="admin-input mt-2"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                placeholder="(opcional)"
              />
            </label>

            <label className="md:col-span-2">
              <span className="text-[11px] uppercase tracking-[0.2em] text-white/50">Pesquisa</span>
              <input
                className="admin-input mt-2"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="eventName, correlationId, actorKey..."
              />
            </label>

            <label className="md:col-span-1">
              <span className="text-[11px] uppercase tracking-[0.2em] text-white/50">Source</span>
              <select
                className="admin-select mt-2"
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="WEB">WEB</option>
                <option value="MOBILE">MOBILE</option>
                <option value="API">API</option>
                <option value="WORKER">WORKER</option>
                <option value="CRON">CRON</option>
                <option value="INTERNAL">INTERNAL</option>
              </select>
            </label>

            <label className="md:col-span-1">
              <span className="text-[11px] uppercase tracking-[0.2em] text-white/50">Severidade</span>
              <select
                className="admin-select mt-2"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
              >
                <option value="">Todas</option>
                <option value="INFO">INFO</option>
                <option value="WARN">WARN</option>
                <option value="ERROR">ERROR</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </label>

            <label className="md:col-span-1">
              <span className="text-[11px] uppercase tracking-[0.2em] text-white/50">Estados incidentes</span>
              <select
                className="admin-select mt-2"
                value={incidentStatuses}
                onChange={(e) => setIncidentStatuses(e.target.value)}
              >
                <option value="OPEN,ACKNOWLEDGED">Abertos + Reconhecidos</option>
                <option value="OPEN">Abertos</option>
                <option value="ACKNOWLEDGED">Reconhecidos</option>
                <option value="RESOLVED">Resolvidos</option>
                <option value="ALL">Todos</option>
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button className="admin-button" onClick={() => void reloadAll()}>
              Aplicar filtros
            </button>
            <button
              className="admin-button-secondary"
              onClick={() => void runEvaluate()}
              disabled={evaluateBusy}
            >
              {evaluateBusy ? "A avaliar..." : "Avaliar alertas"}
            </button>
            <button
              className="admin-button-secondary"
              onClick={() => void runRecompute()}
              disabled={recomputeBusy}
            >
              {recomputeBusy ? "A recomputar..." : "Recompute + avaliar"}
            </button>
            <select
              className="admin-select h-9 min-w-[180px]"
              value={exportDataset}
              onChange={(event) => setExportDataset(event.target.value as TelemetryExportDataset)}
            >
              <option value="events">Exportar: eventos</option>
              <option value="incidents">Exportar: incidentes</option>
              <option value="rules">Exportar: regras</option>
              <option value="funnels">Exportar: funis</option>
              <option value="funnel_results">Exportar: resultados de funil</option>
            </select>
            <select
              className="admin-select h-9 min-w-[120px]"
              value={exportFormat}
              onChange={(event) => setExportFormat(event.target.value as TelemetryExportFormat)}
            >
              <option value="csv">CSV</option>
              <option value="pdf">PDF</option>
            </select>
            <button
              className="admin-button-secondary"
              onClick={() => void runPreviewExport()}
              disabled={exportPreviewBusy}
            >
              {exportPreviewBusy ? "A gerar preview..." : "Pré-visualizar"}
            </button>
            <button className="admin-button-secondary" onClick={() => void runExportCsv()}>
              {exportFormat === "pdf" ? "Exportar PDF" : "Exportar CSV"}
            </button>
            <p className="text-xs text-white/60">{summaryText}</p>
          </div>

          {(lastEvaluation || lastRecompute) && (
            <div className="mt-3 rounded-xl border border-white/15 bg-black/20 p-3 text-xs text-white/70">
              {lastEvaluation ? (
                <p>
                  Última avaliação: {lastEvaluation.evaluatedRules} regras, {lastEvaluation.openedIncidents} incidentes abertos, {" "}
                  {lastEvaluation.resolvedIncidents} resolvidos.
                </p>
              ) : null}
              {lastRecompute ? (
                <div className="mt-1 space-y-1">
                  <p>
                    Último recompute: {lastRecompute.rollup.written} linhas escritas ({lastRecompute.rollup.bucketUnit}).
                  </p>
                  {lastRecompute.funnels ? (
                    <p>
                      Funis: {lastRecompute.funnels.rowsWritten} linhas ({lastRecompute.funnels.funnels} funis).
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {error && (
          <div className="admin-card p-4 text-sm text-rose-200">
            Erro ao carregar telemetria: {error}
          </div>
        )}

        {opsError && (
          <div className="admin-card border border-rose-500/40 p-4 text-sm text-rose-200">
            {opsError}
          </div>
        )}

        {opsInfo && (
          <div className="admin-card border border-emerald-500/40 p-4 text-sm text-emerald-100">
            {opsInfo}
          </div>
        )}

        {exportPreview && (
          <div className="admin-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">
                Pré-visualização exportação ({exportPreview.dataset})
              </p>
              <p className="text-xs text-white/60">
                {exportPreview.rowCount} linhas carregadas
                {exportPreview.truncated ? ` · amostra ${exportPreview.sampleSize}` : ""}
              </p>
            </div>
            <div className="mt-3 overflow-auto rounded-xl border border-white/10">
              <table className="min-w-full text-xs">
                <thead className="bg-white/5 text-left uppercase tracking-[0.12em] text-white/55">
                  <tr>
                    {exportPreview.headers.map((header) => (
                      <th key={`preview-head-${header}`} className="px-2 py-2">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {exportPreview.rows.map((row, rowIndex) => (
                    <tr key={`preview-row-${rowIndex}`} className="bg-black/15">
                      {exportPreview.headers.map((header, colIndex) => (
                        <td key={`preview-cell-${rowIndex}-${header}`} className="max-w-[280px] truncate px-2 py-1.5 text-white/80">
                          {row[colIndex] || "-"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-7">
          <div className="admin-card p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">Eventos</p>
            <p className="mt-2 text-2xl font-semibold text-white">{overview?.totals.totalEvents ?? "-"}</p>
          </div>
          <div className="admin-card p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">Erros</p>
            <p className="mt-2 text-2xl font-semibold text-white">{overview?.totals.errorEvents ?? "-"}</p>
          </div>
          <div className="admin-card p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">Taxa de erro</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {overview ? formatBpsToPct(overview.totals.errorRateBps) : "-"}
            </p>
          </div>
          <div className="admin-card p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">Actores únicos</p>
            <p className="mt-2 text-2xl font-semibold text-white">{overview?.totals.uniqueActors ?? "-"}</p>
          </div>
          <div className="admin-card p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">Incidentes activos</p>
            <p className="mt-2 text-2xl font-semibold text-white">{openIncidentsCount}</p>
          </div>
          <div className="admin-card p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">Regras activas</p>
            <p className="mt-2 text-2xl font-semibold text-white">{activeRulesCount}</p>
          </div>
          <div className="admin-card p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">Funis activos</p>
            <p className="mt-2 text-2xl font-semibold text-white">{activeFunnelsCount}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="admin-card p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">MTTA</p>
            <p className="mt-2 text-2xl font-semibold text-white">{formatDurationMinutes(incidentKpis?.mttaMinutes ?? null)}</p>
            <p className="mt-1 text-[11px] text-white/55">
              {incidentKpis ? `${incidentKpis.acknowledgedSamples} amostras` : "Sem dados"}
            </p>
          </div>
          <div className="admin-card p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">MTTR</p>
            <p className="mt-2 text-2xl font-semibold text-white">{formatDurationMinutes(incidentKpis?.mttrMinutes ?? null)}</p>
            <p className="mt-1 text-[11px] text-white/55">
              {incidentKpis ? `${incidentKpis.resolvedSamples} amostras` : "Sem dados"}
            </p>
          </div>
          <div className="admin-card p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">
              Breaches ACK ({incidentKpis?.ackSlaMinutes ?? 15}m)
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">{incidentKpis?.ackSlaBreaches ?? "-"}</p>
            <p className="mt-1 text-[11px] text-white/55">
              {incidentKpis ? `${incidentKpis.acknowledgedIncidents} reconhecidos` : "Sem dados"}
            </p>
          </div>
          <div className="admin-card p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">
              Breaches Resolve ({incidentKpis?.resolveSlaMinutes ?? 120}m)
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">{incidentKpis?.resolveSlaBreaches ?? "-"}</p>
            <p className="mt-1 text-[11px] text-white/55">
              {incidentKpis ? `${incidentKpis.resolvedIncidents} resolvidos` : "Sem dados"}
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="admin-card p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Top eventos</p>
            <div className="mt-3 space-y-2 text-sm text-white/80">
              {(overview?.topEvents ?? []).slice(0, 10).map((item) => (
                <div key={item.eventName} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                  <span className="truncate pr-3">{item.eventName}</span>
                  <strong>{item.count}</strong>
                </div>
              ))}
              {!overview?.topEvents?.length && (
                <p className="text-white/60">Sem dados para o período selecionado.</p>
              )}
            </div>
          </div>

          <div className="admin-card p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Distribuição por source</p>
            <div className="mt-3 space-y-2 text-sm text-white/80">
              {(overview?.sourceBreakdown ?? []).map((item) => (
                <div key={item.sourceType} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                  <span>{item.sourceType}</span>
                  <strong>{item.count}</strong>
                </div>
              ))}
              {!overview?.sourceBreakdown?.length && (
                <p className="text-white/60">Sem dados para o período selecionado.</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="admin-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Incidentes</p>
              {loadingIncidents && <p className="text-xs text-white/50">A carregar...</p>}
            </div>

            <div className="mt-3 space-y-2">
              {incidents.map((incident) => {
                const ackBusy = actionBusyKey === `incident:${incident.id}:ACK`;
                const resolveBusy = actionBusyKey === `incident:${incident.id}:RESOLVE`;
                const canAck = incident.status === "OPEN";
                const canResolve = incident.status !== "RESOLVED";
                return (
                  <div key={incident.id} className="rounded-xl border border-white/12 bg-white/[0.03] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{incident.title}</p>
                      <span className="rounded-md border border-white/15 bg-white/[0.06] px-2 py-1 text-[11px] text-white/70">
                        {incidentStatusLabel(incident.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-white/65">
                      {metricLabel(incident.metricKey)} · {incident.observedValue ?? 0} / {incident.thresholdValue ?? 0}
                    </p>
                    <p className="mt-1 text-[11px] text-white/55">{formatDateTime(incident.triggeredAt)}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {canAck ? (
                        <button
                          className="admin-button-secondary px-2 py-1 text-[11px]"
                          onClick={() => void applyIncidentAction(incident.id, "ACK")}
                          disabled={ackBusy || Boolean(actionBusyKey)}
                        >
                          {ackBusy ? "A processar..." : "Reconhecer"}
                        </button>
                      ) : null}
                      {canResolve ? (
                        <button
                          className="admin-button px-2 py-1 text-[11px]"
                          onClick={() => void applyIncidentAction(incident.id, "RESOLVE")}
                          disabled={resolveBusy || Boolean(actionBusyKey)}
                        >
                          {resolveBusy ? "A processar..." : "Resolver"}
                        </button>
                      ) : null}
                      <span className="text-[11px] text-white/55">
                        {incident.organizationId ? `Org #${incident.organizationId}` : "Global"}
                      </span>
                    </div>
                  </div>
                );
              })}
              {!incidents.length && !loadingIncidents && (
                <p className="rounded-xl border border-white/10 bg-black/20 px-3 py-4 text-sm text-white/65">
                  Sem incidentes com os filtros atuais.
                </p>
              )}
            </div>
          </div>

          <div className="admin-card p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Regras</p>
            <p className="mt-1 text-xs text-white/60">Cria e gere regras de alerta por organização ou globais.</p>

            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <label>
                <span className="text-[11px] uppercase tracking-[0.14em] text-white/45">Âmbito</span>
                <select
                  className="admin-select mt-1"
                  value={ruleDraft.scope}
                  onChange={(e) =>
                    setRuleDraft((prev) => ({ ...prev, scope: e.target.value as RuleDraft["scope"] }))
                  }
                >
                  <option value="ORG">Organização (Org ID do filtro)</option>
                  <option value="GLOBAL">Global</option>
                </select>
              </label>

              <label>
                <span className="text-[11px] uppercase tracking-[0.14em] text-white/45">Nome</span>
                <input
                  className="admin-input mt-1"
                  value={ruleDraft.name}
                  onChange={(e) => setRuleDraft((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="ex: Erros API críticos"
                />
              </label>

              <label>
                <span className="text-[11px] uppercase tracking-[0.14em] text-white/45">Métrica</span>
                <select
                  className="admin-select mt-1"
                  value={ruleDraft.metricKey}
                  onChange={(e) =>
                    setRuleDraft((prev) => ({ ...prev, metricKey: e.target.value as RuleDraft["metricKey"] }))
                  }
                >
                  <option value="ERROR_COUNT">ERROR_COUNT</option>
                  <option value="EVENT_COUNT">EVENT_COUNT</option>
                  <option value="UNIQUE_ACTORS">UNIQUE_ACTORS</option>
                </select>
              </label>

              <label>
                <span className="text-[11px] uppercase tracking-[0.14em] text-white/45">Operador</span>
                <select
                  className="admin-select mt-1"
                  value={ruleDraft.comparisonOperator}
                  onChange={(e) =>
                    setRuleDraft((prev) => ({
                      ...prev,
                      comparisonOperator: e.target.value as RuleDraft["comparisonOperator"],
                    }))
                  }
                >
                  <option value="GTE">GTE</option>
                  <option value="GT">GT</option>
                  <option value="LTE">LTE</option>
                  <option value="LT">LT</option>
                  <option value="EQ">EQ</option>
                  <option value="NEQ">NEQ</option>
                </select>
              </label>

              <label>
                <span className="text-[11px] uppercase tracking-[0.14em] text-white/45">Threshold</span>
                <input
                  className="admin-input mt-1"
                  value={ruleDraft.threshold}
                  onChange={(e) => setRuleDraft((prev) => ({ ...prev, threshold: e.target.value }))}
                  inputMode="numeric"
                />
              </label>

              <label>
                <span className="text-[11px] uppercase tracking-[0.14em] text-white/45">Janela (min)</span>
                <input
                  className="admin-input mt-1"
                  value={ruleDraft.windowMinutes}
                  onChange={(e) => setRuleDraft((prev) => ({ ...prev, windowMinutes: e.target.value }))}
                  inputMode="numeric"
                />
              </label>

              <label>
                <span className="text-[11px] uppercase tracking-[0.14em] text-white/45">Cooldown (min)</span>
                <input
                  className="admin-input mt-1"
                  value={ruleDraft.cooldownMinutes}
                  onChange={(e) => setRuleDraft((prev) => ({ ...prev, cooldownMinutes: e.target.value }))}
                  inputMode="numeric"
                />
              </label>

              <label>
                <span className="text-[11px] uppercase tracking-[0.14em] text-white/45">Severidade</span>
                <select
                  className="admin-select mt-1"
                  value={ruleDraft.severity}
                  onChange={(e) =>
                    setRuleDraft((prev) => ({ ...prev, severity: e.target.value as RuleDraft["severity"] }))
                  }
                >
                  <option value="WARN">WARN</option>
                  <option value="ERROR">ERROR</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </label>

              <label>
                <span className="text-[11px] uppercase tracking-[0.14em] text-white/45">Dimension key</span>
                <select
                  className="admin-select mt-1"
                  value={ruleDraft.dimensionKey}
                  onChange={(e) => setRuleDraft((prev) => ({ ...prev, dimensionKey: e.target.value }))}
                >
                  <option value="">(sem dimensão)</option>
                  <option value="GLOBAL">GLOBAL</option>
                  <option value="EVENT_NAME">EVENT_NAME</option>
                  <option value="SOURCE_TYPE">SOURCE_TYPE</option>
                  <option value="ACTOR_TYPE">ACTOR_TYPE</option>
                </select>
              </label>

              <label>
                <span className="text-[11px] uppercase tracking-[0.14em] text-white/45">Dimension value</span>
                <input
                  className="admin-input mt-1"
                  value={ruleDraft.dimensionValue}
                  onChange={(e) => setRuleDraft((prev) => ({ ...prev, dimensionValue: e.target.value }))}
                  placeholder="opcional"
                />
              </label>
            </div>

            <label className="mt-2 block">
              <span className="text-[11px] uppercase tracking-[0.14em] text-white/45">Descrição</span>
              <textarea
                className="admin-input mt-1 min-h-20"
                value={ruleDraft.description}
                onChange={(e) => setRuleDraft((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Contexto da regra para operação"
              />
            </label>

            {createRuleError && <p className="mt-2 text-xs text-rose-200">{createRuleError}</p>}

            <div className="mt-3">
              <button className="admin-button" onClick={() => void createRule()} disabled={createRuleBusy}>
                {createRuleBusy ? "A criar..." : "Criar regra"}
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {rules.map((rule) => {
                const busy = actionBusyKey === `rule:${rule.id}`;
                return (
                  <div key={rule.id} className="rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{rule.name}</p>
                      <span className="text-[11px] text-white/55">
                        {rule.organizationId ? `Org #${rule.organizationId}` : "Global"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-white/65">
                      {metricLabel(rule.metricKey)} · {rule.comparisonOperator} {rule.threshold} · janela {rule.windowMinutes}m
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        className="admin-button-secondary px-2 py-1 text-[11px]"
                        onClick={() => void toggleRule(rule)}
                        disabled={busy || Boolean(actionBusyKey)}
                      >
                        {busy ? "A atualizar..." : rule.isActive ? "Desativar" : "Ativar"}
                      </button>
                      <span className="text-[11px] text-white/55">
                        {rule.isActive ? "Ativa" : "Inativa"} · {rule.severity}
                      </span>
                    </div>
                  </div>
                );
              })}
              {!rules.length && !loadingRules && (
                <p className="rounded-xl border border-white/10 bg-black/20 px-3 py-4 text-sm text-white/65">
                  Sem regras para os filtros atuais.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="admin-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Funis</p>
              {loadingFunnels && <p className="text-xs text-white/50">A carregar...</p>}
            </div>
            <p className="mt-1 text-xs text-white/60">
              Definições de funis para análise de conversão por organização/global.
            </p>

            <div className="mt-3 space-y-2">
              {funnels.map((funnel) => {
                const busy = actionBusyKey === `funnel:${funnel.id}`;
                return (
                  <div key={funnel.id} className="rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{funnel.name}</p>
                      <span className="text-[11px] text-white/55">
                        {funnel.organizationId ? `Org #${funnel.organizationId}` : "Global"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-white/65">
                      {funnel.steps.map((step) => step.key).slice(0, 4).join(" → ")}
                      {funnel.steps.length > 4 ? " → ..." : ""} · {funnel.steps.length} passos
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        className="admin-button-secondary px-2 py-1 text-[11px]"
                        onClick={() => void toggleFunnel(funnel)}
                        disabled={busy || Boolean(actionBusyKey)}
                      >
                        {busy ? "A atualizar..." : funnel.isActive ? "Desativar" : "Ativar"}
                      </button>
                      <span className="text-[11px] text-white/55">
                        {funnel.isActive ? "Ativo" : "Inativo"} · atualizado {formatDateTime(funnel.updatedAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
              {!funnels.length && !loadingFunnels && (
                <p className="rounded-xl border border-white/10 bg-black/20 px-3 py-4 text-sm text-white/65">
                  Sem funis para os filtros atuais.
                </p>
              )}
            </div>
          </div>

          <div className="admin-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Resultados de funil</p>
              {loadingFunnelResults && <p className="text-xs text-white/50">A carregar...</p>}
            </div>
            <p className="mt-1 text-xs text-white/60">
              Conversão por passo e bucket horário para monitorização operacional.
            </p>

            <div className="mt-3 space-y-2">
              {funnelResults.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">
                      {funnelsById.get(item.funnelId)?.name ?? item.funnelId}
                    </p>
                    <span className="text-[11px] text-white/55">{formatDateTime(item.bucketStart)}</span>
                  </div>
                  <p className="mt-1 text-xs text-white/65">
                    Passo {item.stepKey} · entraram {item.enteredCount} · converteram {item.convertedCount} · taxa{" "}
                    {formatBpsToPct(item.conversionRateBps)}
                  </p>
                </div>
              ))}
              {!funnelResults.length && !loadingFunnelResults && (
                <p className="rounded-xl border border-white/10 bg-black/20 px-3 py-4 text-sm text-white/65">
                  Sem resultados de funil para os filtros atuais.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="admin-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Eventos recentes</p>
            {loadingEvents && <p className="text-xs text-white/50">A carregar...</p>}
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-white/85">
              <thead className="text-[11px] uppercase tracking-[0.14em] text-white/45">
                <tr>
                  <th className="px-2 py-2">Data</th>
                  <th className="px-2 py-2">Evento</th>
                  <th className="px-2 py-2">Source</th>
                  <th className="px-2 py-2">Sev</th>
                  <th className="px-2 py-2">Org</th>
                  <th className="px-2 py-2">Actor</th>
                  <th className="px-2 py-2">Correlation</th>
                </tr>
              </thead>
              <tbody>
                {events.map((item) => (
                  <tr key={item.id} className="border-t border-white/10">
                    <td className="px-2 py-2 whitespace-nowrap">{formatDateTime(item.occurredAt)}</td>
                    <td className="px-2 py-2">{item.eventName}</td>
                    <td className="px-2 py-2">{item.sourceType}</td>
                    <td className="px-2 py-2">{item.severity}</td>
                    <td className="px-2 py-2">
                      {item.organization?.publicName ||
                        (typeof item.organizationId === "number" ? `#${item.organizationId}` : "Global")}
                    </td>
                    <td className="px-2 py-2">{item.actor?.name || item.actor?.email || item.actorType}</td>
                    <td className="px-2 py-2 max-w-[180px] truncate">{item.correlationId || "-"}</td>
                  </tr>
                ))}
                {!events.length && !loadingEvents && (
                  <tr>
                    <td colSpan={7} className="px-2 py-6 text-center text-white/60">
                      Sem eventos com os filtros atuais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-center">
            {hasMore ? (
              <button
                className="admin-button-secondary"
                onClick={() => void loadEvents({ cursor: nextCursor })}
                disabled={loadingEvents}
              >
                Carregar mais
              </button>
            ) : (
              <p className="text-xs text-white/50">Fim da lista</p>
            )}
          </div>
        </div>

        {(loadingOverview ||
          loadingEvents ||
          loadingIncidents ||
          loadingRules ||
          loadingFunnels ||
          loadingFunnelResults) && (
          <p className="text-xs text-white/50">Atualização em curso...</p>
        )}
      </section>
    </AdminLayout>
  );
}
