"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  RECHARTS_AXIS_TICK_STYLE,
  RECHARTS_LEGEND_WRAPPER_STYLE,
  RECHARTS_TOOLTIP_CONTENT_STYLE,
  RECHARTS_TOOLTIP_CURSOR_STYLE,
  RECHARTS_TOOLTIP_ITEM_STYLE,
  RECHARTS_TOOLTIP_LABEL_STYLE,
  formatRechartsLegendLabel,
  renderReadablePiePercentLabel,
} from "@/components/ui/rechartsTheme";
import { OryaDateField } from "@/components/ui/datetime";
import { CTA_PRIMARY_CLEAN, CTA_SECONDARY_CLEAN } from "@/app/org/_internal/core/dashboardUi";
import { buildOrgHref } from "@/lib/organizationIdUtils";
import { isFinanceAllowedView, type FinanceAllowedView } from "@/lib/domainBoundaries";
import { cn } from "@/lib/utils";

type FinanceToolClientProps = {
  orgId: number;
  initialView: FinanceAllowedView;
};

type ScopeOption = "all" | "eventos" | "padel";
type PaymentsStatus = "NO_STRIPE" | "PENDING" | "READY";
type PaymentsMode = "CONNECT" | "PLATFORM";
type StripeConnectApiStatus = "PLATFORM" | "NOT_CONNECTED" | "INCOMPLETE" | "CONNECTED";

type OrganizationMeFinanceResponse = {
  membershipRole?: string | null;
  paymentsStatus?: PaymentsStatus;
  paymentsMode?: PaymentsMode;
  organization?: {
    status?: string | null;
    officialEmail?: string | null;
    officialEmailVerifiedAt?: string | null;
    stripeAccountId?: string | null;
    stripeChargesEnabled?: boolean | null;
    stripePayoutsEnabled?: boolean | null;
  } | null;
};

type StripeStatusResponse = {
  status?: StripeConnectApiStatus;
  accountId?: string | null;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  requirements_due?: string[];
};

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

function isOwnerRole(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase() === "OWNER";
}

function normalizeStripeStatus(params: {
  paymentsMode: PaymentsMode;
  paymentsStatus: PaymentsStatus;
  stripeStatus?: StripeConnectApiStatus | null;
}): StripeConnectApiStatus {
  if (params.paymentsMode === "PLATFORM") return "PLATFORM";
  if (params.stripeStatus) return params.stripeStatus;
  if (params.paymentsStatus === "READY") return "CONNECTED";
  if (params.paymentsStatus === "PENDING") return "INCOMPLETE";
  return "NOT_CONNECTED";
}

function formatStatusCode(value: string | null | undefined) {
  if (!value) return "—";
  return value.replaceAll("_", " ");
}

function paymentsStatusLabel(status: PaymentsStatus) {
  if (status === "READY") return "Pronto";
  if (status === "PENDING") return "Pendente";
  return "Sem Stripe";
}

function stripeStatusLabel(status: StripeConnectApiStatus) {
  if (status === "CONNECTED") return "Ligado";
  if (status === "INCOMPLETE") return "Incompleto";
  if (status === "NOT_CONNECTED") return "Não ligado";
  return "Conta ORYA";
}

function mapStripeConnectError(errorCode: string | null, fallbackMessage: string) {
  const normalized = (errorCode ?? "").trim().toUpperCase();
  if (normalized === "APENAS_OWNER") return "Só o owner pode iniciar o onboarding Stripe.";
  if (normalized === "OFFICIAL_EMAIL_REQUIRED") return "Define o email oficial da organização antes de ligares o Stripe.";
  if (normalized === "OFFICIAL_EMAIL_NOT_VERIFIED") return "Verifica o email oficial da organização antes de ligares o Stripe.";
  if (normalized === "ORGANIZATION_NOT_ACTIVE") return "A organização tem de estar ativa para ligares o Stripe.";
  if (normalized === "PLATFORM_ACCOUNT") return "Esta organização usa pagamentos na conta ORYA (sem Stripe Connect).";
  return fallbackMessage;
}

