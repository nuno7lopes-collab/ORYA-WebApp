"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { buildOrgHref } from "@/lib/organizationIdUtils";
import { isAnalyticsAllowedView, type AnalyticsAllowedView } from "@/lib/domainBoundaries";
import { cn } from "@/lib/utils";

type AnalyticsToolClientProps = {
  orgId: number;
  initialView: AnalyticsAllowedView;
};

type AnalyticsOverviewResponse =
  | {
      ok: true;
      range: string;
      currency: string | null;
      totalTickets: number;
      grossCents: number;
      feesCents: number;
      netRevenueCents: number;
      eventsWithSalesCount: number;
      activeEventsCount: number;
    }
  | { ok: false; error?: string };

type AnalyticsConversionResponse =
  | {
      ok: true;
      range: string;
      startedCount: number;
      succeededCount: number;
      conversionRateBps: number;
      conversionRatePct: number;
      breakdown: Array<{ sourceType: string; startedCount: number; succeededCount: number; conversionRateBps: number }>;
    }
  | { ok: false; error?: string };

type AnalyticsCohortsResponse =
  | {
      ok: true;
      months: number;
      cohorts: Array<{
        cohortMonth: string;
        buyers: number;
        retention: Array<{ monthOffset: number; retainedBuyers: number; retentionRateBps: number; revenueCents: number }>;
      }>;
    }
  | { ok: false; error?: string };

type AnalyticsTimeSeriesResponse =
  | {
      ok: true;
      currency: string | null;
      points: Array<{ date: string; grossCents: number; feesCents: number; netCents: number }>;
    }
  | { ok: false; error?: string };

type AnalyticsDimensionsResponse =
  | {
      ok: true;
      bucketDate: string | null;
      items: Record<string, Record<string, number>>;
    }
  | { ok: false; error?: string };

type AnalyticsBuyersResponse =
  | {
      ok: true;
      eventId: number;
      items: Array<{
        id: string;
        buyerName: string;
        buyerEmail: string;
        totalPaidCents: number;
        status: string;
      }>;
    }
  | { ok: false; error?: string };

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function parseView(raw: string | null | undefined, fallback: AnalyticsAllowedView): AnalyticsAllowedView {
  if (isAnalyticsAllowedView(raw)) return raw;
  return fallback;
}

