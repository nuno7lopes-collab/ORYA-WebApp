"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";

import { useMemo } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/i18n";
import {
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
  DASHBOARD_TITLE,
  CTA_NEUTRAL,
} from "@/app/organizacao/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type ReportCategory = {
  id: string;
  label: string;
  count: number;
  amountCents: number;
};

type ReportsResponse =
  | {
      ok: true;
      windowDays: number;
      totals: { interactions: number; amountCents: number };
      customers: { total: number; new: number };
      campaignsSent: number;
      categories: ReportCategory[];
    }
  | { ok: false; error?: string; message?: string };

export default function CrmRelatoriosPage() {
  const { data, isLoading, mutate, isValidating } = useSWR<ReportsResponse>(resolveCanonicalOrgApiPath("/api/org/[orgId]/crm/relatorios"), fetcher);
  const okData = data && data.ok ? data : null;
  const windowDays = okData?.windowDays ?? 30;
  const totals = okData?.totals ?? { interactions: 0, amountCents: 0 };
  const customers = okData?.customers ?? { total: 0, new: 0 };
  const campaignsSent = okData?.campaignsSent ?? 0;
  const categories = okData?.categories ?? [];

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => b.count - a.count),
    [categories],
  );
  const maxCategoryCount = sortedCategories[0]?.count ?? 0;
  const hasData = totals.interactions > 0 || customers.total > 0 || categories.some((item) => item.count > 0);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className={DASHBOARD_LABEL}>CRM</p>
        <h1 className={DASHBOARD_TITLE}>Relatórios</h1>
        <p className={DASHBOARD_MUTED}>Visão rápida de clientes, receita e atividade.</p>
      </header>

      {data?.ok === false ? (
        <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-100">
          {data.error ?? data.message ?? "Não foi possível carregar os relatórios."}
        </div>
      ) : null}

      <section className={cn(DASHBOARD_CARD, "p-4")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] text-white/60">
            {isLoading ? "A carregar..." : `Janela de análise: últimos ${windowDays} dias.`}
          </p>
          <button type="button" className={CTA_NEUTRAL} onClick={() => mutate()} disabled={isValidating}>
            {isValidating ? "A atualizar..." : "Atualizar"}
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Clientes totais", value: customers.total },
            { label: `Novos clientes (${windowDays}d)`, value: customers.new },
            { label: `Interações (${windowDays}d)`, value: totals.interactions },
            { label: `Receita CRM (${windowDays}d)`, value: formatCurrency(totals.amountCents, "EUR") },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
              <p className="text-[11px] text-white/60">{item.label}</p>
              <p className="mt-2 text-xl font-semibold text-white">{item.value}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-white/55">Campanhas enviadas: {campaignsSent}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Interações por área</h2>
        {!isLoading && !hasData ? (
          <div className={cn(DASHBOARD_CARD, "p-6 text-center text-[12px] text-white/60")}>
            Ainda sem atividade suficiente para relatório detalhado.
          </div>
        ) : (
          <div className="grid gap-3">
            {sortedCategories.map((category) => {
              const percent =
                maxCategoryCount > 0 ? Math.max(6, Math.round((category.count / maxCategoryCount) * 100)) : 0;
              return (
                <div key={category.id} className={cn(DASHBOARD_CARD, "space-y-3 p-4")}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{category.label}</p>
                      <p className="text-[12px] text-white/60">{category.count} interações</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[12px] text-white/60">Receita</p>
                      <p className="text-lg font-semibold text-white">{formatCurrency(category.amountCents, "EUR")}</p>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/8">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#6BFFFF]/65 via-[#7FE0FF]/55 to-[#6A7BFF]/60"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
