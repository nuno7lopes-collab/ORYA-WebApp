"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type OverviewResponse = {
  ok: boolean;
  totalTickets: number;
  totalRevenueCents: number;
  eventsWithSalesCount: number;
  activeEventsCount: number;
};

type EventItem = {
  id: number;
  slug: string;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  templateType?: string | null;
  locationName: string | null;
  locationCity: string | null;
  status: string;
  isFree: boolean;
  ticketsSold?: number;
  revenueCents?: number;
  capacity?: number | null;
  categories?: string[];
};

type EventsResponse = { ok: boolean; items: EventItem[] };

type PayoutSummaryResponse =
  | {
      ok: true;
      ticketsSold: number;
      revenueCents: number;
      grossCents: number;
      platformFeesCents: number;
      eventsWithSales: number;
      estimatedPayoutCents: number;
    }
  | { ok: false; error?: string };

type PromoCodeRow = {
  id: number;
  code: string;
  type: "PERCENTAGE" | "FIXED";
  value: number;
  maxUses: number | null;
  perUserLimit: number | null;
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;
  eventId: number | null;
  redemptionsCount?: number;
  autoApply?: boolean;
  minQuantity?: number | null;
  minTotalCents?: number | null;
};

type PromoListResponse = {
  ok: boolean;
  promoCodes: PromoCodeRow[];
  events: { id: number; title: string; slug: string }[];
  error?: string;
};

type BuyersResponse =
  | {
      ok: true;
      eventId: number;
      items: {
        id: string;
        ticketType: string;
        priceCents: number;
        totalPaidCents: number;
        status: string;
        purchasedAt: string;
        buyerName: string;
        buyerEmail: string;
        buyerCity: string | null;
        paymentIntentId: string | null;
      }[];
    }
  | { ok: false; error?: string };
type FinanceOverviewResponse =
  | {
      ok: true;
      totals: { grossCents: number; netCents: number; feesCents: number; tickets: number; eventsWithSales: number };
      rolling: {
        last7: { grossCents: number; netCents: number; feesCents: number; tickets: number };
        last30: { grossCents: number; netCents: number; feesCents: number; tickets: number };
      };
      upcomingPayoutCents: number;
      events: {
        id: number;
        title: string;
        slug: string;
        startsAt: string | null;
        status: string | null;
        grossCents: number;
        netCents: number;
        feesCents: number;
        ticketsSold: number;
      }[];
      error?: string;
    }
  | { ok: false; error?: string };
type MarketingOverviewResponse = {
  ok: boolean;
  totalTickets: number;
  ticketsWithPromo: number;
  guestTickets: number;
  totalRevenueCents: number;
  marketingRevenueCents: number;
  topPromo: { id: number; code: string; redemptionsCount: number; revenueCents: number } | null;
  events?: {
    id: number;
    title: string;
    slug: string;
    startsAt: string | null;
    templateType: string | null;
    locationName: string | null;
    locationCity: string | null;
    capacity: number | null;
    ticketsSold: number;
    revenueCents: number;
  }[];
};
type AudienceSummaryResponse =
  | {
      ok: true;
      segments: {
        frequent: number;
        newLast60d: number;
        highSpenders: number;
        groups: number;
        dormant90d: number;
        local: number;
      };
    }
  | { ok: false; error?: string };
type OrganizerStatus = {
  paymentsStatus?: "NO_STRIPE" | "PENDING" | "READY";
  profileStatus?: "MISSING_CONTACT" | "OK";
  contactEmail?: string | null;
};
type OrganizerLite = {
  id?: number;
  status?: string | null;
  entityType?: string | null;
  displayName?: string | null;
  city?: string | null;
  payoutIban?: string | null;
};

