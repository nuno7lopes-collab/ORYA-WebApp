"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  stripePaymentIntentId: string | null;
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

  const items = data && "ok" in data && data.ok ? data.items : [];
  const pagination = data && "ok" in data && data.ok ? data.pagination : { nextCursor: null, hasMore: false };
  const errorMsg = data && "ok" in data && !data.ok ? data.error || "Falha ao carregar intents." : null;
  const overviewTotals = overview && "ok" in overview && overview.ok ? overview.totals : null;
  const overviewByOrganization = overview && "ok" in overview && overview.ok ? overview.byOrganization : [];
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
        subtitle="Monitoriza intents, fees e ações críticas de cobrança."
      />

      <div className="admin-card-soft p-4">
        <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-white/45">Pesquisa</label>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Intent ID, event ID..."
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
            <h3 className="text-sm font-semibold text-white">Visão global (sale_summaries)</h3>
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
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="max-h-[70vh] overflow-auto">
          <table className="admin-table text-left">
            <thead>
              <tr>
                <th className="px-3 py-3">Intent</th>
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
                    Sem intents para estes filtros.
                  </td>
                </tr>
              )}
              {!isLoading &&
                !errorMsg &&
                items?.map((p) => (
                  <tr key={p.id} className="border-b border-white/10 last:border-0">
                    <td className="px-3 py-3 align-top text-[11px] font-mono text-white/70">
                      <div className="flex flex-col gap-1">
                        <span className="truncate">{p.stripePaymentIntentId || "—"}</span>
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
                            navigator.clipboard?.writeText(p.stripePaymentIntentId || "");
                          }}
                          className="admin-button-secondary px-2 py-1 text-[11px]"
                        >
                          Copiar ID
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReprocess(p.stripePaymentIntentId || "")}
                          className="admin-button px-2.5 py-1 text-[11px]"
                        >
                          Reprocessar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRefund(p.stripePaymentIntentId || "")}
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

type PendingPayout = {
  id: number;
  sourceType: string;
  sourceId: string;
  paymentIntentId: string;
  recipientConnectAccountId: string;
  amountCents: number;
  currency: string;
  status: string;
  holdUntil: string;
  nextAttemptAt: string | null;
  retryCount: number;
  blockedReason: string | null;
  transferId: string | null;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
  organization?: { id: number; publicName: string | null; username: string | null; stripeAccountId: string | null } | null;
  source?: { title: string | null; href: string | null } | null;
};

type PayoutListResponse =
  | { ok: true; items: PendingPayout[]; pagination: { nextCursor: number | null; hasMore: boolean } }
  | { ok: false; error?: string };

type AuditEntry = {
  id: string;
  action: string;
  createdAt: string | null;
  metadata: unknown;
  actor: { id: string; fullName: string | null; username: string | null } | null;
};

type DetailResponse =
  | {
      ok: true;
      payout: PendingPayout;
      organization: { id: number; publicName: string; username: string | null; status: string; stripeAccountId: string | null } | null;
      source: { title: string | null; href: string | null };
      audit: AuditEntry[];
    }
  | { ok: false; error?: string };

function payoutBadgeClass(status: string) {
  switch (status) {
    case "RELEASED":
      return "bg-emerald-500/15 text-emerald-100 border border-emerald-400/30";
    case "BLOCKED":
      return "bg-amber-500/15 text-amber-100 border border-amber-400/30";
    case "ACTION_REQUIRED":
      return "bg-amber-500/20 text-amber-100 border border-amber-400/40";
    case "RELEASING":
      return "bg-sky-500/15 text-sky-100 border border-sky-400/30";
    case "CANCELLED":
      return "bg-rose-500/15 text-rose-100 border border-rose-400/30";
    case "HELD":
    default:
      return "bg-white/10 text-white/80 border border-white/20";
  }
}

function resolvePayoutStatus(payout: Pick<PendingPayout, "status" | "blockedReason">) {
  if (payout.blockedReason?.startsWith("ACTION_REQUIRED")) return "ACTION_REQUIRED";
  return payout.status;
}

