"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { AdminLayout } from "@/app/admin/components/AdminLayout";
import { AdminTopActions } from "@/app/admin/components/AdminTopActions";

type PaymentEvent = {
  id: number;
  stripePaymentIntentId: string | null;
  status: string;
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
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState<number | null>(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    if (cursor) params.set("cursor", String(cursor));
    return params.toString() ? `?${params.toString()}` : "";
  }, [status, q, cursor]);

  const { data, isLoading, mutate } = useSWR<ApiResponse>(
    `/api/admin/payments/list${queryParams}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const items = data && "ok" in data && data.ok ? data.items : [];
  const pagination = data && "ok" in data && data.ok ? data.pagination : { nextCursor: null, hasMore: false };
  const errorMsg = data && "ok" in data && !data.ok ? data.error || "Falha ao carregar intents." : null;

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
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setCursor(null);
                  // trigger refetch
                  void mutate();
                }}
                className="rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-2 text-sm font-semibold text-black shadow"
              >
                Atualizar
              </button>
            </div>
          </div>
        </div>

        {/* Lista */}
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
                            className="rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-2.5 py-1 text-black font-semibold shadow hover:opacity-90"
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
