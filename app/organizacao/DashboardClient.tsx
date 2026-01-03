"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { ConfirmDestructiveActionDialog } from "@/app/components/ConfirmDestructiveActionDialog";
import { ORGANIZATION_CATEGORY_LABELS, normalizeOrganizationCategory } from "@/lib/organizationCategories";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { useUser } from "@/app/hooks/useUser";
import { AuthModalProvider } from "@/app/components/autenticação/AuthModalContext";
import PromoCodesPage from "./promo/PromoCodesClient";
import { SalesAreaChart } from "@/app/components/charts/SalesAreaChart";
import InvoicesClient from "./pagamentos/invoices/invoices-client";
import ObjectiveSubnav from "./ObjectiveSubnav";
import PadelHubSection from "./(dashboard)/padel/PadelHubSection";
import { CTA_DANGER, CTA_NEUTRAL, CTA_PRIMARY, CTA_SECONDARY, CTA_SUCCESS } from "@/app/organizacao/dashboardUi";
import OrganizationPublicProfilePanel from "./OrganizationPublicProfilePanel";
import InscricoesPage from "./(dashboard)/inscricoes/page";
import { getEventCoverSuggestionIds, getEventCoverUrl } from "@/lib/eventCover";
import { getOrganizationRoleFlags } from "@/lib/organizationUiPermissions";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type OverviewResponse = {
  ok: boolean;
  totalTickets: number;
  totalRevenueCents: number;
  grossCents?: number;
  discountCents?: number;
  platformFeeCents?: number;
  netRevenueCents?: number;
  eventsWithSalesCount: number;
  activeEventsCount: number;
};
type MembersResponse = {
  ok: boolean;
  items?: Array<{ userId: string }>;
  error?: string;
};