export default function AnalyticsToolClient({ orgId, initialView }: AnalyticsToolClientProps) {
  const searchParams = useSearchParams();
  const view = parseView(searchParams?.get("view") ?? null, initialView);
  const eventIdParam = searchParams?.get("eventId") ?? null;
  const eventId = eventIdParam && Number.isFinite(Number(eventIdParam)) ? Number(eventIdParam) : null;
  const orgApiBase = `/api/org/${orgId}`;

  const overviewKey = view === "overview" ? `${orgApiBase}/analytics/overview?range=30d` : null;
  const conversionKey = view === "conversion" ? `${orgApiBase}/analytics/conversion?range=30d` : null;
  const cohortsKey = view === "cohorts" ? `${orgApiBase}/analytics/cohorts?months=12` : null;
  const buyersKey = view === "buyers" && eventId ? `${orgApiBase}/analytics/buyers?eventId=${eventId}` : null;
  const seriesKey = view === "time-series" ? `${orgApiBase}/analytics/time-series?range=30d` : null;
  const dimensionsKey = view === "dimensions" ? `${orgApiBase}/analytics/dimensoes?dimensionKey=MODULE` : null;

  const { data: overview } = useSWR<AnalyticsOverviewResponse>(overviewKey, fetcher);
  const { data: conversion } = useSWR<AnalyticsConversionResponse>(conversionKey, fetcher);
  const { data: cohorts } = useSWR<AnalyticsCohortsResponse>(cohortsKey, fetcher);
  const { data: buyers } = useSWR<AnalyticsBuyersResponse>(buyersKey, fetcher);
  const { data: series } = useSWR<AnalyticsTimeSeriesResponse>(seriesKey, fetcher);
  const { data: dimensions } = useSWR<AnalyticsDimensionsResponse>(dimensionsKey, fetcher);

  const headerByView = useMemo<Record<AnalyticsAllowedView, string>>(
    () => ({
      overview: "Resumo BI financeiro",
      conversion: "Conversão de checkout",
      cohorts: "Coortes financeiras",
      buyers: "Compradores",
      "time-series": "Séries temporais",
      dimensions: "Dimensões financeiras",
    }),
    [],
  );

  return (
    <section className="space-y-4 text-white">
      <div className="rounded-3xl border border-white/12 bg-gradient-to-r from-[#0b1226]/80 via-[#101b39]/75 to-[#050811]/90 px-4 py-4 sm:px-6 sm:py-5 backdrop-blur-2xl">
        <h1 className="text-2xl font-semibold">{headerByView[view]}</h1>
        <p className="text-sm text-white/70">Analytics focado em BI/performance monetária, sem CRM.</p>
      </div>

      {view === "overview" && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Bruto (30d)"
            value={overview?.ok ? `${(overview.grossCents / 100).toFixed(2)} €` : "—"}
          />
          <MetricCard
            label="Taxas (30d)"
            value={overview?.ok ? `${(overview.feesCents / 100).toFixed(2)} €` : "—"}
          />
          <MetricCard
            label="Líquido (30d)"
            value={overview?.ok ? `${(overview.netRevenueCents / 100).toFixed(2)} €` : "—"}
          />
          <MetricCard label="Eventos com vendas" value={overview?.ok ? String(overview.eventsWithSalesCount) : "—"} />
        </div>
      )}

      {view === "conversion" && (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard label="Checkouts iniciados" value={conversion?.ok ? String(conversion.startedCount) : "—"} />
            <MetricCard label="Pagamentos concluídos" value={conversion?.ok ? String(conversion.succeededCount) : "—"} />
            <MetricCard label="Taxa de conversão" value={conversion?.ok ? `${conversion.conversionRatePct.toFixed(2)}%` : "—"} />
          </div>
          <div className="rounded-2xl border border-white/12 bg-white/5 p-4 text-sm text-white/75">
            {conversion?.ok && conversion.breakdown.length > 0 ? (
              <ul className="space-y-1">
                {conversion.breakdown.map((item) => (
                  <li key={item.sourceType}>
                    {item.sourceType}: {item.succeededCount}/{item.startedCount} ({(item.conversionRateBps / 100).toFixed(2)}%)
                  </li>
                ))}
              </ul>
            ) : (
              "Sem dados de conversão para o período."
            )}
          </div>
        </div>
      )}

      {view === "cohorts" && (
        <div className="rounded-2xl border border-white/12 bg-white/5 p-4 text-sm text-white/75">
          {cohorts?.ok && cohorts.cohorts.length > 0 ? (
            <div className="space-y-3">
              {cohorts.cohorts.map((cohort) => (
                <div key={cohort.cohortMonth} className="rounded-xl border border-white/10 bg-black/25 p-3">
                  <p className="font-semibold text-white">{cohort.cohortMonth} · {cohort.buyers} compradores</p>
                  <div className="mt-2 grid gap-2 md:grid-cols-3">
                    {cohort.retention.slice(0, 6).map((row) => (
                      <div key={`${cohort.cohortMonth}-${row.monthOffset}`} className="text-[12px] text-white/70">
                        M+{row.monthOffset}: {row.retainedBuyers} ({(row.retentionRateBps / 100).toFixed(2)}%) · {(row.revenueCents / 100).toFixed(2)} €
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            "Sem coortes financeiras para mostrar."
          )}
        </div>
      )}

      {view === "buyers" && (
        <div className="space-y-3">
          {!eventId ? (
            <div className="rounded-2xl border border-white/12 bg-white/5 p-4 text-sm text-white/75">
              Define `eventId` na query para analisar compradores de um evento.
            </div>
          ) : buyers?.ok && buyers.items.length > 0 ? (
            <div className="overflow-auto rounded-2xl border border-white/12 bg-white/5 p-2">
              <table className="min-w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wide text-white/60">
                  <tr>
                    <th className="px-3 py-2">Comprador</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2 text-right">Pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {buyers.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2">{item.buyerName}</td>
                      <td className="px-3 py-2">{item.buyerEmail}</td>
                      <td className="px-3 py-2">{item.status}</td>
                      <td className="px-3 py-2 text-right">{(item.totalPaidCents / 100).toFixed(2)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/12 bg-white/5 p-4 text-sm text-white/75">
              Sem compradores para este evento.
            </div>
          )}
        </div>
      )}

      {view === "time-series" && (
        <div className="rounded-2xl border border-white/12 bg-white/5 p-4 text-sm text-white/75">
          {series?.ok && series.points.length > 0 ? (
            <ul className="space-y-1">
              {series.points.slice(0, 30).map((point) => (
                <li key={point.date}>
                  {point.date}: bruto {(point.grossCents / 100).toFixed(2)} € · taxas {(point.feesCents / 100).toFixed(2)} € · líquido {(point.netCents / 100).toFixed(2)} €
                </li>
              ))}
            </ul>
          ) : (
            "Sem série temporal disponível."
          )}
        </div>
      )}

      {view === "dimensions" && (
        <div className="rounded-2xl border border-white/12 bg-white/5 p-4 text-sm text-white/75">
          {dimensions?.ok ? (
            <ul className="space-y-1">
              {Object.keys(dimensions.items).map((key) => (
                <li key={key}>{key}</li>
              ))}
            </ul>
          ) : (
            "Sem dimensões para mostrar."
          )}
        </div>
      )}

      <div className="rounded-2xl border border-white/12 bg-white/5 p-3 text-[12px] text-white/60">
        Links rápidos:
        {" "}
        <a className={cn("underline")} href={buildOrgHref(orgId, "/analytics", { view: "conversion" })}>Conversão</a>
        {" · "}
        <a className={cn("underline")} href={buildOrgHref(orgId, "/analytics", { view: "cohorts" })}>Coortes</a>
        {" · "}
        <a className={cn("underline")} href={buildOrgHref(orgId, "/analytics", { view: "time-series" })}>Séries</a>
      </div>
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