export default function OrganizadorPage() {
  const { user, profile, isLoading: userLoading, mutate: mutateUser } = useUser();
  const { openModal } = useAuthModal();
  const [ctaLoading, setCtaLoading] = useState(false);
  const [ctaError, setCtaError] = useState<string | null>(null);
  const [ctaSuccess, setCtaSuccess] = useState<string | null>(null);
  const [stripeCtaLoading, setStripeCtaLoading] = useState(false);
  const [stripeCtaError, setStripeCtaError] = useState<string | null>(null);
  const [billingSaving, setBillingSaving] = useState(false);
  const [billingMessage, setBillingMessage] = useState<string | null>(null);
  const [refundPolicy, setRefundPolicy] = useState<string>("");
  const [vatRate, setVatRate] = useState<string>("");
  const [entityType, setEntityType] = useState<string>("");
  const [businessName, setBusinessName] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [payoutIban, setPayoutIban] = useState<string>("");
  const [eventStatusFilter, setEventStatusFilter] = useState<"all" | "active" | "draft" | "finished" | "ongoing">("all");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [eventCategoryFilter, setEventCategoryFilter] = useState<string>("all");
  const [eventDateFilter, setEventDateFilter] = useState<"any" | "today" | "week" | "month" | "weekend">("any");
  const [salesMetric, setSalesMetric] = useState<"tickets" | "revenue">("revenue");
  const [salesEventId, setSalesEventId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [timeScope, setTimeScope] = useState<"all" | "upcoming" | "ongoing" | "past">("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [marketingSection, setMarketingSection] = useState<"overview" | "campaigns" | "audience" | "promoters" | "content" | "automation">("overview");
  const [salesRange, setSalesRange] = useState<"7d" | "30d" | "all">("30d");

  const tabParam = searchParams?.get("tab") || undefined;
  const activeTab = ["overview", "events", "sales", "finance", "marketing"].includes(tabParam || "")
    ? (tabParam as "overview" | "events" | "sales" | "finance" | "marketing")
    : "overview";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("organizadorFinanceLocal");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { refundPolicy?: string; vatRate?: string };
        if (parsed.refundPolicy) setRefundPolicy(parsed.refundPolicy);
        if (parsed.vatRate) setVatRate(parsed.vatRate);
      } catch {
        // ignore invalid
      }
    }
  }, []);

  // Redirecionar view=categories legacy para a nova página de categorias
  useEffect(() => {
    if (!searchParams) return;
    const viewParam = searchParams.get("view");
    const tabParam = searchParams.get("tab");
    if (tabParam === "events" && viewParam === "categories") {
      router.replace("/organizador/categorias", { scroll: false });
    }
  }, [router, searchParams]);

  useEffect(() => {
    const statusParam = searchParams?.get("status");
    const typeParam = searchParams?.get("type");
    const catParam = searchParams?.get("cat");
    const dateParam = searchParams?.get("date");
    const searchParam = searchParams?.get("search");
    const scopeParam = searchParams?.get("scope");
    const viewParam = searchParams?.get("view");
    const eventIdParam = searchParams?.get("eventId");
    const marketingSectionParam = searchParams?.get("section");

    if (statusParam) setEventStatusFilter(statusParam as typeof eventStatusFilter);
    if (typeParam) setEventTypeFilter(typeParam);
    if (catParam) setEventCategoryFilter(catParam);
    if (dateParam) setEventDateFilter(dateParam as typeof eventDateFilter);
    if (searchParam) setSearchTerm(searchParam);
    if (scopeParam) setTimeScope(scopeParam as typeof timeScope);
    if (viewParam === "table" || viewParam === "cards") setViewMode(viewParam);
    if (eventIdParam) setSalesEventId(Number(eventIdParam));
    if (marketingSectionParam) {
      const allowed = ["overview", "campaigns", "audience", "promoters", "content", "automation"] as const;
      if (allowed.includes(marketingSectionParam as (typeof allowed)[number])) {
        setMarketingSection(marketingSectionParam as typeof marketingSection);
      }
    }
  }, [searchParams]);

  const { data: organizerData, isLoading: organizerLoading, mutate: mutateOrganizer } = useSWR<
    OrganizerStatus & { profile?: { fullName?: string | null; city?: string | null } | null; organizer?: OrganizerLite | null; ok?: boolean }
  >(
    user ? "/api/organizador/me" : null,
    fetcher
  );

  const organizer = organizerData?.organizer ?? null;
  const loading = userLoading || organizerLoading;
  const paymentsStatus = organizerData?.paymentsStatus ?? "NO_STRIPE";
  const profileStatus = organizerData?.profileStatus ?? "MISSING_CONTACT";

  // Prefill onboarding fields quando já existirem dados
  useEffect(() => {
    if (!businessName && profile?.fullName) setBusinessName(profile.fullName);
    if (!city && profile?.city) setCity(profile.city);
    if (organizer) {
      if (!entityType && organizer.entityType) setEntityType(organizer.entityType);
      if (!businessName && organizer.displayName) setBusinessName(organizer.displayName);
      if (!city && organizer.city) setCity(organizer.city);
      if (!payoutIban && organizer.payoutIban) setPayoutIban(organizer.payoutIban);
    }
  }, [organizer, profile, businessName, city, entityType, payoutIban]);

  const { data: overview } = useSWR<OverviewResponse>(
    organizer?.status === "ACTIVE" ? "/api/organizador/estatisticas/overview?range=30d" : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  type TimeSeriesResponse = { ok: boolean; points: TimeSeriesPoint[]; range: { from: string | null; to: string | null } };
  const { data: timeSeries } = useSWR<TimeSeriesResponse>(
    organizer?.status === "ACTIVE" ? "/api/organizador/estatisticas/time-series?range=30d" : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const {
    data: events,
    error: eventsError,
    isLoading: eventsLoading,
    mutate: mutateEvents,
  } = useSWR<EventsResponse>(
    organizer?.status === "ACTIVE" ? "/api/organizador/events/list" : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    if (!salesEventId && events?.items?.length) {
      setSalesEventId(events.items[0].id);
    }
  }, [events, salesEventId]);

  const { data: payoutSummary } = useSWR<PayoutSummaryResponse>(
    organizer?.status === "ACTIVE" ? "/api/organizador/payouts/summary" : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const { data: financeOverview } = useSWR<FinanceOverviewResponse>(
    organizer?.status === "ACTIVE" && activeTab === "finance" ? "/api/organizador/finance/overview" : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const { data: salesSeries } = useSWR<TimeSeriesResponse>(
    salesEventId ? `/api/organizador/estatisticas/time-series?range=${salesRange}&eventId=${salesEventId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const { data: buyers } = useSWR<BuyersResponse>(
    salesEventId ? `/api/organizador/estatisticas/buyers?eventId=${salesEventId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const { data: marketingOverview } = useSWR<MarketingOverviewResponse>(
    organizer?.status === "ACTIVE" && activeTab === "marketing" ? "/api/organizador/marketing/overview" : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const [marketingFilters, setMarketingFilters] = useState({ eventId: "all", status: "all" as "all" | "active" | "inactive" });
  const { data: promoData, mutate: mutatePromos } = useSWR<PromoListResponse>(
    organizer?.status === "ACTIVE" ? "/api/organizador/promo" : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const { data: audienceSummary } = useSWR<AudienceSummaryResponse>(
    organizer?.status === "ACTIVE" && activeTab === "marketing" ? "/api/organizador/marketing/audience/summary" : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const currentQuery = searchParams?.toString() || "";

  useEffect(() => {
    const params = new URLSearchParams(currentQuery);
    const setParam = (key: string, value: string, defaultVal: string) => {
      if (!value || value === defaultVal) params.delete(key);
      else params.set(key, value);
    };
    setParam("status", eventStatusFilter, "all");
    setParam("type", eventTypeFilter, "all");
    setParam("cat", eventCategoryFilter, "all");
    setParam("date", eventDateFilter, "any");
    setParam("search", searchTerm, "");
    setParam("scope", timeScope, "all");
    setParam("view", viewMode, "cards");
    const qs = params.toString();
    if (qs !== currentQuery) {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [
    eventCategoryFilter,
    eventDateFilter,
    eventStatusFilter,
    eventTypeFilter,
    pathname,
    router,
    searchTerm,
    timeScope,
    viewMode,
    currentQuery,
  ]);

  async function handleBecomeOrganizer() {
    if (!user) {
      openModal({ mode: "login", redirectTo: "/organizador", showGoogle: true });
      return;
    }
    setCtaSuccess(null);
    if (!entityType.trim() || !businessName.trim() || !city.trim()) {
      setCtaError("Preenche tipo de entidade, nome e cidade.");
      return;
    }
    if (payoutIban && payoutIban.length < 10) {
      setCtaError("IBAN inválido. Deixa vazio ou insere um IBAN válido.");
      return;
    }
    setCtaLoading(true);
    setCtaError(null);
    try {
      const res = await fetch("/api/organizador/become", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          businessName,
          city,
          payoutIban,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.ok === false) {
        setCtaError(data?.error || "Não foi possível ativar a conta de organizador.");
        setCtaLoading(false);
        return;
      }

      await mutateOrganizer();
      await mutateUser();
      setCtaSuccess("Conta de organizador ativa. Podes começar a criar eventos.");
    } catch (err) {
      console.error("Erro inesperado ao tornar organizador", err);
      setCtaError("Erro inesperado ao ativar conta de organizador.");
    } finally {
      setCtaLoading(false);
    }
  }

  async function handleStripeConnect() {
    setStripeCtaError(null);
    setStripeCtaLoading(true);
    try {
      const res = await fetch("/api/organizador/payouts/connect", { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok || !json.url) {
        setStripeCtaError(json?.error || "Não foi possível gerar o link de onboarding.");
        setStripeCtaLoading(false);
        return;
      }
      window.location.href = json.url;
    } catch (err) {
      console.error(err);
      setStripeCtaError("Erro inesperado ao gerar link de onboarding.");
      setStripeCtaLoading(false);
    }
  }

  async function handleSaveBilling() {
    setBillingMessage(null);
    setBillingSaving(true);
    try {
      const res = await fetch("/api/organizador/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName,
          entityType,
          city,
          payoutIban,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setBillingMessage(json?.error || "Não foi possível guardar os dados de faturação.");
      } else {
        setBillingMessage("Dados de faturação guardados.");
        await mutateOrganizer();
      }
    } catch (err) {
      console.error("[finance] guardar faturação", err);
      setBillingMessage("Erro inesperado ao guardar os dados.");
    } finally {
      setBillingSaving(false);
    }
  }

  const handleSavePolicy = useCallback(() => {
    if (typeof window === "undefined") return;
    const payload = { refundPolicy, vatRate };
    window.localStorage.setItem("organizadorFinanceLocal", JSON.stringify(payload));
    setBillingMessage("Política e IVA guardados localmente.");
  }, [refundPolicy, vatRate]);

  const statsCards = useMemo(() => {
    const revenueEuros = (overview?.totalRevenueCents ?? 0) / 100;
    return [
      {
        label: "Bilhetes 30d",
        value: overview ? overview.totalTickets : "—",
        hint: "Bilhetes vendidos nos últimos 30 dias",
      },
      {
        label: "Receita 30d",
        value: overview ? `${revenueEuros.toFixed(2)} €` : "—",
        hint: "Valor bruto em cêntimos convertidos",
      },
      {
        label: "Eventos com vendas",
        value: overview ? overview.eventsWithSalesCount : "—",
        hint: "Eventos com pelo menos 1 venda",
      },
      {
        label: "Eventos publicados",
        value: overview ? overview.activeEventsCount : "—",
        hint: "Eventos PUBLISHED ligados a ti",
      },
    ];
  }, [overview]);

  const marketingCards = [
    "💸 Sem mensalidades. Pagas só quando vendes — defines se absorves ou passas a taxa ao cliente.",
    "🔐 Pagamentos seguros via Stripe; dinheiro direto na tua conta, com proteção anti-fraude.",
    "🎟️ Bilhetes digitais com QR e validação em tempo real no check-in.",
    "👥 Staff e acessos rápidos: dá permissões de check-in sem partilhar a conta.",
  ];

  const containerClasses = "mx-auto max-w-7xl px-4 pb-12 pt-6 md:pt-8 md:px-6 lg:px-8";
    const eventsList = useMemo(() => events?.items ?? [], [events]);
  const persistFilters = useCallback(
    (params: URLSearchParams) => {
      const paramString = params.toString();
      if (paramString !== currentQuery) {
        router.replace(paramString ? `${pathname}?${paramString}` : pathname, { scroll: false });
      }
      const payload = {
        status: eventStatusFilter,
        type: eventTypeFilter,
        cat: eventCategoryFilter,
        date: eventDateFilter,
        search: searchTerm,
        scope: timeScope,
        view: viewMode,
        section: marketingSection,
      };
      if (typeof window !== "undefined") {
        localStorage.setItem("organizadorFilters", JSON.stringify(payload));
      }
    },
    [
      eventCategoryFilter,
      eventDateFilter,
      eventStatusFilter,
      eventTypeFilter,
      pathname,
      router,
      searchTerm,
      timeScope,
      viewMode,
      marketingSection,
      currentQuery,
    ]
  );
  useEffect(() => {
    const params = new URLSearchParams(currentQuery);
    const setParam = (key: string, value: string, defaultVal: string) => {
      if (!value || value === defaultVal) params.delete(key);
      else params.set(key, value);
    };
    setParam("status", eventStatusFilter, "all");
    setParam("type", eventTypeFilter, "all");
    setParam("cat", eventCategoryFilter, "all");
    setParam("date", eventDateFilter, "any");
    setParam("search", searchTerm, "");
    setParam("scope", timeScope, "all");
    setParam("view", viewMode, "cards");
    setParam("section", marketingSection, "overview");
    if (salesEventId) params.set("eventId", String(salesEventId));
    else params.delete("eventId");
    persistFilters(params);
  }, [
    eventCategoryFilter,
    eventDateFilter,
    eventStatusFilter,
    eventTypeFilter,
    marketingSection,
    persistFilters,
    salesEventId,
    searchTerm,
    timeScope,
    viewMode,
    currentQuery,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (searchParams?.toString()) return;
    const saved = localStorage.getItem("organizadorFilters");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as {
        status?: string;
        type?: string;
        cat?: string;
        date?: string;
        search?: string;
        scope?: string;
        view?: string;
        section?: string;
      };
      if (parsed.status) setEventStatusFilter(parsed.status as typeof eventStatusFilter);
      if (parsed.type) setEventTypeFilter(parsed.type);
      if (parsed.cat) setEventCategoryFilter(parsed.cat);
      if (parsed.date) setEventDateFilter(parsed.date as typeof eventDateFilter);
      if (parsed.search) setSearchTerm(parsed.search);
      if (parsed.scope) setTimeScope(parsed.scope as typeof timeScope);
      if (parsed.view === "cards" || parsed.view === "table") setViewMode(parsed.view);
      if (
        parsed.section &&
        ["overview", "campaigns", "audience", "promoters", "content", "automation"].includes(parsed.section)
      ) {
        setMarketingSection(parsed.section as typeof marketingSection);
      }
    } catch {
      // ignore parse errors
    }
  }, [searchParams]);
  const upcomingCount = useMemo(
    () =>
      eventsList.filter((ev) => {
        const start = ev.startsAt ? new Date(ev.startsAt) : null;
        return ev.status === "PUBLISHED" && start && start.getTime() > Date.now();
      }).length,
    [eventsList]
  );
  const ongoingCount = useMemo(
    () =>
      eventsList.filter((ev) => {
        const start = ev.startsAt ? new Date(ev.startsAt) : null;
        const end = ev.endsAt ? new Date(ev.endsAt) : null;
        const now = Date.now();
        return ev.status === "PUBLISHED" && start && end && start.getTime() <= now && now <= end.getTime();
      }).length,
    [eventsList]
  );
  const finishedCount = useMemo(
    () =>
      eventsList.filter((ev) => {
        const end = ev.endsAt ? new Date(ev.endsAt) : null;
        return ev.status === "PUBLISHED" && end && end.getTime() < Date.now();
      }).length,
    [eventsList]
  );
  const filteredEvents = useMemo(() => {
    const now = new Date();
    const search = searchTerm.trim().toLowerCase();
    return eventsList.filter((ev) => {
      const startsAt = ev.startsAt ? new Date(ev.startsAt) : null;
      const endsAt = ev.endsAt ? new Date(ev.endsAt) : null;
      const isFinished = endsAt ? endsAt.getTime() < now.getTime() : false;
      const isFuture = startsAt ? startsAt.getTime() >= now.getTime() : false;
      const isOngoing = startsAt && endsAt ? startsAt.getTime() <= now.getTime() && now.getTime() <= endsAt.getTime() : false;

      if (eventStatusFilter === "draft" && ev.status !== "DRAFT") return false;
      if (eventStatusFilter === "active" && !(ev.status === "PUBLISHED" && isFuture)) return false;
      if (eventStatusFilter === "finished" && !isFinished) return false;
      if (eventStatusFilter === "ongoing" && !isOngoing) return false;

      if (eventTypeFilter !== "all" && ev.templateType !== eventTypeFilter) return false;
      if (eventCategoryFilter !== "all") {
        const cats = ev.categories ?? [];
        if (!cats.includes(eventCategoryFilter)) return false;
      }
      if (search) {
        if (!ev.title.toLowerCase().includes(search)) return false;
      }

      if (eventDateFilter !== "any" && startsAt) {
        const diffDays = (startsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        if (eventDateFilter === "today" && Math.floor(diffDays) !== 0) return false;
        if (eventDateFilter === "week" && diffDays > 7) return false;
        if (eventDateFilter === "month" && diffDays > 31) return false;
        if (eventDateFilter === "weekend") {
          const day = startsAt.getDay();
          if (day !== 6 && day !== 0) return false;
        }
      }

      if (timeScope === "upcoming" && !isFuture) return false;
      if (timeScope === "ongoing" && !isOngoing) return false;
      if (timeScope === "past" && !isFinished) return false;

      return true;
    });
  }, [eventCategoryFilter, eventDateFilter, eventStatusFilter, eventTypeFilter, eventsList, searchTerm, timeScope]);
  const activeFilterCount = useMemo(
    () =>
      [
        eventStatusFilter !== "all",
        eventTypeFilter !== "all",
        eventCategoryFilter !== "all",
        eventDateFilter !== "any",
        timeScope !== "all",
        searchTerm.trim() !== "",
      ].filter(Boolean).length,
    [eventCategoryFilter, eventDateFilter, eventStatusFilter, eventTypeFilter, searchTerm, timeScope]
  );

  const selectedSalesEvent = salesEventId ? eventsList.find((ev) => ev.id === salesEventId) ?? null : null;
  const financeData = financeOverview && financeOverview.ok ? financeOverview : null;
  const financeSummary = payoutSummary && "ok" in payoutSummary && payoutSummary.ok ? payoutSummary : null;
  const stripeState = useMemo(() => {
    if (paymentsStatus === "READY") {
      return { badge: "Ativo", tone: "success", title: "Conta Stripe ligada ✅", desc: "Já podes vender bilhetes pagos e receber os teus payouts normalmente.", cta: "Abrir painel Stripe" };
    }
    if (paymentsStatus === "PENDING") {
      return { badge: "Onboarding incompleto", tone: "warning", title: "Conta Stripe em configuração", desc: "Conclui o onboarding no Stripe para começares a receber os pagamentos dos teus bilhetes.", cta: "Continuar configuração no Stripe" };
    }
    return { badge: "Por ligar", tone: "neutral", title: "Ainda não ligaste a tua conta Stripe", desc: "Podes criar eventos gratuitos, mas para vender bilhetes pagos precisas de ligar uma conta Stripe.", cta: "Ligar conta Stripe" };
  }, [paymentsStatus]);

  const marketingPromos = useMemo(() => promoData?.promoCodes ?? [], [promoData]);
  const marketingEvents = useMemo(() => promoData?.events ?? [], [promoData]);
  const filteredPromos = useMemo(() => {
    return marketingPromos.filter((p) => {
      if (marketingFilters.eventId !== "all" && `${p.eventId ?? "global"}` !== marketingFilters.eventId) return false;
      if (marketingFilters.status === "active" && !p.active) return false;
      if (marketingFilters.status === "inactive" && p.active) return false;
      return true;
    });
  }, [marketingFilters.eventId, marketingFilters.status, marketingPromos]);
  const marketingKpis = useMemo(() => {
    const activePromos = marketingPromos.filter((p) => p.active).length;
    const fallbackTop = [...marketingPromos].sort(
      (a, b) => (b.redemptionsCount ?? 0) - (a.redemptionsCount ?? 0)
    )[0];
    return {
      totalTickets: marketingOverview?.totalTickets ?? overview?.totalTickets ?? 0,
      ticketsWithPromo: marketingOverview?.ticketsWithPromo ?? marketingPromos.reduce((sum, p) => sum + (p.redemptionsCount ?? 0), 0),
      guestTickets: marketingOverview?.guestTickets ?? 0,
      marketingRevenueCents: marketingOverview?.marketingRevenueCents ?? 0,
      activePromos,
      topPromo: marketingOverview?.topPromo ?? (fallbackTop
        ? {
            id: fallbackTop.id,
            code: fallbackTop.code,
            redemptionsCount: fallbackTop.redemptionsCount ?? 0,
            revenueCents: 0,
          }
        : null),
    };
  }, [marketingOverview, marketingPromos, overview]);
  const buyersItems = buyers && buyers.ok !== false ? buyers.items : [];
  const salesKpis = useMemo(() => {
    const tickets = salesSeries?.points?.reduce((sum, p) => sum + p.tickets, 0) ?? 0;
    const revenueCents = salesSeries?.points?.reduce((sum, p) => sum + p.revenueCents, 0) ?? 0;
    const eventsWithSales = tickets > 0 ? 1 : 0;
    const avgOccupancy = (() => {
      const capacity = selectedSalesEvent?.capacity ?? null;
      if (!capacity) return null;
      const sold = selectedSalesEvent?.ticketsSold ?? 0;
      return Math.min(100, Math.round((sold / capacity) * 100));
    })();
    return { tickets, revenueCents, eventsWithSales, avgOccupancy };
  }, [salesSeries?.points, selectedSalesEvent]);

  const topEvents = useMemo(() => {
    return [...eventsList]
      .filter((ev) => (ev.revenueCents ?? 0) > 0 || (ev.ticketsSold ?? 0) > 0)
      .sort((a, b) => (b.revenueCents ?? 0) - (a.revenueCents ?? 0) || (b.ticketsSold ?? 0) - (a.ticketsSold ?? 0))
      .slice(0, 5);
  }, [eventsList]);

  const exportFinanceCsv = useCallback(() => {
    if (!financeData || !financeData.events.length) return;
    const header = ["ID", "Evento", "Bilhetes", "Bruto (€)", "Taxas (€)", "Líquido (€)", "Estado", "Data"];
    const rows = financeData.events.map((ev) => [
      ev.id,
      ev.title,
      ev.ticketsSold,
      (ev.grossCents / 100).toFixed(2),
      (ev.feesCents / 100).toFixed(2),
      (ev.netCents / 100).toFixed(2),
      ev.status ?? "",
      ev.startsAt ? new Date(ev.startsAt).toLocaleDateString("pt-PT") : "",
    ]);
    const csv = [header.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vendas-por-evento.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [financeData]);

  const handleExportSalesCsv = useCallback(() => {
    if (!salesSeries?.points?.length || !selectedSalesEvent) return;
    const header = ["Data", "Bilhetes", "Receita (€)"];
    const rows = salesSeries.points.map((p) => {
      const date = new Date(p.date).toLocaleDateString("pt-PT");
      return [date, p.tickets, (p.revenueCents / 100).toFixed(2)];
    });
    const csv = [header.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const rangeLabel = salesRange === "all" ? "sempre" : `${salesRange}`;
    a.download = `vendas-${selectedSalesEvent.title}-${rangeLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [salesRange, salesSeries?.points, selectedSalesEvent]);
  const fillTheRoomEvents = useMemo(() => {
    const sourceEvents =
      marketingOverview?.events && marketingOverview.events.length > 0 ? marketingOverview.events : eventsList;
    const now = new Date();
    return sourceEvents
      .filter((ev) => {
        const start = ev.startsAt ? new Date(ev.startsAt) : null;
        return start && start.getTime() >= now.getTime();
      })
      .sort((a, b) => (a.startsAt && b.startsAt ? new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime() : 0))
      .slice(0, 6)
      .map((ev) => {
        const start = ev.startsAt ? new Date(ev.startsAt) : null;
        const diffDays = start ? Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
        const capacity = ev.capacity ?? null;
        const sold = ev.ticketsSold ?? 0;
        const occupancy = capacity ? Math.min(1, sold / capacity) : null;
        let tag: { label: string; tone: string; suggestion: string } = {
          label: "Atenção",
          tone: "border-amber-400/40 bg-amber-400/10 text-amber-100",
          suggestion: "Criar código -10% 48h",
        };
        if (occupancy !== null) {
          if (occupancy >= 0.8) {
            tag = {
              label: "Confortável",
              tone: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
              suggestion: "Preparar lista de espera",
            };
          } else if (occupancy < 0.4 && (diffDays ?? 0) <= 7) {
            tag = {
              label: "Crítico",
              tone: "border-red-400/50 bg-red-500/10 text-red-100",
              suggestion: "Last-minute boost",
            };
          }
        } else if ((diffDays ?? 0) <= 5) {
          tag = {
            label: "Sem lotação",
            tone: "border-white/20 bg-white/5 text-white/70",
            suggestion: "Definir capacidade e criar código",
          };
        }

        return { ...ev, diffDays, capacity, occupancy, tag };
      });
  }, [eventsList, marketingOverview?.events]);

  if (loading) {
    return (
      <div className={`${containerClasses} space-y-6`}>
        <div className="h-8 w-48 rounded-full bg-white/10 animate-pulse" />
        <div className="h-24 rounded-3xl bg-white/5 border border-white/10 animate-pulse" />
      </div>
    );
  }

  if (organizer?.status !== "ACTIVE") {
    return (
      <div className={`${containerClasses} space-y-8`}>
        <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr] items-center">
          <div className="space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/60">
              Organizar com a ORYA
            </p>
            <div className="space-y-2">
              <h1 className="text-3xl md:text-4xl font-bold leading-tight">
                Abre o teu espaço ou evento ao público em minutos.
              </h1>
              <p className="text-sm text-white/70 max-w-2xl">
                Self-serve, sem convites: cria eventos, vende bilhetes e recebe pagamentos. Sem mensalidades nem contratos longos.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 w-full max-w-2xl">
              <div className="space-y-2">
                <label className="text-xs text-white/70">Tipo de entidade</label>
                <select
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                  className="w-full rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
                >
                  <option value="">Seleciona</option>
                  <option value="Clube">Clube</option>
                  <option value="Bar">Bar</option>
                  <option value="Associação">Associação</option>
                  <option value="Freelance">Freelance</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-white/70">Nome do espaço/negócio</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Ex.: Clube XPTO"
                  className="w-full rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-white/70">Cidade</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ex.: Lisboa"
                  className="w-full rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-white/70">IBAN para payouts (opcional)</label>
                <input
                  type="text"
                  value={payoutIban}
                  onChange={(e) => setPayoutIban(e.target.value)}
                  placeholder="PT50 ...."
                  className="w-full rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleBecomeOrganizer}
                disabled={ctaLoading}
                className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] font-semibold text-black shadow-lg disabled:opacity-60"
              >
                {ctaLoading ? "A ativar conta..." : "Começar a organizar"}
              </button>
              {!user && (
                <button
                  type="button"
                  onClick={() =>
                    openModal({ mode: "login", redirectTo: "/organizador", showGoogle: true })
                  }
                  className="px-5 py-2.5 rounded-full border border-white/20 text-white/80 hover:bg-white/10 transition"
                >
                  Criar conta / Entrar
                </button>
              )}
            </div>
            {ctaError && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {ctaError}
              </div>
            )}
            {ctaSuccess && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                {ctaSuccess}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur-xl p-5 space-y-3 shadow-[0_18px_60px_rgba(0,0,0,0.55)]">
            <h3 className="text-sm font-semibold text-white">Porquê a ORYA?</h3>
            <div className="space-y-2 text-sm text-white/80">
              {marketingCards.map((item) => (
                <p
                  key={item}
                  className="rounded-2xl border border-white/10 bg-black/40 p-3"
                >
                  {item}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const stripeReady = paymentsStatus === "READY";
  const quickTasks = [
    {
      label: "Liga Stripe para vender",
      done: stripeReady,
      href: "/organizador/pagamentos",
    },
    {
      label: "Cria o teu primeiro evento",
      done: (events?.items?.length ?? 0) > 0,
      href: "/organizador/eventos/novo",
    },
    {
      label: "Configura promo codes",
      done: false,
      href: "/organizador/promo",
    },
    {
      label: "Convida staff para check-in",
      done: false,
      href: "/organizador/staff",
    },
  ];

  const hasIban = Boolean(organizer.payoutIban);
  const nextEvent = events?.items?.[0] ?? null;

  return (
    <div className={`${containerClasses} space-y-6 text-white`}>
      {activeTab === "overview" && (
        <>
          {/* Header + alerta onboarding */}
          <div className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl p-4 md:p-5 shadow-[0_18px_60px_rgba(0,0,0,0.65)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">Resumo</p>
                <h1 className="text-3xl font-bold leading-tight">
                  Olá, {organizer.displayName || profile?.fullName || "organizador"} 👋
                </h1>
                <p className="text-sm text-white/70">Aqui está o resumo dos teus eventos e vendas.</p>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <Link
                  href="/organizador/eventos/novo"
                  className="px-4 py-2 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] font-semibold text-black shadow-lg"
                >
                  Criar evento
                </Link>
                <Link
                  href="/organizador/pagamentos"
                  className="px-4 py-2 rounded-full border border-white/15 text-white/80 hover:bg-white/10 transition"
                >
                  Pagamentos
                </Link>
                <Link
                  href="/organizador/promo"
                  className="px-4 py-2 rounded-full border border-white/15 text-white/80 hover:bg-white/10 transition"
                >
                  Promo codes
                </Link>
              </div>
            </div>

            {((profileStatus === "MISSING_CONTACT") || !stripeReady) && (
              <div className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100 space-y-2">
                {profileStatus === "MISSING_CONTACT" && (
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">Completa os dados básicos do organizador (nome, tipo, cidade, email).</p>
                    <Link
                      href="/organizador/settings"
                      className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-white hover:bg-white/20"
                    >
                      Preencher dados
                    </Link>
                  </div>
                )}
                {!stripeReady && (
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">
                      Podes publicar eventos gratuitos. Para bilhetes pagos, liga a tua conta Stripe.
                    </p>
                    <Link
                      href="/organizador/pagamentos"
                      className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-white hover:bg-white/20"
                    >
                      Ligar Stripe
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
            {statsCards.map((card, idx) => (
              <div
                key={card.label}
                className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.6)]"
              >
                <p className="text-white/60 text-xs">{card.label}</p>
                <p className="text-2xl font-bold text-white mt-1">{card.value}</p>
                <p className="text-[11px] text-white/45">{card.hint}</p>
                {idx === 0 && nextEvent && (
                  <Link
                    href={`/eventos/${nextEvent.slug}`}
                    className="mt-2 inline-flex text-[11px] text-[#6BFFFF] hover:underline"
                  >
                    Ver evento →
                  </Link>
                )}
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-white/10 bg-black/40 p-4 space-y-3 shadow-[0_18px_60px_rgba(0,0,0,0.65)]">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Vendas ao longo do tempo</h3>
                <div className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/70">
                  Receita · 30 dias
                </div>
              </div>
              <div className="h-40 rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 shadow-inner flex items-center justify-center text-white/70 text-sm">
                {timeSeries?.points?.length ? (
                  <ChartLine points={timeSeries.points} />
                ) : (
                  <span className="text-white/40 text-xs">Sem dados suficientes.</span>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/30 p-4 space-y-3 shadow-[0_18px_60px_rgba(0,0,0,0.65)]">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Próximos passos</h3>
                <span className="text-[11px] text-white/60">{quickTasks.filter((t) => t.done).length}/{quickTasks.length} feitos</span>
              </div>
              <div className="space-y-2 text-[12px]">
                {quickTasks.map((task) => (
                  <Link
                    key={task.label}
                    href={task.href}
                    className={`flex items-center justify-between rounded-2xl border px-3 py-2 transition ${
                      task.done
                        ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
                        : "border-white/12 bg-white/5 text-white/80 hover:bg-white/10"
                    }`}
                  >
                    <span>{task.label}</span>
                    <span className={`text-[11px] rounded-full px-2 py-0.5 ${task.done ? "bg-emerald-400/20" : "bg-white/10"}`}>
                      {task.done ? "Feito" : "Ir"}
                    </span>
                  </Link>
                ))}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-[11px] text-white/70">
                Organiza-te: cria eventos, ativa promo codes e convida staff. Tudo começa aqui.
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl p-4 md:p-5 shadow-[0_18px_60px_rgba(0,0,0,0.65)] space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">Os teus eventos</h3>
                <p className="text-[11px] text-white/60">Próximos e passados ligados à tua conta de organizador.</p>
              </div>
              <Link
                href="/organizador/eventos/novo"
                className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-3 py-1.5 text-[11px] font-semibold text-black shadow"
              >
                Novo evento
              </Link>
            </div>
            <div className="space-y-2">
              {!events?.items && (
                <div className="grid gap-2 md:grid-cols-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-24 rounded-2xl border border-white/10 bg-white/5 animate-pulse" />
                  ))}
                </div>
              )}
              {events?.items?.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-3 text-[12px] text-white/70">
                  Ainda não tens eventos. Cria o primeiro e começa a vender.
                </div>
              )}
              {events?.items && events.items.length > 0 && (
                <div className="grid gap-3 md:grid-cols-2">
                  {events.items.slice(0, 6).map((ev) => {
                    const date = ev.startsAt ? new Date(ev.startsAt) : null;
                    const ticketsSold = ev.ticketsSold ?? 0;
                    const revenue = ((ev.revenueCents ?? 0) / 100).toFixed(2);
                    const dateLabel = date
                      ? date.toLocaleString("pt-PT", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Data a confirmar";
                    return (
                      <div
                        key={ev.id}
                        className="rounded-2xl border border-white/12 bg-white/5 p-3 flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-col">
                            <p className="text-sm font-semibold text-white line-clamp-2">{ev.title}</p>
                            <p className="text-[11px] text-white/60">{dateLabel}</p>
                            <p className="text-[11px] text-white/60">
                              {ev.locationName || ev.locationCity || "Local a anunciar"}
                            </p>
                            <p className="text-[11px] text-white/60">
                              {ticketsSold} bilhetes · {revenue} €
                            </p>
                          </div>
                          <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] text-white/80">
                            {ev.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-[11px]">
                          <Link
                            href={`/organizador/eventos/${ev.id}/edit`}
                            className="rounded-full border border-white/20 px-2.5 py-1 text-white/80 hover:bg-white/10"
                          >
                            Editar
                          </Link>
                          <Link
                            href={`/eventos/${ev.slug}`}
                            className="rounded-full border border-white/20 px-2.5 py-1 text-white/80 hover:bg-white/10"
                          >
                            Página pública
                          </Link>
                          <Link
                            href={`/organizador/estatisticas?eventId=${ev.id}`}
                            className="rounded-full border border-white/20 px-2.5 py-1 text-white/80 hover:bg-white/10"
                          >
                            Estatísticas
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === "events" && (
        <section className="space-y-4">
          {/* Header + ação */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold">Gestão de eventos</h2>
              <p className="text-sm text-white/65">Vê os teus eventos, filtra o que precisas e cria novos em segundos.</p>
            </div>
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
              <input
                type="search"
                placeholder="Procurar por evento…"
                value={searchTerm}
                onChange={(e) => {
                  const val = e.target.value;
                  const normalized = val.toLowerCase();
                  setSearchTerm(val);
                  if (normalized.includes("padel") || normalized.includes("pádel")) setEventTypeFilter("SPORT");
                  if (normalized.includes("jantar") || normalized.includes("restaurante")) setEventTypeFilter("COMIDA");
                  if (normalized.includes("solid")) setEventTypeFilter("VOLUNTEERING");
                  if (normalized.includes("festa")) setEventTypeFilter("PARTY");
                }}
                className="w-full rounded-full border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF] sm:min-w-[260px]"
              />
              <Link
                href="/organizador/eventos/novo"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-2 text-sm font-semibold text-black shadow transition hover:scale-[1.01]"
              >
                + Criar evento
              </Link>
            </div>
          </div>

          {/* Filtros em faixa única */}
          <div className="rounded-2xl border border-white/15 bg-gradient-to-r from-white/10 via-black/50 to-[#0c1a2d] backdrop-blur-xl px-3 py-3 space-y-2 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-white/80">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold text-white">
                  🔎 Filtros inteligentes
                </span>
                <span className="text-white/70">Estado, tipo, categoria e datas numa só vista.</span>
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-[#6BFFFF]/15 px-2 py-0.5 text-[11px] font-semibold text-[#6BFFFF]">
                    {activeFilterCount} ativo{activeFilterCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setEventStatusFilter("all");
                  setEventTypeFilter("all");
                  setEventCategoryFilter("all");
                  setEventDateFilter("any");
                  setSearchTerm("");
                  setTimeScope("all");
                }}
                className="text-[12px] rounded-full border border-white/15 px-3 py-1 text-white/90 hover:border-white/40 hover:bg-white/10 transition"
              >
                Limpar filtros
              </button>
            </div>
            <div className="grid w-full gap-2 md:grid-cols-2 lg:grid-cols-4">
              <select
                value={eventStatusFilter}
                onChange={(e) => setEventStatusFilter(e.target.value as typeof eventStatusFilter)}
                className={`w-full rounded-xl border px-3 py-2 text-[12px] text-white outline-none focus:border-[#6BFFFF] ${
                  eventStatusFilter !== "all" ? "border-[#6BFFFF]/60 bg-[#0b1224]" : "border-white/15 bg-black/40"
                }`}
              >
                <option value="all">Estado: Todos</option>
                <option value="active">Ativo</option>
                <option value="draft">Draft</option>
                <option value="finished">Concluído</option>
                <option value="ongoing">Em curso</option>
              </select>
              <select
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-[12px] text-white outline-none focus:border-[#6BFFFF] ${
                  eventTypeFilter !== "all" ? "border-[#6BFFFF]/60 bg-[#0b1224]" : "border-white/15 bg-black/40"
                }`}
              >
                <option value="all">Tipo: Todos</option>
                <option value="SPORT">Padel</option>
                <option value="COMIDA">Restaurante &amp; Jantar</option>
                <option value="VOLUNTEERING">Solidário / Voluntariado</option>
                <option value="PARTY">Festa &amp; Noite</option>
                <option value="OTHER">Outro</option>
              </select>
              <select
                value={eventCategoryFilter}
                onChange={(e) => setEventCategoryFilter(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-[12px] text-white outline-none focus:border-[#6BFFFF] ${
                  eventCategoryFilter !== "all" ? "border-[#6BFFFF]/60 bg-[#0b1224]" : "border-white/15 bg-black/40"
                }`}
              >
                <option value="all">Categoria: Todas</option>
                <option value="DESPORTO">Padel / Desporto</option>
                <option value="COMIDA">Restaurantes &amp; Jantares</option>
                <option value="FESTA">Festas / Noite</option>
                <option value="VOLUNTARIADO">Solidário / Voluntariado</option>
                <option value="PALESTRA">Talks / Palestras</option>
                <option value="ARTE">Arte</option>
                <option value="CONCERTO">Concertos</option>
                <option value="DRINKS">Drinks</option>
              </select>
              <select
                value={eventDateFilter}
                onChange={(e) => setEventDateFilter(e.target.value as typeof eventDateFilter)}
                className={`w-full rounded-xl border px-3 py-2 text-[12px] text-white outline-none focus:border-[#6BFFFF] ${
                  eventDateFilter !== "any" ? "border-[#6BFFFF]/60 bg-[#0b1224]" : "border-white/15 bg-black/40"
                }`}
              >
                <option value="any">Datas: Qualquer</option>
                <option value="today">Hoje</option>
                <option value="weekend">Este fim-de-semana</option>
                <option value="week">Esta semana</option>
                <option value="month">Este mês</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[12px] text-white/70">
            <span className="rounded-full border border-white/15 px-2 py-0.5">Vista:</span>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`rounded-full px-3 py-1 transition ${
                viewMode === "cards" ? "bg-white text-black font-semibold shadow" : "border border-white/20 hover:border-white/30"
              }`}
            >
              Cartões
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`rounded-full px-3 py-1 transition ${
                viewMode === "table" ? "bg-white text-black font-semibold shadow" : "border border-white/20 hover:border-white/30"
              }`}
            >
              Tabela
            </button>
            <div className="h-4 w-px bg-white/20" />
            <span className="rounded-full border border-white/15 px-2 py-0.5">Mostrar:</span>
            {([
              { key: "all", label: "Todos" },
              { key: "upcoming", label: "Próximos" },
              { key: "ongoing", label: "A decorrer" },
              { key: "past", label: "Passados" },
            ] as const).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setTimeScope(opt.key)}
                className={`rounded-full px-3 py-1 transition ${
                  timeScope === opt.key ? "bg-[#6BFFFF]/20 border-[#6BFFFF]/40 text-white" : "border border-white/20 text-white/70 hover:border-white/30"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {[
            eventStatusFilter !== "all",
            eventTypeFilter !== "all",
            eventCategoryFilter !== "all",
            eventDateFilter !== "any",
            timeScope !== "all",
            searchTerm.trim() !== "",
          ].some(Boolean) && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
              <span className="text-white/70 font-semibold">Filtros ativos</span>
              {eventStatusFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => setEventStatusFilter("all")}
                  className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2 py-0.5 hover:border-white/40"
                >
                  Estado: {eventStatusFilter} ×
                </button>
              )}
              {eventTypeFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => setEventTypeFilter("all")}
                  className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2 py-0.5 hover:border-white/40"
                >
                  Tipo: {eventTypeFilter} ×
                </button>
              )}
              {eventCategoryFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => setEventCategoryFilter("all")}
                  className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2 py-0.5 hover:border-white/40"
                >
                  Categoria: {eventCategoryFilter} ×
                </button>
              )}
              {eventDateFilter !== "any" && (
                <button
                  type="button"
                  onClick={() => setEventDateFilter("any")}
                  className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2 py-0.5 hover:border-white/40"
                >
                  Datas: {eventDateFilter} ×
                </button>
              )}
              {timeScope !== "all" && (
                <button
                  type="button"
                  onClick={() => setTimeScope("all")}
                  className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2 py-0.5 hover:border-white/40"
                >
                  Mostrar: {timeScope} ×
                </button>
              )}
              {searchTerm.trim() && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2 py-0.5 hover:border-white/40"
                >
                  Pesquisa: “{searchTerm}” ×
                </button>
              )}
            </div>
          )}

          <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm text-white/80">
                  <h3 className="text-lg font-semibold">Eventos</h3>
                  <span className="text-[11px] rounded-full bg-white/10 px-2 py-0.5">{filteredEvents.length}</span>
                </div>
                <div className="flex items-center gap-2 text-[12px] text-white/70">
                  <span className="rounded-full border border-white/15 px-2 py-0.5">Próximos: {upcomingCount}</span>
                  <span className="rounded-full border border-white/15 px-2 py-0.5">A decorrer: {ongoingCount}</span>
                  <span className="rounded-full border border-white/15 px-2 py-0.5">Concluídos: {finishedCount}</span>
                </div>
              </div>

              {eventsLoading && (
                <div className="grid gap-2 md:grid-cols-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-28 rounded-2xl border border-white/10 bg-white/5 animate-pulse" />
                  ))}
                </div>
              )}

              {eventsError && (
                <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">Não foi possível carregar os eventos.</p>
                    <p className="text-[12px] text-red-100/80">Verifica a ligação e tenta novamente.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => mutateEvents()}
                    className="rounded-full border border-red-200/50 px-3 py-1 text-[12px] font-semibold hover:bg-red-500/20"
                  >
                    Tentar novamente
                  </button>
                </div>
              )}

              {!eventsLoading && events?.items?.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-6 text-center text-sm text-white/70 space-y-2">
                  <p className="text-base font-semibold text-white">Ainda não tens eventos criados.</p>
                  <p>Começa com um torneio de padel, um jantar de grupo ou um evento solidário.</p>
                  <div className="flex flex-wrap justify-center gap-2 text-[12px]">
                    <Link href="/organizador/eventos/novo" className="rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-3 py-1.5 font-semibold text-black shadow">
                      Criar evento
                    </Link>
                    <Link href="/organizador/eventos/novo" className="rounded-full border border-white/20 px-3 py-1.5 text-white/80 hover:bg-white/10">
                      Criar torneio de padel
                    </Link>
                    <Link href="/organizador/eventos/novo" className="rounded-full border border-white/20 px-3 py-1.5 text-white/80 hover:bg-white/10">
                      Criar jantar
                    </Link>
                  </div>
                </div>
              )}

              {!eventsLoading && events?.items && events.items.length > 0 && filteredEvents.length === 0 && (
                <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-6 text-center text-sm text-white/70 space-y-2">
                  <p className="text-base font-semibold text-white">Nenhum evento corresponde a estes filtros.</p>
                  <p className="text-white/65">Alarga as datas, limpa filtros ou procura por outro nome.</p>
                  <div className="flex flex-wrap justify-center gap-2 text-[12px]">
                    <button
                      type="button"
                      onClick={() => {
                        setEventStatusFilter("all");
                        setEventTypeFilter("all");
                        setEventCategoryFilter("all");
                        setEventDateFilter("any");
                        setTimeScope("all");
                        setSearchTerm("");
                      }}
                      className="rounded-full border border-white/20 px-3 py-1.5 text-white/80 hover:bg-white/10"
                    >
                      Limpar filtros
                    </button>
                    <Link
                      href="/organizador/eventos/novo"
                      className="rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-3 py-1.5 font-semibold text-black shadow"
                    >
                      Criar novo evento
                    </Link>
                  </div>
                </div>
              )}

              {filteredEvents.length > 0 && (
                <div className="space-y-2">
                  {viewMode === "table" ? (
                    <div className="overflow-auto rounded-2xl border border-white/10 bg-white/5">
                      <table className="min-w-full text-sm text-white/80">
                        <thead className="text-left text-[11px] uppercase tracking-wide text-white/60">
                          <tr>
                            <th className="px-4 py-3">Evento</th>
                            <th className="px-4 py-3">Data</th>
                            <th className="px-4 py-3">Estado</th>
                            <th className="px-4 py-3">Tipo</th>
                            <th className="px-4 py-3">Bilhetes</th>
                            <th className="px-4 py-3">Receita</th>
                            <th className="px-4 py-3 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {filteredEvents.map((ev) => {
                            const date = ev.startsAt ? new Date(ev.startsAt) : null;
                            const endsAt = ev.endsAt ? new Date(ev.endsAt) : null;
                            const now = new Date();
                            const isOngoing = date && endsAt ? date.getTime() <= now.getTime() && now.getTime() <= endsAt.getTime() : false;
                            const isFuture = date ? date.getTime() > now.getTime() : false;
                            const isFinished = endsAt ? endsAt.getTime() < now.getTime() : false;
                            const dateLabel = date
                              ? date.toLocaleString("pt-PT", {
                                  day: "2-digit",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Data a confirmar";
                            const ticketsSold = ev.ticketsSold ?? 0;
                            const capacity = ev.capacity ?? null;
                            const revenue = ((ev.revenueCents ?? 0) / 100).toFixed(2);
                            const typeLabel =
                              ev.templateType === "SPORT"
                                ? "Padel"
                                : ev.templateType === "COMIDA"
                                  ? "Restaurantes & Jantares"
                                  : ev.templateType === "VOLUNTEERING"
                                    ? "Solidário / Voluntariado"
                                    : ev.templateType === "PARTY"
                                      ? "Festas & Noite"
                                      : ev.templateType || "Outro";
                            const statusBadge =
                              ev.status === "CANCELLED"
                                ? { label: "Cancelado", classes: "text-red-200" }
                                : ev.status === "DRAFT"
                                  ? { label: "Draft", classes: "text-white/70" }
                                  : isOngoing
                                    ? { label: "A decorrer", classes: "text-emerald-200" }
                                    : isFuture
                                      ? { label: "Publicado", classes: "text-sky-200" }
                                      : isFinished
                                        ? { label: "Concluído", classes: "text-purple-200" }
                                        : { label: ev.status, classes: "text-white/70" };

                            const goToTab = (tab: string) => {
                              const params = new URLSearchParams(searchParams?.toString() || "");
                              params.set("tab", tab);
                              params.set("eventId", String(ev.id));
                              router.replace(`${pathname}?${params.toString()}`, { scroll: false });
                            };

                            return (
                              <tr key={ev.id} className="hover:bg-white/5 transition">
                                <td className="px-4 py-3 font-semibold text-white">
                                  <button
                                    type="button"
                                    className="text-left hover:underline"
                                    onClick={() => router.push(`/organizador/estatisticas?eventId=${ev.id}`)}
                                  >
                                    {ev.title}
                                  </button>
                                </td>
                                <td className="px-4 py-3 text-[12px]">{dateLabel}</td>
                                <td className={`px-4 py-3 text-[12px] ${statusBadge.classes}`}>{statusBadge.label}</td>
                                <td className="px-4 py-3 text-[12px]">{typeLabel}</td>
                                <td className="px-4 py-3 text-[12px]">
                                  {ticketsSold} / {capacity ?? "—"}
                                </td>
                                <td className="px-4 py-3 text-[12px]">{revenue} €</td>
                                <td className="px-4 py-3 text-right text-[11px]">
                                  <div className="flex flex-wrap items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => goToTab("sales")}
                                      className="rounded-full border border-white/20 px-2 py-1 hover:bg-white/10"
                                    >
                                      Vendas
                                    </button>
                                    <Link
                                      href={`/organizador/eventos/${ev.id}/edit`}
                                      className="rounded-full border border-white/20 px-2 py-1 hover:bg-white/10"
                                    >
                                      Editar
                                    </Link>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    filteredEvents.map((ev) => {
                      const date = ev.startsAt ? new Date(ev.startsAt) : null;
                      const endsAt = ev.endsAt ? new Date(ev.endsAt) : null;
                      const now = new Date();
                      const isOngoing = date && endsAt ? date.getTime() <= now.getTime() && now.getTime() <= endsAt.getTime() : false;
                      const isFuture = date ? date.getTime() > now.getTime() : false;
                      const isFinished = endsAt ? endsAt.getTime() < now.getTime() : false;
                      const dateLabel = date
                        ? date.toLocaleString("pt-PT", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Data a confirmar";
                      const ticketsSold = ev.ticketsSold ?? 0;
                      const capacity = ev.capacity ?? null;
                      const revenue = ((ev.revenueCents ?? 0) / 100).toFixed(2);
                      const typeLabel =
                        ev.templateType === "SPORT"
                          ? "Padel"
                          : ev.templateType === "COMIDA"
                            ? "Restaurantes & Jantares"
                            : ev.templateType === "VOLUNTEERING"
                              ? "Solidário / Voluntariado"
                              : ev.templateType === "PARTY"
                                ? "Festas & Noite"
                                : ev.templateType || "Outro";
                      const typeTone =
                        ev.templateType === "SPORT"
                          ? "border-sky-400/40 bg-sky-400/10 text-sky-100"
                          : ev.templateType === "COMIDA"
                            ? "border-amber-300/40 bg-amber-300/10 text-amber-100"
                            : ev.templateType === "VOLUNTEERING"
                              ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100"
                              : ev.templateType === "PARTY"
                                ? "border-fuchsia-300/40 bg-fuchsia-300/10 text-fuchsia-100"
                                : "border-white/20 bg-white/5 text-white/80";

                      const statusBadge =
                        ev.status === "CANCELLED"
                          ? { label: "Cancelado", classes: "border-red-400/50 bg-red-500/10 text-red-100" }
                          : ev.status === "DRAFT"
                            ? { label: "Draft", classes: "border-white/20 bg-white/5 text-white/70" }
                            : isOngoing
                              ? { label: "A decorrer", classes: "border-emerald-400/50 bg-emerald-500/10 text-emerald-100" }
                              : isFuture
                                ? { label: "Publicado", classes: "border-sky-400/50 bg-sky-500/10 text-sky-100" }
                                : isFinished
                                  ? { label: "Concluído", classes: "border-purple-400/50 bg-purple-500/10 text-purple-100" }
                                  : { label: ev.status, classes: "border-white/20 bg-white/5 text-white/70" };

                      const handlePrimaryOpen = () => {
                        router.push(`/organizador/estatisticas?eventId=${ev.id}`);
                      };

                      const goToTab = (tab: string) => {
                        const params = new URLSearchParams(searchParams?.toString() || "");
                        params.set("tab", tab);
                        params.set("eventId", String(ev.id));
                        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
                      };

                      return (
                        <div
                          key={ev.id}
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest("a,button")) return;
                            handlePrimaryOpen();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handlePrimaryOpen();
                            }
                          }}
                          className="group rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-[#6BFFFF]/60 hover:shadow-[0_12px_40px_rgba(0,0,0,0.5)] transition cursor-pointer"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-white line-clamp-2">{ev.title}</p>
                                <span className={`rounded-full border px-2 py-0.5 text-[11px] ${statusBadge.classes}`}>{statusBadge.label}</span>
                                <span className={`rounded-full border px-2 py-0.5 text-[11px] ${typeTone}`}>{typeLabel}</span>
                                {ev.categories?.[0] && (
                                  <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[11px] text-white/75">
                                    {ev.categories[0]}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-2 text-[11px] text-white/70">
                                <span>📅 {dateLabel}</span>
                                <span>·</span>
                                <span>📍 {ev.locationName || ev.locationCity || "Local a anunciar"}</span>
                                <span>·</span>
                                <span>🎟️ {ticketsSold} / {capacity ?? "—"} bilhetes</span>
                                <span>·</span>
                                <span>💶 {revenue} €</span>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePrimaryOpen();
                                }}
                                className="rounded-full border border-white/25 bg-white/10 px-3 py-1 font-semibold text-white hover:border-[#6BFFFF]/60"
                              >
                                Dashboard
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  goToTab("sales");
                                }}
                                className="rounded-full border border-white/20 px-2.5 py-1 text-white/80 hover:bg-white/10"
                              >
                                Ver vendas
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  goToTab("finance");
                                }}
                                className="rounded-full border border-white/20 px-2.5 py-1 text-white/80 hover:bg-white/10"
                              >
                                Payouts
                              </button>
                              <Link
                                href={`/organizador/eventos/${ev.id}/edit`}
                                onClick={(e) => e.stopPropagation()}
                                className="rounded-full border border-white/20 px-2.5 py-1 text-white/80 hover:bg-white/10"
                              >
                                Editar
                              </Link>
                              <Link
                                href={`/eventos/${ev.slug}`}
                                onClick={(e) => e.stopPropagation()}
                                className="rounded-full border border-white/20 px-2.5 py-1 text-white/80 hover:bg-white/10"
                              >
                                Página pública
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
          </div>
        </section>
      )}

      {activeTab === "sales" && (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Bilhetes &amp; Vendas</p>
              <h2 className="text-2xl font-semibold">Vendas por evento</h2>
              <p className="text-sm text-white/65">Escolhe um evento e vê evolução + compradores.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-white/60">Período</span>
              <div className="inline-flex rounded-full border border-white/15 bg-black/40 p-[3px] text-[11px]">
                {(["7d", "30d", "all"] as const).map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setSalesRange(range)}
                    className={`rounded-full px-3 py-1 transition ${
                      salesRange === range
                        ? "bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black font-semibold shadow-[0_0_12px_rgba(107,255,255,0.6)]"
                        : "text-white/70 hover:bg-white/5"
                    }`}
                  >
                    {range === "7d" ? "7 dias" : range === "30d" ? "30 dias" : "Sempre"}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-white/60">Métrica</span>
              <div className="inline-flex rounded-full border border-white/15 bg-black/40 p-[3px] text-[11px]">
                {(["tickets", "revenue"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSalesMetric(key)}
                    className={`rounded-full px-3 py-1 transition ${
                      salesMetric === key
                        ? "bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black font-semibold shadow-[0_0_12px_rgba(107,255,255,0.6)]"
                        : "text-white/70 hover:bg-white/5"
                    }`}
                  >
                    {key === "tickets" ? "Bilhetes" : "Receita"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-white/70">
              Seleciona evento:
              <select
                value={salesEventId ?? ""}
                onChange={(e) => setSalesEventId(e.target.value ? Number(e.target.value) : null)}
                className="ml-2 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF]"
              >
                {eventsList.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title}
                  </option>
                ))}
              </select>
            </label>
            {!eventsList.length && <span className="text-[12px] text-white/60">Sem eventos para analisar.</span>}
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] text-white/60">Receita no período</p>
              <p className="text-2xl font-bold text-white mt-1">{(salesKpis.revenueCents / 100).toFixed(2)} €</p>
              <p className="text-[11px] text-white/50">{salesRange === "all" ? "Total" : `Últimos ${salesRange === "7d" ? "7" : "30"} dias`}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] text-white/60">Bilhetes vendidos</p>
              <p className="text-2xl font-bold text-white mt-1">{salesKpis.tickets}</p>
              <p className="text-[11px] text-white/50">No período selecionado</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] text-white/60">Eventos com vendas</p>
              <p className="text-2xl font-bold text-white mt-1">{salesKpis.eventsWithSales}</p>
              <p className="text-[11px] text-white/50">Eventos com pelo menos 1 venda</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] text-white/60">Ocupação média</p>
              <p className="text-2xl font-bold text-white mt-1">
                {salesKpis.avgOccupancy !== null ? `${salesKpis.avgOccupancy}%` : "—"}
              </p>
              <p className="text-[11px] text-white/50">Calculado nos eventos com capacidade</p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/40 p-4 space-y-3 shadow-[0_18px_60px_rgba(0,0,0,0.65)]">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Evolução</h3>
              {selectedSalesEvent && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-white/60">{selectedSalesEvent.title}</span>
                  <button
                    type="button"
                    disabled={!salesSeries?.points?.length}
                    onClick={handleExportSalesCsv}
                    className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10 disabled:opacity-50"
                  >
                    Exportar vendas
                  </button>
                </div>
              )}
            </div>
            <div className="h-44 rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 shadow-inner flex items-center justify-center text-white/70 text-sm">
              {salesSeries?.points?.length ? (
                <ChartLine points={salesSeries.points} mode={salesMetric === "tickets" ? "tickets" : "revenue"} />
              ) : (
                <span className="text-white/40 text-xs">Sem dados de vendas para este evento.</span>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/40 p-4 space-y-3 shadow-[0_18px_60px_rgba(0,0,0,0.65)]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Eventos com mais vendas</h3>
                <p className="text-[11px] text-white/60">Top por receita total. Usa como atalho para ver o detalhe.</p>
              </div>
            </div>

            {topEvents.length === 0 && <p className="text-sm text-white/60">Ainda sem eventos com vendas para ordenar.</p>}
            {topEvents.length > 0 && (
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-[11px] text-white/60">
                    <tr>
                      <th className="py-2 pr-3">Evento</th>
                      <th className="py-2 pr-3">Bilhetes</th>
                      <th className="py-2 pr-3">Receita</th>
                      <th className="py-2 pr-3">Estado</th>
                      <th className="py-2 pr-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {topEvents.map((ev) => {
                      const statusBadge =
                        ev.status === "CANCELLED"
                          ? { label: "Cancelado", classes: "border-red-400/50 bg-red-500/10 text-red-100" }
                          : ev.status === "DRAFT"
                            ? { label: "Draft", classes: "border-white/20 bg-white/5 text-white/70" }
                            : { label: "Publicado", classes: "border-sky-400/50 bg-sky-500/10 text-sky-100" };
                      return (
                        <tr key={ev.id}>
                          <td className="py-2 pr-3 text-white">{ev.title}</td>
                          <td className="py-2 pr-3 text-white/80">{ev.ticketsSold ?? 0}</td>
                          <td className="py-2 pr-3 text-white">{((ev.revenueCents ?? 0) / 100).toFixed(2)} €</td>
                          <td className="py-2 pr-3 text-[11px]">
                            <span className={`rounded-full border px-2 py-0.5 ${statusBadge.classes}`}>{statusBadge.label}</span>
                          </td>
                          <td className="py-2 pr-3 text-right text-[11px]">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setSalesEventId(ev.id)}
                                className="rounded-full border border-white/20 px-2.5 py-1 text-white/80 hover:bg-white/10"
                              >
                                Ver vendas
                              </button>
                              <Link
                                href={`/organizador/estatisticas?eventId=${ev.id}`}
                                className="rounded-full border border-white/20 px-2.5 py-1 text-white/80 hover:bg-white/10"
                              >
                                Dashboard
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/40 p-4 space-y-3 shadow-[0_18px_60px_rgba(0,0,0,0.65)]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Compradores</h3>
                <p className="text-[11px] text-white/60">Lista rápida por bilhete. Exporta para CSV para detalhe.</p>
              </div>
              <button
                type="button"
                disabled={!buyers || buyers.ok === false || buyersItems.length === 0}
                onClick={() => {
                  if (!buyers || buyers.ok === false) return;
                  const rows = buyersItems;
                  const header = ["ID", "Nome", "Email", "Cidade", "Tipo", "Preço (€)", "Estado", "Comprado em"];
                  const body = rows
                    .map((r) =>
                      [
                        r.id,
                        r.buyerName,
                        r.buyerEmail,
                        r.buyerCity ?? "",
                        r.ticketType,
                        (r.totalPaidCents / 100).toFixed(2),
                        r.status,
                        new Date(r.purchasedAt).toLocaleString("pt-PT"),
                      ].join(";")
                    )
                    .join("\n");
                  const blob = new Blob([[header.join(";"), body].join("\n")], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "compradores.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="text-[11px] rounded-full border border-white/20 px-3 py-1 text-white/80 hover:bg-white/10 disabled:opacity-50"
              >
                Exportar CSV
              </button>
            </div>

            {!buyers && <p className="text-sm text-white/60">A carregar compradores…</p>}
            {buyers && buyers.ok === false && <p className="text-sm text-red-400">Não foi possível carregar os compradores.</p>}
            {buyers && buyers.ok !== false && buyersItems.length === 0 && (
              <p className="text-sm text-white/60">Sem compras registadas para este evento.</p>
            )}
            {buyers && buyers.ok !== false && buyersItems.length > 0 && (
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-[11px] text-white/60">
                    <tr>
                      <th className="py-2 pr-3">Comprador</th>
                      <th className="py-2 pr-3">Email</th>
                      <th className="py-2 pr-3">Bilhete</th>
                      <th className="py-2 pr-3">Estado</th>
                      <th className="py-2 pr-3 text-right">Pago</th>
                      <th className="py-2 pr-3">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {buyersItems.map((row) => (
                      <tr key={row.id}>
                        <td className="py-2 pr-3 text-white">{row.buyerName}</td>
                        <td className="py-2 pr-3 text-white/70">{row.buyerEmail}</td>
                        <td className="py-2 pr-3 text-white/80">{row.ticketType}</td>
                        <td className="py-2 pr-3 text-[11px]">
                          <span className="rounded-full border border-white/15 px-2 py-0.5 text-white/70">{row.status}</span>
                        </td>
                        <td className="py-2 pr-3 text-right text-white">
                          {(row.totalPaidCents / 100).toFixed(2)} €
                        </td>
                        <td className="py-2 pr-3 text-white/70">
                          {new Date(row.purchasedAt).toLocaleString("pt-PT")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === "finance" && (
        <section className="space-y-4">
          <div className="flex flex-col gap-2">
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Finanças &amp; Payouts</p>
            <h2 className="text-2xl font-semibold">Cashflow, Stripe e próximos pagamentos</h2>
            <p className="text-sm text-white/65">Resumo financeiro real, pronto para saber o que vais receber.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Saldo líquido estimado",
                value:
                  financeData?.totals.netCents !== undefined
                    ? `${(financeData.totals.netCents / 100).toFixed(2)} €`
                    : financeSummary
                      ? `${(financeSummary.estimatedPayoutCents / 100).toFixed(2)} €`
                      : "—",
                hint: "Vendas após taxas (estimativa).",
              },
              {
                label: "Receita bruta (30d)",
                value:
                  financeData?.rolling.last30.grossCents !== undefined
                    ? `${(financeData.rolling.last30.grossCents / 100).toFixed(2)} €`
                    : "—",
                hint: "Receita total dos últimos 30 dias.",
              },
              {
                label: "Taxas ORYA (30d)",
                value:
                  financeData?.rolling.last30.feesCents !== undefined
                    ? `${(financeData.rolling.last30.feesCents / 100).toFixed(2)} €`
                    : "—",
                hint: "Taxas deduzidas (30d).",
              },
              {
                label: "Bilhetes (30d)",
                value: financeData?.rolling.last30.tickets ?? "—",
                hint: "Bilhetes vendidos em 30 dias.",
              },
            ].map((card) => (
              <div key={card.label} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] text-white/60">{card.label}</p>
                <p className="text-2xl font-bold text-white mt-1">{card.value}</p>
                <p className="text-[11px] text-white/50">{card.hint}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 space-y-3 shadow-[0_18px_60px_rgba(0,0,0,0.65)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">Stripe</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] ${
                      stripeState.tone === "success"
                        ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-100"
                        : stripeState.tone === "warning"
                          ? "border-amber-400/50 bg-amber-500/10 text-amber-100"
                          : "border-white/20 bg-white/5 text-white/70"
                    }`}
                  >
                    {stripeState.badge}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {paymentsStatus === "READY" ? (
                    <a
                      href="https://dashboard.stripe.com/"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] rounded-full border border-white/20 px-3 py-1 text-white/80 hover:bg-white/10"
                    >
                      {stripeState.cta}
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStripeConnect}
                      disabled={stripeCtaLoading}
                      className="text-[11px] rounded-full border border-white/20 px-3 py-1 text-white/80 hover:bg-white/10 disabled:opacity-60"
                    >
                      {stripeState.cta}
                    </button>
                  )}
                  <Link
                    href="/organizador/pagamentos"
                    className="text-[11px] rounded-full border border-white/20 px-3 py-1 text-white/80 hover:bg-white/10"
                  >
                    Abrir pagamentos
                  </Link>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/40 p-3 text-sm space-y-1">
                <p className="text-white/60">Conta: {organizer.stripeAccountId ? `…${organizer.stripeAccountId.slice(-6)}` : "Por ligar"}</p>
                <p className="text-white/60">Cobranças: {organizer.stripeChargesEnabled ? "Ativo" : "Inativo"}</p>
                <p className="text-white/60">Payouts: {organizer.stripePayoutsEnabled ? "Ativo" : "Inativo"}</p>
              </div>
              <div className="text-[11px] text-white/70">
                {stripeState.desc}
              </div>
              {stripeCtaError && <div className="text-xs text-red-300">{stripeCtaError}</div>}
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/30 backdrop-blur-xl p-4 space-y-3 shadow-[0_18px_60px_rgba(0,0,0,0.65)]">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Payouts</h3>
                <span className="text-[11px] text-white/65">Estimativa</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 text-sm">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-white/60 text-xs">Próximo payout (estimado)</p>
                  <p className="text-xl font-semibold text-white">
                    {financeData ? (financeData.upcomingPayoutCents / 100).toFixed(2) : financeSummary ? (financeSummary.estimatedPayoutCents / 100).toFixed(2) : "—"} €
                  </p>
                  <p className="text-[11px] text-white/55">Baseado nas vendas dos últimos 7 dias.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-white/60 text-xs">Receita bruta (total)</p>
                  <p className="text-xl font-semibold text-white">
                    {financeData ? (financeData.totals.grossCents / 100).toFixed(2) : financeSummary ? (financeSummary.revenueCents / 100).toFixed(2) : "—"} €
                  </p>
                  <p className="text-[11px] text-white/55">Inclui todos os eventos.</p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 text-sm">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-white/60 text-xs">Taxas acumuladas</p>
                  <p className="text-xl font-semibold text-white">
                    {financeData ? (financeData.totals.feesCents / 100).toFixed(2) : financeSummary ? (financeSummary.platformFeesCents / 100).toFixed(2) : "—"} €
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-white/60 text-xs">Eventos com vendas</p>
                  <p className="text-xl font-semibold text-white">
                    {financeData ? financeData.totals.eventsWithSales : financeSummary ? financeSummary.eventsWithSales : "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-black/35 p-4 space-y-3 shadow-[0_18px_60px_rgba(0,0,0,0.65)]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">Dados de faturação</h3>
                  <p className="text-[12px] text-white/65">Nome legal, tipo de entidade e IBAN para recebimentos.</p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveBilling}
                  disabled={billingSaving}
                  className="rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-3 py-1.5 text-[12px] font-semibold text-black shadow disabled:opacity-60"
                >
                  {billingSaving ? "A guardar..." : "Guardar"}
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[12px] text-white/70">Nome legal / negócio</label>
                  <input
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                    placeholder="Ex.: Clube XPTO"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] text-white/70">Tipo de entidade / NIF</label>
                  <input
                    value={entityType}
                    onChange={(e) => setEntityType(e.target.value)}
                    className="w-full rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                    placeholder="Empresa, associação..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] text-white/70">Cidade / morada curta</label>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                    placeholder="Lisboa, Porto..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] text-white/70">IBAN para payouts</label>
                  <input
                    value={payoutIban}
                    onChange={(e) => setPayoutIban(e.target.value)}
                    className="w-full rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                    placeholder="PT50..."
                  />
                </div>
              </div>
              {billingMessage && <p className="text-[12px] text-white/70">{billingMessage}</p>}
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/30 p-4 space-y-3 shadow-[0_18px_60px_rgba(0,0,0,0.65)]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">Impostos &amp; reembolsos</h3>
                  <p className="text-[12px] text-white/65">Prepara o texto a mostrar nas faturas e bilhetes.</p>
                </div>
                <button
                  type="button"
                  onClick={handleSavePolicy}
                  className="rounded-full border border-white/20 px-3 py-1.5 text-[12px] text-white/80 hover:bg-white/10"
                >
                  Guardar
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-[0.4fr_1fr]">
                <div className="space-y-1">
                  <label className="text-[12px] text-white/70">IVA (% aproximado)</label>
                  <input
                    value={vatRate}
                    onChange={(e) => setVatRate(e.target.value)}
                    className="w-full rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                    placeholder="Ex.: 23"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] text-white/70">Política de reembolso</label>
                  <textarea
                    value={refundPolicy}
                    onChange={(e) => setRefundPolicy(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] resize-none"
                    placeholder="Ex.: Reembolsos até 48h antes do evento..."
                  />
                </div>
              </div>
              <p className="text-[11px] text-white/55">
                Guardado no painel. Liga o Stripe para refletir estas regras nas transações.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/35 backdrop-blur-xl p-4 space-y-3 shadow-[0_18px_60px_rgba(0,0,0,0.65)]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Por evento</h3>
                <p className="text-[12px] text-white/65">Bruto, taxas e líquido por evento.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportFinanceCsv}
                  disabled={!financeData || financeData.events.length === 0}
                  className="rounded-full border border-white/20 px-3 py-1 text-[12px] text-white/80 hover:bg-white/10 disabled:opacity-50"
                >
                  Exportar CSV
                </button>
                <Link
                  href="/organizador/estatisticas"
                  className="rounded-full border border-white/20 px-3 py-1 text-[12px] text-white/80 hover:bg-white/10"
                >
                  Ver estatísticas
                </Link>
              </div>
            </div>

            {!financeData && <p className="text-sm text-white/60">A carregar finanças…</p>}
            {financeData && financeData.events.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-4 text-sm text-white/70">
                Sem vendas ainda. Assim que venderes bilhetes, verás aqui os totais por evento.
              </div>
            )}

            {financeData && financeData.events.length > 0 && (
              <div className="overflow-auto">
                <table className="min-w-full text-sm text-white/80">
                  <thead className="text-left text-[11px] uppercase tracking-wide text-white/60">
                    <tr>
                      <th className="px-4 py-3">Evento</th>
                      <th className="px-4 py-3">Bilhetes</th>
                      <th className="px-4 py-3">Bruto</th>
                      <th className="px-4 py-3">Taxas</th>
                      <th className="px-4 py-3">Líquido</th>
                      <th className="px-4 py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {financeData.events.map((ev) => (
                      <tr key={ev.id} className="hover:bg-white/5 transition">
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-semibold text-white">{ev.title}</span>
                            <span className="text-[11px] text-white/60">
                              {ev.startsAt ? new Date(ev.startsAt).toLocaleDateString("pt-PT") : "Data a definir"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[12px]">{ev.ticketsSold}</td>
                        <td className="px-4 py-3 text-[12px]">{(ev.grossCents / 100).toFixed(2)} €</td>
                        <td className="px-4 py-3 text-[12px]">{(ev.feesCents / 100).toFixed(2)} €</td>
                        <td className="px-4 py-3 text-[12px]">{(ev.netCents / 100).toFixed(2)} €</td>
                        <td className="px-4 py-3 text-[11px]">
                          <span className="rounded-full border border-white/20 px-2 py-0.5 text-white/70">{ev.status ?? "—"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === "marketing" && (
        <section className="space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Marketing &amp; Crescimento</p>
              <h2 className="text-2xl font-semibold">Marketing · {marketingSection === "overview" ? "Visão geral" : "Painel"}</h2>
              <p className="text-sm text-white/65">Preenche a sala: visão, campanhas, audiência e automações.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <Link
                href="/organizador/promo"
                className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
              >
                Abrir gestão completa
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-black/30 px-2 py-2 text-sm">
            {[
              { key: "overview", label: "Visão geral" },
              { key: "campaigns", label: "Campanhas" },
              { key: "audience", label: "Audiência" },
              { key: "promoters", label: "Promotores & Parcerias" },
              { key: "content", label: "Conteúdo & Kits" },
              { key: "automation", label: "Automação & Boost" },
            ].map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setMarketingSection(opt.key as typeof marketingSection)}
                className={`rounded-xl px-3 py-2 transition ${
                  marketingSection === opt.key
                    ? "bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black font-semibold shadow-[0_0_16px_rgba(107,255,255,0.35)]"
                    : "text-white/75 hover:bg-white/5"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {marketingSection === "overview" && (
            <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="text-[11px] text-white/60">Receita atribuída a marketing</p>
                    <p className="text-2xl font-bold text-white mt-1">
                      {marketingKpis.marketingRevenueCents ? `${(marketingKpis.marketingRevenueCents / 100).toFixed(2)} €` : "—"}
                    </p>
                    <p className="text-[11px] text-white/50">Receita estimada através de códigos.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="text-[11px] text-white/60">Bilhetes via marketing</p>
                    <p className="text-2xl font-bold text-white mt-1">{marketingKpis.ticketsWithPromo}</p>
                    <p className="text-[11px] text-white/50">Contagem de utilizações de códigos.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="text-[11px] text-white/60">Top código</p>
                    <p className="text-2xl font-bold text-white mt-1">
                    {marketingKpis.topPromo ? marketingKpis.topPromo.code : "—"}
                    </p>
                    <p className="text-[11px] text-white/50">
                    {marketingKpis.topPromo ? `${marketingKpis.topPromo.redemptionsCount ?? 0} utilizações` : "Sem dados ainda."}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="text-[11px] text-white/60">Promo codes ativos</p>
                    <p className="text-2xl font-bold text-white mt-1">{marketingKpis.activePromos}</p>
                    <p className="text-[11px] text-white/50">Disponíveis para vender agora.</p>
                  </div>
                </div>

              <div className="rounded-3xl border border-white/10 bg-black/35 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Fill the Room</h3>
                    <p className="text-[12px] text-white/65">Próximos eventos com ocupação, urgência e sugestões.</p>
                  </div>
                  <Link
                    href="/organizador/promo"
                    className="rounded-full border border-white/20 px-3 py-1 text-[12px] text-white/80 hover:bg-white/10"
                  >
                    Ver todas as ações
                  </Link>
                </div>

                {fillTheRoomEvents.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-4 text-sm text-white/70">
                    Sem eventos futuros para otimizar. Cria um evento ou define datas para ver sugestões.
                  </div>
                )}

                {fillTheRoomEvents.length > 0 && (
                  <div className="space-y-2">
                    {fillTheRoomEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold">{ev.title}</p>
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] ${ev.tag.tone}`}>{ev.tag.label}</span>
                            <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[11px] text-white/75">
                              {ev.templateType || "Evento"}
                            </span>
                            {typeof ev.diffDays === "number" && (
                              <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-white/70">
                                Faltam {ev.diffDays} dia{ev.diffDays === 1 ? "" : "s"}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 text-[11px] text-white/70">
                            <span>{ev.startsAt ? new Date(ev.startsAt).toLocaleString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Data a definir"}</span>
                            <span>·</span>
                            <span>{ev.locationCity || ev.locationName || "Local a anunciar"}</span>
                            <span>·</span>
                            <span>
                              Lotação: {ev.ticketsSold ?? 0} / {ev.capacity ?? "—"}{" "}
                              {ev.occupancy !== null ? `(${Math.round((ev.occupancy ?? 0) * 100)}%)` : ""}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 text-[12px] md:text-right">
                          <div className="flex items-center gap-2 text-[11px] text-white/70">
                            <div className="h-2 w-28 rounded-full bg-white/10">
                              <div
                                className="h-2 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5]"
                                style={{ width: `${Math.min(100, Math.round((ev.occupancy ?? 0) * 100))}%` }}
                              />
                            </div>
                            <span>{ev.occupancy !== null ? `${Math.round((ev.occupancy ?? 0) * 100)}%` : "—"}</span>
                          </div>
                          <div className="flex flex-wrap justify-end gap-2 text-[11px]">
                            <Link
                              href="/organizador/promo"
                              className="rounded-full border border-white/20 px-2.5 py-1 text-white/80 hover:bg-white/10"
                            >
                              {ev.tag.suggestion}
                            </Link>
                            <Link
                              href={`/organizador/eventos/${ev.id}/edit`}
                              className="rounded-full border border-white/20 px-2.5 py-1 text-white/80 hover:bg-white/10"
                            >
                              Ajustar evento
                            </Link>
                            <Link
                              href={`/eventos/${ev.slug}`}
                              className="rounded-full border border-white/20 px-2.5 py-1 text-white/80 hover:bg-white/10"
                            >
                              Partilhar
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/35 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-lg font-semibold text-white">Funil de marketing (v1)</h4>
                    <p className="text-[12px] text-white/65">Bilhetes totais vs. com promo vs. convidados.</p>
                  </div>
                  <span className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white/70">Baseado em códigos</span>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {[
                    { label: "Bilhetes totais", value: marketingKpis.totalTickets ?? "—" },
                    { label: "Bilhetes com promo", value: marketingKpis.ticketsWithPromo ?? 0 },
                    { label: "Guest / convidados", value: marketingKpis.guestTickets ?? 0 },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-[11px] text-white/60">{item.label}</p>
                      <p className="text-xl font-bold text-white mt-1">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {marketingSection === "campaigns" && (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white">Campanhas</h3>
                  <p className="text-[12px] text-white/65">Códigos e links como campanhas. Ativa, pausa, mede impacto.</p>
                </div>
                <Link
                  href="/organizador/promo"
                  className="rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-2 text-sm font-semibold text-black shadow"
                >
                  + Criar campanha
                </Link>
              </div>

              <div className="flex flex-wrap gap-2 text-[11px]">
                <select
                  value={marketingFilters.eventId}
                  onChange={(e) => setMarketingFilters((f) => ({ ...f, eventId: e.target.value }))}
                  className="rounded-full border border-white/15 bg-black/40 px-3 py-1 text-white/80 outline-none"
                >
                  <option value="all">Todos os eventos</option>
                  <option value="global">Globais</option>
                  {marketingEvents.map((ev) => (
                    <option key={ev.id} value={`${ev.id}`}>
                      {ev.title}
                    </option>
                  ))}
                </select>
                <select
                  value={marketingFilters.status}
                  onChange={(e) => setMarketingFilters((f) => ({ ...f, status: e.target.value as typeof f.status }))}
                  className="rounded-full border border-white/15 bg-black/40 px-3 py-1 text-white/80 outline-none"
                >
                  <option value="all">Todos</option>
                  <option value="active">Ativos</option>
                  <option value="inactive">Inativos</option>
                </select>
                <button
                  type="button"
                  onClick={() => mutatePromos()}
                  className="text-[11px] rounded-full border border-white/20 px-3 py-1 text-white/80 hover:bg-white/10"
                >
                  Atualizar
                </button>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/35 backdrop-blur-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-white/80">Campanhas ({filteredPromos.length})</p>
                  <Link
                    href="/organizador/promo"
                    className="text-[11px] rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-3 py-1.5 font-semibold text-black shadow"
                  >
                    + Criar código
                  </Link>
                </div>

                {!promoData && <p className="text-sm text-white/60">A carregar promo codes…</p>}
                {promoData?.ok === false && <p className="text-sm text-red-400">{promoData.error || "Erro ao carregar promo codes."}</p>}
                {promoData?.promoCodes && filteredPromos.length === 0 && (
                  <p className="text-sm text-white/60">Sem promo codes com os filtros atuais.</p>
                )}

                {filteredPromos.length > 0 && (
                  <div className="overflow-auto rounded-2xl border border-white/10">
                    <table className="min-w-full text-sm text-white/80">
                      <thead className="text-left text-[11px] uppercase tracking-wide text-white/60">
                        <tr>
                          <th className="px-4 py-3">Campanha</th>
                          <th className="px-4 py-3">Evento</th>
                          <th className="px-4 py-3">Tipo</th>
                          <th className="px-4 py-3">Valor</th>
                          <th className="px-4 py-3">Utilizações</th>
                          <th className="px-4 py-3">Estado</th>
                          <th className="px-4 py-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredPromos.map((promo) => {
                          const badgeClass = promo.active ? "text-emerald-200" : "text-white/60";
                          const eventTitle =
                            promo.eventId && marketingEvents.find((ev) => ev.id === promo.eventId)?.title
                              ? marketingEvents.find((ev) => ev.id === promo.eventId)?.title
                              : promo.eventId
                                ? `Evento ${promo.eventId}`
                                : "Global";
                          return (
                            <tr key={promo.id} className="hover:bg-white/5 transition">
                              <td className="px-4 py-3 font-semibold text-white">
                                {promo.code}
                                {promo.autoApply && <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70">Auto</span>}
                              </td>
                              <td className="px-4 py-3 text-[12px]">{eventTitle}</td>
                              <td className="px-4 py-3 text-[12px]">{promo.type === "PERCENTAGE" ? "%" : "€"}</td>
                              <td className="px-4 py-3 text-[12px]">
                                {promo.type === "PERCENTAGE" ? `${promo.value / 100}%` : `${(promo.value / 100).toFixed(2)} €`}
                              </td>
                              <td className="px-4 py-3 text-[12px]">{promo.redemptionsCount ?? 0}{promo.maxUses ? ` / ${promo.maxUses}` : ""}</td>
                              <td className={`px-4 py-3 text-[12px] ${badgeClass}`}>{promo.active ? "Ativo" : "Inativo"}</td>
                              <td className="px-4 py-3 text-right text-[11px]">
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await fetch("/api/organizador/promo", {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ id: promo.id, active: !promo.active }),
                                      });
                                      mutatePromos();
                                    }}
                                    className="rounded-full border border-white/20 px-2 py-1 hover:bg-white/10"
                                  >
                                    {promo.active ? "Pausar" : "Ativar"}
                                  </button>
                                  <Link
                                    href={`/organizador/promo?edit=${promo.id}`}
                                    className="rounded-full border border-white/20 px-2 py-1 hover:bg-white/10"
                                  >
                                    Editar
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await fetch("/api/organizador/promo", {
                                        method: "DELETE",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ id: promo.id }),
                                      });
                                      mutatePromos();
                                    }}
                                    className="rounded-full border border-red-400/30 px-2 py-1 text-red-200 hover:bg-red-500/10"
                                  >
                                    Apagar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {marketingSection === "audience" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white">Audiência</h3>
                  <p className="text-[12px] text-white/65">Segmentos rápidos para vender mais sem CRM gigante.</p>
                </div>
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/70">
                  {audienceSummary && audienceSummary.ok !== false ? "Dados reais" : "Em breve dados reais"}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {[
                  { key: "frequent", title: "Clientes frequentes", desc: "3+ eventos contigo", cta: "FREQUENTE10" },
                  { key: "newLast60d", title: "Novos (60 dias)", desc: "Primeiras compras recentes", cta: "BEMVINDO" },
                  { key: "highSpenders", title: "High spenders / VIP", desc: "Gastaram +100€ no total", cta: "VIP10" },
                  { key: "groups", title: "Grupos / jantares", desc: "Reservas 4+ pessoas", cta: "GRUPO" },
                  { key: "dormant90d", title: "Dormant", desc: "Não compram há 90 dias", cta: "REATIVAR10" },
                  { key: "local", title: "Público local", desc: "Cidade do evento", cta: "LOCAL" },
                ].map((seg) => (
                  <div key={seg.key} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-white">{seg.title}</h4>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/70">
                        {audienceSummary && audienceSummary.ok !== false ? audienceSummary.segments[seg.key as keyof typeof audienceSummary.segments] : "—"}{" "}
                        pessoas
                      </span>
                    </div>
                    <p className="text-[12px] text-white/65">{seg.desc}</p>
                    <Link
                      href={`/organizador/promo?name=${encodeURIComponent(seg.cta)}&suggestedCode=${encodeURIComponent(seg.cta)}`}
                      className="inline-flex items-center rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10"
                    >
                      Criar código {seg.cta}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {marketingSection === "promoters" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white">Promotores &amp; Parcerias</h3>
                  <p className="text-[12px] text-white/65">Quem te ajuda a vender (pessoas, grupos, parceiros).</p>
                </div>
                <Link
                  href="/organizador/promo?view=promoters"
                  className="rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-2 text-sm font-semibold text-black shadow"
                >
                  + Novo promotor
                </Link>
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/35 p-4 text-sm text-white/70 space-y-3">
                <p className="text-white/80 font-semibold">Em breve</p>
                <ul className="list-disc pl-5 space-y-1 text-white/70 text-[12px]">
                  <li>Dashboard de vendas por promotor/link com comissão estimada.</li>
                  <li>Copiar link/código do promotor e ver redemptions.</li>
                  <li>Export rápido para CSV.</li>
                </ul>
              </div>
            </div>
          )}

          {marketingSection === "content" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white">Conteúdo &amp; Kits</h3>
                  <p className="text-[12px] text-white/65">Copiar e partilhar: textos rápidos por evento.</p>
                </div>
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/70">v1 em preparação</span>
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/35 p-4 text-sm text-white/70">
                Em breve: textos para Instagram, WhatsApp e email para cada evento, com botões de copiar e links com promo aplicadas.
              </div>
            </div>
          )}

          {marketingSection === "automation" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white">Automação &amp; Boost</h3>
                  <p className="text-[12px] text-white/65">Regras simples para nunca deixar uma sala vazia.</p>
                </div>
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/70">Sugestões v1</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  { title: "Faltam 3 dias e ocupação <50%", action: "Sugerir código LASTMINUTE10" },
                  { title: "Ocupação >90%", action: "Fechar códigos e abrir lista de espera" },
                  { title: "Jantar slot vazio", action: "Promo para horário com pouca ocupação" },
                  { title: "Zero vendas em 48h", action: "Enviar push/email para público local" },
                ].map((rule) => (
                  <div key={rule.title} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-white">{rule.title}</p>
                        <p className="text-[12px] text-white/65">{rule.action}</p>
                      </div>
                      <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-white/70">Em breve</span>
                    </div>
                    <button className="text-[11px] rounded-full border border-white/20 px-3 py-1 text-white/80 hover:bg-white/10">
                      Guardar regra
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

type TimeSeriesPoint = { date: string; tickets: number; revenueCents: number };

function ChartLine({ points, mode = "revenue" }: { points: TimeSeriesPoint[]; mode?: "revenue" | "tickets" }) {
  const width = 320;
  const height = 120;
  const pad = 10;
  const xs = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0;
  const valueAccessor = (p: TimeSeriesPoint) => (mode === "tickets" ? p.tickets : p.revenueCents);
  const maxY = Math.max(...points.map((p) => valueAccessor(p)), 1);
  const path = points
    .map((p, i) => {
      const x = pad + i * xs;
      const norm = valueAccessor(p) / maxY;
      const y = height - pad - norm * (height - pad * 2);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  const last = points[points.length - 1];
  const lastLabel =
    mode === "tickets" ? `${last.tickets} bilhetes` : `${(last.revenueCents / 100).toFixed(2)} €`;

  return (
    <div className="flex w-full items-center gap-3 px-2">
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6BFFFF" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#6BFFFF" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <path
          d={`${path} L ${pad + (points.length - 1) * xs} ${height - pad} L ${pad} ${height - pad} Z`}
          fill="url(#lineFill)"
          stroke="none"
        />
        <path d={path} fill="none" stroke="#6BFFFF" strokeWidth="2" />
        {points.map((p, i) => {
          const x = pad + i * xs;
          const norm = p.revenueCents / maxY;
          const y = height - pad - norm * (height - pad * 2);
          return <circle key={p.date} cx={x} cy={y} r={3} fill="#6BFFFF" />;
        })}
      </svg>
      <div className="text-[11px] text-white/70 min-w-[80px]">
        <p className="text-white font-semibold">{lastLabel}</p>
        <p>Último dia</p>
      </div>
    </div>
  );
}
