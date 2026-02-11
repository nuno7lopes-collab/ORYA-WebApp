"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminLayout } from "@/app/admin/components/AdminLayout";
import { AdminPageHeader } from "@/app/admin/components/AdminPageHeader";

type AdminEventItem = {
  id: number;
  title: string;
  slug: string;
  status: string;
  type: string;
  startsAt: string | null;
  organization?: { id: number; publicName: string | null } | null;
  ticketsSold?: number;
  revenueCents?: number;
  revenueTotalCents?: number;
  platformFeeCents?: number;
};

type EventsApiResponse =
  | {
      ok: true;
      items: AdminEventItem[];
      pagination?: { nextCursor: number | null; hasMore: boolean };
    }
  | { ok: false; error?: string };

function formatDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatCurrency(cents?: number | null, currency = "EUR") {
  if (cents == null || Number.isNaN(cents)) return "-";
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function statusClasses(status: string) {
  switch (status) {
    case "PUBLISHED":
      return "bg-emerald-500/10 text-emerald-200 border-emerald-400/40";
    case "DRAFT":
      return "bg-amber-500/10 text-amber-100 border-amber-400/40";
    case "CANCELLED":
      return "bg-red-500/10 text-red-100 border-red-400/40";
    default:
      return "bg-white/5 text-white/80 border-white/20";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "PUBLISHED":
      return "Publicado";
    case "DRAFT":
      return "Rascunho";
    case "CANCELLED":
      return "Cancelado";
    default:
      return status;
  }
}

export default function AdminEventosPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [organizationFilter, setOrganizationFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [events, setEvents] = useState<AdminEventItem[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [purgingIds, setPurgingIds] = useState<Set<number>>(new Set());
  const [statusUpdatingIds, setStatusUpdatingIds] = useState<Set<number>>(new Set());

  async function loadEvents(opts?: {
    search?: string;
    status?: string;
    type?: string;
    organizationId?: string;
    cursor?: number | null;
    reset?: boolean;
  }) {
    try {
      setLoading(true);
      setErrorMsg(null);

      const sp = new URLSearchParams();
      const s = opts?.search ?? search;
      const st = opts?.status ?? statusFilter;
      const ty = opts?.type ?? typeFilter;
      const org = opts?.organizationId ?? organizationFilter;
      const cur = opts?.cursor ?? null;

      if (s.trim()) sp.set("search", s.trim());
      if (st !== "ALL") sp.set("status", st);
      if (ty !== "ALL") sp.set("type", ty);
      if (org.trim()) sp.set("organizationId", org.trim());
      if (cur) sp.set("cursor", String(cur));

      const qs = sp.toString() ? `?${sp.toString()}` : "";
      const res = await fetch(`/api/admin/eventos/list${qs}`, { cache: "no-store" });

      if (res.status === 401 || res.status === 403) {
        setErrorMsg("Não tens permissões para ver esta área (admin only).");
        setEvents([]);
        return;
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("[admin/eventos] erro:", res.status, txt);
        setErrorMsg("Não foi possível carregar os eventos.");
        setEvents([]);
        return;
      }

      const json = (await res.json().catch(() => null)) as EventsApiResponse | null;
      if (!json || !json.ok) {
        setErrorMsg(json?.error || "Resposta inesperada da API.");
        setEvents([]);
        return;
      }

      const merged = opts?.reset ? json.items ?? [] : [...events, ...(json.items ?? [])];
      setEvents(merged);
      setHasMore(json.pagination?.hasMore ?? false);
      setCursor(json.pagination?.nextCursor ?? null);
      setInitialized(true);
    } catch (err) {
      console.error("[admin/eventos] erro inesperado", err);
      setErrorMsg("Erro inesperado ao carregar eventos.");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents({ reset: true });
  }, []);

  async function handlePurgeEvent(ev: AdminEventItem) {
    const confirmed = window.confirm(
      `Isto vai apagar TODOS os dados do evento "${ev.title || "Evento sem título"}" (ID ${ev.id}).\n\nQueres mesmo continuar?`,
    );
    if (!confirmed) return;

    setPurgingIds((prev) => new Set(prev).add(ev.id));
    try {
      const res = await fetch("/api/admin/eventos/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: ev.id }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("[admin/eventos] purge error:", res.status, text);
        setErrorMsg("Não foi possível apagar os dados do evento.");
        return;
      }

      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!json?.ok) {
        setErrorMsg(json?.error || "Resposta inesperada ao apagar o evento.");
        return;
      }

      setEvents((prev) => prev.filter((item) => item.id !== ev.id));
    } catch (err) {
      console.error("[admin/eventos] purge error:", err);
      setErrorMsg("Erro inesperado ao apagar o evento.");
    } finally {
      setPurgingIds((prev) => {
        const next = new Set(prev);
        next.delete(ev.id);
        return next;
      });
    }
  }

  async function handleUpdateEventStatus(ev: AdminEventItem, nextStatus: "DRAFT" | "PUBLISHED" | "CANCELLED") {
    if (ev.status === nextStatus) return;
    const confirmText =
      nextStatus === "CANCELLED"
        ? `Confirmas cancelar o evento "${ev.title || "Evento sem título"}"?`
        : `Confirmas atualizar o estado para ${statusLabel(nextStatus)}?`;
    if (!window.confirm(confirmText)) return;

    setStatusUpdatingIds((prev) => new Set(prev).add(ev.id));
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/eventos/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: ev.id, status: nextStatus }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; event?: { status?: string } }
        | null;
      if (!res.ok || !json?.ok) {
        setErrorMsg(json?.error || "Não foi possível atualizar estado do evento.");
        return;
      }

      setEvents((prev) =>
        prev.map((item) =>
          item.id === ev.id ? { ...item, status: json.event?.status ?? nextStatus } : item,
        ),
      );
    } catch (err) {
      console.error("[admin/eventos] update-status error:", err);
      setErrorMsg("Erro inesperado ao atualizar estado.");
    } finally {
      setStatusUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(ev.id);
        return next;
      });
    }
  }

  const isEmpty = initialized && !loading && events.length === 0 && !errorMsg;

  return (
    <AdminLayout title="Eventos" subtitle="Gestão global de eventos com receita e bilhetes.">
      <section className="space-y-6">
        <AdminPageHeader
          title="Eventos"
          subtitle="Lista de eventos com bilhetes vendidos e receita agregada."
          eyebrow="Admin • Eventos"
        />

        {/* Filtros */}
        <section className="admin-section space-y-4">
          <div className="grid gap-3 text-[11px] md:grid-cols-[1.3fr_1fr_1fr_1fr]">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[rgba(8,12,20,0.6)] px-3 py-2">
              <span className="text-xs uppercase tracking-[0.2em] text-white/50">Pesquisa</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") loadEvents({ search: e.currentTarget.value, reset: true });
                }}
                placeholder="Nome, slug ou organização"
                className="w-full bg-transparent text-xs text-white placeholder:text-white/35 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-white/45">Estado</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  loadEvents({ status: e.target.value, reset: true });
                }}
                className="admin-select"
              >
                <option value="ALL">Todos</option>
                <option value="PUBLISHED">Publicado</option>
                <option value="DRAFT">Rascunho</option>
                <option value="CANCELLED">Cancelado</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-white/45">Tipo</label>
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  loadEvents({ type: e.target.value, reset: true });
                }}
                className="admin-select"
              >
                <option value="ALL">Todos</option>
                <option value="ORGANIZATION_EVENT">Organização</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-white/45">ID organização</label>
              <input
                type="text"
                value={organizationFilter}
                onChange={(e) => setOrganizationFilter(e.target.value)}
                placeholder="ex.: 3"
                className="admin-input"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => loadEvents({ search, organizationId: organizationFilter, reset: true })}
              disabled={loading}
              className="admin-button px-4 py-1.5 text-xs active:scale-95 disabled:opacity-60"
            >
              {loading ? "A carregar..." : "Aplicar filtros"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatusFilter("ALL");
                setTypeFilter("ALL");
                setOrganizationFilter("");
                setEvents([]);
                setCursor(null);
                setHasMore(false);
                loadEvents({ search: "", status: "ALL", type: "ALL", organizationId: "", cursor: null, reset: true });
              }}
              className="admin-button-secondary px-3 py-1.5"
            >
              Limpar
            </button>
          </div>
        </section>

        <section className="admin-section space-y-4">
          {errorMsg && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-100">
              {errorMsg}
            </div>
          )}

          {!errorMsg && isEmpty && (
            <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 px-6 py-8 text-center text-sm text-white/70">
              <p className="font-medium text-white">Sem eventos registados.</p>
              <p className="mt-1 text-xs text-white/70">Quando criarem eventos, aparecem aqui.</p>
            </div>
          )}

          {!errorMsg && !isEmpty && (
            <div className="admin-card overflow-hidden">
              <div className="max-h-[70vh] overflow-auto">
                <table className="admin-table text-left">
                  <thead>
                    <tr>
                      <th className="px-4 py-3">Evento</th>
                      <th className="px-4 py-3">Organização</th>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3">Bilhetes</th>
                      <th className="px-4 py-3">Receita</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((ev) => (
                      <tr key={ev.id} className="text-white/80 hover:bg-white/5">
                        <td className="px-4 py-3 align-middle">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-semibold text-white">{ev.title || "Evento sem título"}</span>
                            {ev.slug && <span className="text-[10px] text-white/45">/eventos/{ev.slug}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle text-white/80">
                          {ev.organization?.publicName ?? "-"} {ev.organization ? `(ID ${ev.organization.id})` : ""}
                        </td>
                        <td className="px-4 py-3 align-middle text-white/80">{formatDate(ev.startsAt)}</td>
                        <td className="px-4 py-3 align-middle text-white/80">{ev.type || "-"}</td>
                        <td className="px-4 py-3 align-middle">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-[2px] text-[10px] font-medium ${statusClasses(
                              ev.status
                            )}`}
                          >
                            {statusLabel(ev.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-middle text-white/80">{ev.ticketsSold ?? 0}</td>
                        <td className="px-4 py-3 align-middle text-white/80">
                          <div className="flex flex-col">
                            <span>Total: {formatCurrency(ev.revenueTotalCents ?? 0)}</span>
                            <span className="text-white/60">Fee: {formatCurrency(ev.platformFeeCents ?? 0)}</span>
                            <span className="text-white/60">Bruto: {formatCurrency(ev.revenueCents ?? 0)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            {ev.slug && (
                              <Link
                                href={`/eventos/${ev.slug}`}
                                className="admin-button-secondary px-3 py-1 text-[10px]"
                              >
                                Ver público
                              </Link>
                            )}
                            {ev.status !== "PUBLISHED" && (
                              <button
                                type="button"
                                onClick={() => handleUpdateEventStatus(ev, "PUBLISHED")}
                                disabled={statusUpdatingIds.has(ev.id)}
                                className="admin-button-secondary px-3 py-1 text-[10px] disabled:opacity-60"
                              >
                                {statusUpdatingIds.has(ev.id) ? "A atualizar..." : "Publicar"}
                              </button>
                            )}
                            {ev.status !== "DRAFT" && (
                              <button
                                type="button"
                                onClick={() => handleUpdateEventStatus(ev, "DRAFT")}
                                disabled={statusUpdatingIds.has(ev.id)}
                                className="admin-button-secondary px-3 py-1 text-[10px] disabled:opacity-60"
                              >
                                {statusUpdatingIds.has(ev.id) ? "A atualizar..." : "Rascunho"}
                              </button>
                            )}
                            {ev.status !== "CANCELLED" && (
                              <button
                                type="button"
                                onClick={() => handleUpdateEventStatus(ev, "CANCELLED")}
                                disabled={statusUpdatingIds.has(ev.id)}
                                className="rounded-full border border-amber-300/40 px-3 py-1 text-[10px] text-amber-100 hover:bg-amber-500/10 disabled:opacity-60"
                              >
                                {statusUpdatingIds.has(ev.id) ? "A atualizar..." : "Cancelar"}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handlePurgeEvent(ev)}
                              disabled={purgingIds.has(ev.id)}
                              className="rounded-full border border-red-400/40 px-3 py-1 text-[10px] text-red-100 hover:bg-red-500/10 transition-colors disabled:opacity-60"
                            >
                              {purgingIds.has(ev.id) ? "A apagar..." : "Apagar dados"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!errorMsg && (
            <div className="flex items-center justify-between text-[11px] text-white/70">
              <span>{events.length} registos</span>
              <button
                type="button"
                disabled={!hasMore}
                onClick={() => {
                  if (hasMore) loadEvents({ cursor, reset: false });
                }}
                className="admin-button-secondary px-3 py-1.5 disabled:opacity-40"
              >
                {hasMore ? "Carregar mais" : "Fim"}
              </button>
            </div>
          )}
        </section>
      </section>
    </AdminLayout>
  );
}