function formatActor(actor: AuditEntry["actor"]) {
  if (!actor) return "Sistema";
  if (actor.fullName) return actor.fullName;
  if (actor.username) return `@${actor.username}`;
  return "Utilizador";
}

function formatAuditMeta(meta: AuditEntry["metadata"]) {
  if (!meta || typeof meta !== "object") return [];
  const metadata = meta as Record<string, unknown>;
  const labels: Array<[string, string]> = [
    ["reason", "Motivo"],
    ["blockedReason", "Bloqueio"],
    ["transferId", "Transfer"],
    ["paymentIntentId", "PaymentIntent"],
    ["status", "Estado"],
  ];
  const lines = labels
    .map(([key, label]) => {
      const value = metadata[key];
      if (value === null || value === undefined || value === "") return null;
      return `${label}: ${String(value)}`;
    })
    .filter((line): line is string => Boolean(line));
  return lines;
}

function PayoutsSection() {
  const [status, setStatus] = useState("ALL");
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    if (cursor) params.set("cursor", String(cursor));
    return params.toString() ? `?${params.toString()}` : "";
  }, [status, q, cursor]);

  const { data, isLoading, mutate } = useSWR<PayoutListResponse>(
    `/api/admin/payouts/list${queryParams}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const detailKey = selectedId ? `/api/admin/payouts/${selectedId}` : null;
  const { data: detail, mutate: mutateDetail } = useSWR<DetailResponse>(detailKey, fetcher, {
    revalidateOnFocus: false,
  });

  const items = data && "ok" in data && data.ok ? data.items : [];
  const pagination = data && "ok" in data && data.ok ? data.pagination : { nextCursor: null, hasMore: false };
  const detailPayout = detail && "ok" in detail && detail.ok ? detail.payout : null;
  const detailOrg = detail && "ok" in detail && detail.ok ? detail.organization : null;
  const detailSource = detail && "ok" in detail && detail.ok ? detail.source : null;
  const detailAudit = detail && "ok" in detail && detail.ok ? detail.audit : [];

  async function runAction(id: number, action: string, reason?: string) {
    const body = reason ? JSON.stringify({ reason }) : undefined;
    await fetch(`/api/admin/payouts/${id}/${action}`, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body,
    });
    await mutate();
    if (selectedId === id) await mutateDetail();
  }

  return (
    <section className="admin-section space-y-6">
      <SectionHeader
        id="payouts"
        title="Payouts"
        subtitle="Gestão de holds, releases e bloqueios com auditoria completa."
      />

      <div className="admin-card-soft p-4">
        <div className="grid gap-3 md:grid-cols-[1.5fr_1fr]">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-white/45">Pesquisa</label>
            <input
              type="text"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setCursor(null);
              }}
              placeholder="payment_intent, source, recipient..."
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
              {["ALL", "HELD", "RELEASING", "RELEASED", "BLOCKED", "ACTION_REQUIRED", "CANCELLED"].map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="admin-card overflow-hidden">
          <table className="admin-table text-left">
            <thead>
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Limite hold</th>
                <th className="px-4 py-3">Recetor</th>
                <th className="px-4 py-3">Origem</th>
                <th className="px-4 py-3">Montante</th>
                <th className="px-4 py-3">Tentativas</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-4 text-center text-white/60">
                    A carregar...
                  </td>
                </tr>
              )}
              {!isLoading && (!items || items.length === 0) && (
                <tr>
                  <td colSpan={8} className="px-4 py-4 text-center text-white/60">
                    Sem payouts para estes filtros.
                  </td>
                </tr>
              )}
              {items.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-white/10 last:border-0 cursor-pointer hover:bg-white/5"
                  onClick={() => setSelectedId(p.id)}
                >
                  <td className="px-4 py-3 text-[11px] text-white/70">#{p.id}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-1 text-[11px] ${payoutBadgeClass(resolvePayoutStatus(p))}`}>
                      {resolvePayoutStatus(p)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-white/70">{formatDate(p.holdUntil)}</td>
                  <td className="px-4 py-3 text-[11px] text-white/70">
                    <div className="flex flex-col gap-1">
                      <span>{p.organization?.publicName ?? "—"}</span>
                      <span className="text-white/50">{p.recipientConnectAccountId}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-white/70">
                    <div className="flex flex-col gap-1">
                      <span>{p.source?.title ?? p.sourceType}</span>
                      <span className="text-white/50">#{p.sourceId}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-white/70">{formatMoney(p.amountCents, p.currency)}</td>
                  <td className="px-4 py-3 text-[11px] text-white/70">{p.retryCount}</td>
                  <td className="px-4 py-3 text-[11px] text-white/70">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          runAction(p.id, "release");
                        }}
                        className="admin-button-secondary px-2 py-1 text-xs"
                      >
                        Release
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          runAction(p.id, "force-release");
                        }}
                        className="admin-button-secondary px-2 py-1 text-xs"
                      >
                        Force
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const reason = window.prompt("Razão do cancel?", "ADMIN_CANCEL");
                          if (reason) runAction(p.id, "cancel", reason);
                        }}
                        className="admin-button-secondary px-2 py-1 text-xs"
                      >
                        Cancelar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagination.hasMore && (
            <div className="flex justify-center border-t border-white/10 p-4">
              <button
                onClick={() => setCursor(pagination.nextCursor)}
                className="admin-button-secondary px-4 py-2 text-xs"
              >
                Carregar mais
              </button>
            </div>
          )}
        </div>

        {detailPayout && (
          <div className="admin-card-soft p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Payout #{detailPayout.id}</h2>
                <div className="text-sm text-white/60">
                  <span>{detailPayout.sourceType}</span>
                  <span className="mx-1">·</span>
                  {detailSource?.href ? (
                    <Link href={detailSource.href} className="hover:underline">
                      #{detailPayout.sourceId}
                    </Link>
                  ) : (
                    <span>#{detailPayout.sourceId}</span>
                  )}
                  {detailSource?.title && <span className="ml-2 text-white/50">{detailSource.title}</span>}
                </div>
              </div>
              <span className={`inline-flex rounded-full px-2 py-1 text-[11px] ${payoutBadgeClass(resolvePayoutStatus(detailPayout))}`}>
                {resolvePayoutStatus(detailPayout)}
              </span>
            </div>

            <div className="mt-4 space-y-2 text-[12px] text-white/70">
              <p>Montante: {formatMoney(detailPayout.amountCents, detailPayout.currency)}</p>
              <p>Hold até: {formatDate(detailPayout.holdUntil)}</p>
              <p>Próxima tentativa: {formatDate(detailPayout.nextAttemptAt)}</p>
              <p>Transfer: {detailPayout.transferId || "—"}</p>
              <p>Liberado: {formatDate(detailPayout.releasedAt)}</p>
              {detailOrg && (
                <p>
                  Org: {detailOrg.publicName} ({detailOrg.username ?? "—"})
                </p>
              )}
              {detailPayout.blockedReason && <p>Bloqueio: {detailPayout.blockedReason}</p>}
            </div>

            <div className="mt-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Audit</p>
              <div className="mt-2 space-y-3 text-[12px] text-white/70">
                {detailAudit.length === 0 && <p>Sem eventos de audit.</p>}
                {detailAudit.map((item) => {
                  const metaLines = formatAuditMeta(item.metadata);
                  return (
                    <div key={item.id} className="admin-card-soft p-3">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-white/90">{item.action}</p>
                        <p className="text-[11px] text-white/50">{formatDate(item.createdAt)}</p>
                      </div>
                      <p className="text-[11px] text-white/60">Actor: {formatActor(item.actor)}</p>
                      {metaLines.length > 0 && (
                        <div className="mt-2 space-y-0.5 text-[11px] text-white/60">
                          {metaLines.map((line) => (
                            <div key={line}>{line}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
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
      subtitle="Pagamentos, payouts e reembolsos num painel único."
    >
      <section className="space-y-10">
        <AdminPageHeader
          title="Financeiro"
          subtitle="Visão consolidada de receita, payouts e reembolsos com ações críticas num só local."
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
