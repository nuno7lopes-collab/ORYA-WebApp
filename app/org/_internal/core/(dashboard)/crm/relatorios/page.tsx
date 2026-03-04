"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/i18n";
import {
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
  DASHBOARD_TITLE,
  CTA_NEUTRAL,
} from "@/app/org/_internal/core/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function formatRate(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `${(value * 100).toFixed(1)}%`;
}

function normalizeWindowDays(raw: string | null) {
  const parsed = Number(raw ?? "");
  if (!Number.isFinite(parsed)) return 30;
  if ([14, 30, 60, 90, 180].includes(parsed)) return parsed;
  return 30;
}

function normalizeCohortMonths(raw: string | null) {
  const parsed = Number(raw ?? "");
  if (!Number.isFinite(parsed)) return 6;
  if ([3, 6, 9, 12, 18].includes(parsed)) return parsed;
  return 6;
}

const SEGMENT_SORT_KEYS = ["sent", "score", "ctr"] as const;
type SegmentSortKey = (typeof SEGMENT_SORT_KEYS)[number];

function normalizeSegmentSort(raw: string | null): SegmentSortKey {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "score") return "score";
  if (value === "ctr") return "ctr";
  return "sent";
}

const FRONT_DESK_SORT_KEYS = ["priority", "churn", "rfm"] as const;
type FrontDeskSortKey = (typeof FRONT_DESK_SORT_KEYS)[number];

function normalizeFrontDeskSort(raw: string | null): FrontDeskSortKey {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "churn") return "churn";
  if (value === "rfm") return "rfm";
  return "priority";
}

const SECTION_IDS = ["categories", "ab", "retention", "loyalty", "frontDesk"] as const;
type SectionId = (typeof SECTION_IDS)[number];

function parseSections(raw: string | null) {
  if (!raw) return new Set<SectionId>(SECTION_IDS);
  const parts = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const valid = parts.filter((item): item is SectionId =>
    SECTION_IDS.includes(item as SectionId),
  );
  if (valid.length === 0) return new Set<SectionId>(SECTION_IDS);
  return new Set<SectionId>(valid);
}

function serializeSections(sections: Set<SectionId>) {
  return SECTION_IDS.filter((id) => sections.has(id)).join(",");
}

type ReportCategory = {
  id: string;
  label: string;
  count: number;
  amountCents: number;
};

type CampaignAbVariant = {
  campaignId: string;
  campaignName: string;
  variantId: string;
  sent: number;
  opened: number;
  clicked: number;
  failed: number;
  openRate: number;
  ctr: number;
};

type JourneyAbVariant = {
  journeyId: string;
  journeyName: string;
  stepKey: string;
  variantId: string;
  completed: number;
  skipped: number;
  failed: number;
};

type CampaignAbWinner = {
  campaignId: string;
  campaignName: string;
  winnerVariantId: string;
  winnerCtr: number;
  winnerOpenRate: number;
  winnerSent: number;
  runnerUpVariantId: string | null;
  upliftCtr: number | null;
  upliftOpenRate: number | null;
};

type JourneyAbWinner = {
  journeyId: string;
  journeyName: string;
  stepKey: string;
  winnerVariantId: string;
  completionRate: number;
  failureRate: number;
  runnerUpVariantId: string | null;
  upliftCompletionRate: number | null;
};

type RetentionCohort = {
  month: string;
  size: number;
  retained30: number;
  retained60: number;
  retained90: number;
  eligible30: boolean;
  eligible60: boolean;
  eligible90: boolean;
  rate30: number | null;
  rate60: number | null;
  rate90: number | null;
};

type SegmentPerformanceRow = {
  segmentId: string;
  segmentName: string;
  sizeCache: number | null;
  campaignsSent: number;
  campaignsWithAb: number;
  sent: number;
  opened: number;
  clicked: number;
  failed: number;
  openRate: number;
  ctr: number;
  failRate: number;
  performanceScore: number;
};

