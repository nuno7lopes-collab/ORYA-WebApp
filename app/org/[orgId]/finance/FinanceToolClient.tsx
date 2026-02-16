"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
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

type FinanceOverviewResponse =
  | {
      ok: true;
      totals: { grossCents: number; netCents: number; feesCents: number; tickets: number; eventsWithSales: number };
      rolling: { last30: { netCents: number } };
      upcomingPayoutCents: number;
    }
  | { ok: false; error?: string };

type FinanceReconciliationResponse =
  | {
      ok: true;
      summary: {
        grossCents: number;
        feesCents: number;
        netCents: number;
        refundsCents: number;
        netAfterRefundsCents: number;
      };
      events: Array<{ id: number; title: string; netAfterRefundsCents: number }>;
    }
  | { ok: false; error?: string };

type OpsFeedResponse = {
  ok: boolean;
  items?: Array<{ id: string; eventType: string; createdAt: string; sourceType?: string | null; sourceId?: string | null }>;
  error?: string;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function parseView(raw: string | null | undefined, fallback: FinanceAllowedView): FinanceAllowedView {
  if (isFinanceAllowedView(raw)) return raw;
  return fallback;
}

export default function FinanceToolClient({ orgId, initialView }: FinanceToolClientProps) {
  const searchParams = useSearchParams();
  const view = parseView(searchParams?.get("view") ?? null, initialView);
  const orgApiBase = `/api/org/${orgId}`;

  const overviewKey = view === "overview" ? `${orgApiBase}/finance/overview` : null;
  const reconciliationKey = view === "reconciliation" ? `${orgApiBase}/finance/reconciliation` : null;
  const opsFeedKey = view === "ops" ? `${orgApiBase}/ops/feed?limit=25` : null;
  const { data: overview } = useSWR<FinanceOverviewResponse>(overviewKey, fetcher);
  const { data: reconciliation } = useSWR<FinanceReconciliationResponse>(reconciliationKey, fetcher);
  const { data: opsFeed } = useSWR<OpsFeedResponse>(opsFeedKey, fetcher);

  const exportRange = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    };
  }, []);

  const headerByView = useMemo<Record<FinanceAllowedView, string>>(
    () => ({
      overview: "Resumo financeiro operacional",
      invoicing: "Faturação",
      payouts: "Transferências",
      "refunds-disputes": "Reembolsos e disputas",
      reconciliation: "Reconciliação",
      ledger: "Ledger",
      exports: "Exports",
      ops: "Feed operacional",
    }),
    [],
  );

  return (
    <section className="space-y-4 text-white">
      <div className="rounded-3xl border border-white/12 bg-gradient-to-r from-[#0b1226]/80 via-[#101b39]/75 to-[#050811]/90 px-4 py-4 sm:px-6 sm:py-5 backdrop-blur-2xl">
        <h1 className="text-2xl font-semibold">{headerByView[view]}</h1>
        <p className="text-sm text-white/70">Finanças focadas em operação/compliance transacional, sem BI de performance.</p>
      </div>

      {view === "overview" && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Bruto total" value={overview?.ok ? `${(overview.totals.grossCents / 100).toFixed(2)} €` : "—"} />
          <MetricCard label="Líquido total" value={overview?.ok ? `${(overview.totals.netCents / 100).toFixed(2)} €` : "—"} />
          <MetricCard label="Taxas total" value={overview?.ok ? `${(overview.totals.feesCents / 100).toFixed(2)} €` : "—"} />
          <MetricCard label="Próxima transferência" value={overview?.ok ? `${(overview.upcomingPayoutCents / 100).toFixed(2)} €` : "—"} />
        </div>
      )}

      {view === "invoicing" && (
        <InvoicesClient
          organizationId={orgId}
          basePath={buildOrgHref(orgId, "/finance", { view: "invoicing" })}
          fullWidth
        />
      )}

      {view === "payouts" && <PayoutsPanel />}

      {view === "refunds-disputes" && <RefundsPanel />}

      {view === "reconciliation" && (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard
              label="Líquido após refunds"
              value={reconciliation?.ok ? `${(reconciliation.summary.netAfterRefundsCents / 100).toFixed(2)} €` : "—"}
            />
            <MetricCard
              label="Refunds"
              value={reconciliation?.ok ? `${(reconciliation.summary.refundsCents / 100).toFixed(2)} €` : "—"}
            />
            <MetricCard
              label="Taxas"
              value={reconciliation?.ok ? `${(reconciliation.summary.feesCents / 100).toFixed(2)} €` : "—"}
            />
          </div>
          <div className="rounded-2xl border border-white/12 bg-white/5 p-4 text-sm text-white/75">
            {reconciliation?.ok && reconciliation.events.length > 0 ? (
              <ul className="space-y-1">
                {reconciliation.events.slice(0, 20).map((event) => (
                  <li key={event.id}>{event.title}: {(event.netAfterRefundsCents / 100).toFixed(2)} €</li>
                ))}
              </ul>
            ) : (
              "Sem dados de reconciliação para mostrar."
            )}
          </div>
        </div>
      )}

      {view === "ledger" && (
        <div className="rounded-2xl border border-white/12 bg-white/5 p-4 text-sm text-white/75">
          O ledger é exportável para análise operacional e auditoria.
          <div className="mt-2">
            <a
              className={cn("underline")}
              href={`${orgApiBase}/finance/exports/ledger?from=${exportRange.from}&to=${exportRange.to}`}
              download
            >
              Descarregar ledger CSV (30 dias)
            </a>
          </div>
        </div>
      )}

      {view === "exports" && (
        <div className="rounded-2xl border border-white/12 bg-white/5 p-4 text-sm text-white/75">
          <ul className="space-y-1">
            <li>
              <a className={cn("underline")} href={`${orgApiBase}/finance/exports/fees?from=${exportRange.from}&to=${exportRange.to}`} download>
                Exportar taxas CSV
              </a>
            </li>
            <li>
              <a className={cn("underline")} href={`${orgApiBase}/finance/exports/ledger?from=${exportRange.from}&to=${exportRange.to}`} download>
                Exportar ledger CSV
              </a>
            </li>
            <li>
              <a className={cn("underline")} href={`${orgApiBase}/finance/exports/payouts?from=${exportRange.from}&to=${exportRange.to}`} download>
                Exportar transferências CSV
              </a>
            </li>
          </ul>
        </div>
      )}

      {view === "ops" && (
        <div className="rounded-2xl border border-white/12 bg-white/5 p-4 text-sm text-white/75">
          {opsFeed?.ok && (opsFeed.items?.length ?? 0) > 0 ? (
            <ul className="space-y-1">
              {(opsFeed.items ?? []).map((item) => (
                <li key={item.id}>
                  {new Date(item.createdAt).toLocaleString("pt-PT")} · {item.eventType}
                  {item.sourceType ? ` · ${item.sourceType}` : ""}
                  {item.sourceId ? ` #${item.sourceId}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            "Sem eventos no feed operacional."
          )}
        </div>
      )}
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/12 bg-gradient-to-br from-white/10 via-[#0b1124]/65 to-[#050810]/90 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.55)]">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/70">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

