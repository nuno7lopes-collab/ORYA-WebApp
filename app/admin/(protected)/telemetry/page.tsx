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

function unwrapPayload<T>(input: unknown): T {
  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;
    if (record.data && typeof record.data === "object") return record.data as T;
    if (record.result && typeof record.result === "object") return record.result as T;
  }
  return input as T;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => null);
  const payload = unwrapPayload<T>(json);
  if (!res.ok) {
    const errorCode =
      (json && typeof json === "object" && (json as Record<string, unknown>).error) ||
      `HTTP_${res.status}`;
    throw new Error(String(errorCode));
  }
  return payload;
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

export default function AdminTelemetryPage() {
  const [hours, setHours] = useState(24);
  const [orgId, setOrgId] = useState("");
  const [query, setQuery] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [severity, setSeverity] = useState("");

  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [events, setEvents] = useState<EventsPayload["items"]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildBaseParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set("hours", String(hours));
    if (orgId.trim()) params.set("orgId", orgId.trim());
    return params;
  }, [hours, orgId]);

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

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const params = buildBaseParams();
      const payload = await fetchJson<{
        overview: OverviewPayload;
      }>(`/api/admin/telemetry/overview?${params.toString()}`);
      setOverview(payload.overview);
    } finally {
      setLoadingOverview(false);
    }
  }, [buildBaseParams]);

  const loadEvents = useCallback(
    async (opts?: { reset?: boolean; cursor?: string | null }) => {
      setLoadingEvents(true);
      try {
        const params = buildEventsParams(opts?.cursor ?? null);
        const payload = await fetchJson<EventsPayload>(
          `/api/admin/telemetry/events?${params.toString()}`,
        );
        setEvents((prev) => (opts?.reset ? payload.items : [...prev, ...payload.items]));
        setHasMore(Boolean(payload.pagination.hasMore));
        setNextCursor(payload.pagination.nextCursor ?? null);
      } finally {
        setLoadingEvents(false);
      }
    },
    [buildEventsParams],
  );

  const reloadAll = useCallback(async () => {
    setError(null);
    try {
      await Promise.all([loadOverview(), loadEvents({ reset: true })]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "INTERNAL_ERROR");
    }
  }, [loadEvents, loadOverview]);

  useEffect(() => {
    void reloadAll();
  }, [reloadAll]);

  const summaryText = useMemo(() => {
    if (!overview) return "Sem dados";
    return `${overview.totals.totalEvents} eventos nas últimas ${overview.window.hours}h`;
  }, [overview]);

  return (
    <AdminLayout
      title="Telemetria"
      subtitle="Observabilidade nativa ORYA: eventos, erros, fontes e sinais operacionais."
    >
      <section className="space-y-6">
        <AdminPageHeader
          title="Telemetria"
          subtitle="Visibilidade central da plataforma sem providers externos."
          eyebrow="Admin • Observabilidade"
        />

        <div className="admin-card p-4">
          <div className="grid gap-3 md:grid-cols-6">
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
                placeholder="eventName, correlationId, actorKey…"
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
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button className="admin-button" onClick={() => void reloadAll()}>
              Aplicar filtros
            </button>
            <p className="text-xs text-white/60">{summaryText}</p>
          </div>
        </div>

        {error && (
          <div className="admin-card p-4 text-sm text-rose-200">
            Erro ao carregar telemetria: {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <div className="admin-card p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">Eventos</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {overview?.totals.totalEvents ?? "-"}
            </p>
          </div>
          <div className="admin-card p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">Erros</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {overview?.totals.errorEvents ?? "-"}
            </p>
          </div>
          <div className="admin-card p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">Taxa de erro</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {overview ? formatBpsToPct(overview.totals.errorRateBps) : "-"}
            </p>
          </div>
          <div className="admin-card p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">Actores únicos</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {overview?.totals.uniqueActors ?? "-"}
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

        <div className="admin-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Eventos recentes</p>
            {loadingEvents && <p className="text-xs text-white/50">A carregar…</p>}
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
                      Sem eventos com os filtros actuais.
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

        {(loadingOverview || loadingEvents) && (
          <p className="text-xs text-white/50">Atualização em curso…</p>
        )}
      </section>
    </AdminLayout>
  );
}
