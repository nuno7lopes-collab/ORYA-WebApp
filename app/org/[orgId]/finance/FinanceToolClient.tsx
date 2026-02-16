"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import InvoicesClient from "@/app/org/_internal/core/pagamentos/invoices/invoices-client";
import PayoutsPanel from "@/app/org/_internal/core/pagamentos/PayoutsPanel";
import RefundsPanel from "@/app/org/_internal/core/pagamentos/RefundsPanel";
import { buildOrgHref } from "@/lib/organizationIdUtils";
import { isFinanceAllowedView, type FinanceAllowedView } from "@/lib/domainBoundaries";
import { cn } from "@/lib/utils";

type FinanceToolClientProps = {
  orgId: number;
  initialView: FinanceAllowedView;
};

type ScopeOption = "all" | "eventos" | "padel";

type FinanceOverviewResponse = {
  ok?: boolean;
  totals: { grossCents: number; netCents: number; feesCents: number; tickets: number; eventsWithSales: number };
  rolling: {
    last7: { grossCents: number; netCents: number; feesCents: number; tickets: number };
    last30: { grossCents: number; netCents: number; feesCents: number; tickets: number };
  };
  upcomingPayoutCents: number;
  payoutAlerts?: { holdUntil: string | null; nextAttemptAt: string | null; actionRequired: boolean };
  events: Array<{
    id: number;
    title: string;
    startsAt: string | null;
    status: string | null;
    grossCents: number;
    netCents: number;
    feesCents: number;
    ticketsSold: number;
  }>;
};

type FinanceReconciliationResponse = {
  ok?: boolean;
  summary: {
    grossCents: number;
    feesCents: number;
    netCents: number;
    refundsCents: number;
    netAfterRefundsCents: number;
    holdCents?: number;
  };
  events: Array<{
    id: number;
    title: string;
    startsAt?: string | null;
    status?: string | null;
    payoutMode?: string | null;
    grossCents?: number;
    feesCents?: number;
    netCents?: number;
    refundsCents?: number;
    netAfterRefundsCents: number;
    holdCents?: number;
  }>;
};

type OpsFeedResponse = {
  ok?: boolean;
  items: Array<{ id: string; eventType: string; createdAt: string; sourceType?: string | null; sourceId?: string | null }>;
};

const swrOptions = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  shouldRetryOnError: true,
  errorRetryCount: 2,
} as const;

const CHART_COLORS = ["#22D3EE", "#60A5FA", "#34D399", "#F59E0B", "#A78BFA", "#F472B6"];
const DEFAULT_SCOPE: ScopeOption = "all";

function parseView(raw: string | null | undefined, fallback: FinanceAllowedView): FinanceAllowedView {
  if (isFinanceAllowedView(raw)) return raw;
  return fallback;
}

function parseScope(raw: string | null | undefined): ScopeOption {
  if (raw === "all" || raw === "eventos" || raw === "padel") return raw;
  return "all";
}

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function parseDate(raw: string | null | undefined, fallback: string) {
  if (!raw) return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return fallback;
  return raw;
}

function toCurrency(cents: number | null | undefined, currency = "EUR") {
  const value = (cents ?? 0) / 100;
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function compactDateTime(input: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function toEuroChartLabel(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return `${numeric.toFixed(2)} €`;
}

function prettyScope(scope: ScopeOption) {
  if (scope === "eventos") return "Eventos";
  if (scope === "padel") return "Padel";
  return "Tudo";
}

function unwrapEnvelope(payload: unknown) {
  if (!payload || typeof payload !== "object") return payload;
  const asRecord = payload as Record<string, unknown>;
  if (asRecord.data && typeof asRecord.data === "object") return asRecord.data;
  if (asRecord.result && typeof asRecord.result === "object") return asRecord.result;
  return payload;
}

async function apiFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const payload = await res.json().catch(() => null);
  const unwrapped = unwrapEnvelope(payload) as Record<string, unknown> | null;
  const topLevel = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  const hasErrorFlag = topLevel?.ok === false || unwrapped?.ok === false;
  if (!res.ok || hasErrorFlag) {
    const errorCode =
      (unwrapped?.error as string | undefined) ??
      (topLevel?.error as string | undefined) ??
      `HTTP_${res.status}`;
    throw new Error(errorCode);
  }
  return (unwrapped ?? payload) as T;
}

function buildScopeQuery(scope: ScopeOption) {
  if (scope === "padel") return { templateType: "PADEL" as const };
  if (scope === "eventos") return { excludeTemplateType: "PADEL" as const };
  return {};
}

function buildQueryString(query: Record<string, string | number | undefined | null>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || typeof value === "undefined" || value === "") continue;
    params.set(key, String(value));
  }
  return params.toString();
}

