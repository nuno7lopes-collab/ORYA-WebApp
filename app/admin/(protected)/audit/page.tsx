"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/app/admin/components/AdminLayout";
import { AdminPageHeader } from "@/app/admin/components/AdminPageHeader";

type AuditItem = {
  id: string;
  eventType: string;
  eventVersion: string;
  createdAt: string;
  actorUserId: string | null;
  actor: { id: string; name: string | null; email: string | null } | null;
  correlationId: string | null;
  sourceType: string | null;
  sourceId: string | null;
  subjectType: string;
  subjectId: string;
  idempotencyKey: string;
  payload: unknown;
  organization: { id: number; publicName: string | null } | null;
};

type AuditResponse =
  | {
      ok: true;
      items: AuditItem[];
      pagination: { nextCursor: string | null; hasMore: boolean };
    }
  | { ok: false; error?: string };

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function clampPayload(payload: unknown) {
  try {
    const text = JSON.stringify(payload, null, 2);
    if (text.length <= 2400) return text;
    return `${text.slice(0, 2400)}\n…`;
  } catch {
    return String(payload);
  }
}

export default function AdminAuditPage() {
  const [query, setQuery] = useState("");
  const [eventType, setEventType] = useState("");
  const [actor, setActor] = useState("");
  const [orgId, setOrgId] = useState("");
  const [scope, setScope] = useState<"admin" | "all">("admin");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [items, setItems] = useState<AuditItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const currentFilters = useMemo(
    () => ({
      query,
      eventType,
      actor,
      orgId,
      scope,
      fromDate,
      toDate,
    }),
    [query, eventType, actor, orgId, scope, fromDate, toDate],
  );

  const buildParams = (filters: typeof currentFilters, cursorOverride?: string | null) => {
    const sp = new URLSearchParams();
    if (filters.query.trim()) sp.set("q", filters.query.trim());
    if (filters.eventType.trim()) sp.set("type", filters.eventType.trim());
    if (filters.actor.trim()) sp.set("actor", filters.actor.trim());
    if (filters.orgId.trim()) sp.set("orgId", filters.orgId.trim());
    if (filters.scope !== "admin") sp.set("scope", filters.scope);
    if (filters.fromDate) sp.set("from", filters.fromDate);
    if (filters.toDate) sp.set("to", filters.toDate);
    if (cursorOverride) sp.set("cursor", cursorOverride);
    return sp.toString();
  };

  const loadAudit = async (opts?: {
    reset?: boolean;
    cursor?: string | null;
    filters?: Partial<typeof currentFilters>;
  }) => {
    try {
      setLoading(true);
      setErrorMsg(null);
      if (opts?.reset) {
        setItems([]);
      }

      const filters = { ...currentFilters, ...(opts?.filters ?? {}) };
      const qs = buildParams(filters, opts?.cursor ?? null);
      const res = await fetch(`/api/admin/audit/list${qs ? `?${qs}` : ""}`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as AuditResponse | null;

      if (!res.ok || !json || !("ok" in json) || !json.ok) {
        setErrorMsg("Não foi possível carregar a auditoria.");
        return;
      }

      setItems((prev) => (opts?.reset ? json.items : [...prev, ...json.items]));
      setCursor(json.pagination?.nextCursor ?? null);
      setHasMore(Boolean(json.pagination?.hasMore));
      setInitialized(true);
    } catch (err) {
      console.error("admin.audit.load_failed", err);
      setErrorMsg("Erro inesperado ao carregar.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAudit({ reset: true });
  }, []);

  const handleApply = () => {
    setCursor(null);
    setHasMore(false);
    loadAudit({ reset: true });
  };

  const handleClear = () => {
    const cleared = {
      query: "",
      eventType: "",
      actor: "",
      orgId: "",
      scope: "admin" as const,
      fromDate: "",
      toDate: "",
    };
    setQuery(cleared.query);
    setEventType(cleared.eventType);
    setActor(cleared.actor);
    setOrgId(cleared.orgId);
    setScope(cleared.scope);
    setFromDate(cleared.fromDate);
    setToDate(cleared.toDate);
    setCursor(null);
    setHasMore(false);
    loadAudit({ reset: true, filters: cleared });
  };

  const summary = useMemo(() => {
    if (!initialized) return "A preparar auditoria…";
    if (items.length === 0) return "Sem eventos para o filtro atual.";
    return `${items.length} eventos carregados`;
  }, [initialized, items.length]);

  return (
    <AdminLayout
      title="Auditoria"
      subtitle="Eventos administrativos, ações críticas e rastreio de segurança."
    >
      <section className="space-y-6">
        <AdminPageHeader
          title="Auditoria"
          subtitle="Consulta operações administrativas e rastreia ações críticas da plataforma."
          eyebrow="Admin • Auditoria"
        />

        <div className="admin-card p-4">
          <div className="grid gap-3 md:grid-cols-6">
            <div className="md:col-span-2">
              <label className="text-[11px] uppercase tracking-[0.2em] text-white/50">Pesquisa</label>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="eventType, correlationId, id…"
                className="admin-input mt-2"
              />
            </div>
            <div className="md:col-span-1">
              <label className="text-[11px] uppercase tracking-[0.2em] text-white/50">Tipo</label>
              <input
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                placeholder="ADMIN_*"
                className="admin-input mt-2"
              />
            </div>
            <div className="md:col-span-1">
              <label className="text-[11px] uppercase tracking-[0.2em] text-white/50">Actor</label>
              <input
                value={actor}
                onChange={(e) => setActor(e.target.value)}
                placeholder="email / username / id"
                className="admin-input mt-2"
              />
            </div>
            <div className="md:col-span-1">
              <label className="text-[11px] uppercase tracking-[0.2em] text-white/50">Org ID</label>
              <input
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                placeholder="123"
                className="admin-input mt-2"
              />
            </div>
            <div className="md:col-span-1">
              <label className="text-[11px] uppercase tracking-[0.2em] text-white/50">Scope</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as "admin" | "all")}
                className="admin-select mt-2"
              >
                <option value="admin">Admin only</option>
                <option value="all">Todos</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-[11px] uppercase tracking-[0.2em] text-white/50">De</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="admin-input mt-2"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[11px] uppercase tracking-[0.2em] text-white/50">Até</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="admin-input mt-2"
              />
            </div>
            <div className="md:col-span-2 flex items-end gap-2">
              <button className="admin-button" onClick={handleApply} disabled={loading}>
                Aplicar
              </button>
              <button className="admin-button-secondary" onClick={handleClear} disabled={loading}>
                Limpar
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-white/60">{summary}</p>
          {loading && <p className="text-xs text-white/50">A carregar…</p>}
        </div>

        {errorMsg && <div className="admin-card p-4 text-sm text-rose-200">{errorMsg}</div>}

        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="admin-card p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/50">Evento</p>
                  <p className="text-sm font-semibold text-white/90">{item.eventType}</p>
                  <p className="text-[11px] text-white/60">ID: {item.id}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Data</p>
                  <p className="text-sm text-white/80">{formatDate(item.createdAt)}</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="admin-card-soft p-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">Actor</p>
                  <p className="text-sm text-white/85">
                    {item.actor?.name || item.actor?.email || item.actorUserId || "Sistema"}
                  </p>
                  {item.actor?.email && <p className="text-[11px] text-white/60">{item.actor.email}</p>}
                </div>
                <div className="admin-card-soft p-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">Organização</p>
                  <p className="text-sm text-white/85">
                    {item.organization?.publicName || "Global"}
                  </p>
                  {item.organization && (
                    <p className="text-[11px] text-white/60">ID: {item.organization.id}</p>
                  )}
                </div>
                <div className="admin-card-soft p-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">Correlation</p>
                  <p className="text-sm text-white/85">{item.correlationId || "-"}</p>
                  <p className="text-[11px] text-white/60">Idempotency: {item.idempotencyKey || "-"}</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="admin-card-soft p-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">Subject</p>
                  <p className="text-sm text-white/85">{item.subjectType}</p>
                  <p className="text-[11px] text-white/60">{item.subjectId}</p>
                </div>
                <div className="admin-card-soft p-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">Source</p>
                  <p className="text-sm text-white/85">{item.sourceType || "-"}</p>
                  <p className="text-[11px] text-white/60">{item.sourceId || "-"}</p>
                </div>
                <div className="admin-card-soft p-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">Version</p>
                  <p className="text-sm text-white/85">{item.eventVersion}</p>
                </div>
              </div>

              <details className="admin-card-soft p-3">
                <summary className="cursor-pointer text-[11px] uppercase tracking-[0.2em] text-white/55">
                  Payload
                </summary>
                <pre className="mt-3 whitespace-pre-wrap text-xs text-white/70 admin-mono">
                  {clampPayload(item.payload)}
                </pre>
              </details>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center">
          {hasMore ? (
            <button
              className="admin-button-secondary"
              onClick={() => loadAudit({ cursor })}
              disabled={loading}
            >
              Carregar mais
            </button>
          ) : initialized ? (
            <p className="text-xs text-white/50">Fim da lista</p>
          ) : null}
        </div>
      </section>
    </AdminLayout>
  );
}
