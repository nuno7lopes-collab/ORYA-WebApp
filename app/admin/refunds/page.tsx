"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { AdminLayout } from "@/app/admin/components/AdminLayout";
import { AdminTopActions } from "@/app/admin/components/AdminTopActions";

type RefundItem = {
  id: number;
  status: "PENDING" | "FAILED" | "SUCCEEDED";
  opStatus: string;
  attempts: number;
  lastError: string | null;
  purchaseId: string | null;
  paymentIntentId: string | null;
  eventId: number | null;
  createdAt: string;
  updatedAt: string;
  refund: {
    id: number;
    baseAmountCents: number;
    feesExcludedCents: number;
    refundedAt: string | null;
    stripeRefundId: string | null;
    reason: string;
  } | null;
};

type ApiResponse =
  | { ok: true; items: RefundItem[]; pagination: { nextCursor: number | null; hasMore: boolean } }
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
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function statusBadge(status: string) {
  if (status === "SUCCEEDED") {
    return "bg-emerald-500/15 text-emerald-100 border border-emerald-400/30";
  }
  if (status === "FAILED") {
    return "bg-rose-500/15 text-rose-100 border border-rose-400/30";
  }
  return "bg-white/10 text-white/80 border border-white/20";
}

export default function AdminRefundsPage() {
  const [status, setStatus] = useState("ALL");
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState<number | null>(null);
  const [isRetrying, setIsRetrying] = useState<number | null>(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    if (cursor) params.set("cursor", String(cursor));
    return params.toString() ? `?${params.toString()}` : "";
  }, [status, q, cursor]);

  const { data, isLoading, mutate } = useSWR<ApiResponse>(
    `/api/admin/refunds/list${queryParams}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const items = data && "ok" in data && data.ok ? data.items : [];
  const pagination = data && "ok" in data && data.ok ? data.pagination : { nextCursor: null, hasMore: false };
  const errorMsg = data && "ok" in data && !data.ok ? data.error || "Falha ao carregar refunds." : null;

  async function handleRetry(operationId: number) {
    setIsRetrying(operationId);
    try {
      await fetch("/api/admin/refunds/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationId }),
      });
      await mutate();
    } finally {
      setIsRetrying(null);
    }
  }

  return (
    <AdminLayout title="Refunds" subtitle="Backoffice de refunds base-only e reprocessamento manual.">
      <main className="flex-1 p-6 space-y-6">
        <section className="space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Refunds</h1>
              <p className="mt-1 max-w-2xl text-sm text-white/70">
                Lista de refunds, estados e erros. Reprocessa manualmente quando necessário.
              </p>
            </div>
            <AdminTopActions />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div className="grid gap-3 md:grid-cols-[1.5fr_1fr]">
              <div>
                <label className="mb-1 block text-[11px] text-white/70">Pesquisa</label>
                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="purchaseId, intent id, event id..."
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
                  <option value="PENDING">Pending</option>
                  <option value="FAILED">Failed</option>
                  <option value="SUCCEEDED">Succeeded</option>
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/50 backdrop-blur">
            <div className="max-h-[70vh] overflow-auto">
              <table className="min-w-full text-left text-xs text-white/90">
                <thead className="sticky top-0 z-10 bg-black/80">
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.16em] text-white/60">
                    <th className="px-3 py-3">Compra</th>
                    <th className="px-3 py-3">Estado</th>
                    <th className="px-3 py-3">Evento</th>
                    <th className="px-3 py-3">Montantes</th>
                    <th className="px-3 py-3">Datas</th>
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
                        Sem refunds para estes filtros.
                      </td>
                    </tr>
                  )}
                  {!isLoading &&
                    !errorMsg &&
                    items.map((item) => (
                      <tr key={item.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="px-3 py-3 align-top">
                          <div className="font-mono text-[11px] break-all">
                            {item.purchaseId || item.paymentIntentId || "—"}
                          </div>
                          {item.paymentIntentId && item.paymentIntentId !== item.purchaseId && (
                            <div className="mt-1 text-[10px] text-white/60 break-all">
                              PI: {item.paymentIntentId}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] ${statusBadge(item.status)}`}>
                            {item.status}
                          </span>
                          <div className="mt-1 text-[10px] text-white/60">Op: {item.opStatus}</div>
                          <div className="text-[10px] text-white/50">Tentativas: {item.attempts}</div>
                          {item.lastError && (
                            <p className="mt-1 text-[10px] text-rose-200">{item.lastError}</p>
                          )}
                        </td>
                        <td className="px-3 py-3 align-top text-[11px] text-white/80">
                          {item.eventId ? <>Event #{item.eventId}</> : "—"}
                        </td>
                        <td className="px-3 py-3 align-top text-[11px] text-white/80">
                          <div className="flex flex-col">
                            <span>Base: {formatMoney(item.refund?.baseAmountCents ?? null)}</span>
                            <span className="text-white/60">Fees: {formatMoney(item.refund?.feesExcludedCents ?? null)}</span>
                            <span className="text-white/50">Stripe: {item.refund?.stripeRefundId ?? "—"}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top text-[11px] text-white/70">
                          <div>Atualizado: {formatDate(item.updatedAt)}</div>
                          <div className="text-white/50">Criado: {formatDate(item.createdAt)}</div>
                          <div className="text-white/50">Refund: {formatDate(item.refund?.refundedAt ?? null)}</div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex flex-wrap gap-2">
                            {item.status === "FAILED" && (
                              <button
                                type="button"
                                onClick={() => handleRetry(item.id)}
                                disabled={isRetrying === item.id}
                                className="rounded-full border border-white/20 px-2.5 py-1 text-white/85 hover:bg-white/10 disabled:opacity-40"
                              >
                                {isRetrying === item.id ? "A tentar..." : "Retry"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-white/70">
            <span>{items?.length || 0} registos</span>
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
