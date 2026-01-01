"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { AdminLayout } from "@/app/admin/components/AdminLayout";
import { AdminTopActions } from "@/app/admin/components/AdminTopActions";
import { CTA_PRIMARY } from "@/app/organizador/dashboardUi";

type PaymentEvent = {
  id: number;
  stripePaymentIntentId: string | null;
  status: string;
  mode?: "LIVE" | "TEST" | null;
  isTest?: boolean;
  eventId: number | null;
  userId: string | null;
  amountCents: number | null;
  platformFeeCents: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

type ApiResponse =
  | { ok: true; items: PaymentEvent[]; pagination: { nextCursor: number | null; hasMore: boolean } }
  | { ok: false; error?: string };

type Aggregate = {
  grossCents: number;
  discountCents: number;
  platformFeeCents: number;
  stripeFeeCents: number;
  netCents: number;
  tickets: number;
};

type OverviewResponse =
  | {
      ok: true;
      totals: Aggregate;
      byOrganizer: {
        organizerId: number;
        grossCents: number;
        discountCents: number;
        platformFeeCents: number;
        stripeFeeCents: number;
        netCents: number;
        tickets: number;
        events: number;
      }[];
      period: { from: string | Date | null; to: string | Date | null };
    }
  | { ok: false; error?: string };

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatMoney(cents?: number | null, currency = "EUR") {
  if (cents == null || Number.isNaN(cents)) return "—";
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default function AdminPaymentsPage() {
  const [status, setStatus] = useState<string>("ALL");
  const [mode, setMode] = useState<string>("ALL");
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState<number | null>(null);
  const [organizerId, setOrganizerId] = useState("");
  const [eventId, setEventId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status);
    if (mode !== "ALL") params.set("mode", mode);
    if (q.trim()) params.set("q", q.trim());
    if (cursor) params.set("cursor", String(cursor));
    return params.toString() ? `?${params.toString()}` : "";
  }, [status, mode, q, cursor]);

  const { data, isLoading, mutate } = useSWR<ApiResponse>(
    `/api/admin/payments/list${queryParams}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const overviewParams = useMemo(() => {
    const params = new URLSearchParams();
    if (mode !== "ALL") params.set("mode", mode);
    if (organizerId.trim()) params.set("organizerId", organizerId.trim());
    if (eventId.trim()) params.set("eventId", eventId.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params.toString() ? `?${params.toString()}` : "";
  }, [mode, organizerId, eventId, from, to]);

  const { data: overview } = useSWR<OverviewResponse>(
    `/api/admin/payments/overview${overviewParams}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const items = data && "ok" in data && data.ok ? data.items : [];
  const pagination = data && "ok" in data && data.ok ? data.pagination : { nextCursor: null, hasMore: false };
  const errorMsg = data && "ok" in data && !data.ok ? data.error || "Falha ao carregar intents." : null;
  const overviewTotals = overview && "ok" in overview && overview.ok ? overview.totals : null;
  const overviewByOrganizer = overview && "ok" in overview && overview.ok ? overview.byOrganizer : [];
  const overviewError = overview && "ok" in overview && !overview.ok ? overview.error || "Falha ao carregar overview." : null;

  function badgeClass(s: string) {
    switch (s) {
      case "OK":
        return "bg-emerald-500/15 text-emerald-100 border border-emerald-400/30";
      case "REFUNDED":
        return "bg-amber-500/15 text-amber-100 border border-amber-400/30";
      case "ERROR":
        return "bg-rose-500/15 text-rose-100 border border-rose-400/30";
      case "PROCESSING":
      default:
        return "bg-white/10 text-white/80 border border-white/20";
    }
  }

  function modeBadgeClass(m?: string | null) {
    if (m === "TEST") return "bg-rose-500/15 text-rose-100 border border-rose-400/30";
    if (m === "LIVE") return "bg-white/10 text-white/80 border border-white/20";
    return "bg-white/5 text-white/60 border border-white/10";
  }

  async function handleReprocess(pi: string | null | undefined) {
    if (!pi) return;
    await fetch("/api/admin/payments/reprocess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentIntentId: pi }),
    });
    await mutate();
  }

  async function handleRefund(pi: string | null | undefined) {
    if (!pi) return;
    await fetch("/api/admin/payments/refund", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentIntentId: pi }),
    });
    await mutate();
  }

  return (
    <AdminLayout title="Pagamentos / intents" subtitle="Consulta os payment_events, reprocessa intents e refunds.">
      <main className="flex-1 p-6 space-y-6">

      <section className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Pagamentos / intents</h1>
            <p className="mt-1 max-w-2xl text-sm text-white/70">Consulta payment_events, reprocessa ou faz refund.</p>
          </div>
          <AdminTopActions showPaymentsExport />
        </div>

        {/* Filtros */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_1fr]">
                <div>
                  <label className="mb-1 block text-[11px] text-white/70">Pesquisa</label>
                  <input
                    type="text"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Intent id, event id..."
                    className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-white/70">Estado</label>
                  <select
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      setCursor(null);
                    }}
                    className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                  >
                    <option value="ALL">Todos</option>
                    <option value="PROCESSING">Processing</option>
                    <option value="OK">OK</option>
                    <option value="REFUNDED">Refunded</option>
                    <option value="ERROR">Error</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-white/70">Modo</label>
                  <select
                    value={mode}
                    onChange={(e) => {
                      setMode(e.target.value);
                      setCursor(null);
                    }}
                    className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                  >
                    <option value="ALL">Todos</option>
                    <option value="LIVE">Live</option>
                    <option value="TEST">Test</option>
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCursor(null);
                      void mutate();
                    }}
                    className={`${CTA_PRIMARY} px-4 py-2 text-sm`}
                  >
                    Atualizar
                  </button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <label className="mb-1 block text-[11px] text-white/70">Organizer ID</label>
                  <input
                    type="text"
                    value={organizerId}
                    onChange={(e) => setOrganizerId(e.target.value)}
                    placeholder="ex: 12"
                    className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-white/70">Evento ID</label>
                  <input
                    type="text"
                    value={eventId}
                    onChange={(e) => setEventId(e.target.value)}
                    placeholder="ex: 340"
                    className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-white/70">De</label>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-white/70">Até</label>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                  />
                </div>
              </div>
            </div>
        </div>

        {/* Lista */}
        <div className="rounded-2xl border border-white/10 bg-black/50 backdrop-blur">
          <div className="border-b border-white/10 px-4 py-3">
            <h3 className="text-sm font-semibold text-white">Visão global (sale_summaries)</h3>
            <p className="text-[11px] text-white/60">
              Filtros de modo/organizer/evento/período aplicados. Valores estimam fee Stripe base.
            </p>
          </div>
          {overviewError && (
            <div className="px-4 py-3 text-[12px] text-rose-200">{overviewError}</div>
          )}
          {!overviewError && (
            <div className="grid gap-4 px-4 py-4 md:grid-cols-5">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] uppercase tracking-wide text-white/60">Bruto</p>
                <p className="text-lg font-semibold">{formatMoney(overviewTotals?.grossCents ?? 0)}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] uppercase tracking-wide text-white/60">Descontos</p>
                <p className="text-lg font-semibold text-emerald-200">-{formatMoney(overviewTotals?.discountCents ?? 0)}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] uppercase tracking-wide text-white/60">Taxa ORYA</p>
                <p className="text-lg font-semibold text-orange-200">{formatMoney(overviewTotals?.platformFeeCents ?? 0)}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] uppercase tracking-wide text-white/60">Fee Stripe (estim.)</p>
                <p className="text-lg font-semibold text-white">{formatMoney(overviewTotals?.stripeFeeCents ?? 0)}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] uppercase tracking-wide text-white/60">Líquido</p>
                <p className="text-lg font-semibold text-emerald-100">{formatMoney(overviewTotals?.netCents ?? 0)}</p>
                <p className="text-[11px] text-white/50">{(overviewTotals?.tickets ?? 0)} bilhetes</p>
              </div>
            </div>
          )}

          {overviewByOrganizer && overviewByOrganizer.length > 0 && (
            <div className="px-4 pb-4">
              <div className="overflow-auto rounded-xl border border-white/10">
                <table className="min-w-full text-left text-xs text-white/90">
                  <thead className="bg-black/70">
                    <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.16em] text-white/60">
                      <th className="px-3 py-3">Organizer</th>
                      <th className="px-3 py-3">Bruto</th>
                      <th className="px-3 py-3">Taxa ORYA</th>
                      <th className="px-3 py-3">Fee Stripe (est.)</th>
                      <th className="px-3 py-3">Líquido</th>
                      <th className="px-3 py-3">Bilhetes</th>
                      <th className="px-3 py-3">Eventos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overviewByOrganizer.map((o) => (
                      <tr key={o.organizerId} className="border-b border-white/5">
                        <td className="px-3 py-2">#{o.organizerId}</td>
                        <td className="px-3 py-2">{formatMoney(o.grossCents)}</td>
                        <td className="px-3 py-2">{formatMoney(o.platformFeeCents)}</td>
                        <td className="px-3 py-2">{formatMoney(o.stripeFeeCents)}</td>
                        <td className="px-3 py-2 font-semibold text-emerald-100">{formatMoney(o.netCents)}</td>
                        <td className="px-3 py-2">{o.tickets}</td>
                        <td className="px-3 py-2">{o.events}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/50 backdrop-blur">
          <div className="max-h-[70vh] overflow-auto">
            <table className="min-w-full text-left text-xs text-white/90">
              <thead className="sticky top-0 z-10 bg-black/80">
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.16em] text-white/60">
                  <th className="px-3 py-3">Intent</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Evento</th>
                  <th className="px-3 py-3">Montantes</th>
                  <th className="px-3 py-3">Atualizado</th>
                  <th className="px-3 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {errorMsg && (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-rose-200">
                      {errorMsg}
                    </td>
                  </tr>
                )}
                {isLoading && (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-white/60">
                      A carregar...
                    </td>
                  </tr>
                )}
                {!isLoading && !errorMsg && (!items || items.length === 0) && (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-white/60">
                      Sem registos para estes filtros.
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  !errorMsg &&
                  items?.map((p) => (
                    <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-3 py-3 align-top font-mono text-[11px] break-all">
                        {p.stripePaymentIntentId || "—"}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] ${badgeClass(p.status)}`}>
                          {p.status}
                        </span>
                        <div className="mt-1">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${modeBadgeClass(p.mode || (p.isTest ? "TEST" : "LIVE"))}`}>
                            {p.mode || (p.isTest ? "TEST" : "LIVE")}
                          </span>
                        </div>
                        {p.errorMessage && (
                          <p className="mt-1 text-[10px] text-rose-200">{p.errorMessage}</p>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top text-[11px] text-white/80">
                        {p.eventId ? <>Event #{p.eventId}</> : "—"}
                      </td>
                      <td className="px-3 py-3 align-top text-[11px] text-white/80">
                        <div className="flex flex-col">
                          <span>Total: {formatMoney(p.amountCents)}</span>
                          <span className="text-white/60">Fee: {formatMoney(p.platformFeeCents)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top text-[11px] text-white/70">
                        {formatDate(p.updatedAt)}
                        <div className="text-white/50">{formatDate(p.createdAt)}</div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex flex-wrap gap-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(p.stripePaymentIntentId || "");
                            }}
                            className="rounded-full border border-white/20 px-2 py-1 text-white/80 hover:bg-white/10"
                          >
                            Copiar ID
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReprocess(p.stripePaymentIntentId || "")}
                            className={`${CTA_PRIMARY} px-2.5 py-1 text-[11px]`}
                          >
                            Reprocessar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRefund(p.stripePaymentIntentId || "")}
                            className="rounded-full border border-white/20 px-2.5 py-1 text-white/85 hover:bg-white/10"
                          >
                            Refund
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Paginação */}
        <div className="flex items-center justify-between text-[11px] text-white/70">
          <span>
            {items?.length || 0} registos
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!cursor}
              onClick={() => setCursor(null)}
              className="rounded-full border border-white/20 px-3 py-1.5 disabled:opacity-40"
            >
              Início
            </button>
            <button
              type="button"
              disabled={!pagination?.nextCursor}
              onClick={() => setCursor(pagination?.nextCursor ?? null)}
              className="rounded-full border border-white/20 px-3 py-1.5 disabled:opacity-40"
            >
              Mais
            </button>
          </div>
        </div>
      </section>
      </main>
    </AdminLayout>
  );
}
