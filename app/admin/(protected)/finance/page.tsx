"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { AdminLayout } from "@/app/admin/components/AdminLayout";
import { AdminPageHeader } from "@/app/admin/components/AdminPageHeader";
import { AdminTopActions } from "@/app/admin/components/AdminTopActions";
import PaymentTools from "@/app/admin/components/PaymentTools";

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

function SectionHeader({ id, title, subtitle }: { id: string; title: string; subtitle?: string }) {
  return (
    <div id={id} className="flex flex-col gap-2">
      <p className="text-[11px] uppercase tracking-[0.3em] text-white/45">Admin • Financeiro</p>
      <h2 className="text-xl font-semibold text-white/95 md:text-2xl">{title}</h2>
      {subtitle && <p className="text-sm text-white/55">{subtitle}</p>}
    </div>
  );
}

type PaymentEvent = {
  id: number;
  purchaseId: string | null;
  stripeEventId?: string | null;
  paymentIntentId?: string | null;
  status: string;
  mode?: "LIVE" | "TEST" | null;
  isTest?: boolean;
  eventId: number | null;
  userId: string | null;
  amountCents: number | null;
  platformFeeCents: number | null;
  errorMessage: string | null;
  saleSummaryId?: number | null;
  saleStatus?: string | null;
  payoutStatus?: string | null;
  payoutHoldUntil?: string | null;
  payoutTransferId?: string | null;
  payoutAmountCents?: number | null;
  createdAt: string;
  updatedAt: string;
};

