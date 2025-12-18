"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminLayout } from "@/app/admin/components/AdminLayout";
import { AdminTopActions } from "@/app/admin/components/AdminTopActions";

type AdminEventItem = {
  id: number;
  title: string;
  slug: string;
  status: string;
  type: string;
  startsAt: string | null;
  organizer?: { id: number; displayName: string | null } | null;
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
  const [organizerFilter, setOrganizerFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [events, setEvents] = useState<AdminEventItem[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [initialized, setInitialized] = useState(false);

  async function loadEvents(opts?: {
    search?: string;
    status?: string;
    type?: string;
    organizerId?: string;
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
      const org = opts?.organizerId ?? organizerFilter;
      const cur = opts?.cursor ?? null;

      if (s.trim()) sp.set("search", s.trim());
      if (st !== "ALL") sp.set("status", st);
      if (ty !== "ALL") sp.set("type", ty);
      if (org.trim()) sp.set("organizerId", org.trim());
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

  const isEmpty = initialized && !loading && events.length === 0 && !errorMsg;

  return (
    <AdminLayout title="Eventos" subtitle="Gestão global de eventos com receita e bilhetes.">
      <section className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Eventos</h1>
            <p className="mt-1 max-w-xl text-sm text-white/70">
              Lista de eventos com bilhetes vendidos e receita agregada.
            </p>
          </div>
          <AdminTopActions />
        </div>

        {/* Filtros */}
        <div className="grid gap-3 md:grid-cols-[1.3fr_1fr_1fr_1fr] text-[11px]">
          <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-3 py-2">
            <span className="text-xs text-white/60">Pesquisar</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") loadEvents({ search: e.currentTarget.value, reset: true });
              }}
              placeholder="Nome, slug ou organizador"
              className="w-full bg-transparent text-xs text-white placeholder:text-white/35 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] text-white/60">Estado</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                loadEvents({ status: e.target.value, reset: true });
              }}
              className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-xs text-white outline-none focus:border-white/30"
            >
              <option value="ALL">Todos</option>
              <option value="PUBLISHED">Publicado</option>
              <option value="DRAFT">Rascunho</option>
              <option value="CANCELLED">Cancelado</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] text-white/60">Tipo</label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                loadEvents({ type: e.target.value, reset: true });
              }}
              className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-xs text-white outline-none focus:border-white/30"
            >
              <option value="ALL">Todos</option>
              <option value="ORGANIZER_EVENT">Organizador</option>
              <option value="EXPERIENCE">Experiência</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] text-white/60">Organizer ID</label>
            <input
              type="text"
              value={organizerFilter}
              onChange={(e) => setOrganizerFilter(e.target.value)}
              placeholder="ex.: 3"
              className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-xs text-white outline-none focus:border-white/30"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <button
            type="button"
            onClick={() => loadEvents({ search, organizerId: organizerFilter, reset: true })}
            disabled={loading}
            className="rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-1.5 text-xs font-semibold text-black shadow-[0_0_18px_rgba(107,255,255,0.6)] hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-60 disabled:hover:scale-100"
          >
            {loading ? "A carregar..." : "Aplicar filtros"}
          </button>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStatusFilter("ALL");
              setTypeFilter("ALL");
              setOrganizerFilter("");
              setEvents([]);
              setCursor(null);
              setHasMore(false);
              loadEvents({ search: "", status: "ALL", type: "ALL", organizerId: "", cursor: null, reset: true });
            }}
            className="rounded-full border border-white/20 px-3 py-1.5 text-white/75 hover:bg-white/10 transition"
          >
            Limpar
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-100">
            {errorMsg}
          </div>
        )}

        {!errorMsg && isEmpty && (
          <div className="mt-6 rounded-2xl border border-dashed border-white/20 bg-white/5 px-6 py-8 text-center text-sm text-white/70">
            <p className="font-medium text-white">Ainda não existem eventos registados na plataforma.</p>
            <p className="mt-1 text-xs text-white/70">Assim que os organizadores começarem a criar eventos, eles vão aparecer aqui.</p>
          </div>
        )}

        {!errorMsg && !isEmpty && (
          <div className="mt-4 overflow-hidden rounded-2xl border border-white/15 bg-white/5">
            <div className="max-h-[70vh] overflow-auto">
              <table className="min-w-full border-separate border-spacing-0 text-left text-[11px]">
                <thead className="bg-white/5 text-white/60">
                  <tr>
                    <th className="sticky top-0 z-10 border-b border-white/10 px-4 py-3 font-medium">Evento</th>
                    <th className="sticky top-0 z-10 border-b border-white/10 px-4 py-3 font-medium">Organizador</th>
                    <th className="sticky top-0 z-10 border-b border-white/10 px-4 py-3 font-medium">Data</th>
                    <th className="sticky top-0 z-10 border-b border-white/10 px-4 py-3 font-medium">Tipo</th>
                    <th className="sticky top-0 z-10 border-b border-white/10 px-4 py-3 font-medium">Estado</th>
                    <th className="sticky top-0 z-10 border-b border-white/10 px-4 py-3 font-medium">Bilhetes</th>
                    <th className="sticky top-0 z-10 border-b border-white/10 px-4 py-3 font-medium">Receita</th>
                    <th className="sticky top-0 z-10 border-b border-white/10 px-4 py-3 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => (
                    <tr key={ev.id} className="border-b border-white/10 text-white/80 last:border-0">
                      <td className="px-4 py-3 align-middle">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-semibold text-white">{ev.title || "Evento sem título"}</span>
                          {ev.slug && <span className="text-[10px] text-white/45">/eventos/{ev.slug}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle text-white/80">
                        {ev.organizer?.displayName ?? "-"} {ev.organizer ? `(ID ${ev.organizer.id})` : ""}
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
                              className="rounded-full border border-white/20 px-3 py-1 text-[10px] text-white/80 hover:bg-white/10 transition-colors"
                            >
                              Ver público
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-white/70">
          <span>{events.length} registos</span>
          <button
            type="button"
            disabled={!hasMore}
            onClick={() => {
              if (hasMore) loadEvents({ cursor, reset: false });
            }}
            className="rounded-full border border-white/20 px-3 py-1.5 disabled:opacity-40"
          >
            {hasMore ? "Carregar mais" : "Fim"}
          </button>
        </div>
      </section>
    </AdminLayout>
  );
}