type EventItem = {
  id: number;
  slug: string;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  templateType?: string | null;
  tournamentId?: number | null;
  locationName: string | null;
  locationCity: string | null;
  status: string;
  isFree: boolean;
  coverImageUrl?: string | null;
  ticketsSold?: number;
  revenueCents?: number;
  capacity?: number | null;
  categories?: string[];
  padelClubId?: number | null;
  padelPartnerClubIds?: number[];
  padelClubName?: string | null;
  padelPartnerClubNames?: Array<string | null>;
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
type OrganizationStatus = {
  paymentsStatus?: "NO_STRIPE" | "PENDING" | "READY";
  paymentsMode?: "CONNECT" | "PLATFORM";
  profileStatus?: "MISSING_CONTACT" | "OK";
  contactEmail?: string | null;
};
type OrganizationLite = {
  id?: number;
  status?: string | null;
  entityType?: string | null;
  publicName?: string | null;
  businessName?: string | null;
  city?: string | null;
  payoutIban?: string | null;
  officialEmail?: string | null;
  officialEmailVerifiedAt?: string | null;
  stripeAccountId?: string | null;
  stripeChargesEnabled?: boolean | null;
  stripePayoutsEnabled?: boolean | null;
  organizationCategory?: string | null;
  organizationKind?: string | null;
  username?: string | null;
  modules?: string[] | null;
  publicDescription?: string | null;
  brandingAvatarUrl?: string | null;
  brandingCoverUrl?: string | null;
  liveHubPremiumEnabled?: boolean | null;
  publicWebsite?: string | null;
  publicInstagram?: string | null;
  publicYoutube?: string | null;
  publicHours?: string | null;
  address?: string | null;
  showAddressPublicly?: boolean | null;
};

type ObjectiveTab = "create" | "manage" | "promote" | "analyze";
const MARKETING_TABS = [
  { key: "overview", label: "Visão geral" },
  { key: "promos", label: "Códigos promocionais" },
  { key: "promoters", label: "Promotores e parcerias" },
  { key: "content", label: "Conteúdos e kits" },
] as const;
type MarketingSectionKey = (typeof MARKETING_TABS)[number]["key"];
const MARKETING_TAB_KEYS = MARKETING_TABS.map((tab) => tab.key) as MarketingSectionKey[];

const OBJECTIVE_TABS: ObjectiveTab[] = ["create", "manage", "promote", "analyze"];
type SalesRange = "7d" | "30d" | "90d" | "365d" | "all";

type EventStatusFilter = "all" | "active" | "draft" | "finished" | "ongoing" | "archived";

const DATE_LOCALE = "pt-PT";
const DATE_TIMEZONE = "Europe/Lisbon";

const formatDateTime = (date: Date | null, options?: Intl.DateTimeFormatOptions) =>
  date ? date.toLocaleString(DATE_LOCALE, { timeZone: DATE_TIMEZONE, ...options }) : "Data a definir";

const formatDateOnly = (date: Date | null, options?: Intl.DateTimeFormatOptions) =>
  date ? date.toLocaleDateString(DATE_LOCALE, { timeZone: DATE_TIMEZONE, ...options }) : "";

const mapTabToObjective = (tab?: string | null): ObjectiveTab => {
  if (OBJECTIVE_TABS.includes((tab as ObjectiveTab) || "create")) {
    return (tab as ObjectiveTab) || "create";
  }
  switch (tab) {
    case "overview":
      return "create";
    default:
      return "create";
  }
};



function OrganizacaoPageInner({ hasOrganization }: { hasOrganization: boolean }) {
  const { user, profile, isLoading: userLoading } = useUser();
  const [stripeCtaLoading, setStripeCtaLoading] = useState(false);
  const [stripeCtaError, setStripeCtaError] = useState<string | null>(null);
  const [ctaError, setCtaError] = useState<string | null>(null);
  const [ctaSuccess, setCtaSuccess] = useState<string | null>(null);
  const [entityType, setEntityType] = useState<string>("");
  const [businessName, setBusinessName] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [payoutIban, setPayoutIban] = useState<string>("");
  const [eventStatusFilter, setEventStatusFilter] = useState<EventStatusFilter>("all");
  const [eventCategoryFilter, setEventCategoryFilter] = useState<string>("all");
  const [eventPartnerClubFilter, setEventPartnerClubFilter] = useState<string>("all");
  const [salesEventId, setSalesEventId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [timeScope, setTimeScope] = useState<"all" | "upcoming" | "ongoing" | "past">("all");
  const [eventView, setEventView] = useState<"list" | "grid">("grid");
  const [eventActionLoading, setEventActionLoading] = useState<number | null>(null);
  const [eventDialog, setEventDialog] = useState<{ mode: "archive" | "delete" | "unarchive"; ev: EventItem } | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [marketingSection, setMarketingSection] = useState<MarketingSectionKey>("overview");
  const marketingSectionSourceRef = useRef<"url" | "ui">("url");
  const handleMarketingSectionSelect = useCallback(
    (section: MarketingSectionKey) => {
      marketingSectionSourceRef.current = "ui";
      setMarketingSection(section);
    },
    [setMarketingSection],
  );
  const [salesRange, setSalesRange] = useState<SalesRange>("30d");
  const salesRangeLabelShort = (range: SalesRange) => {
    switch (range) {
      case "7d":
        return "7d";
      case "30d":
        return "30d";
      case "90d":
        return "3m";
      case "365d":
        return "1a";
      default:
        return "sempre";
    }
  };
  const salesRangeLabelLong = (range: SalesRange) => {
    switch (range) {
      case "7d":
        return "Últimos 7 dias";
      case "30d":
        return "Últimos 30 dias";
      case "90d":
        return "Últimos 3 meses";
      case "365d":
        return "Último ano";
      default:
        return "Todo o histórico";
    }
  };

  const tabParamRaw = searchParams?.get("tab");
  const sectionParamRaw = searchParams?.get("section");
  const marketingParamRaw = searchParams?.get("marketing");
  const activeObjective = mapTabToObjective(tabParamRaw);
  const normalizedSection = sectionParamRaw ?? undefined;
  const scrollSection = sectionParamRaw ?? undefined;

  useEffect(() => {
    if (!scrollSection) return;
    if (typeof window === "undefined") return;

    const scrollTargets: Record<ObjectiveTab, string[]> = {
      create: ["overview"],
      manage: ["eventos", "inscricoes", "padel-hub"],
      promote: ["marketing"],
      analyze: ["financas", "invoices"],
    };

    const allowed = scrollTargets[activeObjective] ?? [];
    if (!allowed.includes(scrollSection)) return;
    const target = document.getElementById(scrollSection);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [scrollSection, activeObjective]);

  useEffect(() => {
    const statusParam = searchParams?.get("status");
    const catParam = searchParams?.get("cat");
    const clubParam = searchParams?.get("club");
    const searchParam = searchParams?.get("search");
    const scopeParam = searchParams?.get("scope");
    const eventIdParam = searchParams?.get("eventId");
    const marketingSectionParam =
      marketingParamRaw && MARKETING_TAB_KEYS.includes(marketingParamRaw as MarketingSectionKey)
        ? (marketingParamRaw as MarketingSectionKey)
        : MARKETING_TAB_KEYS.includes((sectionParamRaw ?? "") as MarketingSectionKey)
          ? (sectionParamRaw as MarketingSectionKey)
          : null;

    if (statusParam) setEventStatusFilter(statusParam as typeof eventStatusFilter);
    if (catParam) setEventCategoryFilter(catParam);
    if (clubParam) setEventPartnerClubFilter(clubParam);
    if (searchParam) setSearchTerm(searchParam);
    if (scopeParam) setTimeScope(scopeParam as typeof timeScope);
    if (eventIdParam) setSalesEventId(Number(eventIdParam));
    if (marketingSectionParam) {
      marketingSectionSourceRef.current = "url";
      setMarketingSection(marketingSectionParam);
    } else if (activeObjective === "promote" && sectionParamRaw === "marketing") {
      marketingSectionSourceRef.current = "url";
      setMarketingSection("overview");
    }
  }, [searchParams, marketingParamRaw, sectionParamRaw, activeObjective]);

  const organizationIdParam = searchParams?.get("organizationId");
  const orgMeUrl = useMemo(() => {
    if (!user) return null;
    return organizationIdParam ? `/api/organizacao/me?organizationId=${organizationIdParam}` : "/api/organizacao/me";
  }, [user, organizationIdParam]);

  const { data: organizationData, isLoading: organizationLoading, mutate: mutateOrganization } = useSWR<
    OrganizationStatus & {
      profile?: { fullName?: string | null; city?: string | null } | null;
      organization?: OrganizationLite | null;
      ok?: boolean;
      orgTransferEnabled?: boolean | null;
      membershipRole?: string | null;
    }
  >(orgMeUrl, fetcher);

  const organization = organizationData?.organization ?? null;
  const organizationCategory = organization?.organizationCategory ?? null;
  const orgCategory = normalizeOrganizationCategory(organizationCategory);
  const categoryLabel = ORGANIZATION_CATEGORY_LABELS[orgCategory];
  const showPadelHub = orgCategory === "PADEL";
  const loading = userLoading || organizationLoading;
  const paymentsStatus = organizationData?.paymentsStatus ?? "NO_STRIPE";
  const paymentsMode = organizationData?.paymentsMode ?? "CONNECT";
  const profileStatus = organizationData?.profileStatus ?? "MISSING_CONTACT";
  const officialEmail = (organization as { officialEmail?: string | null })?.officialEmail ?? null;
  const officialEmailVerifiedAtRaw = (organization as { officialEmailVerifiedAt?: string | null })?.officialEmailVerifiedAt ?? null;
  const officialEmailVerifiedAt = officialEmailVerifiedAtRaw ? new Date(officialEmailVerifiedAtRaw) : null;
  const showOfficialEmailWarning = Boolean(organization) && !officialEmailVerifiedAt;
  const membershipRole = organizationData?.membershipRole ?? null;
  const roleFlags = useMemo(() => getOrganizationRoleFlags(membershipRole), [membershipRole]);
  const marketingTabs = useMemo(() => {
    if (!roleFlags.canPromote) return [];
    if (roleFlags.isPromoterOnly) {
      return MARKETING_TABS.filter((tab) => tab.key === "promoters");
    }
    return MARKETING_TABS;
  }, [roleFlags]);
  const onboardingParam = searchParams?.get("onboarding");
  const [stripeRequirements, setStripeRequirements] = useState<string[]>([]);
  const [stripeSuccessMessage, setStripeSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (marketingTabs.length === 0) return;
    const allowedKeys = marketingTabs.map((tab) => tab.key);
    if (!allowedKeys.includes(marketingSection)) {
      marketingSectionSourceRef.current = "ui";
      setMarketingSection(allowedKeys[0]);
    }
  }, [marketingTabs, marketingSection]);

  useEffect(() => {
    const refreshStripe = async () => {
      try {
        const res = await fetch("/api/organizacao/payouts/status");
        const data = await res.json().catch(() => null);
        if (res.ok && data?.status) {
          setStripeRequirements(Array.isArray(data.requirements_due) ? data.requirements_due : []);
          if (data.status === "CONNECTED" && onboardingParam === "done") {
            setStripeSuccessMessage("Conta Stripe ligada. Já podes vender bilhetes pagos.");
            setTimeout(() => setStripeSuccessMessage(null), 3200);
          }
        }
        mutateOrganization();
      } catch (err) {
        console.error("[stripe][refresh-status] err", err);
      }
    };
    if (activeObjective === "analyze") {
      refreshStripe();
    }
  }, [onboardingParam, activeObjective, mutateOrganization]);

  // Prefill onboarding fields quando já existirem dados
  useEffect(() => {
    if (!businessName && profile?.fullName) setBusinessName(profile.fullName);
    if (!city && profile?.city) setCity(profile.city);
    if (organization) {
      if (!entityType && organization.entityType) setEntityType(organization.entityType);
      if (!businessName && organization.publicName) setBusinessName(organization.publicName);
      if (!city && organization.city) setCity(organization.city);
      if (!payoutIban && organization.payoutIban) setPayoutIban(organization.payoutIban);
    }
  }, [organization, profile, businessName, city, entityType, payoutIban]);

  const { data: overview } = useSWR<OverviewResponse>(
    organization?.status === "ACTIVE" ? "/api/organizacao/estatisticas/overview?range=30d" : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const shouldLoadOverviewSeries =
    organization?.status === "ACTIVE" &&
    activeObjective === "analyze" &&
    normalizedSection === "overview";

  type TimeSeriesResponse = { ok: boolean; points: TimeSeriesPoint[]; range: { from: string | null; to: string | null } };
  const { data: timeSeries } = useSWR<TimeSeriesResponse>(
    shouldLoadOverviewSeries ? "/api/organizacao/estatisticas/time-series?range=30d" : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const {
    data: events,
    error: eventsError,
    mutate: mutateEvents,
  } = useSWR<EventsResponse>(
    organization?.status === "ACTIVE" ? "/api/organizacao/events/list" : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const { data: membersData } = useSWR<MembersResponse>(
    organization?.status === "ACTIVE" && organization?.id
      ? `/api/organizacao/organizations/members?organizationId=${organization.id}`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const shouldLoadSales =
    organization?.status === "ACTIVE" &&
    activeObjective === "analyze" &&
    normalizedSection === "vendas";

  useEffect(() => {
    if (!shouldLoadSales) return;
    if (!salesEventId && events?.items?.length) {
      setSalesEventId(events.items[0].id);
    }
  }, [events, salesEventId, shouldLoadSales]);

  const { data: payoutSummary } = useSWR<PayoutSummaryResponse>(
    organization?.status === "ACTIVE" ? "/api/organizacao/payouts/summary" : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const { data: financeOverview } = useSWR<FinanceOverviewResponse>(
    organization?.status === "ACTIVE" && activeObjective === "analyze"
      ? "/api/organizacao/finance/overview"
      : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const oneYearAgoIso = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 365);
    return d.toISOString();
  }, []);

  const salesSeriesKey = useMemo(() => {
    if (!shouldLoadSales || !salesEventId) return null;
    if (salesRange === "7d" || salesRange === "30d" || salesRange === "90d") {
      return `/api/organizacao/estatisticas/time-series?range=${salesRange}&eventId=${salesEventId}`;
    }
    if (salesRange === "365d") {
      return `/api/organizacao/estatisticas/time-series?eventId=${salesEventId}&from=${oneYearAgoIso}`;
    }
    return `/api/organizacao/estatisticas/time-series?eventId=${salesEventId}`;
  }, [salesEventId, salesRange, oneYearAgoIso, shouldLoadSales]);

  const { data: salesSeries } = useSWR<TimeSeriesResponse>(
    salesSeriesKey,
    fetcher,
    { revalidateOnFocus: false }
  );

  const { data: buyers } = useSWR<BuyersResponse>(
    shouldLoadSales && salesEventId ? `/api/organizacao/estatisticas/buyers?eventId=${salesEventId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const archiveEvent = useCallback(
    async (target: EventItem, mode: "archive" | "delete" | "unarchive") => {
      setEventActionLoading(target.id);
      setCtaError(null);
      setCtaSuccess(null);
      const archive = mode === "archive" || mode === "delete";
      try {
        const res = await fetch("/api/organizacao/events/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId: target.id, archive }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.ok === false) {
          setCtaError(json?.error || "Não foi possível concluir esta ação.");
        } else {
          mutateEvents();
          if (mode === "delete") {
            setCtaSuccess("Rascunho apagado.");
            trackEvent("event_draft_deleted", { eventId: target.id, status: target.status });
          } else if (mode === "archive") {
            setCtaSuccess("Evento arquivado.");
            trackEvent("event_archived", { eventId: target.id, status: target.status });
          } else {
            setCtaSuccess("Evento reativado.");
            trackEvent("event_unarchived", { eventId: target.id, status: target.status });
          }
          setTimeout(() => setCtaSuccess(null), 3000);
        }
      } catch (err) {
        console.error("[events][archive]", err);
        setCtaError("Erro inesperado ao processar a ação.");
      } finally {
        setEventActionLoading(null);
        setEventDialog(null);
      }
    },
    [mutateEvents],
  );
  const { data: marketingOverview } = useSWR<MarketingOverviewResponse>(
    organization?.status === "ACTIVE" && activeObjective === "promote"
      ? "/api/organizacao/marketing/overview"
      : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const { data: promoData } = useSWR<PromoListResponse>(
    organization?.status === "ACTIVE" ? "/api/organizacao/promo" : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const currentQuery = searchParams?.toString() || "";
  async function handleStripeConnect() {
    import("@/lib/analytics").then(({ trackEvent }) =>
      trackEvent("connect_stripe_clicked", { status: paymentsStatus }),
    );
    setStripeCtaError(null);
    setStripeCtaLoading(true);
    try {
      const res = await fetch("/api/organizacao/payouts/connect", { method: "POST" });
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

  const statsCards = useMemo(() => {
    const grossEuros = (overview?.grossCents ?? overview?.totalRevenueCents ?? 0) / 100;
    const netEuros = (overview?.netRevenueCents ?? overview?.totalRevenueCents ?? 0) / 100;
    const discountEuros = (overview?.discountCents ?? 0) / 100;
    const feeEuros = (overview?.platformFeeCents ?? 0) / 100;
    return [
      {
        label: "Bilhetes 30d",
        value: overview ? overview.totalTickets : "—",
        hint: "Bilhetes vendidos nos últimos 30 dias",
      },
      {
        label: "Receita líquida 30d",
        value: overview ? `${netEuros.toFixed(2)} €` : "—",
        hint: overview
          ? `Bruto ${grossEuros.toFixed(2)}€ · Descontos -${discountEuros.toFixed(2)}€ · Taxas -${feeEuros.toFixed(2)}€`
          : "—",
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

  const statGradients = [
    "from-[#6BFFFF]/25 via-[#0b1224]/70 to-[#0a0f1c]/90",
    "from-[#FF00C8]/18 via-[#130d1f]/70 to-[#0a0f1c]/90",
    "from-[#7AF89A]/18 via-[#0d1c16]/70 to-[#0a0f1c]/90",
    "from-[#AEE4FF]/18 via-[#0d1623]/70 to-[#0a0f1c]/90",
  ];

  // Usar largura completa do inset para evitar que o conteúdo fique centrado/direita quando a sidebar está aberta
  const containerClasses = "w-full max-w-none px-4 pb-12 pt-6 md:pt-8 md:px-6 lg:px-8";
  const statusLabelMap: Record<EventStatusFilter, string> = {
    all: "Todos",
    active: "Ativos",
    draft: "Rascunhos",
    finished: "Concluídos",
    ongoing: "Em curso",
    archived: "Arquivados",
  };
  const timeScopeLabels: Record<"all" | "upcoming" | "ongoing" | "past", string> = {
    all: "Todos",
    upcoming: "Próximos",
    ongoing: "A decorrer",
    past: "Passados",
  };
  const eventsList = useMemo(() => events?.items ?? [], [events]);
  const eventSummary = useMemo(() => {
    const now = new Date();
    let upcoming = 0;
    let ongoing = 0;
    let finished = 0;
    eventsList.forEach((ev) => {
      if (ev.status === "ARCHIVED") return;
      const startsAt = ev.startsAt ? new Date(ev.startsAt) : null;
      const endsAt = ev.endsAt ? new Date(ev.endsAt) : null;
      const isFinished = ev.status === "FINISHED" || (endsAt ? endsAt.getTime() < now.getTime() : false);
      const isOngoing =
        startsAt && endsAt
          ? startsAt.getTime() <= now.getTime() && now.getTime() <= endsAt.getTime()
          : false;
      const isUpcoming = startsAt ? startsAt.getTime() > now.getTime() : false;
      if (isFinished) finished += 1;
      else if (isOngoing) ongoing += 1;
      else if (isUpcoming) upcoming += 1;
    });
    return { upcoming, ongoing, finished, total: eventsList.length };
  }, [eventsList]);
  const eventsListLoading =
    organization?.status === "ACTIVE" &&
    activeObjective === "manage" &&
    !events;
  const overviewLoading = organization?.status === "ACTIVE" && !overview;
  const partnerClubOptions = useMemo(() => {
    const map = new Map<number, string>();
    eventsList.forEach((ev) => {
      if (ev.templateType !== "PADEL") return;
      if (Number.isFinite(ev.padelClubId as number)) {
        map.set(ev.padelClubId as number, ev.padelClubName || `Clube ${ev.padelClubId}`);
      }
      (ev.padelPartnerClubIds || []).forEach((id, idx) => {
        if (!Number.isFinite(id)) return;
        const label = ev.padelPartnerClubNames?.[idx] || `Clube ${id}`;
        map.set(id as number, label);
      });
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [eventsList]);
  const persistFilters = useCallback(
    (params: URLSearchParams) => {
      const paramString = params.toString();
      if (paramString !== currentQuery) {
        router.replace(paramString ? `${pathname}?${paramString}` : pathname, { scroll: false });
      }
      const payload = {
        status: eventStatusFilter,
        cat: eventCategoryFilter,
        club: eventPartnerClubFilter,
        search: searchTerm,
        scope: timeScope,
        marketing: marketingSection,
      };
      if (typeof window !== "undefined") {
        localStorage.setItem("organizacaoFilters", JSON.stringify(payload));
      }
    },
    [
      eventCategoryFilter,
      eventPartnerClubFilter,
      eventStatusFilter,
      pathname,
      router,
      searchTerm,
      timeScope,
      marketingSection,
      currentQuery,
    ]
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (searchParams?.toString()) return;
    const saved = localStorage.getItem("organizacaoFilters");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as {
        status?: string;
        cat?: string;
        club?: string;
        search?: string;
        scope?: string;
        section?: string;
        marketing?: string;
      };
      if (parsed.status) setEventStatusFilter(parsed.status as typeof eventStatusFilter);
      if (parsed.cat) setEventCategoryFilter(parsed.cat);
      if (parsed.club) setEventPartnerClubFilter(parsed.club);
      if (parsed.search) setSearchTerm(parsed.search);
      if (parsed.scope) setTimeScope(parsed.scope as typeof timeScope);
      const persistedMarketing = parsed.marketing ?? parsed.section;
      if (persistedMarketing && MARKETING_TAB_KEYS.includes(persistedMarketing as MarketingSectionKey)) {
        setMarketingSection(persistedMarketing as MarketingSectionKey);
      }
    } catch {
      // ignore parse errors
    }
  }, [searchParams]);
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
      if (eventStatusFilter === "archived" && ev.status !== "ARCHIVED") return false;
      if (eventStatusFilter === "active" && !(ev.status === "PUBLISHED" && isFuture)) return false;
      if (eventStatusFilter === "finished" && !isFinished) return false;
      if (eventStatusFilter === "ongoing" && !isOngoing) return false;

      if (eventCategoryFilter !== "all") {
        const cats = ev.categories ?? [];
        if (!cats.includes(eventCategoryFilter)) return false;
      }
      if (eventPartnerClubFilter !== "all") {
        const clubId = Number(eventPartnerClubFilter);
        if (Number.isFinite(clubId)) {
          const partners = ev.padelPartnerClubIds ?? [];
          const mainClub = ev.padelClubId ?? null;
          if (mainClub !== clubId && !partners.includes(clubId)) return false;
        }
      }
      if (search) {
        if (!ev.title.toLowerCase().includes(search)) return false;
      }

      if (timeScope === "upcoming" && !isFuture) return false;
      if (timeScope === "ongoing" && !isOngoing) return false;
      if (timeScope === "past" && !isFinished) return false;

      return true;
    });
  }, [eventCategoryFilter, eventPartnerClubFilter, eventStatusFilter, eventsList, searchTerm, timeScope]);
  const activeFilterCount = useMemo(
    () =>
      [
        eventStatusFilter !== "all",
        eventCategoryFilter !== "all",
        eventPartnerClubFilter !== "all",
        timeScope !== "all",
        searchTerm.trim() !== "",
      ].filter(Boolean).length,
    [eventCategoryFilter, eventPartnerClubFilter, eventStatusFilter, searchTerm, timeScope]
  );

  const selectedSalesEvent = salesEventId ? eventsList.find((ev) => ev.id === salesEventId) ?? null : null;
  const financeData = financeOverview && financeOverview.ok ? financeOverview : null;
  const financeSummary = payoutSummary && "ok" in payoutSummary && payoutSummary.ok ? payoutSummary : null;
  const stripeState = useMemo(() => {
    const hasReqs = stripeRequirements.length > 0;
    if (paymentsStatus === "READY") {
      return { badge: "Ativo", tone: "success", title: "Conta Stripe ligada ✅", desc: "Já podes vender bilhetes pagos e receber os teus payouts normalmente.", cta: "Abrir painel Stripe" };
    }
    if (paymentsStatus === "PENDING") {
      return {
        badge: hasReqs ? "Requer atenção" : "Onboarding incompleto",
        tone: hasReqs ? "error" : "warning",
        title: hasReqs ? "Falta concluir dados no Stripe" : "Conta Stripe em configuração",
        desc: hasReqs
          ? "A tua conta Stripe precisa de dados antes de ativar pagamentos."
          : "Conclui o onboarding no Stripe para começares a receber os pagamentos dos teus bilhetes.",
        cta: hasReqs ? "Rever ligação Stripe" : "Continuar configuração no Stripe",
      };
    }
    return { badge: "Por ligar", tone: "neutral", title: "Ainda não ligaste a tua conta Stripe", desc: "Podes criar eventos gratuitos, mas para vender bilhetes pagos precisas de ligar uma conta Stripe.", cta: "Ligar conta Stripe" };
  }, [paymentsStatus, stripeRequirements]);

  const marketingPromos = useMemo(() => promoData?.promoCodes ?? [], [promoData]);
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
  const salesLoading = !!salesEventId && !salesSeries;
  const buyersLoading = !!salesEventId && !buyers;
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

  const formatEuros = (val: number) => `${(val / 100).toFixed(2)} €`;

  const extractFees = (p: TimeSeriesPoint) => p.platformFeeCents ?? p.feesCents ?? 0;

  const normalizePoint = (p: TimeSeriesPoint) => {
    const netCents = p.netCents ?? p.revenueCents ?? 0;
    const discount = p.discountCents ?? 0;
    const fees = extractFees(p);
    const grossCents = p.grossCents ?? netCents + discount + fees;
    return {
      date: p.date,
      gross: grossCents / 100,
      net: netCents / 100,
    };
  };

  const overviewSeriesBreakdown = useMemo(() => {
    if (!timeSeries?.points?.length) return null;
    const gross = timeSeries.points.reduce(
      (acc, p) => acc + (p.grossCents ?? (p.netCents ?? p.revenueCents ?? 0) + (p.discountCents ?? 0) + extractFees(p)),
      0,
    );
    const discount = timeSeries.points.reduce((acc, p) => acc + (p.discountCents ?? 0), 0);
    const fees = timeSeries.points.reduce((acc, p) => acc + extractFees(p), 0);
    const net = timeSeries.points.reduce((acc, p) => acc + (p.netCents ?? p.revenueCents ?? 0), 0);
    return { gross, discount, fees, net };
  }, [timeSeries?.points]);

  const salesSeriesBreakdown = useMemo(() => {
    if (!salesSeries?.points?.length) return null;
    const gross = salesSeries.points.reduce(
      (acc, p) => acc + (p.grossCents ?? (p.netCents ?? p.revenueCents ?? 0) + (p.discountCents ?? 0) + extractFees(p)),
      0,
    );
    const discount = salesSeries.points.reduce((acc, p) => acc + (p.discountCents ?? 0), 0);
    const fees = salesSeries.points.reduce((acc, p) => acc + extractFees(p), 0);
    const net = salesSeries.points.reduce((acc, p) => acc + (p.netCents ?? p.revenueCents ?? 0), 0);
    return { gross, discount, fees, net };
  }, [salesSeries?.points]);
  const salesChartPoints = useMemo(() => {
    if (!salesSeries?.points?.length) return [];
    return salesSeries.points.map((p) => ({ ...normalizePoint(p), tickets: p.tickets ?? 0 }));
  }, [salesSeries?.points, normalizePoint]);

  const overviewChartPoints = useMemo(() => {
    if (!timeSeries?.points?.length) return [];
    return timeSeries.points.map((p) => normalizePoint(p));
  }, [timeSeries?.points, normalizePoint]);

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
      formatDateOnly(ev.startsAt ? new Date(ev.startsAt) : null),
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
    const header = ["Data", "Bilhetes", "Bruto (€)", "Desconto (€)", "Taxas (€)", "Líquido (€)"];
    const rows = salesSeries.points.map((p) => {
      const date = formatDateOnly(new Date(p.date));
      const gross = (p.grossCents ?? p.revenueCents ?? 0) / 100;
      const discount = (p.discountCents ?? 0) / 100;
      const fees = (p.platformFeeCents ?? 0) / 100;
      const net = (p.netCents ?? p.revenueCents ?? 0) / 100;
      return [
        date,
        p.tickets,
        gross.toFixed(2),
        (-discount).toFixed(2),
        (-fees).toFixed(2),
        net.toFixed(2),
      ];
    });
    const csv = [header.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const rangeLabel = salesRangeLabelShort(salesRange);
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

  const isPlatformStripe = paymentsMode === "PLATFORM";
  const stripeReady = isPlatformStripe || paymentsStatus === "READY";
  const stripeIncomplete = !isPlatformStripe && paymentsStatus === "PENDING";
  const nextEvent = events?.items?.[0] ?? null;
  const publicProfileUrl = organization?.username ? `/${organization.username}` : null;
  const profileCoverUrl = useMemo(() => {
    const customCover = organization?.brandingCoverUrl?.trim() || null;
    const coverEvent = eventsList.find((ev) => ev.coverImageUrl) ?? null;
    const coverCandidate = customCover ?? coverEvent?.coverImageUrl ?? null;
    if (!coverCandidate) return null;
    const suggestions = getEventCoverSuggestionIds({
      templateType: coverEvent?.templateType ?? null,
      organizationCategory: organization?.organizationCategory ?? null,
    });
    return getEventCoverUrl(coverCandidate, {
      seed: coverEvent?.slug ?? organization?.username ?? organization?.id ?? "org-cover",
      suggestedIds: suggestions,
      width: 1400,
      quality: 70,
      format: "webp",
    });
  }, [eventsList, organization?.brandingCoverUrl, organization?.organizationCategory, organization?.username, organization?.id]);
  const membersCount = membersData?.ok ? membersData.items?.length ?? 0 : 0;
  const hasInvitedStaff = membersCount > 1;
  const summarySteps = [
    {
      id: "profile",
      label: "Perfil completo",
      done: profileStatus === "OK",
      href: "/organizacao/settings",
    },
    {
      id: "stripe",
      label: "Stripe ligado",
      done: stripeReady,
      href: "/organizacao?tab=analyze&section=financas",
    },
    {
      id: "event",
      label: "Primeiro evento criado",
      done: eventsList.length > 0,
      href: "/organizacao/eventos/novo",
    },
    {
      id: "staff",
      label: "Primeiro staff convidado",
      done: hasInvitedStaff,
      href: "/organizacao/staff",
    },
    {
      id: "public",
      label: "Página pública definida",
      done: Boolean(publicProfileUrl),
      href: "/organizacao?tab=overview#perfil-publico",
    },
  ];
  const completedSteps = summarySteps.filter((step) => step.done).length;
  const completionPercent = summarySteps.length
    ? Math.round((completedSteps / summarySteps.length) * 100)
    : 0;
  const activeSection = useMemo(() => {
    const manageSections = showPadelHub
      ? ["eventos", "inscricoes", "padel-hub"]
      : ["eventos", "inscricoes"];
    const baseSections: Record<ObjectiveTab, string[]> = {
      create: ["overview"],
      manage: manageSections,
      promote: ["marketing"],
      analyze: ["financas", "invoices"],
    };
    const allowed = baseSections[activeObjective] ?? ["overview"];
    const candidate =
      normalizedSection ??
      (activeObjective === "analyze" ? "financas" : activeObjective === "promote" ? "marketing" : "overview");
    return allowed.includes(candidate) ? candidate : allowed[0];
  }, [activeObjective, normalizedSection, showPadelHub]);

  useEffect(() => {
    const params = new URLSearchParams(currentQuery);
    const setParam = (key: string, value: string, defaultVal: string) => {
      if (!value || value === defaultVal) params.delete(key);
      else params.set(key, value);
    };
    setParam("status", eventStatusFilter, "all");
    setParam("cat", eventCategoryFilter, "all");
    setParam("club", eventPartnerClubFilter, "all");
    setParam("search", searchTerm, "");
    setParam("scope", timeScope, "all");
    if (activeObjective === "promote" && activeSection === "marketing") {
      const validMarketingParam =
        marketingParamRaw && MARKETING_TAB_KEYS.includes(marketingParamRaw as MarketingSectionKey)
          ? (marketingParamRaw as MarketingSectionKey)
          : null;
      if (
        marketingSectionSourceRef.current !== "ui" &&
        validMarketingParam &&
        validMarketingParam !== marketingSection
      ) {
        return;
      }
      setParam("marketing", marketingSection, "overview");
    } else {
      params.delete("marketing");
    }
    if (salesEventId) params.set("eventId", String(salesEventId));
    else params.delete("eventId");
    persistFilters(params);
    if (marketingSectionSourceRef.current === "ui") {
      marketingSectionSourceRef.current = "url";
    }
  }, [
    eventCategoryFilter,
    eventPartnerClubFilter,
    eventStatusFilter,
    marketingSection,
    persistFilters,
    salesEventId,
    searchTerm,
    timeScope,
    currentQuery,
    activeObjective,
    activeSection,
    marketingParamRaw,
  ]);
  const [fadeIn, setFadeIn] = useState(true);
  useEffect(() => {
    setFadeIn(false);
    const id = requestAnimationFrame(() => setFadeIn(true));
    return () => cancelAnimationFrame(id);
  }, [activeObjective, activeSection, marketingSection]);
  const fadeClass = cn("transition-opacity duration-300", fadeIn ? "opacity-100" : "opacity-0");

  if (loading) {
    return (
      <div className={`${containerClasses} space-y-6`}>
        <div className="h-8 w-48 rounded-full bg-white/10 animate-pulse" />
        <div className="h-24 rounded-3xl bg-white/5 border border-white/10 animate-pulse" />
      </div>
    );
  }

  if (!hasOrganization || organization?.status !== "ACTIVE") {
    return (
      <div className={`${containerClasses} space-y-6`}>
        <div className="max-w-xl space-y-3 rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-6 backdrop-blur-2xl">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/70">Sem organização ativa</p>
          <h1 className="text-2xl font-semibold text-white">Liga-te a uma organização para continuares.</h1>
          <p className="text-sm text-white/70">
            Precisas de criar ou escolher uma organização para aceder ao dashboard.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/organizacao/become" className={cn(CTA_PRIMARY, "justify-center")}>
              Criar organização
            </Link>
            <Link href="/organizacao/organizations" className={cn(CTA_SECONDARY, "justify-center")}>
              Escolher organização
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${containerClasses} space-y-6 text-white`}>
      {showOfficialEmailWarning && (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <p className="font-semibold">
                {officialEmail
                  ? "Email oficial pendente de verificação."
                  : "Define o email oficial da organização para faturação e alertas críticos."}
              </p>
              <p className="text-[12px] text-amber-100/80">
                Usamos este email para invoices, alertas de vendas/payouts e transferências de Owner.
              </p>
            </div>
            <Link href="/organizacao/settings" className={cn(CTA_SECONDARY, "text-[12px]")}>
              Atualizar email oficial
            </Link>
          </div>
        </div>
      )}
      {activeObjective === "create" && (
        <section className="space-y-4">
          <div
            id="overview"
            className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/75 to-[#050912]/95 p-5 backdrop-blur-3xl"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.26em] text-white/60">Resumo</p>
                <h1 className="text-3xl font-semibold text-white">Estado atual da organização</h1>
                <p className="text-sm text-white/70">Tudo o essencial num só olhar, sem distrações.</p>
              </div>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] text-white/80">
                {categoryLabel}
              </span>
            </div>
          </div>

          <div className={cn("grid gap-3 md:grid-cols-3", fadeClass)}>
            <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-[#0f1a2e]/80 via-[#0b1224]/70 to-[#050a12]/90 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.55)]">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Conta</p>
              <h3 className="text-lg font-semibold text-white">Estado da conta</h3>
              <div className="mt-3 space-y-2 text-[12px] text-white/75">
                <div className="flex items-center justify-between">
                  <span>Perfil</span>
                  <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5">
                    {profileStatus === "OK" ? "Completo" : "Incompleto"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Stripe</span>
                  <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5">
                    {paymentsMode === "PLATFORM" ? "Conta ORYA" : stripeReady ? "Ativo" : "Por ligar"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Publicação</span>
                  <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5">
                    {organization?.status === "ACTIVE" ? "Ativa" : "Pendente"}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-[#101b39]/80 via-[#0b1124]/70 to-[#050a12]/92 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.55)]">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Eventos</p>
              <h3 className="text-lg font-semibold text-white">Resumo de atividade</h3>
              <div className="mt-3 grid gap-2 text-[12px] text-white/75">
                <div className="flex items-center justify-between">
                  <span>Eventos ativos</span>
                  <span className="font-semibold text-white">{overview?.activeEventsCount ?? eventsList.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Próximos</span>
                  <span className="font-semibold text-white">{eventSummary.upcoming}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Concluídos</span>
                  <span className="font-semibold text-white">{eventSummary.finished}</span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-[#120b24]/75 via-[#0b1124]/70 to-[#050a12]/92 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.55)]">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Vendas</p>
              <h3 className="text-lg font-semibold text-white">Últimos 30 dias</h3>
              <div className="mt-3 grid gap-2 text-[12px] text-white/75">
                <div className="flex items-center justify-between">
                  <span>Bilhetes</span>
                  <span className="font-semibold text-white">{overview?.totalTickets ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Receita líquida</span>
                  <span className="font-semibold text-white">
                    {overview ? `${((overview.netRevenueCents ?? overview.totalRevenueCents ?? 0) / 100).toFixed(2)} €` : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Eventos com vendas</span>
                  <span className="font-semibold text-white">{overview?.eventsWithSalesCount ?? "—"}</span>
                </div>
              </div>
            </div>
          </div>

          <div className={cn("rounded-3xl border border-white/12 bg-gradient-to-br from-[#0b1226]/80 via-[#0b1124]/70 to-[#050a12]/92 p-4", fadeClass)}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Checklist</p>
                <h3 className="text-lg font-semibold text-white">Próximos passos</h3>
                <p className="text-[12px] text-white/65">Completa o básico para lançar sem fricção.</p>
              </div>
              <div className="text-right text-[11px] text-white/70">
                <div>{completedSteps}/{summarySteps.length} concluídos</div>
                <div className="text-white/50">{completionPercent}%</div>
              </div>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-white/10">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-[#FF7AD1] via-[#7FE0FF] to-[#6A7BFF]"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {summarySteps.map((step) => (
                <div
                  key={step.id}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 shadow-[0_12px_36px_rgba(0,0,0,0.35)]"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-full border text-[12px] font-semibold",
                        step.done
                          ? "border-emerald-300/60 bg-emerald-500/15 text-emerald-50"
                          : "border-white/20 bg-white/10 text-white/60",
                      )}
                    >
                      {step.done ? "✓" : "•"}
                    </span>
                    <span>{step.label}</span>
                  </div>
                  {!step.done && (
                    <Link href={step.href} className="text-[11px] text-[#6BFFFF] hover:underline">
                      Completar
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div
            id="perfil-publico"
            className={cn(
              "rounded-3xl border border-white/12 bg-gradient-to-br from-[#0b1226]/80 via-[#0b1124]/70 to-[#050a12]/92 p-5",
              fadeClass,
            )}
          >
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Perfil público</p>
              <h3 className="text-lg font-semibold text-white">Pré-visualização</h3>
              <p className="text-[12px] text-white/65">Confirma como a tua organização aparece ao público.</p>
            </div>
            <OrganizationPublicProfilePanel
              organization={organization ?? null}
              membershipRole={membershipRole}
              categoryLabel={categoryLabel}
              coverUrl={profileCoverUrl}
            />
          </div>
        </section>
      )}

      {activeObjective === "manage" && (
        <section className={cn("space-y-3", fadeClass)} id="gerir">
          <div className="rounded-3xl border border-white/12 bg-gradient-to-r from-[#0b1226]/80 via-[#101b39]/75 to-[#050811]/90 px-4 py-4 sm:px-6 sm:py-5 backdrop-blur-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-white/70 shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
                  Dashboard · Gerir
                </div>
                <h2 className="text-2xl sm:text-3xl font-semibold text-white drop-shadow-[0_12px_45px_rgba(0,0,0,0.6)]">
                  Eventos
                </h2>
                <p className="text-sm text-white/70">
                  Entra em cada evento para editar, preparar live, inscrições, página pública e arquivo.
                </p>
              </div>
            </div>
            <div className="mt-4">
              <ObjectiveSubnav
                objective="manage"
                activeId={activeSection}
                category={orgCategory}
                modules={organization?.modules ?? []}
                mode="dashboard"
                variant="tabs"
              />
            </div>
          </div>
        </section>
      )}

      {activeObjective === "manage" && activeSection === "eventos" && (
        <section className={cn("space-y-4", fadeClass)} id="eventos">
          <div className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-r from-[#0b1226]/80 via-[#101b39]/75 to-[#050811]/90 p-5 backdrop-blur-3xl">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -left-20 top-2 h-56 w-56 rounded-full bg-[#6BFFFF]/18 blur-[120px]" />
              <div className="absolute right-10 top-0 h-48 w-48 rounded-full bg-[#FF7AD1]/18 blur-[120px]" />
              <div className="absolute -right-18 -bottom-20 h-64 w-64 rounded-full bg-[#6A7BFF]/18 blur-[120px]" />
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/8 to-transparent" />
            </div>

            <div className="relative space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-start">
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-[0.26em] text-white/70">Eventos</p>
                  <h2 className="text-2xl font-semibold text-white drop-shadow-[0_14px_40px_rgba(0,0,0,0.45)]">Gestão dos teus eventos</h2>
                  <p className="text-sm text-white/80">Pesquisa focada com estados e períodos claros.</p>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[1.4fr,1fr]">
                <div className="rounded-2xl border border-white/12 bg-gradient-to-br from-[#0b1226]/85 via-[#0b1124]/70 to-[#050912]/90 backdrop-blur-2xl px-3 py-3 shadow-[0_22px_80px_rgba(0,0,0,0.55)]">
                  <label className="text-[10px] uppercase tracking-[0.24em] text-white/55">Pesquisa</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="search"
                      placeholder="Procurar por evento..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
                    />
                    <div className="hidden text-[12px] text-white/50 md:inline">⌘/</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/12 bg-gradient-to-br from-[#0b1226]/85 via-[#0b1124]/70 to-[#050912]/90 backdrop-blur-2xl p-3 shadow-[0_22px_80px_rgba(0,0,0,0.55)]">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-white/55">Período</p>
                  <div className="mt-2 inline-flex w-full rounded-2xl border border-white/10 bg-white/5 p-1 shadow-[0_16px_50px_rgba(0,0,0,0.4)]">
                    {(["all", "upcoming", "ongoing", "past"] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setTimeScope(opt)}
                        className={cn(
                          "flex-1 rounded-xl px-3 py-2 text-[12px] font-semibold transition",
                          timeScope === opt
                            ? "bg-gradient-to-r from-[#FF7AD1]/60 via-[#7FE0FF]/35 to-[#6A7BFF]/55 text-white shadow-[0_14px_36px_rgba(107,255,255,0.45)]"
                            : "text-white/80 hover:bg-white/10",
                        )}
                      >
                        {opt === "all" ? "Todos" : opt === "upcoming" ? "Próximos" : opt === "ongoing" ? "A decorrer" : "Passados"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-white/55">Estados</p>
                  <div className="inline-flex flex-wrap rounded-2xl border border-white/10 bg-white/5 p-1 shadow-[0_14px_40px_rgba(0,0,0,0.4)] backdrop-blur-xl">
                    {[
                      { key: "all", label: "Todos" },
                      { key: "active", label: "Ativos" },
                      { key: "ongoing", label: "Em curso" },
                      { key: "finished", label: "Concluídos" },
                      { key: "archived", label: "Arquivados" },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setEventStatusFilter(opt.key as typeof eventStatusFilter)}
                        className={cn(
                          "rounded-xl px-3 py-2 text-[12px] font-semibold transition",
                          eventStatusFilter === opt.key
                            ? "bg-gradient-to-r from-[#FF7AD1]/60 via-[#7FE0FF]/35 to-[#6A7BFF]/55 text-white shadow-[0_14px_36px_rgba(107,255,255,0.45)]"
                            : "text-white/80 hover:bg-white/10",
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEventStatusFilter("all");
                    setEventCategoryFilter("all");
                    setEventPartnerClubFilter("all");
                    setSearchTerm("");
                    setTimeScope("all");
                  }}
                  className={CTA_SECONDARY}
                >
                  Limpar filtros
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {activeFilterCount > 0 && (
                  <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/12 bg-gradient-to-r from-white/8 via-white/6 to-white/4 px-3 py-2 text-[12px] text-white/80 shadow-[0_12px_36px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
                    <span className="font-semibold text-white/75">Filtros ativos ({activeFilterCount})</span>
                    {eventStatusFilter !== "all" && (
                      <button
                        type="button"
                        onClick={() => setEventStatusFilter("all")}
                        className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 hover:border-white/40"
                      >
                        Estado: {statusLabelMap[eventStatusFilter]} ×
                      </button>
                    )}
                    {eventCategoryFilter !== "all" && (
                      <button
                        type="button"
                        onClick={() => setEventCategoryFilter("all")}
                        className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 hover:border-white/40"
                      >
                        Categoria: {eventCategoryFilter} ×
                      </button>
                    )}
                    {eventPartnerClubFilter !== "all" && (
                      <button
                        type="button"
                        onClick={() => setEventPartnerClubFilter("all")}
                        className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 hover:border-white/40"
                      >
                        Clube: {partnerClubOptions.find((o) => `${o.id}` === eventPartnerClubFilter)?.name ?? eventPartnerClubFilter} ×
                      </button>
                    )}
                    {timeScope !== "all" && (
                      <button
                        type="button"
                        onClick={() => setTimeScope("all")}
                        className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 hover:border-white/40"
                      >
                        Período: {timeScopeLabels[timeScope]} ×
                      </button>
                    )}
                    {searchTerm.trim() && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm("")}
                        className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 hover:border-white/40"
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
                    <div className="inline-flex items-center rounded-2xl border border-white/15 bg-white/5 p-1 text-[12px]">
                      <button
                        type="button"
                        onClick={() => setEventView("list")}
                        className={cn(
                          "rounded-xl px-3 py-1.5 font-semibold transition",
                          eventView === "list"
                            ? "bg-gradient-to-r from-[#FF7AD1]/60 via-[#7FE0FF]/35 to-[#6A7BFF]/55 text-white shadow-[0_14px_36px_rgba(107,255,255,0.45)]"
                            : "text-white/70 hover:bg-white/10",
                        )}
                      >
                        Lista
                      </button>
                      <button
                        type="button"
                        onClick={() => setEventView("grid")}
                        className={cn(
                          "rounded-xl px-3 py-1.5 font-semibold transition",
                          eventView === "grid"
                            ? "bg-gradient-to-r from-[#FF7AD1]/60 via-[#7FE0FF]/35 to-[#6A7BFF]/55 text-white shadow-[0_14px_36px_rgba(107,255,255,0.45)]"
                            : "text-white/70 hover:bg-white/10",
                        )}
                      >
                        Galeria
                      </button>
                    </div>
                  </div>

                  {ctaError && (
                    <div className="rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                      {ctaError}
                    </div>
                  )}
                  {ctaSuccess && (
                    <div className="rounded-2xl border border-emerald-300/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                      {ctaSuccess}
                    </div>
                  )}

            {eventsListLoading && (
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
                  className={cn(CTA_SECONDARY, "text-[12px]")}
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {!eventsListLoading && events?.items?.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-6 text-center text-sm text-white/70 space-y-2">
                <p className="text-base font-semibold text-white">Ainda não tens eventos criados.</p>
                <p>Começa por criar o teu primeiro evento e acompanha tudo a partir daqui.</p>
              </div>
            )}

            {!eventsListLoading && events?.items && events.items.length > 0 && filteredEvents.length === 0 && (
              <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-6 text-center text-sm text-white/70 space-y-2">
                <p className="text-base font-semibold text-white">Nenhum evento corresponde a estes filtros.</p>
                <p className="text-white/65">Troca o período ou limpa os filtros para veres todos.</p>
                <div className="flex flex-wrap justify-center gap-2 text-[12px]">
                  <button
                    type="button"
                    onClick={() => {
                      setEventStatusFilter("all");
                      setEventCategoryFilter("all");
                      setTimeScope("all");
                      setEventPartnerClubFilter("all");
                      setSearchTerm("");
                    }}
                    className={cn(CTA_SECONDARY, "text-[12px]")}
                  >
                    Limpar filtros
                  </button>
                  <Link
                    href="/organizacao/eventos/novo"
                    className={cn(CTA_PRIMARY, "text-[12px]")}
                  >
                    Criar novo evento
                  </Link>
                </div>
              </div>
            )}

                {filteredEvents.length > 0 && (
                  <>
                    {eventView === "list" ? (
                      <div className="overflow-hidden rounded-3xl border border-white/16 bg-gradient-to-br from-white/18 via-[#15284c]/75 to-[#070d19]/92 backdrop-blur-3xl">
                        <table className="min-w-full text-sm text-white/90">
                          <thead className="bg-white/10 text-left text-[11px] uppercase tracking-wide text-white/75">
                            <tr>
                              <th className="px-4 py-3 font-semibold">Evento</th>
                              <th className="px-4 py-3 font-semibold">Data</th>
                              <th className="px-4 py-3 font-semibold">Estado</th>
                              <th className="px-4 py-3 font-semibold">Tipo</th>
                              <th className="px-4 py-3 font-semibold">Bilhetes</th>
                              <th className="px-4 py-3 font-semibold">Receita</th>
                              <th className="px-4 py-3 text-right font-semibold">Ações</th>
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
                                ? formatDateTime(date, {
                                    day: "2-digit",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "Data a confirmar";
                              const ticketsSold = ev.ticketsSold ?? 0;
                              const capacity = ev.capacity ?? null;
                              const revenue = ((ev.revenueCents ?? 0) / 100).toFixed(2);
                              const normalizedTemplate = ev.templateType ?? "OTHER";
                              const typeLabel = normalizedTemplate === "PADEL" ? "Padel" : "Evento padrão";
                              const typeTone =
                                normalizedTemplate === "PADEL"
                                  ? "border-sky-400/40 bg-sky-400/10 text-sky-100"
                                  : "border-white/20 bg-white/5 text-white/80";
                              const statusBadge =
                                ev.status === "CANCELLED"
                                  ? { label: "Cancelado", classes: "border-red-400/60 bg-red-500/10 text-red-100" }
                                  : ev.status === "ARCHIVED"
                                    ? { label: "Arquivado", classes: "border-amber-400/60 bg-amber-500/10 text-amber-100" }
                                    : ev.status === "DRAFT"
                                      ? { label: "Draft", classes: "border-white/20 bg-white/5 text-white/70" }
                                      : isOngoing
                                        ? { label: "A decorrer", classes: "border-emerald-400/60 bg-emerald-500/10 text-emerald-100" }
                                        : isFuture
                                          ? { label: "Publicado", classes: "border-sky-400/60 bg-sky-500/10 text-sky-100" }
                                          : isFinished
                                            ? { label: "Concluído", classes: "border-purple-400/60 bg-purple-500/10 text-purple-100" }
                                            : { label: ev.status, classes: "border-white/20 bg-white/5 text-white/70" };
                              const salesLabel = "Inscrições";

                              return (
                                <tr key={ev.id} className="hover:bg-white/10 transition duration-150">
                                  <td className="px-4 py-3">
                                    <Link
                                      href={`/organizacao/eventos/${ev.id}`}
                                      className="text-left text-white hover:underline"
                                    >
                                      {ev.title}
                                    </Link>
                                  </td>
                                  <td className="px-4 py-3 text-[12px] text-white/80">{dateLabel}</td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] shadow-[0_10px_24px_rgba(0,0,0,0.35)] ${statusBadge.classes}`}>
                                      {statusBadge.label}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] shadow-[0_8px_20px_rgba(0,0,0,0.3)] ${typeTone}`}>
                                      {typeLabel}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-[12px]">
                                    <span className="font-semibold text-white">{ticketsSold}</span>
                                    <span className="text-white/60"> / {capacity ?? "—"}</span>
                                  </td>
                                  <td className="px-4 py-3 text-[12px] font-semibold text-white">{revenue} €</td>
                                  <td className="px-4 py-3 text-right text-[11px]">
                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                      <Link
                                        href={`/organizacao/eventos/${ev.id}/edit`}
                                        className={cn(CTA_SECONDARY, "px-3 py-1 text-[11px]")}
                                      >
                                        Editar
                                      </Link>
                                      <Link
                                        href={`/organizacao/eventos/${ev.id}/live`}
                                        className={cn(CTA_SECONDARY, "px-3 py-1 text-[11px]")}
                                      >
                                        Preparar Live
                                      </Link>
                                      {ev.status !== "ARCHIVED" && (
                                        <Link
                                          href={`/organizacao/eventos/${ev.id}`}
                                          className={cn(CTA_SECONDARY, "px-3 py-1 text-[11px]")}
                                        >
                                          {salesLabel}
                                        </Link>
                                      )}
                                      <Link
                                        href={`/eventos/${ev.slug}`}
                                        className={cn(CTA_NEUTRAL, "px-3 py-1 text-[11px]")}
                                      >
                                        Página pública
                                      </Link>
                                      {ev.status === "ARCHIVED" ? (
                                        <button
                                          type="button"
                                          disabled={eventActionLoading === ev.id}
                                          onClick={() => setEventDialog({ mode: "unarchive", ev })}
                                          className={cn(CTA_SUCCESS, "px-3 py-1 text-[11px] disabled:opacity-60")}
                                        >
                                          Reativar
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          disabled={eventActionLoading === ev.id}
                                          onClick={() => setEventDialog({ mode: ev.status === "DRAFT" ? "delete" : "archive", ev })}
                                          className={cn(CTA_DANGER, "px-3 py-1 text-[11px] disabled:opacity-60")}
                                        >
                                          {ev.status === "DRAFT" ? "Apagar rascunho" : "Arquivar"}
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {filteredEvents.map((ev) => {
                          const date = ev.startsAt ? new Date(ev.startsAt) : null;
                          const endsAt = ev.endsAt ? new Date(ev.endsAt) : null;
                          const now = new Date();
                          const isOngoing = date && endsAt ? date.getTime() <= now.getTime() && now.getTime() <= endsAt.getTime() : false;
                          const isFuture = date ? date.getTime() > now.getTime() : false;
                          const isFinished = endsAt ? endsAt.getTime() < now.getTime() : false;
                          const dateLabel = date
                            ? formatDateTime(date, {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Data a confirmar";
                          const ticketsSold = ev.ticketsSold ?? 0;
                          const capacity = ev.capacity ?? null;
                          const revenue = ((ev.revenueCents ?? 0) / 100).toFixed(2);
                          const normalizedTemplate = ev.templateType ?? "OTHER";
                          const typeLabel = normalizedTemplate === "PADEL" ? "Padel" : "Evento padrão";
                          const typeTone =
                            normalizedTemplate === "PADEL"
                              ? "border-sky-400/40 bg-sky-400/10 text-sky-100"
                              : "border-white/20 bg-white/5 text-white/80";
                          const statusBadge =
                            ev.status === "CANCELLED"
                              ? { label: "Cancelado", classes: "border-red-400/60 bg-red-500/10 text-red-100" }
                              : ev.status === "ARCHIVED"
                                ? { label: "Arquivado", classes: "border-amber-400/60 bg-amber-500/10 text-amber-100" }
                                : ev.status === "DRAFT"
                                  ? { label: "Draft", classes: "border-white/20 bg-white/5 text-white/70" }
                                  : isOngoing
                                    ? { label: "A decorrer", classes: "border-emerald-400/60 bg-emerald-500/10 text-emerald-100" }
                                    : isFuture
                                      ? { label: "Publicado", classes: "border-sky-400/60 bg-sky-500/10 text-sky-100" }
                                      : isFinished
                                      ? { label: "Concluído", classes: "border-purple-400/60 bg-purple-500/10 text-purple-100" }
                                      : { label: ev.status, classes: "border-white/20 bg-white/5 text-white/70" };
                          const coverSuggestions = getEventCoverSuggestionIds({
                            templateType: normalizedTemplate,
                            organizationCategory: organization?.organizationCategory ?? null,
                          });
                          const coverUrl = getEventCoverUrl(ev.coverImageUrl, {
                            seed: ev.slug ?? ev.id,
                            suggestedIds: coverSuggestions,
                            width: 900,
                            quality: 70,
                            format: "webp",
                          });

                          return (
                            <div
                              key={ev.id}
                              className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-[#0f1a2e]/80 via-[#0b1124]/70 to-[#050a12]/90 p-4 shadow-[0_26px_90px_rgba(0,0,0,0.55)]"
                            >
                              <div className="pointer-events-none absolute inset-0">
                                {coverUrl ? (
                                  <div
                                    className="absolute inset-0 scale-110 bg-cover bg-center blur-2xl"
                                    style={{ backgroundImage: `url(${coverUrl})` }}
                                  />
                                ) : (
                                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(107,255,255,0.12),transparent_55%),radial-gradient(circle_at_80%_30%,rgba(255,122,209,0.12),transparent_55%),linear-gradient(135deg,rgba(11,17,36,0.85),rgba(5,10,18,0.95))]" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-b from-[#050810]/35 via-[#050810]/75 to-[#050810]/95" />
                              </div>

                              <div className="relative z-10">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 space-y-1">
                                    <Link
                                      href={`/organizacao/eventos/${ev.id}`}
                                      className="text-lg font-semibold text-white hover:underline"
                                    >
                                      {ev.title}
                                    </Link>
                                    <p className="text-[12px] text-white/70">{dateLabel}</p>
                                    <p className="text-[12px] text-white/55">
                                      {ev.locationCity || ev.locationName || "Local a confirmar"}
                                    </p>
                                  </div>
                                  <div className="flex flex-col items-end gap-2">
                                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] ${statusBadge.classes}`}>
                                      {statusBadge.label}
                                    </span>
                                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] ${typeTone}`}>
                                      {typeLabel}
                                    </span>
                                  </div>
                                </div>

                                <div className="mt-3 grid gap-2 sm:grid-cols-2 text-[12px] text-white/75">
                                  <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                                    <p className="text-[11px] text-white/50">Bilhetes</p>
                                    <p className="text-sm font-semibold text-white">
                                      {ticketsSold} <span className="text-white/50">/ {capacity ?? "—"}</span>
                                    </p>
                                  </div>
                                  <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                                    <p className="text-[11px] text-white/50">Receita</p>
                                    <p className="text-sm font-semibold text-white">{revenue} €</p>
                                  </div>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                                  <Link
                                    href={`/organizacao/eventos/${ev.id}/edit`}
                                    className={cn(CTA_SECONDARY, "px-3 py-1 text-[11px]")}
                                  >
                                    Editar
                                  </Link>
                                  <Link
                                    href={`/organizacao/eventos/${ev.id}/live`}
                                    className={cn(CTA_SECONDARY, "px-3 py-1 text-[11px]")}
                                  >
                                    Preparar Live
                                  </Link>
                                  {ev.status !== "ARCHIVED" && (
                                    <Link
                                      href={`/organizacao/eventos/${ev.id}`}
                                      className={cn(CTA_SECONDARY, "px-3 py-1 text-[11px]")}
                                    >
                                      Inscrições
                                    </Link>
                                  )}
                                  <Link
                                    href={`/eventos/${ev.slug}`}
                                    className={cn(CTA_NEUTRAL, "px-3 py-1 text-[11px]")}
                                  >
                                    Página pública
                                  </Link>
                                  {ev.status === "ARCHIVED" ? (
                                    <button
                                      type="button"
                                      disabled={eventActionLoading === ev.id}
                                      onClick={() => setEventDialog({ mode: "unarchive", ev })}
                                      className={cn(CTA_SUCCESS, "px-3 py-1 text-[11px] disabled:opacity-60")}
                                    >
                                      Reativar
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={eventActionLoading === ev.id}
                                      onClick={() => setEventDialog({ mode: ev.status === "DRAFT" ? "delete" : "archive", ev })}
                                      className={cn(CTA_DANGER, "px-3 py-1 text-[11px] disabled:opacity-60")}
                                    >
                                      {ev.status === "DRAFT" ? "Apagar rascunho" : "Arquivar"}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          </div>
        </section>
      )}

      {activeObjective === "manage" && activeSection === "inscricoes" && (
        <section className={cn("space-y-4", fadeClass)} id="inscricoes">
          <InscricoesPage embedded />
        </section>
      )}

      {activeObjective === "manage" && activeSection === "padel-hub" && showPadelHub && (
        <section className={cn("space-y-4", fadeClass)} id="padel-hub">
          {organization?.id ? (
            <PadelHubSection
              organizationId={organization.id}
              organizationKind={organization.organizationKind ?? null}
            />
          ) : (
            <div className="rounded-2xl border border-white/12 bg-white/5 px-4 py-6 text-sm text-white/70">
              Organização indisponível para carregar o hub.
            </div>
          )}
        </section>
      )}

      {activeObjective === "analyze" && (
        <section className={cn("space-y-3", fadeClass)} id="analisar">
          <div className="rounded-3xl border border-white/12 bg-gradient-to-r from-[#0b1226]/80 via-[#101b39]/75 to-[#050811]/90 px-4 py-4 sm:px-6 sm:py-5 backdrop-blur-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-white/70 shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
                  Dashboard · Analisar
                </div>
                <h2 className="text-2xl sm:text-3xl font-semibold text-white drop-shadow-[0_12px_45px_rgba(0,0,0,0.6)]">
                  Finanças &amp; faturação
                </h2>
                <p className="text-sm text-white/70">Receitas, payouts e documentos fiscais num só lugar.</p>
              </div>
            </div>
            <div className="mt-4">
              <ObjectiveSubnav
                objective="analyze"
                activeId={activeSection}
                category={orgCategory}
                modules={organization?.modules ?? []}
                mode="dashboard"
                variant="tabs"
              />
            </div>
          </div>
        </section>
      )}

      {activeObjective === "analyze" && activeSection === "overview" && (
        <section className={cn("space-y-4", fadeClass)} id="overview">

          <div className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
            {overviewLoading
              ? [...Array(4)].map((_, idx) => (
                  <div
                    key={idx}
                    className="rounded-3xl border border-white/12 bg-white/5 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.55)] animate-pulse space-y-2"
                  >
                    <div className="h-3 w-24 rounded bg-white/15" />
                    <div className="h-6 w-20 rounded bg-white/20" />
                    <div className="h-3 w-32 rounded bg-white/10" />
                  </div>
                ))
              : statsCards.map((card, idx) => (
                  <div
                    key={card.label}
                    className={cn(
                      "relative overflow-hidden rounded-3xl border border-white/12 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.55)] transition hover:-translate-y-0.5 hover:border-white/25 hover:shadow-[0_30px_90px_rgba(0,0,0,0.65)]",
                      "bg-gradient-to-br",
                      statGradients[idx % statGradients.length],
                    )}
                  >
                    <p className="text-white/70 text-xs">{card.label}</p>
                    <p className="text-2xl font-bold text-white mt-1 drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)]">{card.value}</p>
                    <p className="text-[11px] text-white/60">{card.hint}</p>
                    {idx === 0 && nextEvent && (
                      <Link
                        href={`/eventos/${nextEvent.slug}`}
                        className="relative mt-2 inline-flex text-[11px] text-[#6BFFFF] hover:underline"
                      >
                        Ver evento →
                      </Link>
                    )}
                  </div>
                ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-[#0b1226]/80 via-[#101c38]/75 to-[#050810]/95 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.55)]">
              <p className="text-[11px] uppercase tracking-[0.26em] text-white/60">Faturação</p>
              <h3 className="text-lg font-semibold text-white">Recibos e documentos</h3>
              <p className="text-[12px] text-white/65">Consulta invoices emitidas e dados fiscais.</p>
              <Link
                href="/organizacao?tab=analyze&section=invoices"
                className={cn(CTA_SECONDARY, "mt-3 text-[12px]")}
              >
                Abrir faturação
              </Link>
            </div>
            <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-[#0a1120]/85 via-[#0b1428]/80 to-[#05080f]/95 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.55)]">
              <p className="text-[11px] uppercase tracking-[0.26em] text-white/60">Payouts</p>
              <h3 className="text-lg font-semibold text-white">Detalhe de receitas</h3>
              <p className="text-[12px] text-white/65">Vê o detalhe de reservas e releases.</p>
              <Link
                href="/organizacao?tab=analyze&section=financas"
                className={cn(CTA_SECONDARY, "mt-3 text-[12px]")}
              >
                Ver detalhe
              </Link>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0a1226]/75 to-[#050a13]/90 p-4 space-y-3">
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Vendas ao longo do tempo</h3>
                <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] text-white/70">Últimos 30 dias</span>
              </div>
              <div className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/70">
                Receita · 30 dias
              </div>
            </div>
            <div className="relative h-48 rounded-2xl border border-white/10 bg-gradient-to-br from-white/6 via-[#0b1222]/60 to-white/0 shadow-inner overflow-hidden px-2 py-3">
              {!timeSeries && (
                <div className="flex w-full items-center gap-3 px-4">
                  <div className="h-28 flex-1 rounded-xl bg-white/10 animate-pulse" />
                  <div className="hidden h-28 w-20 rounded-xl bg-white/10 animate-pulse md:block" />
                </div>
              )}
              {timeSeries && overviewChartPoints.length > 0 && (
                <SalesAreaChart data={overviewChartPoints} periodLabel="Últimos 30 dias" height={190} />
              )}
              {timeSeries && overviewChartPoints.length === 0 && (
                <span className="text-white/40 text-xs">Sem dados suficientes.</span>
              )}
            </div>
            {overviewSeriesBreakdown && (
              <div className="relative flex flex-wrap gap-3 text-[11px] text-white/75">
                <span>Bruto: {formatEuros(overviewSeriesBreakdown.gross)}</span>
                <span>Desconto: -{formatEuros(overviewSeriesBreakdown.discount)}</span>
                <span>Taxas: -{formatEuros(overviewSeriesBreakdown.fees)}</span>
                <span>Líquido: {formatEuros(overviewSeriesBreakdown.net)}</span>
              </div>
            )}
          </div>
        </section>
      )}

      {activeObjective === "analyze" && activeSection === "vendas" && (
        <section className={cn("space-y-4", fadeClass)} id="vendas">
          <div className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/75 to-[#050810]/92 p-5 backdrop-blur-3xl space-y-4">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_35%),linear-gradient(225deg,rgba(255,255,255,0.08),transparent_40%)]" />
            <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/70">Bilhetes &amp; Vendas</p>
                <h2 className="text-2xl font-semibold text-white">Vendas por evento</h2>
                <p className="text-sm text-white/70">Escolhe um evento e vê evolução + compradores.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-white/70">Período</span>
                <div className="inline-flex rounded-full border border-white/15 bg-white/5 p-[3px] text-[11px] shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                  {(["7d", "30d", "90d", "365d", "all"] as SalesRange[]).map((range) => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setSalesRange(range)}
                      className={cn(
                        "rounded-full px-3 py-1 transition",
                        salesRange === range
                          ? cn(CTA_PRIMARY, "px-3 py-1 text-[11px]")
                          : "text-white/75 hover:bg-white/5",
                      )}
                    >
                      {range === "7d"
                        ? "7 dias"
                        : range === "30d"
                          ? "30 dias"
                          : range === "90d"
                            ? "3 meses"
                            : range === "365d"
                              ? "1 ano"
                              : "Sempre"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="relative flex flex-wrap items-center gap-3">
              <div className="w-full max-w-md">
                <label className="text-xs uppercase tracking-[0.18em] text-white/65 block mb-1">Seleciona o evento</label>
                <select
                  value={salesEventId ?? ""}
                  onChange={(e) => setSalesEventId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF] focus:ring-2 focus:ring-[rgba(107,255,255,0.35)]"
                >
                  <option value="">Escolhe</option>
                  {eventsList.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title}
                    </option>
                  ))}
                </select>
              </div>
              {!eventsList.length && <span className="text-[12px] text-white/65">Sem eventos para analisar.</span>}
              {selectedSalesEvent && (
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] text-white/75 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                  A ver: {selectedSalesEvent.title}
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {!salesEventId && (
              <div className="col-span-full rounded-2xl border border-dashed border-white/20 bg-black/30 p-4 text-white/70 text-sm">
                Seleciona um evento para ver as métricas de vendas.
              </div>
            )}
            {salesLoading && (
              <>
                {[...Array(4)].map((_, idx) => (
                  <div key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-3 animate-pulse space-y-2">
                    <div className="h-3 w-24 rounded bg-white/15" />
                    <div className="h-7 w-20 rounded bg-white/20" />
                    <div className="h-3 w-28 rounded bg-white/10" />
                  </div>
                ))}
              </>
            )}
            {!salesLoading && salesSeries && salesSeries.points?.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-white/20 bg-black/30 p-4 text-white/70 text-sm">
                Sem dados de vendas neste período. Escolhe outro evento ou intervalo.
              </div>
            )}
            {!salesLoading && salesSeries && salesSeries.points?.length !== 0 && (
              <>
                <div className="rounded-2xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/70 to-[#050912]/90 p-3 shadow-[0_14px_45px_rgba(0,0,0,0.5)]">
                  <p className="text-[11px] text-white/60">Receita no período</p>
                  <p className="text-2xl font-bold text-white mt-1">{(salesKpis.revenueCents / 100).toFixed(2)} €</p>
                  <p className="text-[11px] text-white/50">{salesRangeLabelLong(salesRange)}</p>
                </div>
                <div className="rounded-2xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/70 to-[#050912]/90 p-3 shadow-[0_14px_45px_rgba(0,0,0,0.5)]">
                  <p className="text-[11px] text-white/60">Bilhetes vendidos</p>
                  <p className="text-2xl font-bold text-white mt-1">{salesKpis.tickets}</p>
                  <p className="text-[11px] text-white/50">No período selecionado</p>
                </div>
                <div className="rounded-2xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/70 to-[#050912]/90 p-3 shadow-[0_14px_45px_rgba(0,0,0,0.5)]">
                  <p className="text-[11px] text-white/60">Eventos com vendas</p>
                  <p className="text-2xl font-bold text-white mt-1">{salesKpis.eventsWithSales}</p>
                  <p className="text-[11px] text-white/50">Eventos com pelo menos 1 venda</p>
                </div>
                <div className="rounded-2xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/70 to-[#050912]/90 p-3 shadow-[0_14px_45px_rgba(0,0,0,0.5)]">
                  <p className="text-[11px] text-white/60">Ocupação média</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {salesKpis.avgOccupancy !== null ? `${salesKpis.avgOccupancy}%` : "—"}
                  </p>
                  <p className="text-[11px] text-white/50">Calculado nos eventos com capacidade</p>
                </div>
              </>
            )}
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0a1226]/75 to-[#050912]/90 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Evolução</h3>
              {selectedSalesEvent && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-white/60">{selectedSalesEvent.title}</span>
                  <button
                    type="button"
                    disabled={!salesSeries?.points?.length}
                    onClick={handleExportSalesCsv}
                    className={cn(CTA_SECONDARY, "px-3 py-1 text-[11px] disabled:opacity-50")}
                  >
                    Exportar vendas
                  </button>
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0b1224]/60 to-white/0 shadow-inner overflow-hidden px-2 py-3 min-h-[260px]">
              {salesLoading ? (
                <div className="flex w-full items-center gap-3 px-4">
                  <div className="h-28 flex-1 rounded-xl bg-white/10 animate-pulse" />
                  <div className="hidden h-28 w-20 rounded-xl bg-white/10 animate-pulse md:block" />
                </div>
                ) : !salesEventId ? (
                  <span className="text-white/40 text-xs">Escolhe um evento para ver a evolução.</span>
                ) : salesSeries?.points?.length ? (
                  <SalesAreaChart
                    data={salesChartPoints}
                    periodLabel={salesRangeLabelLong(salesRange)}
                  />
              ) : (
                <span className="text-white/40 text-xs">Sem dados de vendas para este evento.</span>
              )}
            </div>
            {salesSeriesBreakdown && (
              <div className="flex flex-wrap gap-3 text-[11px] text-white/70">
                <span>Bruto: {formatEuros(salesSeriesBreakdown.gross)}</span>
                <span>Desconto: -{formatEuros(salesSeriesBreakdown.discount)}</span>
                <span>Taxas: -{formatEuros(salesSeriesBreakdown.fees)}</span>
                <span>Líquido: {formatEuros(salesSeriesBreakdown.net)}</span>
              </div>
            )}
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0a1226]/75 to-[#050912]/90 p-4 space-y-3">
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
                              <Link
                                href={`/organizacao?tab=analyze&section=vendas&eventId=${ev.id}`}
                                className={cn(CTA_SECONDARY, "px-3 py-1 text-[11px]")}
                              >
                                Dashboard de vendas
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

          <div className="rounded-3xl border border-white/10 bg-black/40 p-4 space-y-3">
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
                        formatDateTime(new Date(r.purchasedAt)),
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

            {buyersLoading && (
              <div className="space-y-2">
                {[...Array(4)].map((_, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-black/25 p-3 animate-pulse"
                  >
                    <div className="space-y-2">
                      <div className="h-3 w-32 rounded bg-white/10" />
                      <div className="h-3 w-20 rounded bg-white/5" />
                    </div>
                    <div className="h-3 w-16 rounded bg-white/10" />
                  </div>
                ))}
              </div>
            )}
            {!buyersLoading && !salesEventId && (
              <p className="text-sm text-white/60">Escolhe um evento para ver compradores.</p>
            )}
            {!buyersLoading && salesEventId && buyers && buyers.ok === false && (
              <p className="text-sm text-red-400">Não foi possível carregar os compradores.</p>
            )}
            {!buyersLoading && salesEventId && buyers && buyers.ok !== false && buyersItems.length === 0 && (
              <p className="text-sm text-white/60">Sem compras registadas para este evento.</p>
            )}
            {!buyersLoading && salesEventId && buyers && buyers.ok !== false && buyersItems.length > 0 && (
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
                          {formatDateTime(new Date(row.purchasedAt))}
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

      {activeObjective === "analyze" && activeSection === "financas" && (
        <section className={cn("space-y-5", fadeClass)} id="financas">
          <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/10 via-[#0d1530]/75 to-[#050912]/90 px-5 py-4 backdrop-blur-3xl">
            <div className="flex flex-col gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
                Finanças & Payouts
              </div>
              <h2 className="text-3xl font-semibold text-white drop-shadow-[0_12px_40px_rgba(0,0,0,0.55)]">Receita, liquidez e Stripe.</h2>
              <p className="text-sm text-white/70">Glassmorphism premium para veres o dinheiro, taxas e o estado da conta Stripe.</p>
            </div>
          </div>

          {paymentsMode === "CONNECT" && paymentsStatus !== "READY" && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm shadow-[0_18px_60px_rgba(0,0,0,0.55)] ${
                stripeIncomplete
                  ? "border-amber-400/50 bg-gradient-to-r from-amber-400/15 via-amber-500/10 to-orange-500/15 text-amber-50"
                  : "border-amber-400/35 bg-gradient-to-r from-amber-400/12 via-amber-500/10 to-orange-500/12 text-amber-50"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  <p className="font-semibold">
                    {stripeIncomplete ? "Onboarding incompleto no Stripe." : "Liga o Stripe para começar a receber."}
                  </p>
                  <p className="text-[12px] text-amber-100/85">
                    {paymentsStatus === "NO_STRIPE"
                      ? "Sem ligação Stripe não há payouts. O resto da gestão continua disponível."
                      : stripeRequirements.length > 0
                        ? `Faltam ${stripeRequirements.length} passos no Stripe Connect. Abre o painel para concluir.`
                        : "Conclui o onboarding no Stripe para ativares payouts."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleStripeConnect}
                  disabled={stripeCtaLoading}
                  className="rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-black shadow hover:scale-[1.01] disabled:opacity-60"
                >
                  {stripeCtaLoading ? "A ligar..." : stripeIncomplete ? "Continuar configuração" : "Ligar conta Stripe"}
                </button>
              </div>
            </div>
          )}
          {paymentsMode === "PLATFORM" && (
            <div className="rounded-2xl border border-emerald-400/45 bg-gradient-to-r from-emerald-500/20 via-emerald-500/15 to-teal-500/20 px-4 py-3 text-sm text-emerald-50 shadow-[0_18px_60px_rgba(0,0,0,0.55)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  <p className="font-semibold">Conta interna ORYA</p>
                  <p className="text-[12px] text-emerald-50/85">
                    Pagamentos processados na conta principal da ORYA. Não precisas de ligar Stripe Connect.
                  </p>
                </div>
              </div>
            </div>
          )}
          {stripeSuccessMessage && (
            <div className="rounded-2xl border border-emerald-400/45 bg-gradient-to-r from-emerald-500/20 via-emerald-500/15 to-teal-500/20 px-4 py-3 text-sm text-emerald-50 shadow-[0_18px_60px_rgba(0,0,0,0.55)]">
              {stripeSuccessMessage}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Receita líquida total",
                value:
                  financeData?.totals.netCents !== undefined
                    ? `${(financeData.totals.netCents / 100).toFixed(2)} €`
                    : financeSummary
                      ? `${(financeSummary.estimatedPayoutCents / 100).toFixed(2)} €`
                      : "—",
                hint: "Valor que fica para ti (bruto - taxas).",
              },
              {
                label: "Receita últimos 30d",
                value:
                  financeData?.rolling.last30.netCents !== undefined
                    ? `${(financeData.rolling.last30.netCents / 100).toFixed(2)} €`
                    : "—",
                hint: "Líquido nos últimos 30 dias.",
              },
              {
                label: "Taxas",
                value:
                  financeData?.totals.feesCents !== undefined
                    ? `${(financeData.totals.feesCents / 100).toFixed(2)} €`
                    : financeSummary
                      ? `${(financeSummary.platformFeesCents / 100).toFixed(2)} €`
                      : "—",
                hint: "Custos de processamento + eventuais fees.",
              },
              {
                label: "Eventos com vendas",
                value: financeData?.totals.eventsWithSales ?? financeSummary?.eventsWithSales ?? "—",
                hint: "Eventos pagos com pelo menos 1 bilhete.",
              },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-white/12 bg-gradient-to-br from-white/10 via-[#0b1124]/65 to-[#050810]/90 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
              >
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/70">{card.label}</p>
                <p className="mt-1 text-2xl font-bold text-white drop-shadow-[0_10px_25px_rgba(0,0,0,0.45)]">{card.value}</p>
                <p className="text-[11px] text-white/60">{card.hint}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/10 via-[#0b1124]/70 to-[#050810]/90 backdrop-blur-3xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-white">Stripe</h3>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] shadow-[0_10px_30px_rgba(0,0,0,0.35)] ${
                      stripeState.tone === "success"
                        ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
                        : stripeState.tone === "warning"
                          ? "border-amber-400/60 bg-amber-500/15 text-amber-100"
                          : stripeState.tone === "error"
                            ? "border-red-400/60 bg-red-500/15 text-red-100"
                            : "border-white/25 bg-white/10 text-white/70"
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
                      className={cn(CTA_SECONDARY, "px-3 py-1 text-[11px]")}
                    >
                      {stripeState.cta}
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStripeConnect}
                      disabled={stripeCtaLoading}
                      className={cn(CTA_SECONDARY, "px-3 py-1 text-[11px] disabled:opacity-60")}
                    >
                      {stripeState.cta}
                    </button>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-white/12 bg-black/35 p-3 text-sm space-y-1">
                <p className="text-white/70">Conta: {organization.stripeAccountId ? `…${organization.stripeAccountId.slice(-6)}` : "Por ligar"}</p>
                <p className="text-white/70">Cobranças: {organization.stripeChargesEnabled ? "Ativo" : "Inativo"}</p>
                <p className="text-white/70">Payouts: {organization.stripePayoutsEnabled ? "Ativo" : "Inativo"}</p>
              </div>
              <div className="text-[11px] text-white/75 space-y-2">
                <p>{stripeState.desc}</p>
                {stripeRequirements.length > 0 && (
                  <p className="text-white/70">
                    {stripeRequirements.length} itens pendentes no Stripe. Conclui-os no painel Connect para ativares payouts.
                  </p>
                )}
              </div>
              {stripeCtaError && <div className="text-xs text-red-300">{stripeCtaError}</div>}
            </div>

            <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/10 via-[#0b1124]/70 to-[#050810]/90 backdrop-blur-3xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Payouts</h3>
                <span className="text-[11px] text-white/70">Informativo</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 text-sm">
                <div className="rounded-2xl border border-white/12 bg-white/8 p-3">
                  <p className="text-white/70 text-xs">Próximo payout (estimado)</p>
                  <p className="text-xl font-semibold text-white">
                    {financeData ? (financeData.upcomingPayoutCents / 100).toFixed(2) : financeSummary ? (financeSummary.estimatedPayoutCents / 100).toFixed(2) : "—"} €
                  </p>
                  <p className="text-[11px] text-white/60">Baseado em vendas recentes. Funcionalidade de payouts automáticos em breve.</p>
                </div>
                <div className="rounded-2xl border border-white/12 bg-white/8 p-3">
                  <p className="text-white/70 text-xs">Receita bruta (total)</p>
                  <p className="text-xl font-semibold text-white">
                    {financeData ? (financeData.totals.grossCents / 100).toFixed(2) : financeSummary ? (financeSummary.revenueCents / 100).toFixed(2) : "—"} €
                  </p>
                  <p className="text-[11px] text-white/60">Inclui todos os eventos.</p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 text-sm">
                <div className="rounded-2xl border border-white/12 bg-white/8 p-3">
                  <p className="text-white/70 text-xs">Taxas acumuladas</p>
                  <p className="text-xl font-semibold text-white">
                    {financeData ? (financeData.totals.feesCents / 100).toFixed(2) : financeSummary ? (financeSummary.platformFeesCents / 100).toFixed(2) : "—"} €
                  </p>
                  <p className="text-[11px] text-white/60">Inclui processamento Stripe e fees aplicadas.</p>
                </div>
                <div className="rounded-2xl border border-white/12 bg-white/8 p-3">
                  <p className="text-white/70 text-xs">Eventos com vendas</p>
                  <p className="text-xl font-semibold text-white">
                    {financeData ? financeData.totals.eventsWithSales : financeSummary ? financeSummary.eventsWithSales : "—"}
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-white/65">
                Payouts automáticos e gestão avançada de taxas chegam em breve. Estes valores são informativos.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/92 backdrop-blur-3xl p-4 space-y-3">
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
                  className={cn(CTA_SECONDARY, "px-3 py-1 text-[11px] disabled:opacity-50")}
                >
                  Exportar CSV
                </button>
              </div>
            </div>

            {!financeData && <p className="text-sm text-white/60">A carregar finanças…</p>}
            {financeData && financeData.events.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-4 text-sm text-white/70">
                Sem vendas ainda. Assim que venderes bilhetes, verás aqui os totais por evento.
              </div>
            )}
            {stripeSuccessMessage && (
              <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-50">
                {stripeSuccessMessage}
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
                              {ev.startsAt ? formatDateOnly(new Date(ev.startsAt)) : "Data a definir"}
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

      {activeObjective === "analyze" && activeSection === "invoices" && (
        <section className={cn("space-y-4", fadeClass)} id="invoices">
          <InvoicesClient basePath="/organizacao?tab=analyze&section=invoices" fullWidth organizationId={organization?.id ?? null} />
        </section>
      )}

  {activeObjective === "promote" && (
    <section className="space-y-5">
      <div
        className={cn(
          "rounded-3xl border border-white/12 bg-gradient-to-r from-[#0b1226]/80 via-[#101b39]/75 to-[#050811]/90 px-4 py-4 sm:px-6 sm:py-5 backdrop-blur-2xl",
          fadeClass,
        )}
        id="marketing"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-white/70 shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
              Dashboard · Marketing
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold text-white drop-shadow-[0_12px_45px_rgba(0,0,0,0.6)]">
              Marketing
            </h2>
            <p className="text-sm text-white/70">Promoções, audiência e ações para encher o evento.</p>
          </div>
        </div>

        {marketingTabs.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/5 px-2 py-2 text-sm shadow-[0_16px_50px_rgba(0,0,0,0.4)]">
            {marketingTabs.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => handleMarketingSectionSelect(opt.key)}
                className={`rounded-xl px-3 py-2 font-semibold transition ${
                  marketingSection === opt.key
                    ? "bg-gradient-to-r from-[#FF7AD1]/60 via-[#7FE0FF]/35 to-[#6A7BFF]/55 text-white shadow-[0_14px_36px_rgba(107,255,255,0.45)]"
                    : "text-white/80 hover:bg-white/10"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {marketingSection === "overview" && (
          <div className={cn("mt-4 space-y-4", fadeClass)}>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {marketingOverview
                ? [
                    {
                      label: "Receita atribuída a marketing",
                      value: marketingKpis.marketingRevenueCents ? `${(marketingKpis.marketingRevenueCents / 100).toFixed(2)} €` : "—",
                      hint: "Receita estimada através de códigos.",
                    },
                    {
                      label: "Bilhetes via marketing",
                      value: marketingKpis.ticketsWithPromo,
                      hint: "Utilizações de códigos.",
                    },
                    {
                      label: "Top código",
                      value: marketingKpis.topPromo ? marketingKpis.topPromo.code : "—",
                      hint: marketingKpis.topPromo ? `${marketingKpis.topPromo.redemptionsCount ?? 0} utilizações` : "Sem dados.",
                    },
                    {
                      label: "Promo codes ativos",
                      value: marketingKpis.activePromos,
                      hint: "Disponíveis para vender agora.",
                    },
                  ].map((card, idx) => (
                    <div
                      key={card.label}
                      className={`rounded-2xl border border-white/10 p-3 shadow-[0_18px_55px_rgba(0,0,0,0.45)] ${
                        idx % 2 === 0
                          ? "bg-gradient-to-br from-[#0f1c3d]/70 via-[#0b1124]/65 to-[#050810]/85"
                          : "bg-gradient-to-br from-[#170b1f]/70 via-[#0e122a]/65 to-[#050810]/85"
                      }`}
                    >
                      <p className="text-[11px] text-white/60">{card.label}</p>
                      <p className="mt-1 text-2xl font-bold text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.35)]">{card.value}</p>
                      <p className="text-[11px] text-white/50">{card.hint}</p>
                    </div>
                  ))
                : [...Array(4)].map((_, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 via-[#0f1c3d]/50 to-[#050810]/85 p-3 space-y-2 animate-pulse"
                    >
                      <div className="h-3 w-24 rounded bg-white/15" />
                      <div className="h-6 w-20 rounded bg-white/20" />
                      <div className="h-3 w-32 rounded bg-white/10" />
                    </div>
                  ))}
            </div>

            <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0c162c]/65 to-[#050912]/90 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.45)]">Fill the Room</h3>
                  <p className="text-[12px] text-white/65">Próximos eventos com ocupação e ação sugerida.</p>
                </div>
                <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[12px] text-white/70">
                  Ações sugeridas
                </span>
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
                      className="flex flex-col gap-2 rounded-2xl border border-white/12 bg-gradient-to-r from-[#130c24]/70 via-[#0b162c]/65 to-[#050912]/85 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.45)] md:flex-row md:items-center md:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold">{ev.title}</p>
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] ${ev.tag.tone}`}>{ev.tag.label}</span>
                          <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[11px] text-white/75">
                            {ev.templateType === "PADEL" ? "Padel" : "Evento"}
                          </span>
                          {typeof ev.diffDays === "number" && (
                            <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-white/70">
                              Faltam {ev.diffDays} dia{ev.diffDays === 1 ? "" : "s"}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 text-[11px] text-white/70">
                          <span>
                            {ev.startsAt
                              ? formatDateTime(new Date(ev.startsAt), {
                                  day: "2-digit",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Data a definir"}
                          </span>
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
                              className="h-2 rounded-full bg-gradient-to-r from-[#FF7AD1] via-[#7FE0FF] to-[#6A7BFF]"
                              style={{ width: `${Math.min(100, Math.round((ev.occupancy ?? 0) * 100))}%` }}
                            />
                          </div>
                          <span>{ev.occupancy !== null ? `${Math.round((ev.occupancy ?? 0) * 100)}%` : "—"}</span>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2 text-[11px]">
                          <Link
                            href="/organizacao?tab=promote&section=marketing&marketing=promos"
                            className={cn(CTA_SECONDARY, "px-3 py-1 text-[11px]")}
                          >
                            {ev.tag.suggestion}
                          </Link>
                          <Link
                            href={`/organizacao/eventos/${ev.id}/edit`}
                            className={cn(CTA_SECONDARY, "px-3 py-1 text-[11px]")}
                          >
                            Editar evento
                          </Link>
                          <Link
                            href={`/eventos/${ev.slug}`}
                            className={cn(CTA_NEUTRAL, "px-3 py-1 text-[11px]")}
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

            <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#101b39]/60 to-[#050912]/90 p-4">
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
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5/80 bg-black/20 p-3 shadow-[0_14px_45px_rgba(0,0,0,0.4)]">
                    <p className="text-[11px] text-white/60">{item.label}</p>
                    <p className="text-xl font-bold text-white mt-1">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {marketingSection === "promos" && (
          <div className={cn("mt-4", fadeClass)}>
            <PromoCodesPage />
          </div>
        )}

        {marketingSection === "promoters" && (
          <div className={cn("mt-4 space-y-3", fadeClass)}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-white">Promotores &amp; Parcerias</h3>
                <p className="text-[12px] text-white/65">Quem te ajuda a vender (pessoas, grupos, parceiros).</p>
              </div>
              <button
                type="button"
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/70 cursor-not-allowed"
                disabled
              >
                Em breve
              </button>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/35 p-4 text-sm text-white/70 space-y-3">
              <p className="text-white/80 font-semibold">Em breve</p>
              <p className="text-[12px] text-white/65">Dashboard de vendas por promotor e links com comissão estimada.</p>
            </div>
          </div>
        )}

        {marketingSection === "content" && (
          <div className={cn("mt-4 space-y-3", fadeClass)}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-white">Conteúdo &amp; Kits</h3>
                <p className="text-[12px] text-white/65">Copiar e partilhar: textos rápidos por evento.</p>
              </div>
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/70">Em breve</span>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/35 p-4 text-sm text-white/70">
              Em breve: kits rápidos para Instagram, WhatsApp e email por evento, com botões de copiar.
            </div>
          </div>
        )}
      </div>
    </section>
  )}

      {eventDialog && (
        <ConfirmDestructiveActionDialog
          open
          title={
            eventDialog.mode === "delete"
              ? "Apagar rascunho?"
              : eventDialog.mode === "unarchive"
                ? "Reativar evento?"
                : "Arquivar evento?"
          }
          description={
            eventDialog.mode === "delete"
              ? "Esta ação remove o rascunho e bilhetes associados."
              : eventDialog.mode === "unarchive"
                ? "O evento volta a aparecer nas listas e dashboards."
                : "O evento deixa de estar visível para o público. Vendas e relatórios mantêm-se."
          }
          consequences={
            eventDialog.mode === "delete"
              ? ["Podes criar outro evento quando quiseres."]
              : eventDialog.mode === "unarchive"
                ? ["Podes sempre voltar a arquivar mais tarde."]
                : ["Sai de /explorar e das listas do dashboard.", "Mantém histórico para relatórios/finanças."]
          }
          confirmLabel={
            eventDialog.mode === "delete" ? "Apagar rascunho" : eventDialog.mode === "unarchive" ? "Reativar evento" : "Arquivar evento"
          }
          dangerLevel={eventDialog.mode === "delete" ? "high" : eventDialog.mode === "archive" ? "high" : "medium"}
          onConfirm={() => archiveEvent(eventDialog.ev, eventDialog.mode)}
          onClose={() => setEventDialog(null)}
        />
      )}
    </div>
  );
}

export default function DashboardClient({ hasOrganization = false }: { hasOrganization?: boolean }) {
  return (
    <AuthModalProvider>
      <OrganizacaoPageInner hasOrganization={hasOrganization} />
    </AuthModalProvider>
  );
}

type TimeSeriesPoint = {
  date: string;
  tickets: number;
  revenueCents: number; // líquido (net)
  netCents?: number; // alias
  grossCents?: number;
  discountCents?: number;
  platformFeeCents?: number;
  feesCents?: number; // alias para taxas
};