type PaymentsResponse =
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
      byOrganization: {
        organizationId: number;
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

type PlatformFeesResponse =
  | {
      ok: true;
      orya: {
        feeBps: number;
        feeFixedCents: number;
      };
      stripe: {
        feeBps: number;
        feeFixedCents: number;
        region: string;
      };
    }
  | { ok: false; error?: string };

function PaymentsSection({ initialQuery }: { initialQuery?: string }) {
  const [status, setStatus] = useState<string>("ALL");
  const [mode, setMode] = useState<string>("ALL");
  const [q, setQ] = useState(initialQuery ?? "");
  const [cursor, setCursor] = useState<number | null>(null);
  const [organizationId, setOrganizationId] = useState("");
  const [eventId, setEventId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (typeof initialQuery === "string" && initialQuery.trim()) {
      setQ(initialQuery);
    }
  }, [initialQuery]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status);
    if (mode !== "ALL") params.set("mode", mode);
    if (q.trim()) params.set("q", q.trim());
    if (cursor) params.set("cursor", String(cursor));
    return params.toString() ? `?${params.toString()}` : "";
  }, [status, mode, q, cursor]);

  const { data, isLoading, mutate } = useSWR<PaymentsResponse>(
    `/api/admin/payments/list${queryParams}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const overviewParams = useMemo(() => {
    const params = new URLSearchParams();
    if (mode !== "ALL") params.set("mode", mode);
    if (organizationId.trim()) params.set("organizationId", organizationId.trim());
    if (eventId.trim()) params.set("eventId", eventId.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params.toString() ? `?${params.toString()}` : "";
  }, [mode, organizationId, eventId, from, to]);

  const { data: overview } = useSWR<OverviewResponse>(
    `/api/admin/payments/overview${overviewParams}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const { data: platformFees } = useSWR<PlatformFeesResponse>("/api/platform/fees", fetcher, {
    revalidateOnFocus: false,
  });

  const items = data && "ok" in data && data.ok ? data.items : [];
  const pagination = data && "ok" in data && data.ok ? data.pagination : { nextCursor: null, hasMore: false };
  const errorMsg = data && "ok" in data && !data.ok ? data.error || "Falha ao carregar intents." : null;
  const overviewTotals = overview && "ok" in overview && overview.ok ? overview.totals : null;
  const overviewByOrganization = overview && "ok" in overview && overview.ok ? overview.byOrganization : [];
  const overviewError = overview && "ok" in overview && !overview.ok ? overview.error || "Falha ao carregar overview." : null;
  const feesData = platformFees && "ok" in platformFees && platformFees.ok ? platformFees : null;

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

  async function handleDispute(saleSummaryId: number | null) {
    if (!saleSummaryId) return;
    await fetch("/api/admin/payments/dispute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saleSummaryId }),
    });
    await mutate();
  }

  return (
    <section className="admin-section space-y-6">
      <SectionHeader
        id="pagamentos"
        title="Pagamentos"
        subtitle="Monitoriza pagamentos, fees e ações críticas de cobrança."
      />

      <div className="admin-card-soft p-4">
        <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-white/45">Pesquisa</label>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Pagamento ID, event ID..."
              className="admin-input"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-white/45">Estado</label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setCursor(null);
              }}
              className="admin-select"
            >
              <option value="ALL">Todos</option>
              <option value="PROCESSING">Processing</option>
              <option value="OK">OK</option>
              <option value="REFUNDED">Refunded</option>
              <option value="ERROR">Error</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-white/45">Modo</label>
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                setCursor(null);
              }}
              className="admin-select"
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
              className="admin-button px-4 py-2 text-sm"
            >
              Atualizar
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-white/45">ID organização</label>
            <input
              type="text"
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              placeholder="ex: 12"
              className="admin-input"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-white/45">ID evento</label>
            <input
              type="text"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              placeholder="ex: 340"
              className="admin-input"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-white/45">De</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="admin-input"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-white/45">Até</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="admin-input"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr]">
        <div className="admin-card">
          <div className="border-b border-white/10 px-4 py-3">
            <h3 className="text-sm font-semibold text-white">Visão global (ledger)</h3>
            <p className="text-[11px] text-white/60">
              Filtros de modo/organization/evento/período aplicados. Valores estimam fee Stripe base.
            </p>
          </div>
          {overviewError && (
            <div className="px-4 py-3 text-[12px] text-rose-200">{overviewError}</div>
          )}
          {!overviewError && (
            <div className="grid gap-4 px-4 py-4 md:grid-cols-2">
              <div className="admin-card-soft p-3">
                <p className="text-[11px] uppercase tracking-wide text-white/60">Bruto</p>
                <p className="text-lg font-semibold">{formatMoney(overviewTotals?.grossCents ?? 0)}</p>
              </div>
              <div className="admin-card-soft p-3">
                <p className="text-[11px] uppercase tracking-wide text-white/60">Descontos</p>
                <p className="text-lg font-semibold text-emerald-200">-{formatMoney(overviewTotals?.discountCents ?? 0)}</p>
              </div>
              <div className="admin-card-soft p-3">
                <p className="text-[11px] uppercase tracking-wide text-white/60">Taxa ORYA</p>
                <p className="text-lg font-semibold text-orange-200">{formatMoney(overviewTotals?.platformFeeCents ?? 0)}</p>
              </div>
              <div className="admin-card-soft p-3">
                <p className="text-[11px] uppercase tracking-wide text-white/60">Fee Stripe (estim.)</p>
                <p className="text-lg font-semibold text-white">{formatMoney(overviewTotals?.stripeFeeCents ?? 0)}</p>
              </div>
              <div className="admin-card-soft p-3">
                <p className="text-[11px] uppercase tracking-wide text-white/60">Líquido</p>
                <p className="text-lg font-semibold text-emerald-100">{formatMoney(overviewTotals?.netCents ?? 0)}</p>
              </div>
              <div className="admin-card-soft p-3">
                <p className="text-[11px] uppercase tracking-wide text-white/60">Bilhetes</p>
                <p className="text-lg font-semibold text-white">{overviewTotals?.tickets ?? 0}</p>
              </div>
            </div>
          )}
        </div>

        <div className="admin-card">
          <div className="border-b border-white/10 px-4 py-3">
            <h3 className="text-sm font-semibold text-white">Ferramentas rápidas</h3>
            <p className="text-[11px] text-white/60">Reprocessa intents e exporta relatórios.</p>
          </div>
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <PaymentTools />
            <div className="admin-card-soft p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Exportações</p>
              <div className="mt-2">
                <AdminTopActions showPaymentsExport />
              </div>
            </div>
            <div className="admin-card-soft p-3 md:col-span-2">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Tabela de fees (canónica)</p>
              {!feesData ? (
                <p className="mt-2 text-[12px] text-white/55">A carregar configuração de taxas…</p>
              ) : (
                <div className="mt-2 grid gap-3 text-[12px] text-white/75 md:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">ORYA</p>
                    <p className="mt-1 font-semibold text-white">
                      {feesData.orya.feeBps / 100}% + {formatMoney(feesData.orya.feeFixedCents)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">
                      Stripe {feesData.stripe.region}
                    </p>
                    <p className="mt-1 font-semibold text-white">
                      {feesData.stripe.feeBps / 100}% + {formatMoney(feesData.stripe.feeFixedCents)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="max-h-[70vh] overflow-auto">
          <table className="admin-table text-left">
            <thead>
              <tr>
                <th className="px-3 py-3">Pagamento</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">Evento</th>
                <th className="px-3 py-3">Montantes</th>
                <th className="px-3 py-3">Payout</th>
                <th className="px-3 py-3">Atualizado</th>
                <th className="px-3 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {errorMsg && (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-rose-200">
                    {errorMsg}
                  </td>
                </tr>
              )}
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-white/60">
                    A carregar...
                  </td>
                </tr>
              )}
              {!isLoading && !errorMsg && (!items || items.length === 0) && (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-white/60">
                    Sem pagamentos para estes filtros.
                  </td>
                </tr>
              )}
              {!isLoading &&
                !errorMsg &&
                items?.map((p) => {
                  const paymentRef = p.paymentIntentId ?? p.purchaseId ?? p.stripeEventId ?? "";
                  return (
                    <tr key={p.id} className="border-b border-white/10 last:border-0">
                    <td className="px-3 py-3 align-top text-[11px] font-mono text-white/70">
                      <div className="flex flex-col gap-1">
                        <span className="truncate">{paymentRef || "—"}</span>
                        <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] ${modeBadgeClass(p.mode)}`}>
                          {p.mode || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] ${badgeClass(p.status)}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top text-[11px] text-white/70">
                      <div className="flex flex-col gap-1">
                        <span>Evento: {p.eventId ?? "—"}</span>
                        <span>Utilizador: {p.userId ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top text-[11px] text-white/70">
                      <div className="flex flex-col gap-1">
                        <span>Total: {formatMoney(p.amountCents ?? 0)}</span>
                        <span className="text-white/60">Fee ORYA: {formatMoney(p.platformFeeCents ?? 0)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top text-[11px] text-white/70">
                      <div className="flex flex-col gap-1">
                        <span>Estado: {p.payoutStatus || "—"}</span>
                        {p.payoutHoldUntil && (
                          <span className="text-white/60">Hold até {formatDate(p.payoutHoldUntil)}</span>
                        )}
                        {p.payoutTransferId && (
                          <span className="text-white/60">Transfer: {p.payoutTransferId}</span>
                        )}
                        {p.payoutAmountCents != null && (
                          <span className="text-white/60">Líquido: {formatMoney(p.payoutAmountCents)}</span>
                        )}
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
                            if (paymentRef) navigator.clipboard?.writeText(paymentRef);
                          }}
                          className="admin-button-secondary px-2 py-1 text-[11px]"
                        >
                          Copiar ID
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReprocess(paymentRef)}
                          className="admin-button px-2.5 py-1 text-[11px]"
                        >
                          Reprocessar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRefund(paymentRef)}
                          className="admin-button-secondary px-2.5 py-1 text-[11px]"
                        >
                          Refund
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDispute(p.saleSummaryId ?? null)}
                          className="admin-button-secondary px-2.5 py-1 text-[11px]"
                          disabled={!p.saleSummaryId}
                          title={!p.saleSummaryId ? "Sem SaleSummary" : "Abrir disputa"}
                        >
                          Dispute
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-[11px] text-white/60">
          <span>{items?.length || 0} registos</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!cursor}
              onClick={() => setCursor(null)}
              className="admin-button-secondary px-3 py-1.5 disabled:opacity-40"
            >
              Início
            </button>
            <button
              type="button"
              disabled={!pagination?.nextCursor}
              onClick={() => setCursor(pagination?.nextCursor ?? null)}
              className="admin-button-secondary px-3 py-1.5 disabled:opacity-40"
            >
              Mais
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function PayoutsSection() {
  return (
    <section className="admin-section space-y-6">
      <SectionHeader
        id="payouts"
        title="Payouts"
        subtitle="Controlo interno desativado; settlement é feito pela Stripe Connect."
      />
      <div className="admin-card-soft p-4 text-sm text-white/70">
        <p>
          Nesta fase não existem holds, releases ou bloqueios manuais. O backoffice apenas acompanha pagamentos,
          reembolsos e o ledger.
        </p>
      </div>
    </section>
  );
}

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

type RefundsResponse =
  | { ok: true; items: RefundItem[]; pagination: { nextCursor: number | null; hasMore: boolean } }
  | { ok: false; error?: string };

function refundBadge(status: string) {
  if (status === "SUCCEEDED") {
    return "bg-emerald-500/15 text-emerald-100 border border-emerald-400/30";
  }
  if (status === "FAILED") {
    return "bg-rose-500/15 text-rose-100 border border-rose-400/30";
  }
  return "bg-white/10 text-white/80 border border-white/20";
}

function RefundsSection() {
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

  const { data, isLoading, mutate } = useSWR<RefundsResponse>(
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
    <section className="admin-section space-y-6">
      <SectionHeader
        id="reembolsos"
        title="Reembolsos"
        subtitle="Backoffice de reembolsos com reprocessamento manual."
      />

      <div className="admin-card-soft p-4">
        <div className="grid gap-3 md:grid-cols-[1.5fr_1fr]">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-white/45">Pesquisa</label>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="purchaseId, intent id, event id..."
              className="admin-input"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-white/45">Estado</label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setCursor(null);
              }}
              className="admin-select"
            >
              <option value="ALL">Todos</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
              <option value="SUCCEEDED">Succeeded</option>
            </select>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="max-h-[70vh] overflow-auto">
          <table className="admin-table text-left">
            <thead>
              <tr>
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
                    Sem reembolsos para estes filtros.
                  </td>
                </tr>
              )}
              {!isLoading &&
                !errorMsg &&
                items.map((item) => (
                  <tr key={item.id} className="border-b border-white/10 last:border-0">
                    <td className="px-3 py-3 text-[11px] text-white/70">
                      <div className="flex flex-col gap-1">
                        <span>#{item.purchaseId ?? "—"}</span>
                        <span className="text-white/50">{item.paymentIntentId ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] ${refundBadge(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[11px] text-white/70">
                      {item.eventId ? `Evento ${item.eventId}` : "—"}
                    </td>
                    <td className="px-3 py-3 text-[11px] text-white/70">
                      <div className="flex flex-col gap-1">
                        <span>Base: {formatMoney(item.refund?.baseAmountCents ?? 0)}</span>
                        <span className="text-white/50">Fees excl.: {formatMoney(item.refund?.feesExcludedCents ?? 0)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[11px] text-white/70">
                      <div className="flex flex-col gap-1">
                        <span>Criado: {formatDate(item.createdAt)}</span>
                        <span className="text-white/50">Atualizado: {formatDate(item.updatedAt)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => handleRetry(item.id)}
                        disabled={isRetrying === item.id}
                        className="admin-button-secondary px-2.5 py-1 text-[11px] disabled:opacity-40"
                      >
                        {isRetrying === item.id ? "A tentar..." : "Retry"}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-[11px] text-white/60">
          <span>{items?.length || 0} registos</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!cursor}
              onClick={() => setCursor(null)}
              className="admin-button-secondary px-3 py-1.5 disabled:opacity-40"
            >
              Início
            </button>
            <button
              type="button"
              disabled={!pagination?.nextCursor}
              onClick={() => setCursor(pagination?.nextCursor ?? null)}
              className="admin-button-secondary px-3 py-1.5 disabled:opacity-40"
            >
              Mais
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function AdminFinancePage() {
  const searchParams = useSearchParams();
  const paymentQuery = searchParams?.get("payment_q") ?? "";
  return (
    <AdminLayout
      title="Financeiro"
      subtitle="Pagamentos e reembolsos num painel único (payouts internos desativados)."
    >
      <section className="space-y-10">
        <AdminPageHeader
          title="Financeiro"
          subtitle="Visão consolidada de receita e reembolsos com ações críticas num só local."
          eyebrow="Admin • Financeiro"
          actions={<AdminTopActions showPaymentsExport />}
        />
        <PaymentsSection initialQuery={paymentQuery} />
        <PayoutsSection />
        <RefundsSection />
      </section>
    </AdminLayout>
  );
}