export default function FinanceToolClient({ orgId, initialView }: FinanceToolClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaults = defaultDateRange();
  const view = parseView(searchParams?.get("view") ?? null, initialView);
  const scope = parseScope(searchParams?.get("scope") ?? null);
  const from = parseDate(searchParams?.get("from") ?? null, defaults.from);
  const to = parseDate(searchParams?.get("to") ?? null, defaults.to);
  const orgApiBase = `/api/org/${orgId}`;
  const scopeQuery = buildScopeQuery(scope);

  const updateQuery = useCallback(
    (updates: Record<string, string | number | null | undefined>) => {
      const next = new URLSearchParams(searchParams?.toString() ?? "");
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || typeof value === "undefined" || value === "") {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }
      next.set("view", view);
      router.replace(buildOrgHref(orgId, "/finance", next));
    },
    [orgId, router, searchParams, view],
  );

  const overviewKey =
    view === "overview"
      ? `${orgApiBase}/finance/overview?${buildQueryString(scopeQuery)}`
      : null;
  const reconciliationKey =
    view === "reconciliation"
      ? `${orgApiBase}/finance/reconciliation?${buildQueryString(scopeQuery)}`
      : null;
  const opsFeedKey = view === "ops" ? `${orgApiBase}/ops/feed?limit=25` : null;

  const { data: overview, error: overviewError, isLoading: overviewLoading, mutate: mutateOverview } = useSWR<FinanceOverviewResponse>(
    overviewKey,
    apiFetcher,
    swrOptions,
  );
  const {
    data: reconciliation,
    error: reconciliationError,
    isLoading: reconciliationLoading,
    mutate: mutateReconciliation,
  } = useSWR<FinanceReconciliationResponse>(reconciliationKey, apiFetcher, swrOptions);
  const { data: opsFeed, error: opsFeedError, isLoading: opsFeedLoading, mutate: mutateOpsFeed } = useSWR<OpsFeedResponse>(
    opsFeedKey,
    apiFetcher,
    swrOptions,
  );

  const refreshCurrentView = useCallback(async () => {
    if (view === "overview") await mutateOverview();
    if (view === "reconciliation") await mutateReconciliation();
    if (view === "ops") await mutateOpsFeed();
  }, [mutateOpsFeed, mutateOverview, mutateReconciliation, view]);

  const headerByView = useMemo<Record<FinanceAllowedView, string>>(
    () => ({
      overview: "Resumo financeiro operacional",
      invoicing: "Faturação",
      payouts: "Transferências",
      "refunds-disputes": "Reembolsos e disputas",
      reconciliation: "Reconciliação",
      ledger: "Ledger",
      exports: "Exportações",
      ops: "Operações",
    }),
    [],
  );

  const overviewTotalsChartData = useMemo(() => {
    if (!overview) return [];
    return [
      { metric: "Bruto", value: (overview.totals.grossCents ?? 0) / 100, color: "#60A5FA" },
      { metric: "Taxas", value: (overview.totals.feesCents ?? 0) / 100, color: "#F59E0B" },
      { metric: "Líquido", value: (overview.totals.netCents ?? 0) / 100, color: "#22C55E" },
    ];
  }, [overview]);

  const overviewEventsChartData = useMemo(
    () =>
      (overview?.events ?? [])
        .map((event) => ({
          event: event.title.length > 18 ? `${event.title.slice(0, 18)}…` : event.title,
          net: (event.netCents ?? 0) / 100,
          gross: (event.grossCents ?? 0) / 100,
        }))
        .sort((a, b) => b.net - a.net)
        .slice(0, 10),
    [overview?.events],
  );

  const reconciliationChartData = useMemo(
    () =>
      (reconciliation?.events ?? [])
        .map((event) => ({
          event: event.title.length > 18 ? `${event.title.slice(0, 18)}…` : event.title,
          netAfterRefunds: (event.netAfterRefundsCents ?? 0) / 100,
        }))
        .sort((a, b) => b.netAfterRefunds - a.netAfterRefunds)
        .slice(0, 12),
    [reconciliation?.events],
  );

  const opsSourceDistribution = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of opsFeed?.items ?? []) {
      const key = item.sourceType ?? "SISTEMA";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([sourceType, count]) => ({ sourceType, count }));
  }, [opsFeed?.items]);
  const opsLastEvent = opsFeed?.items?.[0] ?? null;
  const activeFilters = useMemo(
    () => [
      { id: "scope", label: `Âmbito: ${prettyScope(scope)}` },
      { id: "from", label: `De: ${from}` },
      { id: "to", label: `Até: ${to}` },
    ],
    [from, scope, to],
  );
  const resetGlobalFilters = useCallback(() => {
    const range = defaultDateRange();
    updateQuery({
      scope: DEFAULT_SCOPE,
      from: range.from,
      to: range.to,
    });
  }, [updateQuery]);

  const ledgerExportHref = `${orgApiBase}/finance/exports/ledger?${buildQueryString({ from, to })}`;
  const feesExportHref = `${orgApiBase}/finance/exports/fees?${buildQueryString({ from, to })}`;
  const payoutsExportHref = `${orgApiBase}/finance/exports/payouts?${buildQueryString({ from, to })}`;

  return (
    <section className="space-y-5 text-white sm:space-y-6">
      <div className="rounded-3xl border border-white/16 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(20,20,20,0.92))] px-4 py-4 sm:px-6 sm:py-5 backdrop-blur-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{headerByView[view]}</h1>
            <p className="text-sm text-white/70">Finanças focadas em operação/compliance transacional, sem BI de performance.</p>
          </div>
          <div className="rounded-xl border border-amber-300/45 bg-amber-300/12 px-3 py-2 text-xs text-amber-100">
            Domínio de dados: <span className="font-semibold">Operação e compliance</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/12 bg-[#141414]/88 p-4 backdrop-blur-xl">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <FilterSelect
            label="Âmbito"
            value={scope}
            onChange={(value) => updateQuery({ scope: value })}
            options={[
              { label: "Tudo", value: "all" },
              { label: "Eventos", value: "eventos" },
              { label: "Padel", value: "padel" },
            ]}
          />
          <FilterDate label="Data início exportação" value={from} onChange={(value) => updateQuery({ from: value })} />
          <FilterDate label="Data fim exportação" value={to} onChange={(value) => updateQuery({ to: value })} />
          <div className="flex items-end">
            <button
              type="button"
              className="h-10 rounded-xl border border-[#22D3EE]/45 bg-[#22D3EE]/14 px-3 text-sm font-semibold text-white transition hover:border-[#22D3EE]/70 hover:bg-[#22D3EE]/22"
              onClick={() => void refreshCurrentView()}
            >
              Atualizar dados
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/65">
          {activeFilters.map((filter) => (
            <span key={filter.id} className="rounded-md border border-white/24 bg-white/[0.08] px-2 py-1 text-white/85">
              {filter.label}
            </span>
          ))}
          <button
            type="button"
            className="rounded-md border border-[#22D3EE]/40 bg-transparent px-2 py-1 font-semibold text-white transition hover:bg-[#22D3EE]/14"
            onClick={resetGlobalFilters}
          >
            Repor filtros
          </button>
          <button
            type="button"
            className="rounded-md border border-white/24 bg-white/10 px-2 py-1 text-white/90 transition hover:border-[#22D3EE]/40 hover:bg-[#22D3EE]/12"
            onClick={() => {
              const nextTo = new Date();
              const nextFrom = new Date();
              nextFrom.setDate(nextFrom.getDate() - 7);
              updateQuery({ from: nextFrom.toISOString().slice(0, 10), to: nextTo.toISOString().slice(0, 10) });
            }}
          >
            Últimos 7 dias
          </button>
          <button
            type="button"
            className="rounded-md border border-white/24 bg-white/10 px-2 py-1 text-white/90 transition hover:border-[#22D3EE]/40 hover:bg-[#22D3EE]/12"
            onClick={() => {
              const nextTo = new Date();
              const nextFrom = new Date();
              nextFrom.setDate(nextFrom.getDate() - 30);
              updateQuery({ from: nextFrom.toISOString().slice(0, 10), to: nextTo.toISOString().slice(0, 10) });
            }}
          >
            Últimos 30 dias
          </button>
          {(view === "invoicing" || view === "payouts" || view === "refunds-disputes" || view === "ops") && (
            <span className="rounded-md border border-cyan-300/40 bg-cyan-300/10 px-2 py-1 text-cyan-200">
              O âmbito afeta sobretudo resumo/reconciliação nesta versão.
            </span>
          )}
        </div>
      </div>

      {view === "overview" && (
        <ViewSection
          loading={overviewLoading}
          error={overviewError}
          onRetry={() => void mutateOverview()}
          empty={!overview}
          emptyLabel="Sem dados financeiros para mostrar."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard label="Bruto total" value={toCurrency(overview?.totals.grossCents)} />
            <MetricCard label="Líquido total" value={toCurrency(overview?.totals.netCents)} />
            <MetricCard label="Taxas total" value={toCurrency(overview?.totals.feesCents)} />
            <MetricCard label="Próxima transferência" value={toCurrency(overview?.upcomingPayoutCents)} />
            <MetricCard label="Últimos 7 dias (líquido)" value={toCurrency(overview?.rolling.last7.netCents)} />
            <MetricCard label="Eventos com vendas" value={String(overview?.totals.eventsWithSales ?? 0)} />
          </div>
          {overview?.payoutAlerts?.actionRequired ? (
            <div className="rounded-xl border border-amber-300/45 bg-amber-300/10 p-3 text-sm text-amber-100">
              <p className="font-semibold">Ação necessária em transferências</p>
              <p className="mt-1 text-amber-100/80">
                Próxima tentativa: {overview.payoutAlerts.nextAttemptAt ? compactDateTime(overview.payoutAlerts.nextAttemptAt) : "n/d"}
                {" · "}
                Retenção até: {overview.payoutAlerts.holdUntil ? compactDateTime(overview.payoutAlerts.holdUntil) : "n/d"}
              </p>
            </div>
          ) : null}

          <div className="grid gap-3 xl:grid-cols-2">
            <Panel title="Composição financeira" subtitle="Bruto, taxas e líquido">
              {overviewTotalsChartData.length > 0 ? (
                <ChartWrap className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={overviewTotalsChartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff18" />
                      <XAxis dataKey="metric" tick={{ fill: "#E5E7EB", fontSize: 11 }} />
                      <YAxis tick={{ fill: "#E5E7EB", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ background: "#161616", border: "1px solid #ffffff2e", borderRadius: 10 }}
                        formatter={(value) => [toEuroChartLabel(value), "Valor"]}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {overviewTotalsChartData.map((entry) => (
                          <Cell key={entry.metric} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartWrap>
              ) : (
                <EmptyState label="Sem composição disponível." />
              )}
            </Panel>

            <Panel title="Top eventos por líquido" subtitle="Comparação de líquido vs bruto">
              {overviewEventsChartData.length > 0 ? (
                <ChartWrap className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={overviewEventsChartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff18" />
                      <XAxis dataKey="event" tick={{ fill: "#E5E7EB", fontSize: 11 }} />
                      <YAxis tick={{ fill: "#E5E7EB", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ background: "#161616", border: "1px solid #ffffff2e", borderRadius: 10 }}
                        formatter={(value, key) => [toEuroChartLabel(value), String(key ?? "")]}
                      />
                      <Legend />
                      <Bar dataKey="gross" fill="#64748B" radius={[6, 6, 0, 0]} name="Bruto" />
                      <Bar dataKey="net" fill="#22C55E" radius={[6, 6, 0, 0]} name="Líquido" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartWrap>
              ) : (
                <EmptyState label="Sem eventos com vendas no âmbito atual." />
              )}
            </Panel>
          </div>
        </ViewSection>
      )}

      {view === "invoicing" && (
        <Panel title="Configuração de faturação" subtitle="Fluxo operacional de faturação">
          <InvoicesClient
            organizationId={orgId}
            basePath={buildOrgHref(orgId, "/finance", { view: "invoicing", scope, from, to })}
            fullWidth
          />
        </Panel>
      )}

      {view === "payouts" && (
        <Panel title="Transferências" subtitle="Estado da conta Stripe e transferências">
          <PayoutsPanel />
        </Panel>
      )}

      {view === "refunds-disputes" && (
        <Panel title="Reembolsos e disputas" subtitle="Fluxo de exceções financeiras">
          <RefundsPanel />
        </Panel>
      )}

      {view === "reconciliation" && (
        <ViewSection
          loading={reconciliationLoading}
          error={reconciliationError}
          onRetry={() => void mutateReconciliation()}
          empty={!reconciliation}
          emptyLabel="Sem dados de reconciliação para o âmbito atual."
        >
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard label="Líquido após reembolsos" value={toCurrency(reconciliation?.summary.netAfterRefundsCents)} />
            <MetricCard label="Reembolsos" value={toCurrency(reconciliation?.summary.refundsCents)} />
            <MetricCard label="Taxas" value={toCurrency(reconciliation?.summary.feesCents)} />
          </div>
          <Panel title="Reconciliação por evento" subtitle="Líquido pós-reembolsos">
            {reconciliationChartData.length > 0 ? (
              <ChartWrap>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reconciliationChartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff18" />
                    <XAxis dataKey="event" tick={{ fill: "#E5E7EB", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#E5E7EB", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: "#161616", border: "1px solid #ffffff2e", borderRadius: 10 }}
                      formatter={(value) => [toEuroChartLabel(value), "Líquido pós-reembolsos"]}
                    />
                    <Bar dataKey="netAfterRefunds" fill="#22C55E" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartWrap>
            ) : (
              <EmptyState label="Sem eventos para reconciliar." />
            )}
          </Panel>
          <Panel title="Detalhe por evento" subtitle="Bruto, taxas, reembolsos e líquido pós-reembolsos">
            <div className="overflow-auto rounded-xl border border-white/10">
              <table className="min-w-full text-sm">
                <thead className="bg-white/5 text-left text-[11px] uppercase tracking-wide text-white/60">
                  <tr>
                    <th className="px-3 py-2">Evento</th>
                    <th className="px-3 py-2 text-right">Bruto</th>
                    <th className="px-3 py-2 text-right">Taxas</th>
                    <th className="px-3 py-2 text-right">Reembolsos</th>
                    <th className="px-3 py-2 text-right">Líquido pós-reembolsos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {(reconciliation?.events ?? []).map((event) => (
                    <tr key={`rec-${event.id}`} className="bg-black/10">
                      <td className="px-3 py-2">{event.title}</td>
                      <td className="px-3 py-2 text-right">{toCurrency(event.grossCents ?? 0)}</td>
                      <td className="px-3 py-2 text-right">{toCurrency(event.feesCents ?? 0)}</td>
                      <td className="px-3 py-2 text-right">{toCurrency(event.refundsCents ?? 0)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-200">
                        {toCurrency(event.netAfterRefundsCents ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </ViewSection>
      )}

      {view === "ledger" && (
        <Panel title="Ledger operacional" subtitle="Export CSV com janela configurável">
          <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/80">
            <p>Período selecionado: <span className="font-semibold">{from}</span> até <span className="font-semibold">{to}</span></p>
            <a className={cn("mt-3 inline-block underline text-cyan-200 hover:text-cyan-100")} href={ledgerExportHref} download>
              Descarregar ledger CSV
            </a>
          </div>
        </Panel>
      )}

      {view === "exports" && (
        <Panel title="Exportações financeiras" subtitle="Conjunto canónico para operação/compliance">
          <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/80">
            <p>Período selecionado: <span className="font-semibold">{from}</span> até <span className="font-semibold">{to}</span></p>
            <ul className="mt-3 space-y-2">
              <li>
                <a className={cn("underline text-cyan-200 hover:text-cyan-100")} href={feesExportHref} download>
                  Exportar taxas CSV
                </a>
              </li>
              <li>
                <a className={cn("underline text-cyan-200 hover:text-cyan-100")} href={ledgerExportHref} download>
                  Exportar ledger CSV
                </a>
              </li>
              <li>
                <a className={cn("underline text-cyan-200 hover:text-cyan-100")} href={payoutsExportHref} download>
                  Exportar transferências CSV
                </a>
              </li>
            </ul>
          </div>
        </Panel>
      )}

      {view === "ops" && (
        <ViewSection
          loading={opsFeedLoading}
          error={opsFeedError}
          onRetry={() => void mutateOpsFeed()}
          empty={!opsFeed || opsFeed.items.length === 0}
          emptyLabel="Sem eventos nas operações."
        >
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard label="Eventos nas operações" value={String(opsFeed?.items.length ?? 0)} />
            <MetricCard label="Origens distintas" value={String(opsSourceDistribution.length)} />
            <MetricCard
              label="Último evento"
              value={opsLastEvent ? compactDateTime(opsLastEvent.createdAt) : "n/d"}
            />
          </div>
          <div className="grid gap-3 xl:grid-cols-[340px_1fr]">
            <Panel title="Distribuição por origem" subtitle="Volume nas operações">
              {opsSourceDistribution.length > 0 ? (
                <ChartWrap className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={opsSourceDistribution}
                        dataKey="count"
                        nameKey="sourceType"
                        cx="50%"
                        cy="50%"
                        outerRadius={84}
                        label={({ percent }) => `${Math.round((percent ?? 0) * 100)}%`}
                      >
                        {opsSourceDistribution.map((entry, index) => (
                          <Cell key={`${entry.sourceType}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "#161616", border: "1px solid #ffffff2e", borderRadius: 10 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartWrap>
              ) : (
                <EmptyState label="Sem distribuição nas operações." />
              )}
            </Panel>

            <Panel title="Linha temporal operacional" subtitle="Últimos eventos financeiros">
              <div className="space-y-2">
                {(opsFeed?.items ?? []).map((item) => (
                  <div key={item.id} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-cyan-300/40 bg-cyan-300/10 px-2 py-0.5 text-[11px] text-cyan-200">
                        {item.sourceType ?? "SISTEMA"}
                      </span>
                      <span className="text-white">{item.eventType}</span>
                    </div>
                    <div className="mt-1 text-xs text-white/65">
                      {compactDateTime(item.createdAt)}
                      {item.sourceId ? ` · ${item.sourceId}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </ViewSection>
      )}
    </section>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-[0.16em] text-white/60">{label}</span>
      <select
        className="h-10 rounded-xl border border-white/20 bg-[#141414] px-3 text-sm text-white outline-none transition focus:border-cyan-300/80"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterDate({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-[0.16em] text-white/60">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-xl border border-white/20 bg-[#141414] px-3 text-sm text-white outline-none transition focus:border-cyan-300/80"
      />
    </label>
  );
}

function ViewSection({
  loading,
  error,
  onRetry,
  empty,
  emptyLabel,
  children,
}: {
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  empty: boolean;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-white/12 bg-gradient-to-br from-white/[0.08] via-white/[0.04] to-transparent p-4">
        <p className="mb-1 text-xs uppercase tracking-[0.14em] text-white/55">A carregar dados da vista</p>
        <p className="mb-3 text-[12px] text-white/65">A sincronizar reconciliação e indicadores operacionais.</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-300/50 bg-gradient-to-br from-rose-500/16 via-rose-500/10 to-transparent p-4 text-sm text-rose-100">
        <p className="font-semibold">Falha ao carregar dados desta vista.</p>
        <p className="mt-1 rounded-md border border-rose-200/30 bg-black/15 px-2 py-1 text-rose-100/85">
          {error instanceof Error ? error.message : "Erro inesperado."}
        </p>
        <p className="mt-1 text-xs text-rose-100/65">Se persistir, valide âmbito, período e permissões financeiras.</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg border border-rose-200/50 bg-rose-200/20 px-3 py-1.5 text-xs font-semibold text-rose-50 transition hover:bg-rose-200/35"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (empty) {
    return <EmptyState label={emptyLabel} />;
  }

  return <div className="space-y-3">{children}</div>;
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/[0.05] p-4 shadow-[0_16px_46px_rgba(0,0,0,0.28)]">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {subtitle ? <p className="text-xs text-white/60">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

function ChartWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("h-72 w-full", className)}>{children}</div>;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/14 bg-gradient-to-br from-white/12 via-[#0b1124]/72 to-[#050810]/95 p-3 shadow-[0_20px_62px_rgba(0,0,0,0.5)]">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/70">{label}</p>
      <p className="mt-1 text-[24px] font-bold leading-tight text-white">{value}</p>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="h-44 animate-pulse rounded-2xl border border-white/10 bg-white/[0.05] p-3">
      <div className="h-3 w-2/5 rounded bg-white/20" />
      <div className="mt-4 h-7 w-3/5 rounded bg-white/15" />
      <div className="mt-6 h-20 w-full rounded bg-white/10" />
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/[0.05] p-4 text-sm text-white/75">
      <p className="font-semibold text-white/90">Sem dados disponíveis</p>
      <p className="mt-1">{label}</p>
    </div>
  );
}