function extractApiError(payload: unknown, fallbackErrorCode: string) {
  const topLevel = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  const data = topLevel?.data && typeof topLevel.data === "object" ? (topLevel.data as Record<string, unknown>) : null;
  const errorCodeRaw = topLevel?.errorCode ?? topLevel?.error ?? data?.errorCode ?? data?.error ?? fallbackErrorCode;
  const messageRaw = topLevel?.message ?? topLevel?.error ?? data?.message ?? "Erro inesperado.";
  return {
    errorCode: typeof errorCodeRaw === "string" ? errorCodeRaw : fallbackErrorCode,
    message: typeof messageRaw === "string" ? messageRaw : "Erro inesperado.",
  };
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
  const onboardingParam = (searchParams?.get("onboarding") ?? "").trim().toLowerCase();
  const orgMeKey = `${orgApiBase}/me`;

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
  const { data: orgMe, error: orgMeError, isLoading: orgMeLoading, mutate: mutateOrgMe } = useSWR<OrganizationMeFinanceResponse>(
    orgMeKey,
    apiFetcher,
    swrOptions,
  );

  const paymentsMode = orgMe?.paymentsMode ?? "CONNECT";
  const paymentsStatus = orgMe?.paymentsStatus ?? "NO_STRIPE";
  const isOwner = isOwnerRole(orgMe?.membershipRole);
  const stripeStatusKey = paymentsMode === "CONNECT" && isOwner ? `${orgApiBase}/finance/payouts/status` : null;

  const {
    data: stripeStatusData,
    error: stripeStatusError,
    isLoading: stripeStatusLoading,
    mutate: mutateStripeStatus,
  } = useSWR<StripeStatusResponse>(stripeStatusKey, apiFetcher, swrOptions);

  const [stripeActionLoading, setStripeActionLoading] = useState(false);
  const [stripeRefreshLoading, setStripeRefreshLoading] = useState(false);
  const [stripeActionError, setStripeActionError] = useState<string | null>(null);
  const [stripeActionMessage, setStripeActionMessage] = useState<string | null>(null);

  const organizationStatus = orgMe?.organization?.status ?? null;
  const officialEmail = orgMe?.organization?.officialEmail?.trim() ?? "";
  const officialEmailVerified = Boolean(officialEmail && orgMe?.organization?.officialEmailVerifiedAt);
  const stripeStatus = normalizeStripeStatus({
    paymentsMode,
    paymentsStatus,
    stripeStatus: stripeStatusData?.status ?? null,
  });
  const stripeAccountId = (stripeStatusData?.accountId ?? orgMe?.organization?.stripeAccountId ?? "").trim();
  const stripeChargesEnabled = Boolean(
    stripeStatusData?.charges_enabled ?? orgMe?.organization?.stripeChargesEnabled ?? false,
  );
  const stripePayoutsEnabled = Boolean(
    stripeStatusData?.payouts_enabled ?? orgMe?.organization?.stripePayoutsEnabled ?? false,
  );
  const stripeRequirements = Array.isArray(stripeStatusData?.requirements_due) ? stripeStatusData.requirements_due : [];

  const stripeSetupSummary = useMemo(() => {
    if (paymentsMode === "PLATFORM") {
      return {
        title: "Pagamentos em modo plataforma ORYA",
        description: "Esta organização recebe pagamentos pela conta da plataforma.",
      };
    }
    if (stripeStatus === "CONNECTED") {
      return {
        title: "Stripe ligado e operacional",
        description: "Cobranças e transferências estão ativas.",
      };
    }
    if (stripeStatus === "INCOMPLETE") {
      return {
        title: "Onboarding Stripe incompleto",
        description: "Faltam dados obrigatórios para ativar pagamentos e transferências.",
      };
    }
    return {
      title: "Stripe ainda não ligado",
      description: "Liga o Stripe para ativar pagamentos e transferências da organização.",
    };
  }, [paymentsMode, stripeStatus]);

  const activationRows = useMemo(
    () => [
      {
        id: "org_status",
        label: "Estado da organização",
        code: formatStatusCode(organizationStatus),
        active: organizationStatus === "ACTIVE",
      },
      {
        id: "payments_mode",
        label: "Modo de pagamentos",
        code: formatStatusCode(paymentsMode),
        active: paymentsMode === "PLATFORM" || paymentsStatus === "READY",
      },
      {
        id: "payments_status",
        label: "Estado pagamentos (UI)",
        code: `${paymentsStatus} · ${paymentsStatusLabel(paymentsStatus)}`,
        active: paymentsStatus === "READY",
      },
      {
        id: "stripe_api_status",
        label: "Estado Stripe (API)",
        code: `${stripeStatus} · ${stripeStatusLabel(stripeStatus)}`,
        active: stripeStatus === "CONNECTED" || stripeStatus === "PLATFORM",
      },
      {
        id: "stripe_charges",
        label: "Cobranças Stripe",
        code: stripeChargesEnabled ? "ATIVO" : "INATIVO",
        active: stripeChargesEnabled,
      },
      {
        id: "stripe_payouts",
        label: "Transferências Stripe",
        code: stripePayoutsEnabled ? "ATIVO" : "INATIVO",
        active: stripePayoutsEnabled,
      },
      {
        id: "official_email",
        label: "Email oficial verificado",
        code: officialEmailVerified ? "VERIFICADO" : "PENDENTE",
        active: officialEmailVerified,
      },
    ],
    [
      officialEmailVerified,
      organizationStatus,
      paymentsMode,
      paymentsStatus,
      stripeChargesEnabled,
      stripePayoutsEnabled,
      stripeStatus,
    ],
  );

  const refreshCurrentView = useCallback(async () => {
    if (view === "overview") await mutateOverview();
    if (view === "reconciliation") await mutateReconciliation();
    if (view === "ops") await mutateOpsFeed();
  }, [mutateOpsFeed, mutateOverview, mutateReconciliation, view]);

  const refreshStripeState = useCallback(async () => {
    const refreshTasks: Array<Promise<unknown>> = [mutateOrgMe()];
    if (stripeStatusKey) refreshTasks.push(mutateStripeStatus());
    await Promise.all(refreshTasks);
  }, [mutateOrgMe, mutateStripeStatus, stripeStatusKey]);

  const handleStripeConnect = useCallback(async () => {
    if (paymentsMode === "PLATFORM") return;
    setStripeActionError(null);
    setStripeActionMessage(null);
    setStripeActionLoading(true);
    try {
      const res = await fetch(`${orgApiBase}/finance/payouts/connect`, {
        method: "POST",
        cache: "no-store",
      });
      const payload = await res.json().catch(() => null);
      const unwrapped = unwrapEnvelope(payload) as Record<string, unknown> | null;
      const urlValue = unwrapped?.url ?? (payload && typeof payload === "object" ? (payload as Record<string, unknown>).url : null);
      const url = typeof urlValue === "string" ? urlValue.trim() : "";
      if (!res.ok || !url) {
        const parsed = extractApiError(payload, `HTTP_${res.status}`);
        setStripeActionError(mapStripeConnectError(parsed.errorCode, parsed.message));
        return;
      }
      window.location.assign(url);
    } catch (error) {
      setStripeActionError(error instanceof Error ? error.message : "Erro inesperado ao iniciar onboarding Stripe.");
    } finally {
      setStripeActionLoading(false);
    }
  }, [orgApiBase, paymentsMode]);

  const handleStripeRefresh = useCallback(async () => {
    setStripeActionError(null);
    setStripeActionMessage(null);
    setStripeRefreshLoading(true);
    try {
      await refreshStripeState();
      setStripeActionMessage("Estado Stripe atualizado.");
    } catch (error) {
      setStripeActionError(error instanceof Error ? error.message : "Erro ao atualizar estado Stripe.");
    } finally {
      setStripeRefreshLoading(false);
    }
  }, [refreshStripeState]);

  useEffect(() => {
    if (!onboardingParam) return;
    if (onboardingParam === "done") {
      setStripeActionMessage("Onboarding Stripe concluído. Estado sincronizado.");
      void refreshStripeState();
      return;
    }
    if (onboardingParam === "refresh") {
      setStripeActionMessage("Retomaste o onboarding Stripe. Continua a configuração.");
      void refreshStripeState();
    }
  }, [onboardingParam, refreshStripeState]);

  useEffect(() => {
    if (!onboardingParam) return;
    updateQuery({ onboarding: null });
  }, [onboardingParam, updateQuery]);

  useEffect(() => {
    if (!stripeActionMessage) return;
    const timeoutId = window.setTimeout(() => setStripeActionMessage(null), 4200);
    return () => window.clearTimeout(timeoutId);
  }, [stripeActionMessage]);

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
    <section className="org-clean-page space-y-5 sm:space-y-6">
      <div className="org-clean-section px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{headerByView[view]}</h1>
            <p className="text-sm text-white/78">Finanças focadas em operação/compliance transacional, sem BI de performance.</p>
          </div>
          <div className="rounded-xl border border-amber-300/45 bg-amber-300/12 px-3 py-2 text-xs text-amber-100">
            Domínio de dados: <span className="font-semibold">Operação e compliance</span>
          </div>
        </div>
      </div>

      <div className="org-clean-section p-4">
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
              className={`${CTA_PRIMARY_CLEAN} h-10 px-3`}
              onClick={() => void refreshCurrentView()}
            >
              Atualizar dados
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/72">
          {activeFilters.map((filter) => (
            <span key={filter.id} className="org-clean-chip">
              {filter.label}
            </span>
          ))}
          <button
            type="button"
            className={`${CTA_SECONDARY_CLEAN} px-2 py-1 text-xs`}
            onClick={resetGlobalFilters}
          >
            Repor filtros
          </button>
          <button
            type="button"
            className={`${CTA_SECONDARY_CLEAN} px-2 py-1 text-xs`}
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
            className={`${CTA_SECONDARY_CLEAN} px-2 py-1 text-xs`}
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
            <span className="rounded-md border border-cyan-300/40 bg-cyan-300/10 px-2 py-1 text-cyan-100">
              O âmbito afeta sobretudo resumo/reconciliação nesta versão.
            </span>
          )}
        </div>
      </div>

      <Panel title="Stripe e onboarding" subtitle="Local único para ligação Stripe, onboarding e estados de ativação">
        {orgMeLoading ? (
          <div className="rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2 text-sm text-white/75">
            A carregar estado financeiro da organização...
          </div>
        ) : orgMeError ? (
          <div className="rounded-xl border border-rose-300/50 bg-rose-500/14 px-3 py-2 text-sm text-rose-100">
            Erro ao carregar estado da organização: {orgMeError instanceof Error ? orgMeError.message : "erro inesperado."}
          </div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-white/70">Matriz de estados</p>
              <div className="mt-2 space-y-2">
                {activationRows.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-white">{row.label}</p>
                      <p className="text-xs text-white/70">{row.code}</p>
                    </div>
                    <ActiveStatePill active={row.active} />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-3">
                <p className="text-sm font-semibold text-white">{stripeSetupSummary.title}</p>
                <p className="mt-1 text-xs text-white/75">{stripeSetupSummary.description}</p>

                <div className="mt-3 grid gap-2 text-xs text-white/78">
                  <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                    Conta Stripe:{" "}
                    <span className="font-semibold text-white">
                      {stripeAccountId ? `…${stripeAccountId.slice(-6)}` : "Por ligar"}
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                    Requisitos pendentes:{" "}
                    <span className="font-semibold text-white">{stripeRequirements.length}</span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {paymentsMode === "CONNECT" && isOwner ? (
                    <button
                      type="button"
                      onClick={() => void handleStripeConnect()}
                      disabled={stripeActionLoading || stripeRefreshLoading}
                      className={cn(CTA_PRIMARY_CLEAN, "px-3 py-1.5 text-xs disabled:opacity-60")}
                    >
                      {stripeActionLoading
                        ? "A abrir Stripe..."
                        : stripeStatus === "INCOMPLETE"
                          ? "Continuar onboarding"
                          : stripeStatus === "CONNECTED"
                            ? "Rever onboarding"
                            : "Ligar Stripe"}
                    </button>
                  ) : null}

                  {paymentsMode === "CONNECT" && isOwner ? (
                    <button
                      type="button"
                      onClick={() => void handleStripeRefresh()}
                      disabled={stripeRefreshLoading || stripeActionLoading}
                      className={cn(CTA_SECONDARY_CLEAN, "px-3 py-1.5 text-xs disabled:opacity-60")}
                    >
                      {stripeRefreshLoading ? "A validar..." : "Atualizar estado Stripe"}
                    </button>
                  ) : null}

                  {paymentsMode === "CONNECT" && !isOwner ? (
                    <span className="rounded-lg border border-amber-300/40 bg-amber-300/10 px-2 py-1 text-[11px] text-amber-100">
                      Só o owner pode iniciar onboarding Stripe.
                    </span>
                  ) : null}

                  {stripeAccountId ? (
                    <a
                      href="https://dashboard.stripe.com/"
                      target="_blank"
                      rel="noreferrer"
                      className={cn(CTA_SECONDARY_CLEAN, "px-3 py-1.5 text-xs")}
                    >
                      Abrir dashboard Stripe
                    </a>
                  ) : null}

                  {!officialEmailVerified ? (
                    <a
                      href={buildOrgHref(orgId, "/settings", { tab: "official-email" })}
                      className={cn(CTA_SECONDARY_CLEAN, "px-3 py-1.5 text-xs")}
                    >
                      Configurar email oficial
                    </a>
                  ) : null}
                </div>

                {stripeStatusLoading ? (
                  <p className="mt-2 text-xs text-white/70">A validar estado Stripe...</p>
                ) : null}
                {stripeStatusError ? (
                  <div className="mt-2 rounded-lg border border-rose-300/40 bg-rose-500/12 px-2 py-1.5 text-xs text-rose-100">
                    Erro na validação Stripe: {stripeStatusError instanceof Error ? stripeStatusError.message : "erro inesperado."}
                  </div>
                ) : null}
                {stripeActionMessage ? (
                  <div className="mt-2 rounded-lg border border-emerald-300/40 bg-emerald-500/12 px-2 py-1.5 text-xs text-emerald-100">
                    {stripeActionMessage}
                  </div>
                ) : null}
                {stripeActionError ? (
                  <div className="mt-2 rounded-lg border border-rose-300/40 bg-rose-500/12 px-2 py-1.5 text-xs text-rose-100">
                    {stripeActionError}
                  </div>
                ) : null}
              </div>

              {stripeRequirements.length > 0 ? (
                <div className="rounded-2xl border border-amber-300/45 bg-amber-300/12 p-3 text-xs text-amber-100">
                  <p className="font-semibold">Itens pendentes no Stripe</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    {stripeRequirements.slice(0, 8).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {onboardingParam === "done" && stripeRequirements.length > 0 ? (
                <div className="rounded-2xl border border-amber-300/45 bg-amber-300/10 p-3 text-xs text-amber-100">
                  Regressaste do onboarding em estado incompleto. Abre o Stripe e conclui os itens pendentes.
                </div>
              ) : null}
            </div>
          </div>
        )}
      </Panel>

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
                      <XAxis dataKey="metric" tick={RECHARTS_AXIS_TICK_STYLE} tickLine={false} />
                      <YAxis tick={RECHARTS_AXIS_TICK_STYLE} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={RECHARTS_TOOLTIP_CONTENT_STYLE}
                        itemStyle={RECHARTS_TOOLTIP_ITEM_STYLE}
                        labelStyle={RECHARTS_TOOLTIP_LABEL_STYLE}
                        cursor={RECHARTS_TOOLTIP_CURSOR_STYLE}
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
                      <XAxis dataKey="event" tick={RECHARTS_AXIS_TICK_STYLE} tickLine={false} />
                      <YAxis tick={RECHARTS_AXIS_TICK_STYLE} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={RECHARTS_TOOLTIP_CONTENT_STYLE}
                        itemStyle={RECHARTS_TOOLTIP_ITEM_STYLE}
                        labelStyle={RECHARTS_TOOLTIP_LABEL_STYLE}
                        cursor={RECHARTS_TOOLTIP_CURSOR_STYLE}
                        formatter={(value, key) => [toEuroChartLabel(value), String(key ?? "")]}
                      />
                      <Legend formatter={formatRechartsLegendLabel} wrapperStyle={RECHARTS_LEGEND_WRAPPER_STYLE} />
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
                    <XAxis dataKey="event" tick={RECHARTS_AXIS_TICK_STYLE} tickLine={false} />
                    <YAxis tick={RECHARTS_AXIS_TICK_STYLE} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={RECHARTS_TOOLTIP_CONTENT_STYLE}
                      itemStyle={RECHARTS_TOOLTIP_ITEM_STYLE}
                      labelStyle={RECHARTS_TOOLTIP_LABEL_STYLE}
                      cursor={RECHARTS_TOOLTIP_CURSOR_STYLE}
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
                    <tr key={`rec-${event.id}`} className="bg-black/20">
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
          <div className="org-clean-section p-4 text-sm text-white/84">
            <p>Período selecionado: <span className="font-semibold">{from}</span> até <span className="font-semibold">{to}</span></p>
            <a className={cn("mt-3 inline-block underline text-cyan-200 hover:text-cyan-100")} href={ledgerExportHref} download>
              Descarregar ledger CSV
            </a>
          </div>
        </Panel>
      )}

      {view === "exports" && (
        <Panel title="Exportações financeiras" subtitle="Conjunto canónico para operação/compliance">
          <div className="org-clean-section p-4 text-sm text-white/84">
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
                        label={renderReadablePiePercentLabel}
                        labelLine={{ stroke: "rgba(226, 232, 240, 0.4)", strokeWidth: 1 }}
                      >
                        {opsSourceDistribution.map((entry, index) => (
                          <Cell key={`${entry.sourceType}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={RECHARTS_TOOLTIP_CONTENT_STYLE} itemStyle={RECHARTS_TOOLTIP_ITEM_STYLE} labelStyle={RECHARTS_TOOLTIP_LABEL_STYLE} />
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
                  <div key={item.id} className="rounded-xl border border-white/14 bg-white/[0.03] px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-cyan-300/40 bg-cyan-300/10 px-2 py-0.5 text-[11px] text-cyan-200">
                        {item.sourceType ?? "SISTEMA"}
                      </span>
                      <span className="text-white">{item.eventType}</span>
                    </div>
                    <div className="mt-1 text-xs text-white/74">
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
      <span className="org-clean-label">{label}</span>
      <select
        className="org-clean-input h-10 px-3 text-sm"
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
      <span className="org-clean-label">{label}</span>
      <OryaDateField value={value} onChange={onChange} buttonClassName="org-clean-input h-10 w-full text-sm" />
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
      <div className="org-clean-section p-4">
        <p className="mb-1 text-xs uppercase tracking-[0.14em] text-white/74">A carregar dados da vista</p>
        <p className="mb-3 text-[13px] text-white/80">A sincronizar reconciliação e indicadores operacionais.</p>
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
      <div className="rounded-2xl border border-rose-300/50 bg-rose-500/14 p-4 text-sm text-rose-100">
        <p className="font-semibold">Falha ao carregar dados desta vista.</p>
        <p className="mt-1 rounded-md border border-rose-200/30 bg-black/20 px-2 py-1 text-rose-100/88">
          {error instanceof Error ? error.message : "Erro inesperado."}
        </p>
        <p className="mt-1 text-xs text-rose-100/75">Se persistir, valide âmbito, período e permissões financeiras.</p>
        <button
          type="button"
          onClick={onRetry}
          className={`${CTA_SECONDARY_CLEAN} mt-3 px-3 py-1.5 text-xs`}
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
    <div className="org-clean-section p-4">
      <div className="mb-3">
        <h2 className="org-clean-title text-base">{title}</h2>
        {subtitle ? <p className="org-clean-subtitle text-[13px]">{subtitle}</p> : null}
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
    <div className="org-clean-section p-3">
      <p className="org-clean-label uppercase tracking-[0.16em] text-white/78">{label}</p>
      <p className="mt-1 text-[24px] font-bold leading-tight text-white">{value}</p>
    </div>
  );
}

function ActiveStatePill({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[11px]",
        active
          ? "border-emerald-300/60 bg-emerald-500/15 text-emerald-100"
          : "border-rose-300/55 bg-rose-500/12 text-rose-100",
      )}
    >
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

function LoadingCard() {
  return (
    <div className="org-clean-section h-44 animate-pulse p-3">
      <div className="h-3 w-2/5 rounded bg-white/20" />
      <div className="mt-4 h-7 w-3/5 rounded bg-white/15" />
      <div className="mt-6 h-20 w-full rounded bg-white/10" />
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="org-clean-section p-4 text-sm text-white/82">
      <p className="font-semibold text-white/94">Sem dados disponíveis</p>
      <p className="mt-1">{label}</p>
    </div>
  );
}