type LoyaltyTopMember = {
  userId: string;
  displayName: string;
  contactEmail: string | null;
  netPoints: number;
  earnedPoints: number;
  spentPoints: number;
};

type FrontDeskContact = {
  contactId: string;
  displayName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  priorityScore: number;
  churnRiskScore: number;
  rfmScore: number;
  reactivationPropensityScore: number;
  matches30d: number;
  noShowRate90d: number;
  winRate90d: number;
  activityStatus: string | null;
  competitiveTier: string | null;
  estimatedValueBand: string;
  recommendedAction: string;
};

type ReportsResponse =
  | {
      ok: true;
      windowDays: number;
      cohortMonths: number;
      totals: { interactions: number; amountCents: number };
      customers: { total: number; new: number };
      campaignsSent: number;
      categories: ReportCategory[];
      abTesting: {
        campaignsWithAb: number;
        totalDeliveries: number;
        holdoutEstimated: number;
        campaignVariants: CampaignAbVariant[];
        campaignWinners: CampaignAbWinner[];
        journeyVariants: JourneyAbVariant[];
        journeyWinners: JourneyAbWinner[];
      };
      frontDesk: {
        queue: FrontDeskContact[];
      };
      retention: {
        cohortMonths: number;
        cohorts: RetentionCohort[];
        summary: {
          totalContacts: number;
          matureCohorts30: number;
          matureCohorts60: number;
          matureCohorts90: number;
          avgRate30: number;
          avgRate60: number;
          avgRate90: number;
        };
      };
      segmentPerformance: {
        segments: SegmentPerformanceRow[];
        summary: {
          totalSegments: number;
          withCampaigns: number;
          sent: number;
          opened: number;
          clicked: number;
          failed: number;
        };
      };
      loyalty: {
        enabled: boolean;
        programName: string | null;
        pointsName: string | null;
        programStatus: string | null;
        rulesActive: number;
        rewardsActive: number;
        activeMembers: number;
        earnedPoints: number;
        spentPoints: number;
        expiredPoints: number;
        adjustedPoints: number;
        netPoints: number;
        topMembers: LoyaltyTopMember[];
      };
    }
  | { ok: false; error?: string; message?: string };

export default function CrmRelatoriosPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const windowDaysFilter = useMemo(
    () => normalizeWindowDays(searchParams?.get("windowDays") ?? null),
    [searchParams],
  );
  const cohortMonthsFilter = useMemo(
    () => normalizeCohortMonths(searchParams?.get("cohortMonths") ?? null),
    [searchParams],
  );
  const segmentSort = useMemo(
    () => normalizeSegmentSort(searchParams?.get("segmentSort") ?? null),
    [searchParams],
  );
  const frontDeskSort = useMemo(
    () => normalizeFrontDeskSort(searchParams?.get("frontDeskSort") ?? null),
    [searchParams],
  );
  const visibleSections = useMemo(
    () => parseSections(searchParams?.get("sections") ?? null),
    [searchParams],
  );

  const setFilterParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    let changed = false;
    for (const [key, value] of Object.entries(updates)) {
      const current = params.get(key);
      if (value === null) {
        if (current !== null) {
          params.delete(key);
          changed = true;
        }
        continue;
      }
      if (current !== value) {
        params.set(key, value);
        changed = true;
      }
    }
    if (!changed) return;
    const target = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(target, { scroll: false });
  };

  const setFilterParam = (key: "windowDays" | "cohortMonths", value: number) => {
    setFilterParams({ [key]: String(value) });
  };

  const setSortParam = (key: "segmentSort" | "frontDeskSort", value: string) => {
    setFilterParams({ [key]: value });
  };

  const toggleSection = (sectionId: SectionId) => {
    const next = new Set<SectionId>(visibleSections);
    if (next.has(sectionId)) {
      next.delete(sectionId);
    } else {
      next.add(sectionId);
    }
    const serialized = serializeSections(next);
    setFilterParams({ sections: serialized.length ? serialized : null });
  };

  const isSectionVisible = (sectionId: SectionId) => {
    return visibleSections.has(sectionId);
  };

  useEffect(() => {
    const currentWindowRaw = searchParams?.get("windowDays") ?? null;
    const currentCohortRaw = searchParams?.get("cohortMonths") ?? null;
    const currentSegmentSortRaw = searchParams?.get("segmentSort") ?? null;
    const currentFrontDeskSortRaw = searchParams?.get("frontDeskSort") ?? null;
    const currentSectionsRaw = searchParams?.get("sections") ?? null;
    const normalizedWindow = normalizeWindowDays(currentWindowRaw);
    const normalizedCohort = normalizeCohortMonths(currentCohortRaw);
    const normalizedSegmentSort = normalizeSegmentSort(currentSegmentSortRaw);
    const normalizedFrontDeskSort = normalizeFrontDeskSort(currentFrontDeskSortRaw);
    const normalizedSections = serializeSections(parseSections(currentSectionsRaw));
    const hasCanonicalWindow = currentWindowRaw === String(normalizedWindow);
    const hasCanonicalCohort = currentCohortRaw === String(normalizedCohort);
    const hasCanonicalSegmentSort = currentSegmentSortRaw === normalizedSegmentSort;
    const hasCanonicalFrontDeskSort = currentFrontDeskSortRaw === normalizedFrontDeskSort;
    const hasCanonicalSections = currentSectionsRaw === normalizedSections;
    if (
      hasCanonicalWindow &&
      hasCanonicalCohort &&
      hasCanonicalSegmentSort &&
      hasCanonicalFrontDeskSort &&
      hasCanonicalSections
    ) {
      return;
    }

    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("windowDays", String(normalizedWindow));
    params.set("cohortMonths", String(normalizedCohort));
    params.set("segmentSort", normalizedSegmentSort);
    params.set("frontDeskSort", normalizedFrontDeskSort);
    params.set("sections", normalizedSections);
    const target = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(target, { scroll: false });
  }, [pathname, router, searchParams]);

  const reportsUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("windowDays", String(windowDaysFilter));
    params.set("cohortMonths", String(cohortMonthsFilter));
    return resolveCanonicalOrgApiPath(`/api/org/[orgId]/crm/relatorios?${params.toString()}`);
  }, [cohortMonthsFilter, windowDaysFilter]);

  const { data, isLoading, mutate, isValidating } = useSWR<ReportsResponse>(
    reportsUrl,
    fetcher,
  );
  const okData = data && data.ok ? data : null;
  const windowDays = okData?.windowDays ?? 30;
  const cohortMonths = okData?.cohortMonths ?? 6;
  const totals = okData?.totals ?? { interactions: 0, amountCents: 0 };
  const customers = okData?.customers ?? { total: 0, new: 0 };
  const campaignsSent = okData?.campaignsSent ?? 0;
  const categories = okData?.categories ?? [];
  const abTesting = okData?.abTesting ?? {
    campaignsWithAb: 0,
    totalDeliveries: 0,
    holdoutEstimated: 0,
    campaignVariants: [] as CampaignAbVariant[],
    journeyVariants: [] as JourneyAbVariant[],
    campaignWinners: [] as CampaignAbWinner[],
    journeyWinners: [] as JourneyAbWinner[],
  };
  const retention = okData?.retention ?? {
    cohortMonths,
    cohorts: [] as RetentionCohort[],
    summary: {
      totalContacts: 0,
      matureCohorts30: 0,
      matureCohorts60: 0,
      matureCohorts90: 0,
      avgRate30: 0,
      avgRate60: 0,
      avgRate90: 0,
    },
  };
  const segmentPerformance = okData?.segmentPerformance ?? {
    segments: [] as SegmentPerformanceRow[],
    summary: {
      totalSegments: 0,
      withCampaigns: 0,
      sent: 0,
      opened: 0,
      clicked: 0,
      failed: 0,
    },
  };
  const loyalty = okData?.loyalty ?? {
    enabled: false,
    programName: null,
    pointsName: null,
    programStatus: null,
    rulesActive: 0,
    rewardsActive: 0,
    activeMembers: 0,
    earnedPoints: 0,
    spentPoints: 0,
    expiredPoints: 0,
    adjustedPoints: 0,
    netPoints: 0,
    topMembers: [] as LoyaltyTopMember[],
  };
  const frontDeskQueue = okData?.frontDesk.queue ?? [];

  const sortedCategories = useMemo(() => [...categories].sort((a, b) => b.count - a.count), [categories]);
  const maxCategoryCount = sortedCategories[0]?.count ?? 0;
  const hasData = totals.interactions > 0 || customers.total > 0 || categories.some((item) => item.count > 0);

  const topCampaignVariants = useMemo(
    () => [...abTesting.campaignVariants].sort((a, b) => b.sent - a.sent).slice(0, 8),
    [abTesting.campaignVariants],
  );

  const topJourneyVariants = useMemo(
    () => [...abTesting.journeyVariants].sort((a, b) => b.completed - a.completed).slice(0, 8),
    [abTesting.journeyVariants],
  );

  const topCampaignWinners = useMemo(
    () => [...abTesting.campaignWinners].sort((a, b) => b.winnerSent - a.winnerSent).slice(0, 6),
    [abTesting.campaignWinners],
  );

  const topJourneyWinners = useMemo(
    () => [...abTesting.journeyWinners].sort((a, b) => b.completionRate - a.completionRate).slice(0, 6),
    [abTesting.journeyWinners],
  );

  const sortedSegmentRows = useMemo(() => {
    const rows = [...segmentPerformance.segments];
    rows.sort((a, b) => {
      if (segmentSort === "score") {
        if (b.performanceScore !== a.performanceScore) return b.performanceScore - a.performanceScore;
      } else if (segmentSort === "ctr") {
        if (b.ctr !== a.ctr) return b.ctr - a.ctr;
      } else {
        if (b.sent !== a.sent) return b.sent - a.sent;
      }
      return b.sent - a.sent;
    });
    return rows;
  }, [segmentPerformance.segments, segmentSort]);

  const sortedFrontDeskQueue = useMemo(() => {
    const rows = [...frontDeskQueue];
    rows.sort((a, b) => {
      if (frontDeskSort === "churn") {
        if (b.churnRiskScore !== a.churnRiskScore) return b.churnRiskScore - a.churnRiskScore;
      } else if (frontDeskSort === "rfm") {
        if (b.rfmScore !== a.rfmScore) return b.rfmScore - a.rfmScore;
      } else {
        if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
      }
      return b.priorityScore - a.priorityScore;
    });
    return rows;
  }, [frontDeskQueue, frontDeskSort]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className={DASHBOARD_LABEL}>CRM</p>
        <h1 className={DASHBOARD_TITLE}>Relatórios</h1>
        <p className={DASHBOARD_MUTED}>Dashboard avançado de CRM padel-first para operação diária.</p>
      </header>

      {data?.ok === false ? (
        <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-100">
          {data.error ?? data.message ?? "Não foi possível carregar os relatórios."}
        </div>
      ) : null}

      <section className={cn(DASHBOARD_CARD, "p-4")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] text-white/60">
            {isLoading
              ? "A carregar..."
              : `Janela de análise: últimos ${windowDays} dias · Coortes: ${cohortMonths} meses.`}
          </p>
          <button type="button" className={CTA_NEUTRAL} onClick={() => mutate()} disabled={isValidating}>
            {isValidating ? "A atualizar..." : "Atualizar"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-white/50">Atalhos janela:</span>
          {[30, 90, 180].map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setFilterParam("windowDays", days)}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-[11px] transition-colors",
                windowDaysFilter === days
                  ? "border-[#BDF6FF]/60 bg-[#BDF6FF]/15 text-[#D8FBFF]"
                  : "border-white/15 bg-white/5 text-white/75 hover:border-white/30",
              )}
            >
              {days}d
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-[12px] text-white/65">
            Janela KPI (dias)
            <select
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={String(windowDaysFilter)}
              onChange={(event) => setFilterParam("windowDays", Number(event.target.value))}
            >
              <option value="14">14 dias</option>
              <option value="30">30 dias</option>
              <option value="60">60 dias</option>
              <option value="90">90 dias</option>
              <option value="180">180 dias</option>
            </select>
          </label>
          <label className="text-[12px] text-white/65">
            Coortes (meses)
            <select
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={String(cohortMonthsFilter)}
              onChange={(event) => setFilterParam("cohortMonths", Number(event.target.value))}
            >
              <option value="3">3 meses</option>
              <option value="6">6 meses</option>
              <option value="9">9 meses</option>
              <option value="12">12 meses</option>
              <option value="18">18 meses</option>
            </select>
          </label>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-[12px] text-white/65">
            Ordenação segmentos
            <select
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={segmentSort}
              onChange={(event) => setSortParam("segmentSort", event.target.value)}
            >
              <option value="sent">Entregas enviadas</option>
              <option value="score">Score de performance</option>
              <option value="ctr">CTR</option>
            </select>
          </label>
          <label className="text-[12px] text-white/65">
            Ordenação receção
            <select
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={frontDeskSort}
              onChange={(event) => setSortParam("frontDeskSort", event.target.value)}
            >
              <option value="priority">Prioridade</option>
              <option value="churn">Risco churn</option>
              <option value="rfm">RFM</option>
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-white/50">Secções visíveis:</span>
          {[
            { id: "categories", label: "Interações" },
            { id: "ab", label: "A/B" },
            { id: "retention", label: "Coortes" },
            { id: "loyalty", label: "Loyalty" },
            { id: "frontDesk", label: "Receção" },
          ].map((section) => {
            const selected = isSectionVisible(section.id as SectionId);
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => toggleSection(section.id as SectionId)}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-[11px] transition-colors",
                  selected
                    ? "border-emerald-300/60 bg-emerald-400/15 text-emerald-100"
                    : "border-white/15 bg-white/5 text-white/60 hover:border-white/30",
                )}
              >
                {section.label}
              </button>
            );
          })}
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

      {isSectionVisible("categories") ? (
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
                        className="h-full rounded-full bg-gradient-to-r from-[#22D3EE]/65 via-[#7FE0FF]/55 to-[#6A7BFF]/60"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {isSectionVisible("ab") ? (
        <section className="grid gap-4 xl:grid-cols-2">
        <div className={cn(DASHBOARD_CARD, "space-y-3 p-4")}>
          <h2 className="text-sm font-semibold text-white">A/B campanhas</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[11px] text-white/55">Campanhas A/B</p>
              <p className="text-lg font-semibold text-white">{abTesting.campaignsWithAb}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[11px] text-white/55">Deliveries A/B</p>
              <p className="text-lg font-semibold text-white">{abTesting.totalDeliveries}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[11px] text-white/55">Holdout estimado</p>
              <p className="text-lg font-semibold text-white">{abTesting.holdoutEstimated}</p>
            </div>
          </div>
          <div className="space-y-2">
            {topCampaignVariants.map((variant) => (
              <div
                key={`${variant.campaignId}:${variant.variantId}`}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/75"
              >
                <p className="font-semibold text-white">
                  {variant.campaignName} · {variant.variantId}
                </p>
                <p>
                  Sent {variant.sent} · Open {(variant.openRate * 100).toFixed(1)}% · CTR{" "}
                  {(variant.ctr * 100).toFixed(1)}%
                </p>
              </div>
            ))}
            {topCampaignVariants.length === 0 ? (
              <p className="text-[12px] text-white/55">Sem campanhas A/B no período.</p>
            ) : null}
          </div>
          <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Winners</p>
            {topCampaignWinners.map((winner) => (
              <div key={winner.campaignId} className="text-[12px] text-white/75">
                <p className="font-semibold text-white">
                  {winner.campaignName} · {winner.winnerVariantId}
                </p>
                <p>
                  CTR {formatRate(winner.winnerCtr)}
                  {winner.upliftCtr !== null ? ` · uplift ${formatRate(winner.upliftCtr)}` : ""}
                </p>
              </div>
            ))}
            {topCampaignWinners.length === 0 ? <p className="text-[12px] text-white/55">Sem winner definido.</p> : null}
          </div>
        </div>

        <div className={cn(DASHBOARD_CARD, "space-y-3 p-4")}>
          <h2 className="text-sm font-semibold text-white">A/B journeys</h2>
          <div className="space-y-2">
            {topJourneyVariants.map((variant) => (
              <div
                key={`${variant.journeyId}:${variant.stepKey}:${variant.variantId}`}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/75"
              >
                <p className="font-semibold text-white">
                  {variant.journeyName} · {variant.stepKey} · {variant.variantId}
                </p>
                <p>
                  OK {variant.completed} · Skip {variant.skipped} · Failed {variant.failed}
                </p>
              </div>
            ))}
            {topJourneyVariants.length === 0 ? (
              <p className="text-[12px] text-white/55">Sem execuções A/B de journeys no período.</p>
            ) : null}
          </div>
          <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Winners</p>
            {topJourneyWinners.map((winner) => (
              <div key={`${winner.journeyId}:${winner.stepKey}`} className="text-[12px] text-white/75">
                <p className="font-semibold text-white">
                  {winner.journeyName} · {winner.stepKey} · {winner.winnerVariantId}
                </p>
                <p>
                  Completion {formatRate(winner.completionRate)}
                  {winner.upliftCompletionRate !== null
                    ? ` · uplift ${formatRate(winner.upliftCompletionRate)}`
                    : ""}
                </p>
              </div>
            ))}
            {topJourneyWinners.length === 0 ? <p className="text-[12px] text-white/55">Sem winner definido.</p> : null}
          </div>
        </div>
        </section>
      ) : null}

      {isSectionVisible("retention") ? (
        <section className="grid gap-4 xl:grid-cols-2">
        <div className={cn(DASHBOARD_CARD, "space-y-3 p-4")}>
          <h2 className="text-sm font-semibold text-white">Coortes de retenção padel</h2>
          <p className="text-[12px] text-white/55">Últimos {retention.cohortMonths} meses de coorte.</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[11px] text-white/55">R30 médio</p>
              <p className="text-lg font-semibold text-white">{formatRate(retention.summary.avgRate30)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[11px] text-white/55">R60 médio</p>
              <p className="text-lg font-semibold text-white">{formatRate(retention.summary.avgRate60)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[11px] text-white/55">R90 médio</p>
              <p className="text-lg font-semibold text-white">{formatRate(retention.summary.avgRate90)}</p>
            </div>
          </div>
          <div className="space-y-2">
            {retention.cohorts.map((cohort) => (
              <div key={cohort.month} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/75">
                <p className="font-semibold text-white">
                  {cohort.month} · {cohort.size} jogadores
                </p>
                <p>
                  R30 {formatRate(cohort.rate30)} · R60 {formatRate(cohort.rate60)} · R90 {formatRate(cohort.rate90)}
                </p>
              </div>
            ))}
            {retention.cohorts.length === 0 ? (
              <p className="text-[12px] text-white/55">Sem dados suficientes para coortes.</p>
            ) : null}
          </div>
        </div>

        <div className={cn(DASHBOARD_CARD, "space-y-3 p-4")}>
          <h2 className="text-sm font-semibold text-white">Desempenho por segmento</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[11px] text-white/55">Segmentos ativos</p>
              <p className="text-lg font-semibold text-white">{segmentPerformance.summary.totalSegments}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[11px] text-white/55">Com campanhas</p>
              <p className="text-lg font-semibold text-white">{segmentPerformance.summary.withCampaigns}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[11px] text-white/55">Entregas enviadas</p>
              <p className="text-lg font-semibold text-white">{segmentPerformance.summary.sent}</p>
            </div>
          </div>
          <div className="space-y-2">
            {sortedSegmentRows.slice(0, 8).map((segment) => (
              <div key={segment.segmentId} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/75">
                <p className="font-semibold text-white">{segment.segmentName}</p>
                <p>
                  Score {segment.performanceScore} · Sent {segment.sent} · Open{" "}
                  {(segment.openRate * 100).toFixed(1)}% · CTR {(segment.ctr * 100).toFixed(1)}%
                </p>
              </div>
            ))}
            {sortedSegmentRows.length === 0 ? (
              <p className="text-[12px] text-white/55">Sem desempenho de segmentos no período.</p>
            ) : null}
          </div>
        </div>
        </section>
      ) : null}

      {isSectionVisible("loyalty") ? (
        <section className={cn(DASHBOARD_CARD, "space-y-3 p-4")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-white">Loyalty padel-first</h2>
          <span className="text-[11px] text-white/50">
            {loyalty.enabled ? `${loyalty.programName ?? "Programa"} · ${loyalty.programStatus}` : "Programa inativo"}
          </span>
        </div>
        <div className="grid gap-2 md:grid-cols-5">
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-[11px] text-white/55">Membros ativos</p>
            <p className="text-lg font-semibold text-white">{loyalty.activeMembers}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-[11px] text-white/55">Pontos ganhos</p>
            <p className="text-lg font-semibold text-white">{loyalty.earnedPoints}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-[11px] text-white/55">Pontos usados</p>
            <p className="text-lg font-semibold text-white">{loyalty.spentPoints}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-[11px] text-white/55">Saldo líquido</p>
            <p className="text-lg font-semibold text-white">{loyalty.netPoints}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-[11px] text-white/55">Regras/Recompensas</p>
            <p className="text-lg font-semibold text-white">
              {loyalty.rulesActive}/{loyalty.rewardsActive}
            </p>
          </div>
        </div>
        <div className="space-y-2">
          {loyalty.topMembers.map((member) => (
            <div key={member.userId} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/75">
              <p className="font-semibold text-white">{member.displayName}</p>
              <p>
                Saldo {member.netPoints} · Earn {member.earnedPoints} · Spend {member.spentPoints}
              </p>
            </div>
          ))}
          {loyalty.topMembers.length === 0 ? (
            <p className="text-[12px] text-white/55">Sem movimento de loyalty no período.</p>
          ) : null}
        </div>
        </section>
      ) : null}

      {isSectionVisible("frontDesk") ? (
        <section className={cn(DASHBOARD_CARD, "space-y-3 p-4")}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Fila receção por risco/valor</h2>
          <span className="text-[11px] text-white/50">{sortedFrontDeskQueue.length} contactos</span>
        </div>
        <div className="grid gap-2">
          {sortedFrontDeskQueue.slice(0, 12).map((row) => (
            <div key={row.contactId} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2 text-[12px]">
                <div>
                  <p className="font-semibold text-white">{row.displayName}</p>
                  <p className="text-white/55">Prioridade {row.priorityScore} · Valor {row.estimatedValueBand}</p>
                </div>
                <div className="text-right text-white/60">
                  <p>Churn {row.churnRiskScore}</p>
                  <p>RFM {row.rfmScore}</p>
                  <p>Jogos 30d {row.matches30d}</p>
                </div>
              </div>
              <p className="mt-2 text-[12px] text-[#BDF6FF]">{row.recommendedAction}</p>
            </div>
          ))}
          {sortedFrontDeskQueue.length === 0 ? (
            <p className="text-[12px] text-white/55">Sem contactos priorizados no período.</p>
          ) : null}
        </div>
        </section>
      ) : null}
    </div>
  );
}
