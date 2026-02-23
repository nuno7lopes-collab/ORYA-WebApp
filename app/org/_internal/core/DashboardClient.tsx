"use client";

import { type ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import NextLink from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { ConfirmDestructiveActionDialog } from "@/app/components/ConfirmDestructiveActionDialog";
import {
  CORE_ORGANIZATION_MODULES,
  DEFAULT_PRIMARY_MODULE,
  resolvePrimaryModule,
} from "@/lib/organizationCategories";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { useUser } from "@/app/hooks/useUser";
import { AuthModalProvider } from "@/app/components/autenticação/AuthModalContext";
import {
  CTA_DANGER,
  CTA_NEUTRAL,
  CTA_PRIMARY,
  CTA_SECONDARY,
  CTA_SUCCESS,
} from "@/app/org/_shared/dashboardUi";
import { getEventCoverSuggestionIds, getEventCoverUrl } from "@/lib/eventCover";
import { getOrganizationRoleFlags } from "@/lib/organizationUiPermissions";
import { hasModuleAccess, normalizeAccessLevel, resolveMemberModuleAccess } from "@/lib/organizationRbac";
import { normalizeOfficialEmail } from "@/lib/organizationOfficialEmailUtils";
import { appendOrganizationIdToHref, getOrganizationIdFromBrowser, parseOrganizationIdFromPathname } from "@/lib/organizationIdUtils";
import {
  NON_HIDEABLE_DASHBOARD_TOOL_IDS,
  sanitizeDashboardHiddenToolIds,
} from "@/lib/organizationDashboardTools";
import type { OrganizationMemberRole, OrganizationModule, OrganizationRolePack } from "@prisma/client";
import { ModuleIcon } from "./moduleIcons";

const fetcher = (url: string) => fetch(url).then((res) => res.json());
const fetcherStrict = async (url: string) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error((json && typeof json.error === "string" && json.error) || `HTTP_${res.status}`);
    }
    return json;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("HTTP_TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};
const swrOptions = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: 60_000,
};
const orgContextSwrOptions = {
  ...swrOptions,
  errorRetryCount: 2,
  errorRetryInterval: 1_500,
  shouldRetryOnError: (error: unknown) => {
    const message = error instanceof Error ? error.message : "";
    if (message === "HTTP_TIMEOUT") return true;
    if (message.startsWith("HTTP_5")) return true;
    if (message === "Failed to fetch") return true;
    return false;
  },
};

const SkeletonBlock = ({ className = "" }: { className?: string }) => (
  <div className={cn("animate-pulse rounded-3xl border border-white/10 orya-skeleton-surface", className)} />
);

const SkeletonLine = ({ className = "" }: { className?: string }) => (
  <div className={cn("animate-pulse rounded-full border border-white/10 orya-skeleton-surface-strong", className)} />
);

const LoadingPanel = () => <SkeletonBlock className="h-40" />;

const PromoCodesPage = dynamic(() => import("./promo/PromoCodesClient"), { loading: LoadingPanel });
const MarketingContentKit = dynamic(() => import("./promo/MarketingContentKit"), { loading: LoadingPanel });
const SalesAreaChart = dynamic(
  () => import("@/app/components/charts/SalesAreaChart").then((mod) => mod.SalesAreaChart),
  { loading: () => <SkeletonBlock className="h-48" /> },
);
const InvoicesClient = dynamic(() => import("./pagamentos/invoices/invoices-client"), { loading: LoadingPanel });
const PayoutsPanel = dynamic(() => import("./pagamentos/PayoutsPanel"), { loading: LoadingPanel });
const RefundsPanel = dynamic(() => import("./pagamentos/RefundsPanel"), { loading: LoadingPanel });
const PadelHubSection = dynamic(() => import("./(dashboard)/padel/PadelHubSection"), { loading: LoadingPanel });
const ReservasDashboardPage = dynamic(() => import("./(dashboard)/reservas/page"), { loading: LoadingPanel });
const InscricoesPage = dynamic(() => import("./(dashboard)/inscricoes/page"), { loading: LoadingPanel });

type OverviewResponse = {
  ok: boolean;
  totalTickets: number;
  totalRevenueCents: number;
  grossCents?: number;
  discountCents?: number;
  platformFeeCents?: number;
  feesCents?: number;
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
  locationFormattedAddress: string | null;
  status: string;
  isGratis: boolean;
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
type EventsSummaryResponse = {
  ok: boolean;
  counts: { total: number; upcoming: number; ongoing: number; finished: number };
  nextEvent?: {
    id: number;
    slug: string;
    title: string;
    startsAt: string | null;
    endsAt?: string | null;
    status: string;
    templateType?: string | null;
  } | null;
};

type ServiceItem = {
  id: number;
  title: string;
  description: string | null;
  durationMinutes: number;
  unitPriceCents: number;
  currency: string;
  isActive: boolean;
  categoryTag?: string | null;
  locationMode?: string | null;
  _count?: { bookings: number; availabilities: number };
};

type BookingItem = {
  id: number;
  startsAt: string;
  durationMinutes: number;
  status: string;
  price: number;
  currency: string;
  createdAt: string;
  service: { id: number; title: string | null } | null;
  user: { id: string; fullName: string | null; username: string | null; avatarUrl: string | null } | null;
};

type ServicesResponse = { ok: boolean; items: ServiceItem[] };
type BookingsResponse = { ok: boolean; items: BookingItem[] };
type ReservasSummaryResponse =
  | {
      ok: true;
      services: { total: number; active: number; availabilityCount: number };
      bookings: { upcoming: number; confirmed: number; pending: number; revenueCents: number };
    }
  | { ok: false; error?: string };

type PayoutSummaryResponse =
  | {
      ok: true;
      ticketsSold: number;
      revenueCents: number;
      grossCents: number;
      platformFeesCents: number;
      eventsWithSales: number;
      estimatedPayoutCents: number;
      payoutAlerts: PayoutAlerts;
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
  promoterUserId?: string | null;
};

type PromoListResponse = {
  ok: boolean;
  promoCodes: PromoCodeRow[];
  events: { id: number; title: string; slug: string }[];
  promoStats?: {
    promoCodeId: number;
    tickets: number;
    grossCents: number;
    discountCents: number;
    netCents: number;
    usesTotal?: number;
  }[];
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
      payoutAlerts: PayoutAlerts;
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
type PayoutAlerts = {
  holdUntil: string | null;
  nextAttemptAt: string | null;
  actionRequired: boolean;
};
type OpsFeedItem = {
  id: string;
  eventType: string;
  createdAt: string;
  sourceType?: string | null;
  sourceId?: string | null;
  correlationId?: string | null;
};
type OpsFeedResponse = { ok: boolean; items?: OpsFeedItem[]; error?: string };
type FinanceInvoicingResponse =
  | {
      ok: true;
      settings: {
        invoicingMode: "EXTERNAL_SOFTWARE" | "MANUAL_OUTSIDE_ORYA";
        invoicingSoftwareName: string | null;
        invoicingNotes: string | null;
        invoicingAcknowledgedAt: string | null;
      } | null;
    }
  | { ok: false; error?: string };
type AnalyticsDimensionsResponse =
  | {
      ok: true;
      dimensionKey: string;
      bucketDate: string | null;
      items: Record<string, Record<string, number>>;
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
    locationFormattedAddress: string | null;
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
  payoutIban?: string | null;
  feeMode?: string | null;
  platformFeeBps?: number | null;
  platformFeeFixedCents?: number | null;
  officialEmail?: string | null;
  officialEmailVerifiedAt?: string | null;
  suspension?: {
    isSuspended: boolean;
    suspendedAt?: string | null;
    reactivationDeadlineAt?: string | null;
    reactivationWindowOpen?: boolean;
    remainingWindowDays?: number | null;
    suspensionTimestampUnknown?: boolean;
  } | null;
  stripeAccountId?: string | null;
  stripeChargesEnabled?: boolean | null;
  stripePayoutsEnabled?: boolean | null;
  alertsEmail?: string | null;
  alertsSalesEnabled?: boolean | null;
  alertsPayoutEnabled?: boolean | null;
  primaryModule?: string | null;
  organizationKind?: string | null;
  username?: string | null;
  modules?: string[] | null;
  publicDescription?: string | null;
  brandingAvatarUrl?: string | null;
  brandingCoverUrl?: string | null;
  publicWebsite?: string | null;
  publicInstagram?: string | null;
  publicYoutube?: string | null;
  publicTiktok?: string | null;
  publicLinkedin?: string | null;
  publicHours?: string | null;
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

type DashboardToolFlow = "Operações" | "Gestão" | "Administração";

type DashboardToolCard = {
  id: string;
  moduleKey: string;
  iconKey: string;
  title: string;
  summary: string;
  bullets: string[];
  href?: string;
  flow: DashboardToolFlow;
};

type DashboardToolVisibilityResponse = {
  ok: boolean;
  hiddenToolIds?: string[];
  canEdit?: boolean;
  error?: string;
};

const OPERATION_MODULES = ["EVENTOS", "RESERVAS", "TORNEIOS"] as const;
type OperationModule = (typeof OPERATION_MODULES)[number];

const OPERATION_LABELS: Record<OperationModule, string> = {
  EVENTOS: "Eventos",
  RESERVAS: "Reservas",
  TORNEIOS: "Padel",
};

const PADEL_CLUB_SECTION = "padel-club";
const PADEL_TOURNAMENTS_SECTION = "padel-tournaments";
const PADEL_MANAGE_SECTIONS = [PADEL_CLUB_SECTION, PADEL_TOURNAMENTS_SECTION] as const;
const TOOL_FLOW_ORDER: DashboardToolFlow[] = ["Operações", "Gestão", "Administração"];
const MODULE_ICON_GRADIENTS: Record<string, string> = {
  EVENTOS: "from-[#FF7AD1]/45 via-[#7FE0FF]/35 to-[#6A7BFF]/45",
  RESERVAS: "from-[#22D3EE]/40 via-[#6A7BFF]/30 to-[#0EA5E9]/40",
  TORNEIOS: "from-[#F59E0B]/35 via-[#FF7AD1]/35 to-[#6A7BFF]/35",
  CHECKIN: "from-[#22D3EE]/35 via-[#60A5FA]/30 to-[#A78BFA]/35",
  INSCRICOES: "from-[#34D399]/35 via-[#22D3EE]/30 to-[#7FE0FF]/35",
  MENSAGENS: "from-[#A78BFA]/35 via-[#7FE0FF]/30 to-[#34D399]/35",
  LOJA: "from-[#F97316]/35 via-[#FB7185]/30 to-[#F59E0B]/35",
  CRM: "from-[#22D3EE]/35 via-[#38BDF8]/30 to-[#F97316]/35",
  STAFF: "from-[#60A5FA]/35 via-[#7FE0FF]/30 to-[#F59E0B]/35",
  FINANCEIRO: "from-[#F97316]/35 via-[#F59E0B]/30 to-[#FF7AD1]/35",
  ANALYTICS: "from-[#22D3EE]/35 via-[#6A7BFF]/30 to-[#A78BFA]/35",
  MARKETING: "from-[#FF7AD1]/35 via-[#FB7185]/30 to-[#F59E0B]/35",
  DEFINICOES: "from-[#94A3B8]/35 via-[#64748B]/25 to-[#94A3B8]/35",
  TOOL_EVENTOS: "from-[#FF4ECD]/56 via-[#7FE0FF]/44 to-[#6A7BFF]/56",
  TOOL_RESERVAS: "from-[#22D3EE]/52 via-[#4DB4FF]/42 to-[#6A7BFF]/54",
  TOOL_CALENDARIO: "from-[#22D3EE]/50 via-[#60A5FA]/40 to-[#8B5CF6]/52",
  TOOL_PADEL_CLUBE: "from-[#F59E0B]/52 via-[#FB7185]/40 to-[#6A7BFF]/50",
  TOOL_PADEL_TORNEIOS: "from-[#22D3EE]/54 via-[#A78BFA]/40 to-[#F59E0B]/50",
  TOOL_CHECKIN: "from-[#22D3EE]/52 via-[#34D399]/42 to-[#60A5FA]/50",
  TOOL_FORMULARIOS: "from-[#14B8A6]/50 via-[#22D3EE]/40 to-[#A78BFA]/48",
  TOOL_CHAT_INTERNO: "from-[#A78BFA]/52 via-[#60A5FA]/40 to-[#34D399]/48",
  TOOL_FINANCAS: "from-[#F97316]/54 via-[#F59E0B]/42 to-[#FB7185]/50",
  TOOL_ANALYTICS: "from-[#22D3EE]/56 via-[#6A7BFF]/42 to-[#A78BFA]/54",
  TOOL_PROMOCOES: "from-[#FF7AD1]/54 via-[#FB7185]/40 to-[#F59E0B]/52",
  TOOL_CRM: "from-[#38BDF8]/52 via-[#22D3EE]/40 to-[#F97316]/50",
  TOOL_LOJA: "from-[#FB7185]/54 via-[#F59E0B]/40 to-[#FB923C]/52",
  TOOL_EQUIPA: "from-[#60A5FA]/52 via-[#22D3EE]/42 to-[#F59E0B]/48",
  TOOL_DEFINICOES: "from-[#94A3B8]/52 via-[#64748B]/38 to-[#60A5FA]/48",
  TOOL_POLITICAS: "from-[#60A5FA]/54 via-[#22D3EE]/42 to-[#A78BFA]/50",
};
const MODULE_ICON_SURFACE_GLOWS: Record<string, string> = {
  TOOL_EVENTOS: "shadow-[inset_0_1px_0_rgba(255,255,255,0.48),0_14px_28px_rgba(0,0,0,0.45),0_0_24px_rgba(255,78,205,0.35)]",
  TOOL_RESERVAS: "shadow-[inset_0_1px_0_rgba(255,255,255,0.48),0_14px_28px_rgba(0,0,0,0.45),0_0_24px_rgba(34,211,238,0.34)]",
  TOOL_CALENDARIO: "shadow-[inset_0_1px_0_rgba(255,255,255,0.48),0_14px_28px_rgba(0,0,0,0.45),0_0_24px_rgba(96,165,250,0.34)]",
  TOOL_PADEL_CLUBE: "shadow-[inset_0_1px_0_rgba(255,255,255,0.48),0_14px_28px_rgba(0,0,0,0.46),0_0_24px_rgba(245,158,11,0.34)]",
  TOOL_PADEL_TORNEIOS: "shadow-[inset_0_1px_0_rgba(255,255,255,0.48),0_14px_28px_rgba(0,0,0,0.46),0_0_24px_rgba(167,139,250,0.34)]",
  TOOL_CHECKIN: "shadow-[inset_0_1px_0_rgba(255,255,255,0.48),0_14px_28px_rgba(0,0,0,0.45),0_0_24px_rgba(52,211,153,0.34)]",
  TOOL_FORMULARIOS: "shadow-[inset_0_1px_0_rgba(255,255,255,0.48),0_14px_28px_rgba(0,0,0,0.45),0_0_24px_rgba(20,184,166,0.34)]",
  TOOL_CHAT_INTERNO: "shadow-[inset_0_1px_0_rgba(255,255,255,0.48),0_14px_28px_rgba(0,0,0,0.45),0_0_24px_rgba(167,139,250,0.34)]",
  TOOL_FINANCAS: "shadow-[inset_0_1px_0_rgba(255,255,255,0.48),0_14px_28px_rgba(0,0,0,0.46),0_0_24px_rgba(249,115,22,0.34)]",
  TOOL_ANALYTICS: "shadow-[inset_0_1px_0_rgba(255,255,255,0.48),0_14px_28px_rgba(0,0,0,0.45),0_0_24px_rgba(34,211,238,0.35)]",
  TOOL_PROMOCOES: "shadow-[inset_0_1px_0_rgba(255,255,255,0.48),0_14px_28px_rgba(0,0,0,0.46),0_0_24px_rgba(251,113,133,0.34)]",
  TOOL_CRM: "shadow-[inset_0_1px_0_rgba(255,255,255,0.48),0_14px_28px_rgba(0,0,0,0.45),0_0_24px_rgba(56,189,248,0.34)]",
  TOOL_LOJA: "shadow-[inset_0_1px_0_rgba(255,255,255,0.48),0_14px_28px_rgba(0,0,0,0.46),0_0_24px_rgba(251,146,60,0.34)]",
  TOOL_EQUIPA: "shadow-[inset_0_1px_0_rgba(255,255,255,0.48),0_14px_28px_rgba(0,0,0,0.45),0_0_24px_rgba(96,165,250,0.34)]",
  TOOL_DEFINICOES: "shadow-[inset_0_1px_0_rgba(255,255,255,0.48),0_14px_28px_rgba(0,0,0,0.45),0_0_24px_rgba(148,163,184,0.32)]",
  TOOL_POLITICAS: "shadow-[inset_0_1px_0_rgba(255,255,255,0.48),0_14px_28px_rgba(0,0,0,0.45),0_0_24px_rgba(96,165,250,0.34)]",
};
const MODULE_ICON_BG_STYLES: Record<string, string> = {
  TOOL_EVENTOS: "linear-gradient(145deg, rgba(255,78,205,0.85) 0%, rgba(127,224,255,0.72) 46%, rgba(106,123,255,0.86) 100%)",
  TOOL_RESERVAS: "linear-gradient(145deg, rgba(34,211,238,0.84) 0%, rgba(77,180,255,0.7) 46%, rgba(106,123,255,0.84) 100%)",
  TOOL_CALENDARIO: "linear-gradient(145deg, rgba(34,211,238,0.8) 0%, rgba(96,165,250,0.72) 46%, rgba(139,92,246,0.84) 100%)",
  TOOL_PADEL_CLUBE: "linear-gradient(145deg, rgba(245,158,11,0.84) 0%, rgba(251,113,133,0.7) 44%, rgba(106,123,255,0.82) 100%)",
  TOOL_PADEL_TORNEIOS: "linear-gradient(145deg, rgba(34,211,238,0.86) 0%, rgba(167,139,250,0.7) 44%, rgba(245,158,11,0.8) 100%)",
  TOOL_CHECKIN: "linear-gradient(145deg, rgba(34,211,238,0.82) 0%, rgba(52,211,153,0.72) 46%, rgba(96,165,250,0.82) 100%)",
  TOOL_FORMULARIOS: "linear-gradient(145deg, rgba(20,184,166,0.82) 0%, rgba(34,211,238,0.7) 46%, rgba(167,139,250,0.78) 100%)",
  TOOL_CHAT_INTERNO: "linear-gradient(145deg, rgba(167,139,250,0.82) 0%, rgba(96,165,250,0.7) 44%, rgba(52,211,153,0.78) 100%)",
  TOOL_FINANCAS: "linear-gradient(145deg, rgba(249,115,22,0.86) 0%, rgba(245,158,11,0.74) 44%, rgba(251,113,133,0.82) 100%)",
  TOOL_ANALYTICS: "linear-gradient(145deg, rgba(34,211,238,0.88) 0%, rgba(106,123,255,0.72) 44%, rgba(167,139,250,0.84) 100%)",
  TOOL_PROMOCOES: "linear-gradient(145deg, rgba(255,122,209,0.86) 0%, rgba(251,113,133,0.72) 44%, rgba(245,158,11,0.82) 100%)",
  TOOL_CRM: "linear-gradient(145deg, rgba(56,189,248,0.84) 0%, rgba(34,211,238,0.72) 46%, rgba(249,115,22,0.8) 100%)",
  TOOL_LOJA: "linear-gradient(145deg, rgba(251,113,133,0.86) 0%, rgba(245,158,11,0.72) 44%, rgba(251,146,60,0.82) 100%)",
  TOOL_EQUIPA: "linear-gradient(145deg, rgba(96,165,250,0.82) 0%, rgba(34,211,238,0.72) 46%, rgba(245,158,11,0.78) 100%)",
  TOOL_DEFINICOES: "linear-gradient(145deg, rgba(148,163,184,0.82) 0%, rgba(100,116,139,0.68) 46%, rgba(96,165,250,0.74) 100%)",
  TOOL_POLITICAS: "linear-gradient(145deg, rgba(96,165,250,0.86) 0%, rgba(34,211,238,0.72) 44%, rgba(167,139,250,0.8) 100%)",
};
const TOOL_CUSTOM_ICON_BY_ID: Record<string, string> = {
  eventos: "/icons/tools/eventos.png",
  reservas: "/icons/tools/reservas.png",
  calendar: "/icons/tools/calendario.png",
  "padel-club": "/icons/tools/padel-club.png",
  "padel-tournaments": "/icons/tools/padel-tournaments.png",
  checkin: "/icons/tools/checkin.png",
  inscricoes: "/icons/tools/formularios.png",
  mensagens: "/icons/tools/mensagens.png",
  financeiro: "/icons/tools/financas.png",
  analytics: "/icons/tools/analises.png",
  marketing: "/icons/tools/marketing.png",
  crm: "/icons/tools/crm.png",
  loja: "/icons/tools/loja.png",
  staff: "/icons/tools/equipa.png",
  politicas: "/icons/tools/politicas.png",
  settings: "/icons/tools/definicoes.png",
};

const OBJECTIVE_TABS: ObjectiveTab[] = ["create", "manage", "promote", "analyze"];
type SalesRange = "7d" | "30d" | "90d" | "365d" | "all";
type FinanceFocusView = "overview" | "payouts" | "refunds";

type EventStatusFilter = "all" | "active" | "draft" | "finished" | "ongoing" | "archived";

const DATE_LOCALE = "pt-PT";
const DATE_TIMEZONE = "Europe/Lisbon";

const formatDateTime = (date: Date | null, options?: Intl.DateTimeFormatOptions) =>
  date ? date.toLocaleString(DATE_LOCALE, { timeZone: DATE_TIMEZONE, ...options }) : "Data a definir";

const formatDateOnly = (date: Date | null, options?: Intl.DateTimeFormatOptions) =>
  date ? date.toLocaleDateString(DATE_LOCALE, { timeZone: DATE_TIMEZONE, ...options }) : "";

const areStringArraysEqual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const mapTabToObjective = (
  tab: string | null | undefined,
  fallbackObjective: ObjectiveTab = "create",
): ObjectiveTab => {
  if (tab && OBJECTIVE_TABS.includes(tab as ObjectiveTab)) {
    return tab as ObjectiveTab;
  }
  if (tab === "overview" && fallbackObjective === "create") {
    return "create";
  }
  return fallbackObjective;
};

function resolveFinanceFocusView(financeParamRaw: string | null | undefined): FinanceFocusView {
  if (!financeParamRaw) return "overview";
  if (financeParamRaw === "payouts") return "payouts";
  if (financeParamRaw === "refunds" || financeParamRaw === "refunds-disputes") return "refunds";
  return "overview";
}

type DashboardClientDefaults = {
  defaultObjective?: ObjectiveTab;
  defaultSection?: string;
};

function OrganizacaoPageInner({
  hasOrganization,
  defaultObjective,
  defaultSection,
}: { hasOrganization: boolean } & DashboardClientDefaults) {
  const { user, profile, isLoading: userLoading } = useUser();
  const [stripeCtaLoading, setStripeCtaLoading] = useState(false);
  const [stripeCtaError, setStripeCtaError] = useState<string | null>(null);
  const [ctaError, setCtaError] = useState<string | null>(null);
  const [ctaSuccess, setCtaSuccess] = useState<string | null>(null);
  const [suspensionActionLoading, setSuspensionActionLoading] = useState(false);
  const [suspensionActionMessage, setSuspensionActionMessage] = useState<string | null>(null);
  const [entityType, setEntityType] = useState<string>("");
  const [businessName, setBusinessName] = useState<string>("");
  const [payoutIban, setPayoutIban] = useState<string>("");
  const [eventStatusFilter, setEventStatusFilter] = useState<EventStatusFilter>("all");
  const [eventCategoryFilter, setEventCategoryFilter] = useState<string>("all");
  const [eventPartnerClubFilter, setEventPartnerClubFilter] = useState<string>("all");
  const [salesEventId, setSalesEventId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [timeScope, setTimeScope] = useState<"all" | "upcoming" | "ongoing" | "past">("all");
  const [eventView, setEventView] = useState<"list" | "grid">("grid");
  const [manageFiltersOpen, setManageFiltersOpen] = useState<"status" | "period" | "filters" | null>(null);
  const [eventActionLoading, setEventActionLoading] = useState<number | null>(null);
  const [eventDialog, setEventDialog] = useState<{ mode: "archive" | "delete" | "unarchive"; ev: EventItem } | null>(null);
  const [toolsModalOpen, setToolsModalOpen] = useState(false);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const [pendingToolVisibilityRemoval, setPendingToolVisibilityRemoval] = useState<DashboardToolCard | null>(null);
  const loadingRetryAttemptRef = useRef(false);
  const dashboardLoadStartedAtRef = useRef<number | null>(null);
  const dashboardLoadSuccessTrackedRef = useRef(false);
  const dashboardLoadTimeoutTrackedRef = useRef(false);
  const dashboardLoadErrorTrackedRef = useRef(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const manageFiltersRef = useRef<HTMLDivElement | null>(null);
  const [marketingSection, setMarketingSection] = useState<MarketingSectionKey>("overview");
  const marketingSectionSourceRef = useRef<"url" | "ui">("url");
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

  const tabParamRaw = searchParams?.get("tab") ?? defaultObjective ?? null;
  const sectionParamRaw = searchParams?.get("section") ?? null;
  const financeParamRaw = searchParams?.get("finance") ?? null;
  const marketingParamRaw = searchParams?.get("marketing");
  const activeObjective = mapTabToObjective(tabParamRaw, defaultObjective ?? "create");
  const financeFocus = resolveFinanceFocusView(financeParamRaw);
  const normalizedSectionParam = sectionParamRaw;
  const normalizedDefaultSection = defaultSection;
  const normalizedSection = normalizedSectionParam ?? normalizedDefaultSection ?? undefined;
  const scrollSection = normalizedSectionParam ?? undefined;
  const isPadelManageSection =
    sectionParamRaw === PADEL_CLUB_SECTION || sectionParamRaw === PADEL_TOURNAMENTS_SECTION;

  useEffect(() => {
    if (!pathname || pathname.startsWith("/org/padel") || pathname.startsWith("/org/")) return;
    if (activeObjective !== "manage") return;
    if (normalizedSection !== PADEL_CLUB_SECTION && normalizedSection !== PADEL_TOURNAMENTS_SECTION) return;
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("section", normalizedSection);
    if (!params.get("padel")) {
      params.set("padel", normalizedSection === PADEL_TOURNAMENTS_SECTION ? "tournaments" : "clubs");
    }
    params.delete("tab");
    const basePath = normalizedSection === PADEL_CLUB_SECTION ? "/org/padel/clubs" : "/org/padel/tournaments";
    router.replace(`${basePath}?${params.toString()}`);
  }, [activeObjective, normalizedSection, pathname, router, searchParams]);

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

  useEffect(() => {
    if (!manageFiltersOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (manageFiltersRef.current && !manageFiltersRef.current.contains(event.target as Node)) {
        setManageFiltersOpen(null);
      }
    };
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setManageFiltersOpen(null);
    };
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [manageFiltersOpen]);

  useEffect(() => {
    if (!toolsModalOpen || typeof window === "undefined") return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setToolsModalOpen(false);
    };
    window.addEventListener("keydown", handleKeydown);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [toolsModalOpen]);

  const organizationIdParam = searchParams?.get("organizationId");
  const organizationIdFromQuery = organizationIdParam ? Number(organizationIdParam) : null;
  const organizationIdFromPath = parseOrganizationIdFromPathname(pathname);
  const organizationIdFromBrowser = useMemo(
    () => getOrganizationIdFromBrowser(),
    [pathname, organizationIdParam],
  );
  const organizationId =
    organizationIdFromQuery && !Number.isNaN(organizationIdFromQuery)
      ? organizationIdFromQuery
      : organizationIdFromPath ?? organizationIdFromBrowser;
  const orgMeUrl = useMemo(() => {
    if (!organizationId || Number.isNaN(organizationId)) return null;
    return `/api/org/${organizationId}/me`;
  }, [organizationId]);
  const orgApiBase = useMemo(() => {
    if (!organizationId || Number.isNaN(organizationId)) return null;
    return `/api/org/${organizationId}`;
  }, [organizationId]);

  const {
    data: organizationData,
    error: organizationError,
    isLoading: organizationLoading,
    mutate: mutateOrganization,
  } = useSWR<
    OrganizationStatus & {
      profile?: { fullName?: string | null } | null;
      organization?: OrganizationLite | null;
      ok?: boolean;
      orgTransferEnabled?: boolean | null;
      platformOfficialEmail?: string | null;
      membershipRole?: string | null;
      membershipRolePack?: string | null;
      modulePermissions?: Array<{
        moduleKey: OrganizationModule;
        accessLevel: string;
        scopeType?: string | null;
        scopeId?: string | null;
      }>;
    }
  >(orgMeUrl, fetcherStrict, orgContextSwrOptions);

  const organization = organizationData?.organization ?? null;
  const scopedOrganizationId = organization?.id ?? organizationId ?? null;
  const Link = ({ href, ...props }: ComponentProps<typeof NextLink>) => {
    const resolvedHref = typeof href === "string" ? appendOrganizationIdToHref(href, scopedOrganizationId) : href;
    return <NextLink href={resolvedHref} {...props} />;
  };
  const isSuspended = organization?.status === "SUSPENDED";
  const isActive = organization?.status === "ACTIVE";
  const isPending = Boolean(organization?.status && !isActive && !isSuspended);
  const suspension = organization?.suspension ?? null;
  const reactivationDeadlineDate = suspension?.reactivationDeadlineAt ? new Date(suspension.reactivationDeadlineAt) : null;
  const reactivationWindowOpen = suspension?.reactivationWindowOpen === true;
  const remainingReactivationDays =
    typeof suspension?.remainingWindowDays === "number" ? suspension.remainingWindowDays : null;
  const platformSupportEmail = organizationData?.platformOfficialEmail ?? null;
  const primaryModule = organization?.primaryModule ?? null;
  const rawModules = useMemo(() => {
    if (!Array.isArray(organization?.modules)) return [];
    return organization.modules
      .filter((module): module is string => typeof module === "string")
      .map((module) => module.trim().toUpperCase())
      .filter((module) => module.length > 0);
  }, [organization?.modules]);
  const primaryOperation = useMemo<OperationModule>(
    () => resolvePrimaryModule(primaryModule, rawModules) as OperationModule,
    [primaryModule, rawModules],
  );
  const hasReservasModule = useMemo(() => rawModules.includes("RESERVAS"), [rawModules]);
  const activeModules = useMemo(() => {
    const base = new Set<string>([
      ...rawModules,
      ...CORE_ORGANIZATION_MODULES,
      ...OPERATION_MODULES,
    ]);
    base.add(primaryOperation);
    return Array.from(base);
  }, [rawModules, primaryOperation]);
  const operationLabel = OPERATION_LABELS[primaryOperation];
  const orgDisplayName =
    organization?.publicName?.trim() ||
    organization?.businessName?.trim() ||
    "Organização";
  const isReservasOrg = primaryOperation === "RESERVAS";
  const isTorneiosOrg = primaryOperation === "TORNEIOS";
  const hasTorneiosModule = activeModules.includes("TORNEIOS");
  const isOrgCanonicalPath = pathname?.startsWith("/org/");
  const isTorneiosRoute =
    pathname?.startsWith("/org/padel") ||
    Boolean(isOrgCanonicalPath && pathname?.includes("/padel"));
  const isEventosRoute =
    pathname?.startsWith("/org/events") ||
    Boolean(isOrgCanonicalPath && (pathname?.includes("/eventos") || pathname?.includes("/events")));
  const isManageEventosSection = activeObjective === "manage" && normalizedSection === "eventos";
  const isManagePadelSection =
    activeObjective === "manage" &&
    (normalizedSection === PADEL_CLUB_SECTION || normalizedSection === PADEL_TOURNAMENTS_SECTION);
  const isPadelContext =
    hasTorneiosModule &&
    !isManageEventosSection &&
    (isManagePadelSection ||
      isTorneiosRoute ||
      isPadelManageSection ||
      (activeObjective !== "manage" && !isEventosRoute && isTorneiosOrg));
  const eventsScope = useMemo<"PADEL" | "EVENTOS">(() => {
    if (activeObjective === "manage") {
      if (normalizedSection === "eventos") return "EVENTOS";
      if (normalizedSection === PADEL_CLUB_SECTION || normalizedSection === PADEL_TOURNAMENTS_SECTION) return "PADEL";
    }
    if (isTorneiosRoute || isPadelManageSection) return "PADEL";
    if (isEventosRoute) return "EVENTOS";
    return isTorneiosOrg ? "PADEL" : "EVENTOS";
  }, [activeObjective, isEventosRoute, isPadelManageSection, isTorneiosOrg, isTorneiosRoute, normalizedSection]);
  const eventsScopeQuery = eventsScope === "PADEL" ? "templateType=PADEL" : "excludeTemplateType=PADEL";
  const eventsScopeSuffix = `?${eventsScopeQuery}`;
  const eventsScopeAmp = `&${eventsScopeQuery}`;
  const showPadelHub = hasTorneiosModule;
  const hasInscricoesModule = activeModules.includes("INSCRICOES");
  const hasMarketingModule = activeModules.includes("MARKETING");
  const primaryCreateMeta =
    primaryOperation === "RESERVAS"
      ? { label: "Criar serviço", href: "/org/bookings/new", singular: "serviço", plural: "serviços" }
      : primaryOperation === "TORNEIOS"
        ? {
            label: "Criar torneio",
            href: "/org/padel/tournaments/create",
            singular: "torneio",
            plural: "torneios",
          }
        : { label: "Criar evento", href: "/org/events/new", singular: "evento", plural: "eventos" };
  const manageCreateMeta = isEventosRoute
    ? { label: "Criar evento", href: "/org/events/new", singular: "evento", plural: "eventos" }
    : isPadelContext
      ? {
          label: "Criar torneio",
          href: "/org/padel/tournaments/create",
          singular: "torneio",
          plural: "torneios",
        }
      : primaryCreateMeta;
  const managePrimaryLabel = isPadelContext ? "Padel" : "Eventos";
  const managePrimaryLabelLower = isPadelContext ? "torneio" : "evento";
  const managePrimaryLabelTitle = isPadelContext ? "Torneio" : "Evento";
  const managePrimarySingularLabel = manageCreateMeta.singular;
  const salesUnitLabel = isPadelContext ? "Inscrições" : "Bilhetes";
  const salesCountLabel = isPadelContext ? "Inscrições registadas" : "Bilhetes vendidos";
  const eventRouteBase = isPadelContext ? "/org/padel/tournaments" : "/org/events";
  const loading =
    organizationLoading ||
    (Boolean(orgMeUrl) && !organizationData && !organizationError) ||
    (userLoading && !user && !organizationData && !organizationError);
  const paymentsStatus = organizationData?.paymentsStatus ?? "NO_STRIPE";
  const paymentsMode = organizationData?.paymentsMode ?? "CONNECT";
  const profileStatus = organizationData?.profileStatus ?? "MISSING_CONTACT";
  const membershipRole = organizationData?.membershipRole ?? null;
  const membershipRolePack = organizationData?.membershipRolePack ?? null;
  const canReactivateSuspendedOrganization = membershipRole === "OWNER" && isSuspended && reactivationWindowOpen;
  const moduleOverrides = useMemo(
    () =>
      Array.isArray(organizationData?.modulePermissions)
        ? organizationData?.modulePermissions.map((item) => ({
            moduleKey: item.moduleKey,
            accessLevel: normalizeAccessLevel(item.accessLevel) ?? "NONE",
            scopeType: item.scopeType ?? null,
            scopeId: item.scopeId ?? null,
          }))
        : [],
    [organizationData?.modulePermissions],
  );
  const moduleAccess = useMemo(
    () =>
      resolveMemberModuleAccess({
        role: membershipRole as OrganizationMemberRole | null,
        rolePack: membershipRolePack as OrganizationRolePack | null,
        overrides: moduleOverrides,
      }),
    [membershipRole, membershipRolePack, moduleOverrides],
  );
  const canAccessModule = useCallback(
    (moduleKey: OrganizationModule) => hasModuleAccess(moduleAccess, moduleKey, "EDIT"),
    [moduleAccess],
  );
  const canAccessFinance = canAccessModule("FINANCEIRO");
  const canAccessEvents = canAccessModule("EVENTOS");
  const canAccessReservas = canAccessModule("RESERVAS");
  const canAccessTorneios = canAccessModule("TORNEIOS");
  const canAccessInscricoes = canAccessModule("INSCRICOES");
  const canAccessMensagens = canAccessModule("MENSAGENS");
  const canAccessLoja = canAccessModule("LOJA");
  const canAccessMarketing = canAccessModule("MARKETING");
  const canAccessCrm = canAccessModule("CRM");
  const canAccessStaff = canAccessModule("STAFF");
  const canAccessSettings = canAccessModule("DEFINICOES");
  const canAccessAnalytics = canAccessModule("ANALYTICS");
  const roleFlags = useMemo(
    () => getOrganizationRoleFlags(membershipRole, membershipRolePack),
    [membershipRole, membershipRolePack],
  );
  const canViewFinance = roleFlags.canViewFinance && canAccessFinance;
  const canViewAnalytics = canAccessAnalytics;
  const canUseAnalytics = canViewAnalytics;
  const canPromote = roleFlags.canPromote && canAccessMarketing;
  const canManageMembers = roleFlags.canManageMembers && canAccessStaff;
  const canEditOrgSettings = roleFlags.canEditOrg && canAccessSettings;
  const canUseMarketing = canPromote && hasMarketingModule;
  useEffect(() => {
    if (!orgMeUrl) return;
    loadingRetryAttemptRef.current = false;
    dashboardLoadStartedAtRef.current = Date.now();
    dashboardLoadSuccessTrackedRef.current = false;
    dashboardLoadTimeoutTrackedRef.current = false;
    dashboardLoadErrorTrackedRef.current = false;
    trackEvent("org_dashboard_load_started", {
      organizationId: organizationId ?? null,
      pathname: pathname ?? null,
    });
  }, [orgMeUrl, organizationId, pathname]);
  useEffect(() => {
    if (!loading) {
      setLoadingTimedOut(false);
      loadingRetryAttemptRef.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      if (!loadingRetryAttemptRef.current) {
        loadingRetryAttemptRef.current = true;
        trackEvent("org_dashboard_load_retry", {
          organizationId: organization?.id ?? organizationId ?? null,
          reason: "soft_timeout",
        });
        mutateOrganization();
        return;
      }
      setLoadingTimedOut(true);
    }, 12_000);
    return () => clearTimeout(timeout);
  }, [loading, mutateOrganization, organization?.id, organizationId]);
  useEffect(() => {
    if (loading || !organizationData || dashboardLoadSuccessTrackedRef.current) return;
    dashboardLoadSuccessTrackedRef.current = true;
    const durationMs =
      dashboardLoadStartedAtRef.current !== null
        ? Math.max(0, Date.now() - dashboardLoadStartedAtRef.current)
        : null;
    trackEvent("org_dashboard_load_success", {
      organizationId: organization?.id ?? organizationId ?? null,
      durationMs,
    });
  }, [loading, organizationData, organization?.id, organizationId]);
  useEffect(() => {
    if (!loadingTimedOut || dashboardLoadTimeoutTrackedRef.current) return;
    dashboardLoadTimeoutTrackedRef.current = true;
    const durationMs =
      dashboardLoadStartedAtRef.current !== null
        ? Math.max(0, Date.now() - dashboardLoadStartedAtRef.current)
        : null;
    trackEvent("org_dashboard_load_timeout", {
      organizationId: organization?.id ?? organizationId ?? null,
      durationMs,
      pathname: pathname ?? null,
    });
  }, [loadingTimedOut, organization?.id, organizationId, pathname]);
  useEffect(() => {
    if (!organizationError || organizationData || dashboardLoadErrorTrackedRef.current) return;
    dashboardLoadErrorTrackedRef.current = true;
    trackEvent("org_dashboard_load_error", {
      organizationId: organization?.id ?? organizationId ?? null,
      message: organizationError instanceof Error ? organizationError.message : String(organizationError),
    });
  }, [organizationError, organizationData, organization?.id, organizationId]);
  const marketingTabs = useMemo(() => {
    if (!canUseMarketing) return [];
    if (roleFlags.isPromoterOnly) {
      return MARKETING_TABS.filter((tab) => tab.key === "promoters");
    }
    return MARKETING_TABS;
  }, [canUseMarketing, roleFlags]);
  const dashboardToolsVisibilityUrl = scopedOrganizationId
    ? `/api/org/${scopedOrganizationId}/dashboard/tools/visibility`
    : null;
  const { data: dashboardToolsVisibility, mutate: mutateDashboardToolsVisibility } =
    useSWR<DashboardToolVisibilityResponse>(
      dashboardToolsVisibilityUrl,
      fetcherStrict,
      swrOptions,
    );
  const canCustomizeTools = roleFlags.canEditOrg && Boolean(dashboardToolsVisibility?.canEdit ?? roleFlags.canEditOrg);
  const [hiddenToolIds, setHiddenToolIds] = useState<string[]>([]);
  const [toolVisibilityError, setToolVisibilityError] = useState<string | null>(null);
  const salesUnitHint = isPadelContext
    ? "Inscrições registadas nos últimos 30 dias"
    : "Bilhetes vendidos nos últimos 30 dias";

  useEffect(() => {
    if (!scopedOrganizationId) {
      setHiddenToolIds([]);
      setToolVisibilityError(null);
      return;
    }
    const normalized = sanitizeDashboardHiddenToolIds(dashboardToolsVisibility?.hiddenToolIds);
    setHiddenToolIds((prev) => (areStringArraysEqual(prev, normalized) ? prev : normalized));
  }, [dashboardToolsVisibility?.hiddenToolIds, scopedOrganizationId]);

  const persistHiddenToolIds = useCallback(
    async (nextHidden: string[]) => {
      const normalized = sanitizeDashboardHiddenToolIds(nextHidden);
      setHiddenToolIds((prev) => (areStringArraysEqual(prev, normalized) ? prev : normalized));
      setToolVisibilityError(null);
      if (!dashboardToolsVisibilityUrl) return;
      try {
        const res = await fetch(dashboardToolsVisibilityUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hiddenToolIds: normalized }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.ok === false) {
          throw new Error((json && (json.error || json.message)) || "Não foi possível guardar a visibilidade.");
        }
        const serverHidden = sanitizeDashboardHiddenToolIds(json?.hiddenToolIds ?? normalized);
        setHiddenToolIds((prev) => (areStringArraysEqual(prev, serverHidden) ? prev : serverHidden));
      } catch (error) {
        setToolVisibilityError(error instanceof Error ? error.message : "Falha ao guardar visibilidade das ferramentas.");
        void mutateDashboardToolsVisibility();
      }
    },
    [dashboardToolsVisibilityUrl, mutateDashboardToolsVisibility],
  );
  const onboardingParam = searchParams?.get("onboarding");
  const [stripeRequirements, setStripeRequirements] = useState<string[]>([]);
  const [stripeSuccessMessage, setStripeSuccessMessage] = useState<string | null>(null);
  const [financeActionSaving, setFinanceActionSaving] = useState<"invoicing" | "payout-settings" | null>(null);
  const [financeActionMessage, setFinanceActionMessage] = useState<string | null>(null);
  const [financeActionError, setFinanceActionError] = useState<string | null>(null);
  const [checklistDismissed, setChecklistDismissed] = useState(false);
  const [checklistCollapsed, setChecklistCollapsed] = useState(true);

  useEffect(() => {
    if (!scrollSection) return;
    if (typeof window === "undefined") return;

    const scrollTargets: Record<ObjectiveTab, string[]> = {
      create: ["overview", "ferramentas"],
      manage: [
        "eventos",
        "reservas",
        ...(showPadelHub ? [...PADEL_MANAGE_SECTIONS] : []),
        ...(hasInscricoesModule ? ["inscricoes"] : []),
      ],
      promote: ["marketing"],
      analyze: canViewFinance
        ? canUseAnalytics
          ? ["overview", "vendas", "financas", "invoices", "ops"]
          : ["financas", "invoices", "ops"]
        : canUseAnalytics
          ? ["overview", "vendas"]
          : [],
    };

    const allowed = scrollTargets[activeObjective] ?? [];
    if (!allowed.includes(scrollSection)) return;
    const target = document.getElementById(scrollSection);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [scrollSection, activeObjective, canViewFinance, canUseAnalytics, hasInscricoesModule, showPadelHub]);

  useEffect(() => {
    if (scrollSection) return;
    if (typeof window === "undefined") return;
    if (activeObjective !== "create") return;
    const container = document.querySelector<HTMLElement>("[data-org-scroll]");
    container?.scrollTo({ top: 0 });
  }, [scrollSection, activeObjective]);

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
        if (!orgApiBase) return;
        const res = await fetch(`${orgApiBase}/finance/payouts/status`);
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
  }, [onboardingParam, activeObjective, mutateOrganization, orgApiBase]);

  // Prefill onboarding fields quando já existirem dados
  useEffect(() => {
    if (!businessName && profile?.fullName) setBusinessName(profile.fullName);
    if (organization) {
      if (!entityType && organization.entityType) setEntityType(organization.entityType);
      if (!businessName && organization.publicName) setBusinessName(organization.publicName);
      if (!payoutIban && organization.payoutIban) setPayoutIban(organization.payoutIban);
    }
  }, [organization, profile, businessName, entityType, payoutIban]);

  const activeSection = useMemo(() => {
    const manageSections = [
      "eventos",
      "reservas",
      ...(showPadelHub ? [...PADEL_MANAGE_SECTIONS] : []),
      ...(hasInscricoesModule ? ["inscricoes"] : []),
    ];
    const analyzeSections = canViewFinance
      ? canUseAnalytics
        ? ["overview", "vendas", "financas", "invoices", "ops"]
        : ["financas", "invoices", "ops"]
      : canUseAnalytics
        ? ["overview", "vendas"]
        : [];
    const baseSections: Record<ObjectiveTab, string[]> = {
      create: ["overview"],
      manage: manageSections,
      promote: ["marketing"],
      analyze: analyzeSections,
    };
    const allowed = baseSections[activeObjective] ?? ["overview"];
    const candidate =
      normalizedSection ??
      (activeObjective === "analyze"
        ? canViewFinance
          ? "financas"
          : "overview"
        : activeObjective === "promote"
          ? "marketing"
            : "overview");
    return allowed.includes(candidate) ? candidate : allowed[0];
  }, [
    activeObjective,
    normalizedSection,
    showPadelHub,
    hasInscricoesModule,
    canViewFinance,
    canUseAnalytics,
  ]);

  const shouldLoadOverview =
    organization?.status === "ACTIVE" &&
    canUseAnalytics &&
    (activeObjective === "create" || (activeObjective === "analyze" && normalizedSection === "overview"));
  const { data: overview } = useSWR<OverviewResponse>(
    shouldLoadOverview && orgApiBase ? `${orgApiBase}/analytics/overview?range=30d${eventsScopeAmp}` : null,
    fetcher,
    swrOptions
  );

  const shouldLoadOverviewSeries =
    organization?.status === "ACTIVE" &&
    canUseAnalytics &&
    activeObjective === "analyze" &&
    normalizedSection === "overview";

  type TimeSeriesResponse = { ok: boolean; points: TimeSeriesPoint[]; range: { from: string | null; to: string | null } };
  const { data: timeSeries } = useSWR<TimeSeriesResponse>(
    shouldLoadOverviewSeries && orgApiBase ? `${orgApiBase}/analytics/time-series?range=30d${eventsScopeAmp}` : null,
    fetcher,
    swrOptions
  );

  const shouldLoadEvents =
    organization?.status === "ACTIVE" &&
    (activeObjective === "manage" || activeObjective === "analyze" || activeObjective === "promote");
  const shouldLoadEventSummary =
    organization?.status === "ACTIVE" && activeObjective === "create";
  const { data: eventsSummary } = useSWR<EventsSummaryResponse>(
    shouldLoadEventSummary && orgApiBase ? `${orgApiBase}/events/summary${eventsScopeSuffix}` : null,
    fetcher,
    swrOptions
  );
  const {
    data: events,
    error: eventsError,
    mutate: mutateEvents,
  } = useSWR<EventsResponse>(
    shouldLoadEvents && orgApiBase ? `${orgApiBase}/events/list${eventsScopeSuffix}` : null,
    fetcher,
    swrOptions
  );
  const shouldLoadReservasLists =
    organization?.status === "ACTIVE" && activeObjective === "manage" && activeSection === "reservas";
  const shouldLoadReservasSummary =
    organization?.status === "ACTIVE" && activeObjective === "create" && isReservasOrg;
  const { data: reservasSummary } = useSWR<ReservasSummaryResponse>(
    shouldLoadReservasSummary && orgApiBase ? `${orgApiBase}/reservas/summary` : null,
    fetcher,
    swrOptions
  );
  const { data: servicesData } = useSWR<ServicesResponse>(
    shouldLoadReservasLists && orgApiBase ? `${orgApiBase}/servicos` : null,
    fetcher,
    swrOptions
  );
  const { data: bookingsData } = useSWR<BookingsResponse>(
    shouldLoadReservasLists && orgApiBase ? `${orgApiBase}/reservas` : null,
    fetcher,
    swrOptions
  );
  const { data: membersData } = useSWR<MembersResponse>(
    organization?.status === "ACTIVE" && organization?.id && activeObjective === "create"
      ? `/api/org-hub/organizations/members?organizationId=${organization.id}`
      : null,
    fetcher,
    swrOptions
  );

  const shouldLoadSales =
    organization?.status === "ACTIVE" &&
    canUseAnalytics &&
    activeObjective === "analyze" &&
    normalizedSection === "vendas";

  useEffect(() => {
    if (!shouldLoadSales) return;
    if (!salesEventId && events?.items?.length) {
      setSalesEventId(events.items[0].id);
    }
  }, [events, salesEventId, shouldLoadSales]);

  const { data: payoutSummary } = useSWR<PayoutSummaryResponse>(
    organization?.status === "ACTIVE" && canViewFinance && activeObjective === "analyze" && activeSection === "financas" && orgApiBase
      ? `${orgApiBase}/finance/payouts/summary`
      : null,
    fetcher,
    swrOptions
  );
  const { data: financeOverview } = useSWR<FinanceOverviewResponse>(
    organization?.status === "ACTIVE" &&
      canViewFinance &&
      activeObjective === "analyze" &&
      activeSection === "financas"
      && orgApiBase
      ? `${orgApiBase}/finance/overview${eventsScopeSuffix}`
      : null,
    fetcher,
    swrOptions
  );
  const shouldLoadFinanceControls =
    organization?.status === "ACTIVE" &&
    canViewFinance &&
    activeObjective === "analyze" &&
    (activeSection === "financas" || activeSection === "invoices");
  const { data: financeInvoicingSettings, mutate: mutateFinanceInvoicingSettings } = useSWR<FinanceInvoicingResponse>(
    shouldLoadFinanceControls && orgApiBase ? `${orgApiBase}/finance/invoicing` : null,
    fetcher,
    swrOptions,
  );
  const shouldLoadOpsFeed =
    organization?.status === "ACTIVE" &&
    canViewFinance &&
    activeObjective === "analyze" &&
    activeSection === "ops";
  const { data: opsFeed } = useSWR<OpsFeedResponse>(
    shouldLoadOpsFeed && orgApiBase ? `${orgApiBase}/ops/feed?limit=25` : null,
    fetcher,
    swrOptions,
  );

  const financeExportRange = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const toIso = to.toISOString().slice(0, 10);
    const fromIso = from.toISOString().slice(0, 10);
    return { from: fromIso, to: toIso };
  }, []);

  const buildFinanceExportHref = useCallback(
    (kind: "fees" | "ledger" | "payouts") => {
      if (!orgApiBase) return "#";
      const params = new URLSearchParams({
        from: financeExportRange.from,
        to: financeExportRange.to,
      });
      return `${orgApiBase}/finance/exports/${kind}?${params.toString()}`;
    },
    [financeExportRange.from, financeExportRange.to, orgApiBase],
  );

  const oneYearAgoIso = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 365);
    return d.toISOString();
  }, []);

  const salesSeriesKey = useMemo(() => {
    if (!shouldLoadSales || !salesEventId || !orgApiBase) return null;
    const templateQuery = eventsScopeAmp;
    if (salesRange === "7d" || salesRange === "30d" || salesRange === "90d") {
      return `${orgApiBase}/analytics/time-series?range=${salesRange}&eventId=${salesEventId}${templateQuery}`;
    }
    if (salesRange === "365d") {
      return `${orgApiBase}/analytics/time-series?eventId=${salesEventId}&from=${oneYearAgoIso}${templateQuery}`;
    }
    return `${orgApiBase}/analytics/time-series?eventId=${salesEventId}${templateQuery}`;
  }, [salesEventId, salesRange, oneYearAgoIso, shouldLoadSales, eventsScopeAmp, orgApiBase]);

  const { data: salesSeries } = useSWR<TimeSeriesResponse>(
    salesSeriesKey,
    fetcher,
    swrOptions
  );
  const { data: analyticsDimensions } = useSWR<AnalyticsDimensionsResponse>(
    organization?.status === "ACTIVE" &&
      canUseAnalytics &&
      activeObjective === "analyze" &&
      activeSection === "overview" &&
      orgApiBase
      ? `${orgApiBase}/analytics/dimensoes?dimensionKey=MODULE`
      : null,
    fetcher,
    swrOptions,
  );

  const { data: buyers } = useSWR<BuyersResponse>(
    shouldLoadSales && salesEventId && orgApiBase ? `${orgApiBase}/analytics/buyers?eventId=${salesEventId}` : null,
    fetcher,
    swrOptions
  );

  const archiveEvent = useCallback(
    async (target: EventItem, mode: "archive" | "delete" | "unarchive") => {
      setEventActionLoading(target.id);
      setCtaError(null);
      setCtaSuccess(null);
      const archive = mode === "archive" || mode === "delete";
      const targetLabel = target.templateType === "PADEL" ? "Torneio" : "Evento";
      try {
        if (!orgApiBase) throw new Error("ORG_CONTEXT_MISSING");
        const res = await fetch(`${orgApiBase}/events/update`, {
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
            setCtaSuccess(`${targetLabel} arquivado.`);
            trackEvent("event_archived", { eventId: target.id, status: target.status });
          } else {
            setCtaSuccess(`${targetLabel} reativado.`);
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
    [mutateEvents, orgApiBase],
  );
  const { data: marketingOverview } = useSWR<MarketingOverviewResponse>(
    organization?.status === "ACTIVE" &&
      activeObjective === "promote" &&
      !roleFlags.isPromoterOnly &&
      canUseMarketing &&
      orgApiBase
      ? `${orgApiBase}/marketing/overview${eventsScopeSuffix}`
      : null,
    fetcher,
    swrOptions
  );

  const { data: promoData } = useSWR<PromoListResponse>(
    organization?.status === "ACTIVE" && canUseMarketing && activeObjective === "promote" && orgApiBase
      ? `${orgApiBase}/promo`
      : null,
    fetcher,
    swrOptions
  );
  const eventDialogLabel = eventDialog?.ev.templateType === "PADEL" ? "torneio" : "evento";
  const currentQuery = searchParams?.toString() || "";
  async function handleStripeConnect() {
    import("@/lib/analytics").then(({ trackEvent }) =>
      trackEvent("connect_stripe_clicked", { status: paymentsStatus }),
    );
    setStripeCtaError(null);
    setStripeCtaLoading(true);
    try {
      if (!orgApiBase) throw new Error("ORG_CONTEXT_MISSING");
      const res = await fetch(`${orgApiBase}/finance/payouts/connect`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok || !json.url) {
        setStripeCtaError(json?.error || "Não foi possível gerar o link de configuração.");
        setStripeCtaLoading(false);
        return;
      }
      window.location.href = json.url;
    } catch (err) {
      console.error(err);
      setStripeCtaError("Erro inesperado ao gerar link de configuração.");
      setStripeCtaLoading(false);
    }
  }

  const handleReactivateOrganization = useCallback(async () => {
    if (!organization?.id) return;
    setSuspensionActionLoading(true);
    setSuspensionActionMessage(null);
    try {
      const invoke = async (stepUp?: { stepUpChallengeId?: string; stepUpCode?: string }) => {
        const res = await fetch(`/api/org-hub/organizations/${organization.id}/suspend`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reasonCode: "OWNER_RESTORE",
            ...(stepUp?.stepUpChallengeId ? { stepUpChallengeId: stepUp.stepUpChallengeId } : {}),
            ...(stepUp?.stepUpCode ? { stepUpCode: stepUp.stepUpCode } : {}),
          }),
        });
        const json = await res.json().catch(() => null);
        return { res, json };
      };

      let { res, json } = await invoke();
      if ((!res.ok || json?.ok === false) && String(json?.errorCode ?? json?.error ?? "").toUpperCase() === "STEP_UP_REQUIRED") {
        const challengeId = typeof json?.details?.challengeId === "string" ? json.details.challengeId : undefined;
        const input =
          typeof window !== "undefined"
            ? window.prompt("Introduz o código de confirmação (6 dígitos) para reativar a organização:")
            : null;
        const code = typeof input === "string" ? input.trim() : "";
        if (!code) {
          setSuspensionActionMessage("Operação cancelada. Código não introduzido.");
          return;
        }
        const retry = await invoke({ stepUpChallengeId: challengeId, stepUpCode: code });
        res = retry.res;
        json = retry.json;
      }

      if (!res.ok || json?.ok === false) {
        setSuspensionActionMessage(json?.message || json?.error || "Não foi possível reativar a organização.");
        return;
      }
      setSuspensionActionMessage("Organização reativada.");
      await mutateOrganization();
      router.refresh();
    } catch (err) {
      console.error("[dashboard][reactivate-organization]", err);
      setSuspensionActionMessage("Erro inesperado ao reativar.");
    } finally {
      setSuspensionActionLoading(false);
    }
  }, [mutateOrganization, organization?.id, router]);

  async function handleUpdateInvoicing(mode: "EXTERNAL_SOFTWARE" | "MANUAL_OUTSIDE_ORYA") {
    setFinanceActionError(null);
    setFinanceActionMessage(null);
    setFinanceActionSaving("invoicing");
    try {
      const payload: Record<string, unknown> = {
        invoicingMode: mode,
        acknowledged: true,
      };
      if (mode === "EXTERNAL_SOFTWARE") {
        payload.invoicingSoftwareName =
          financeInvoicingSettings?.ok && financeInvoicingSettings.settings?.invoicingSoftwareName
            ? financeInvoicingSettings.settings.invoicingSoftwareName
            : "Software externo";
      }
      if (!orgApiBase) throw new Error("ORG_CONTEXT_MISSING");
      const res = await fetch(`${orgApiBase}/finance/invoicing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || json?.message || "Não foi possível atualizar a faturação.");
      }
      setFinanceActionMessage("Faturação atualizada.");
      mutateFinanceInvoicingSettings();
    } catch (err) {
      setFinanceActionError(err instanceof Error ? err.message : "Erro ao atualizar faturação.");
    } finally {
      setFinanceActionSaving(null);
    }
  }

  async function handlePayoutSettingsHardcut() {
    setFinanceActionError(null);
    setFinanceActionMessage(null);
    setFinanceActionSaving("payout-settings");
    try {
      if (!orgApiBase) throw new Error("ORG_CONTEXT_MISSING");
      const res = await fetch(`${orgApiBase}/finance/payouts/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeMode: "INCLUDED",
          platformFeeBps: Number(organization?.platformFeeBps ?? 0),
          platformFeeFixedCents: Number(organization?.platformFeeFixedCents ?? 0),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || json?.message || "Não foi possível guardar as definições de transferência.");
      }
      setFinanceActionMessage("Definições de transferência guardadas.");
      mutateOrganization();
    } catch (err) {
      setFinanceActionError(err instanceof Error ? err.message : "Erro ao guardar as definições de transferência.");
    } finally {
      setFinanceActionSaving(null);
    }
  }

  const statsCards = useMemo(() => {
    const grossEuros = (overview?.grossCents ?? overview?.totalRevenueCents ?? 0) / 100;
    const netEuros = (overview?.netRevenueCents ?? overview?.totalRevenueCents ?? 0) / 100;
    const discountEuros = (overview?.discountCents ?? 0) / 100;
    const feeEuros = (overview?.feesCents ?? overview?.platformFeeCents ?? 0) / 100;
    return [
      {
        label: `${salesUnitLabel} 30d`,
        value: overview ? overview.totalTickets : "—",
        hint: salesUnitHint,
      },
      {
        label: "Receita líquida 30d",
        value: overview ? `${netEuros.toFixed(2)} €` : "—",
        hint: overview
          ? `Bruto ${grossEuros.toFixed(2)}€ · Descontos -${discountEuros.toFixed(2)}€ · Taxas -${feeEuros.toFixed(2)}€`
          : "—",
      },
      {
        label: `${managePrimaryLabel} com vendas`,
        value: overview ? overview.eventsWithSalesCount : "—",
        hint: `${managePrimaryLabel} com pelo menos 1 venda`,
      },
      {
        label: `${managePrimaryLabel} publicados`,
        value: overview ? overview.activeEventsCount : "—",
        hint: `${managePrimaryLabel} PUBLISHED ligados a ti`,
      },
    ];
  }, [overview, managePrimaryLabel, salesUnitHint, salesUnitLabel]);

  const statGradients = [
    "from-[#22D3EE]/25 via-[#0b1224]/70 to-[#0a0f1c]/90",
    "from-[#FF00C8]/18 via-[#130d1f]/70 to-[#0a0f1c]/90",
    "from-[#7AF89A]/18 via-[#0d1c16]/70 to-[#0a0f1c]/90",
    "from-[#AEE4FF]/18 via-[#0d1623]/70 to-[#0a0f1c]/90",
  ];

  // Usar largura completa do inset para manter o conteúdo alinhado no dashboard
  const containerClasses = "w-full max-w-none pb-12 pt-4 md:pt-6";
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
  const eventsList = useMemo(() => {
    const items = events?.items ?? [];
    const normalizedItems = items.map((ev) => ({
      ...ev,
      startsAt: ev.startsAt ?? null,
      endsAt: ev.endsAt ?? null,
    }));
    if (eventsScope === "PADEL") {
      return normalizedItems.filter((ev) => ev.templateType === "PADEL");
    }
    return normalizedItems.filter((ev) => ev.templateType !== "PADEL");
  }, [events, eventsScope]);
  const eventSummary = useMemo(() => {
    if (!eventsList.length && eventsSummary?.counts) {
      return eventsSummary.counts;
    }
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
  }, [eventsList, eventsSummary?.counts]);
  const servicesList = useMemo(() => servicesData?.items ?? [], [servicesData]);
  const bookingsList = useMemo(() => bookingsData?.items ?? [], [bookingsData]);
  const servicesStats = useMemo(() => {
    if (reservasSummary && reservasSummary.ok) {
      return reservasSummary.services;
    }
    const active = servicesList.filter((service) => service.isActive).length;
    const availabilityCount = servicesList.reduce(
      (sum, service) => sum + (service._count?.availabilities ?? 0),
      0,
    );
    return { total: servicesList.length, active, availabilityCount };
  }, [reservasSummary, servicesList]);
  const bookingsStats = useMemo(() => {
    if (reservasSummary && reservasSummary.ok) {
      return { ...reservasSummary.bookings, cancelled: 0 };
    }
    const now = new Date();
    const weekAhead = new Date(now);
    weekAhead.setDate(weekAhead.getDate() + 7);
    let upcoming = 0;
    let confirmed = 0;
    let pending = 0;
    let cancelled = 0;
    let revenueCents = 0;
    bookingsList.forEach((booking) => {
      const start = new Date(booking.startsAt);
      if (start >= now && start <= weekAhead) upcoming += 1;
      if (booking.status === "CONFIRMED" || booking.status === "COMPLETED") {
        confirmed += 1;
        revenueCents += booking.price || 0;
      } else if (["PENDING_CONFIRMATION", "PENDING"].includes(booking.status)) {
        pending += 1;
      } else if (["CANCELLED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG"].includes(booking.status)) {
        cancelled += 1;
      }
    });
    return { upcoming, confirmed, pending, cancelled, revenueCents };
  }, [reservasSummary, bookingsList]);
  const eventsListLoading =
    shouldLoadEvents &&
    activeObjective === "manage" &&
    !events;
  const overviewLoading = shouldLoadOverview && !overview;
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
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    eventsList.forEach((ev) => {
      (ev.categories ?? []).forEach((cat) => set.add(cat));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
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
  const payoutAlerts = financeData?.payoutAlerts ?? financeSummary?.payoutAlerts ?? null;
  const showFinanceStripeStateBanners = financeFocus === "overview" || financeFocus === "payouts";
  const showFinanceControlPanel = financeFocus === "overview";
  const showFinanceSummaryCards = financeFocus === "overview";
  const showFinanceStripeCard = financeFocus === "overview";
  const showFinancePayoutInfoCard = financeFocus === "overview";
  const showFinanceLedgerTable = financeFocus === "overview";
  const showFinancePayoutsPanel = financeFocus === "payouts";
  const showFinanceRefundsPanel = financeFocus === "refunds";
  const financeInvoicingModeLabel =
    !financeInvoicingSettings || !financeInvoicingSettings.ok
      ? "Sem acesso"
      : financeInvoicingSettings.settings?.invoicingMode === "MANUAL_OUTSIDE_ORYA"
        ? "Manual"
        : financeInvoicingSettings.settings?.invoicingMode === "EXTERNAL_SOFTWARE"
          ? "Software externo"
          : "Não configurado";
  const stripeState = useMemo(() => {
    const hasReqs = stripeRequirements.length > 0;
    const pluralLabel = primaryCreateMeta.plural;
    if (paymentsStatus === "READY") {
      return {
        badge: "Ativo",
        tone: "success",
        title: "Conta Stripe ligada ✅",
        desc: isReservasOrg
          ? "Já podes receber pagamentos e gerir as tuas transferências normalmente."
          : "Já podes vender bilhetes pagos e receber as tuas transferências normalmente.",
        cta: "Abrir painel Stripe",
      };
    }
    if (paymentsStatus === "PENDING") {
      return {
        badge: hasReqs ? "Requer atenção" : "Configuração incompleta",
        tone: hasReqs ? "error" : "warning",
        title: hasReqs ? "Falta concluir dados no Stripe" : "Conta Stripe em configuração",
        desc: hasReqs
          ? "A tua conta Stripe precisa de dados antes de ativar pagamentos."
          : isReservasOrg
            ? "Conclui a configuração no Stripe para começares a receber pagamentos."
            : "Conclui a configuração no Stripe para começares a receber os pagamentos dos teus bilhetes.",
        cta: hasReqs ? "Rever ligação Stripe" : "Continuar configuração no Stripe",
      };
    }
    return {
      badge: "Por ligar",
      tone: "neutral",
      title: "Ainda não ligaste a tua conta Stripe",
      desc: isReservasOrg
        ? `Podes criar ${pluralLabel} gratuitos, mas para receber pagamentos precisas de ligar uma conta Stripe.`
        : `Podes criar ${pluralLabel} gratuitos, mas para vender bilhetes pagos precisas de ligar uma conta Stripe.`,
      cta: "Ligar conta Stripe",
    };
  }, [paymentsStatus, stripeRequirements, primaryCreateMeta.plural, isReservasOrg]);

  const marketingPromos = useMemo(() => promoData?.promoCodes ?? [], [promoData]);
  const promoEvents = useMemo(() => promoData?.events ?? [], [promoData]);
  const promoStats = useMemo(() => promoData?.promoStats ?? [], [promoData]);
  const marketingKpis = useMemo(() => {
    const activePromos = marketingPromos.filter((p) => p.active).length;
    const fallbackTop = [...marketingPromos].sort(
      (a, b) => (b.redemptionsCount ?? 0) - (a.redemptionsCount ?? 0)
    )[0];
    const promoTotals = promoStats.reduce(
      (acc, stat) => {
        acc.tickets += stat.tickets ?? 0;
        acc.grossCents += stat.grossCents ?? 0;
        acc.netCents += stat.netCents ?? 0;
        acc.discountCents += stat.discountCents ?? 0;
        acc.uses += stat.usesTotal ?? 0;
        return acc;
      },
      { tickets: 0, grossCents: 0, netCents: 0, discountCents: 0, uses: 0 },
    );
    if (roleFlags.isPromoterOnly) {
      return {
        totalTickets: promoTotals.tickets,
        ticketsWithPromo: promoTotals.tickets,
        guestTickets: 0,
        marketingRevenueCents: promoTotals.netCents,
        activePromos,
        topPromo: fallbackTop
          ? {
              id: fallbackTop.id,
              code: fallbackTop.code,
              redemptionsCount: fallbackTop.redemptionsCount ?? 0,
              revenueCents: 0,
            }
          : null,
      };
    }
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
  }, [marketingOverview, marketingPromos, overview, promoStats, roleFlags.isPromoterOnly]);
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

  const extractFees = (p: TimeSeriesPoint) => p.feesCents ?? p.platformFeeCents ?? 0;

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
    const header = [
      "ID",
      managePrimaryLabelTitle,
      salesUnitLabel,
      "Bruto (€)",
      "Taxas (€)",
      "Líquido (€)",
      "Estado",
      "Data",
    ];
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
    a.download = `vendas-por-${managePrimaryLabelLower}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [financeData, managePrimaryLabelLower, managePrimaryLabelTitle, salesUnitLabel]);

  const handleExportSalesCsv = useCallback(() => {
    if (!salesSeries?.points?.length || !selectedSalesEvent) return;
    const header = ["Data", salesUnitLabel, "Bruto (€)", "Desconto (€)", "Taxas (€)", "Líquido (€)"];
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
  }, [salesRange, salesSeries?.points, selectedSalesEvent, salesUnitLabel]);
  const fillTheRoomEvents = useMemo(() => {
    const sourceEvents =
      marketingOverview?.events && marketingOverview.events.length > 0 ? marketingOverview.events : eventsList;
    const scopedEvents =
      eventsScope === "PADEL"
        ? sourceEvents.filter((ev) => ev.templateType === "PADEL")
        : sourceEvents.filter((ev) => ev.templateType !== "PADEL");
    const now = new Date();
    return scopedEvents
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
  }, [eventsList, eventsScope, marketingOverview?.events]);

  const isPlatformStripe = paymentsMode === "PLATFORM";
  const stripeReady = isPlatformStripe || paymentsStatus === "READY";
  const stripeIncomplete = !isPlatformStripe && paymentsStatus === "PENDING";
  const nextEvent = eventsList[0] ?? eventsSummary?.nextEvent ?? null;
  const publicProfileUrl = organization?.username ? `/${organization.username}` : null;
  const officialEmailNormalized = normalizeOfficialEmail(organization?.officialEmail ?? null);
  const officialEmailVerified = Boolean(officialEmailNormalized && organization?.officialEmailVerifiedAt);
  const membersCount = membersData?.ok ? membersData.items?.length ?? 0 : 0;
  const hasInvitedStaff = membersCount > 1;
  const eventsTotal = eventsSummary?.counts?.total ?? eventsList.length;
  const primaryCreatedDone = isReservasOrg ? servicesStats.total > 0 : eventsTotal > 0;
  const primaryModuleKey =
    primaryOperation === "RESERVAS" ? "RESERVAS" : primaryOperation === "TORNEIOS" ? "TORNEIOS" : "EVENTOS";
  const primaryLabel =
    primaryOperation === "RESERVAS"
      ? "Primeiro serviço criado"
      : primaryOperation === "TORNEIOS"
        ? "Primeiro torneio criado"
        : "Primeiro evento criado";
  const primaryDescription =
    primaryOperation === "RESERVAS"
      ? "Cria um serviço com disponibilidade."
      : primaryOperation === "TORNEIOS"
        ? "Publica o primeiro torneio."
        : "Publica o primeiro evento.";
  const summarySteps = [
    {
      id: "profile",
      label: "Perfil completo",
      description: "Atualiza dados base da organização.",
      done: profileStatus === "OK",
      href: "/org/settings",
      iconKey: "DEFINICOES",
    },
    {
      id: "email",
      label: "Email oficial verificado",
      description: "Confirma o email oficial da organização.",
      done: officialEmailVerified,
      href: "/org/settings",
      iconKey: "DEFINICOES",
      required: true,
    },
    {
      id: "stripe",
      label: "Stripe ligado",
      description: "Liga pagamentos para receber receitas.",
      done: stripeReady,
      href: "/org/finance",
      iconKey: "FINANCEIRO",
      required: true,
    },
    {
      id: "primary",
      label: primaryLabel,
      description: primaryDescription,
      done: primaryCreatedDone,
      href: primaryCreateMeta.href,
      iconKey: primaryModuleKey,
    },
    ...(isReservasOrg
      ? [
          {
            id: "slots",
            label: "Horários publicados",
            description: "Define slots para reservas.",
            done: servicesStats.availabilityCount > 0,
            href: "/org/bookings",
            iconKey: "RESERVAS",
          },
        ]
      : []),
    {
      id: "staff",
      label: "Primeiro membro convidado",
      description: "Convida alguém para o staff da organização.",
      done: hasInvitedStaff,
      href: "/org/team",
      iconKey: "STAFF",
    },
    {
      id: "public",
      label: "Página pública definida",
      description: "Prepara a presença pública da organização.",
      done: Boolean(publicProfileUrl),
      href: scopedOrganizationId ? `/org/${scopedOrganizationId}/settings` : "/org-hub/organizations",
      iconKey: "DEFINICOES",
    },
  ];
  const orderedChecklistSteps = summarySteps
    .map((step, index) => ({ step, index }))
    .sort((a, b) => {
      if (a.step.done !== b.step.done) return a.step.done ? 1 : -1;
      if (!a.step.done) {
        const aRequired = a.step.required ? 0 : 1;
        const bRequired = b.step.required ? 0 : 1;
        if (aRequired !== bRequired) return aRequired - bRequired;
      }
      return a.index - b.index;
    })
    .map(({ step }) => step);
  const completedSteps = summarySteps.filter((step) => step.done).length;
  const completionPercent = summarySteps.length
    ? Math.round((completedSteps / summarySteps.length) * 100)
    : 0;
  const progressPercent = Math.max(0, Math.min(100, completionPercent));
  const requiredSteps = summarySteps.filter((step) => step.required);
  const requiredIncomplete = requiredSteps.filter((step) => !step.done);
  const requiredComplete = requiredIncomplete.length === 0;
  const checklistStorageKey = organization?.id
    ? `orya_checklist_dismissed_${organization.id}`
    : null;
  const checklistCollapseStorageKey = organization?.id
    ? `orya_checklist_collapsed_${organization.id}`
    : null;
  const checklistComplete = completionPercent >= 100;
  const canDismissChecklist = requiredComplete;
  const checklistDismissHint = canDismissChecklist
    ? "Fechar checklist"
    : "Conclui os passos obrigatórios para fechar.";

  useEffect(() => {
    if (!checklistStorageKey) return;
    try {
      setChecklistDismissed(localStorage.getItem(checklistStorageKey) === "1");
    } catch {
      /* ignore */
    }
  }, [checklistStorageKey]);

  useEffect(() => {
    if (!checklistCollapseStorageKey) return;
    try {
      const stored = localStorage.getItem(checklistCollapseStorageKey);
      if (stored === null) return;
      setChecklistCollapsed(stored === "1");
    } catch {
      /* ignore */
    }
  }, [checklistCollapseStorageKey]);

  const handleDismissChecklist = useCallback(() => {
    if (!canDismissChecklist) return;
    setChecklistDismissed(true);
    if (!checklistStorageKey) return;
    try {
      localStorage.setItem(checklistStorageKey, "1");
    } catch {
      /* ignore */
    }
  }, [canDismissChecklist, checklistStorageKey]);
  const handleToggleChecklist = useCallback(() => {
    setChecklistCollapsed((prev) => {
      const next = !prev;
      if (checklistCollapseStorageKey) {
        try {
          localStorage.setItem(checklistCollapseStorageKey, next ? "1" : "0");
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  }, [checklistCollapseStorageKey]);
  const checklistVisible = activeObjective === "create" && (!checklistDismissed || !canDismissChecklist);
  const canUseCrm = canAccessCrm;
  const canUseChatInterno = canAccessMensagens;
  const canUseCheckin = canAccessEvents || canAccessTorneios;
  const dashboardTools = useMemo<DashboardToolCard[]>(
    () => {
      const tools: Array<DashboardToolCard | null> = [
        canAccessEvents
          ? {
              id: "eventos",
              moduleKey: "EVENTOS",
              iconKey: "TOOL_EVENTOS",
              title: "Eventos",
              summary: "Eventos públicos e privados com operação completa.",
              bullets: ["Bilhetes e regras", "Participantes + check-in", "Operação + anúncios"],
              href: scopedOrganizationId ? `/org/${scopedOrganizationId}/events` : undefined,
              flow: "Operações",
            }
          : null,
        canAccessReservas
          ? {
              id: "reservas",
              moduleKey: "RESERVAS",
              iconKey: "TOOL_RESERVAS",
              title: "Reservas",
              summary: "Serviços e marcações com gestão diária.",
              bullets: ["Serviços + disponibilidade", "Marcações + estados", "Check-in operacional"],
              href: scopedOrganizationId ? `/org/${scopedOrganizationId}/bookings` : undefined,
              flow: "Operações",
            }
          : null,
        canAccessReservas
          ? {
              id: "calendar",
              moduleKey: "RESERVAS",
              iconKey: "TOOL_CALENDARIO",
              title: "Calendário",
              summary: "Visão operacional read-first da ocupação da organização.",
              bullets: ["Agenda consolidada", "Vista semanal e diária", "Sem escrita direta de serviços"],
              href: scopedOrganizationId ? `/org/${scopedOrganizationId}/calendar` : undefined,
              flow: "Operações",
            }
          : null,
        canAccessTorneios
          ? {
              id: "padel-club",
              moduleKey: "TORNEIOS",
              iconKey: "TOOL_PADEL_CLUBE",
              title: "Clube de padel",
              summary: "Operação diária do clube e gestão de campos.",
              bullets: ["Clube base + campos", "Campos + staff operacional", "Jogadores + treinadores"],
              href: scopedOrganizationId ? `/org/${scopedOrganizationId}/padel/clubs` : undefined,
              flow: "Operações",
            }
          : null,
        canAccessTorneios
          ? {
              id: "padel-tournaments",
              moduleKey: "TORNEIOS",
              iconKey: "TOOL_PADEL_TORNEIOS",
              title: "Torneios de padel",
              summary: "Calendário competitivo, equipas de competição e operação ao vivo.",
              bullets: ["Criação + calendário", "Categorias + equipas", "Staff + operação live"],
              href: scopedOrganizationId ? `/org/${scopedOrganizationId}/padel/tournaments` : undefined,
              flow: "Operações",
            }
          : null,
        canUseCheckin
          ? {
              id: "checkin",
              moduleKey: "CHECKIN",
              iconKey: "TOOL_CHECKIN",
              title: "Check-in",
              summary: "Scanner rápido para eventos e torneios.",
              bullets: ["Leitor QR", "Confirmação explícita", "Histórico por evento"],
              href: scopedOrganizationId ? `/org/${scopedOrganizationId}/check-in` : undefined,
              flow: "Operações",
            }
          : null,
        canAccessInscricoes
          ? {
              id: "inscricoes",
              moduleKey: "INSCRICOES",
              iconKey: "TOOL_FORMULARIOS",
              title: "Formulários",
              summary: "Recolha de inscrições e dados operacionais.",
              bullets: ["Formulários rápidos", "Listas e vagas", "Exportação de dados"],
              href: scopedOrganizationId ? `/org/${scopedOrganizationId}/forms` : undefined,
              flow: "Operações",
            }
          : null,
        canUseChatInterno
          ? {
              id: "mensagens",
              moduleKey: "MENSAGENS",
              iconKey: "TOOL_CHAT_INTERNO",
              title: "Mensagens",
              summary: "Canal privado entre membros da organização.",
              bullets: ["Conversas da equipa", "Canais internos", "Histórico completo"],
              href: scopedOrganizationId ? `/org/${scopedOrganizationId}/chat` : undefined,
              flow: "Operações",
            }
          : null,
        canViewFinance
          ? {
              id: "financeiro",
              moduleKey: "FINANCEIRO",
              iconKey: "TOOL_FINANCAS",
              title: "Finanças",
              summary: "Operação financeira e compliance transacional.",
              bullets: ["Faturação + reconciliação", "Reembolsos + disputas", "Transferências + exportações"],
              href: scopedOrganizationId ? `/org/${scopedOrganizationId}/finance` : undefined,
              flow: "Gestão",
            }
          : null,
        canUseAnalytics
          ? {
              id: "analytics",
              moduleKey: "ANALYTICS",
              iconKey: "TOOL_ANALYTICS",
              title: "Análises",
              summary: "BI financeiro com conversão, coortes e tendências de receita.",
              bullets: ["Visão geral monetária", "Conversão + coortes", "Performance por dimensão financeira"],
              href: scopedOrganizationId ? `/org/${scopedOrganizationId}/analytics` : undefined,
              flow: "Gestão",
            }
          : null,
        canPromote
          ? {
              id: "marketing",
              moduleKey: "MARKETING",
              iconKey: "TOOL_PROMOCOES",
              title: "Marketing",
              summary: "Códigos, parcerias e partilha.",
              bullets: ["Códigos promocionais", "Promotores e parcerias", "Links + QR"],
              href: scopedOrganizationId ? `/org/${scopedOrganizationId}/marketing` : undefined,
              flow: "Gestão",
            }
          : null,
        canUseCrm
          ? {
              id: "crm",
              moduleKey: "CRM",
              iconKey: "TOOL_CRM",
              title: "CRM",
              summary: "Clientes, segmentos e fidelização.",
              bullets: ["Clientes + histórico", "Segmentos + campanhas", "Pontos + recompensas"],
              href: scopedOrganizationId ? `/org/${scopedOrganizationId}/crm` : undefined,
              flow: "Gestão",
            }
          : null,
        canAccessLoja
          ? {
              id: "loja",
              moduleKey: "LOJA",
              iconKey: "TOOL_LOJA",
              title: "Loja",
              summary: "Produtos físicos e digitais com checkout único.",
              bullets: ["Catálogo + imagens", "Portes + descontos", "Encomendas + envio"],
              href: scopedOrganizationId ? `/org/${scopedOrganizationId}/store` : undefined,
              flow: "Gestão",
            }
          : null,
        canManageMembers
          ? {
              id: "staff",
              moduleKey: "STAFF",
              iconKey: "TOOL_EQUIPA",
              title: "Equipa",
              summary: "Gestão de equipa, funções e permissões.",
              bullets: ["Dono / Co-dono / Administrador / Equipa / Scanner", "Permissões por ferramenta", "Registo de ações"],
              href: scopedOrganizationId ? `/org/${scopedOrganizationId}/team` : undefined,
              flow: "Administração",
            }
          : null,
        canEditOrgSettings
          ? {
              id: "politicas",
              moduleKey: "DEFINICOES",
              iconKey: "TOOL_POLITICAS",
              title: "Políticas",
              summary: "Políticas personalizáveis, termos e guardrails operacionais.",
              bullets: ["Cancelamento e reagendamento", "Termos e condições", "Defaults editáveis por dropdown e texto"],
              href: scopedOrganizationId ? `/org/${scopedOrganizationId}/policies` : undefined,
              flow: "Administração",
            }
          : null,
        canEditOrgSettings
          ? {
              id: "settings",
              moduleKey: "DEFINICOES",
              iconKey: "TOOL_DEFINICOES",
              title: "Definições",
              summary: "Pagamentos, políticas e preferências.",
              bullets: ["Pagamentos e políticas", "Notificações globais", "Regras de chat"],
              href: scopedOrganizationId ? `/org/${scopedOrganizationId}/settings` : undefined,
              flow: "Administração",
            }
          : null,
      ];
      return tools.filter((tool): tool is DashboardToolCard => tool !== null);
    },
    [
      canAccessEvents,
      canAccessReservas,
      canAccessTorneios,
      canUseCheckin,
      canAccessInscricoes,
      canUseChatInterno,
      canViewFinance,
      canUseAnalytics,
      canPromote,
      canUseCrm,
      canAccessLoja,
      canManageMembers,
      canEditOrgSettings,
      scopedOrganizationId,
    ],
  );
  const hideableToolIds = useMemo(
    () =>
      dashboardTools
        .map((tool) => tool.id)
        .filter((toolId) => !NON_HIDEABLE_DASHBOARD_TOOL_IDS.has(toolId))
        .sort(),
    [dashboardTools],
  );
  const validHiddenToolIds = useMemo(() => {
    const hideableSet = new Set(hideableToolIds);
    return hiddenToolIds.filter((toolId) => hideableSet.has(toolId)).sort();
  }, [hiddenToolIds, hideableToolIds]);
  useEffect(() => {
    if (areStringArraysEqual(hiddenToolIds, validHiddenToolIds)) return;
    void persistHiddenToolIds(validHiddenToolIds);
  }, [hiddenToolIds, persistHiddenToolIds, validHiddenToolIds]);
  const hiddenToolSet = useMemo(() => new Set(validHiddenToolIds), [validHiddenToolIds]);
  const visibleDashboardTools = useMemo(
    () => dashboardTools.filter((tool) => !hiddenToolSet.has(tool.id)),
    [dashboardTools, hiddenToolSet],
  );
  const hiddenDashboardTools = useMemo(
    () => dashboardTools.filter((tool) => hiddenToolSet.has(tool.id)),
    [dashboardTools, hiddenToolSet],
  );
  const toolGroups = useMemo(
    () =>
      TOOL_FLOW_ORDER.map((flow) => ({
        flow,
        tools: visibleDashboardTools.filter((tool) => tool.flow === flow),
      })).filter((group) => group.tools.length > 0),
    [visibleDashboardTools],
  );
  const hiddenToolGroups = useMemo(
    () =>
      TOOL_FLOW_ORDER.map((flow) => ({
        flow,
        tools: hiddenDashboardTools.filter((tool) => tool.flow === flow),
      })).filter((group) => group.tools.length > 0),
    [hiddenDashboardTools],
  );
  const hasHiddenTools = hiddenDashboardTools.length > 0;
  const hideDashboardTool = useCallback(
    (tool: DashboardToolCard) => {
      if (!canCustomizeTools) return;
      if (NON_HIDEABLE_DASHBOARD_TOOL_IDS.has(tool.id)) return;
      if (hiddenToolSet.has(tool.id)) return;
      void persistHiddenToolIds([...validHiddenToolIds, tool.id]);
    },
    [canCustomizeTools, hiddenToolSet, persistHiddenToolIds, validHiddenToolIds],
  );
  const showDashboardTool = useCallback(
    (toolId: string) => {
      if (!canCustomizeTools) return;
      if (!hiddenToolSet.has(toolId)) return;
      void persistHiddenToolIds(validHiddenToolIds.filter((id) => id !== toolId));
    },
    [canCustomizeTools, hiddenToolSet, persistHiddenToolIds, validHiddenToolIds],
  );
  const modulePrefetchTargets = useMemo(() => {
    if (!scopedOrganizationId) return [];
    const coreTargets = [
      `/org/${scopedOrganizationId}/overview`,
      `/org/${scopedOrganizationId}/events`,
      `/org/${scopedOrganizationId}/analytics`,
      `/org/${scopedOrganizationId}/settings`,
    ];
    const moduleTargets = visibleDashboardTools
      .map((module) => module.href)
      .filter((href): href is string => typeof href === "string")
      .map((href) => appendOrganizationIdToHref(href, scopedOrganizationId));
    return Array.from(new Set([...coreTargets, ...moduleTargets])).slice(0, 12);
  }, [scopedOrganizationId, visibleDashboardTools]);
  useEffect(() => {
    if (loading || loadingTimedOut || modulePrefetchTargets.length === 0) return;
    const timer = window.setTimeout(() => {
      modulePrefetchTargets.forEach((href) => {
        try {
          router.prefetch(href);
        } catch {
          // Best effort.
        }
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [loading, loadingTimedOut, modulePrefetchTargets, router]);
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
  const hasMountedFadeRef = useRef(false);
  useEffect(() => {
    if (!hasMountedFadeRef.current) {
      hasMountedFadeRef.current = true;
      return;
    }
    setFadeIn(false);
    const id = requestAnimationFrame(() => setFadeIn(true));
    return () => cancelAnimationFrame(id);
  }, [activeObjective, activeSection, marketingSection]);
  const fadeClass = cn("transition-opacity duration-300", fadeIn ? "opacity-100" : "opacity-0");
  const renderChecklistRing = (percent: number) => {
    const clamped = Math.min(100, Math.max(0, percent));
    const radius = 16;
    const circumference = 2 * Math.PI * radius;
    const dash = (clamped / 100) * circumference;
    return (
      <div className="relative flex h-10 w-10 items-center justify-center">
        <svg
          viewBox="0 0 36 36"
          className="absolute inset-0 h-full w-full -rotate-90 origin-center"
          aria-hidden="true"
        >
          <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke="#22D3EE"
            strokeWidth="3"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#050a12]">
          <span className="text-[9px] font-semibold tabular-nums leading-none text-white/85">{clamped}%</span>
        </div>
      </div>
    );
  };
  const renderToolCard = (tool: DashboardToolCard) => {
    const iconGradient = MODULE_ICON_GRADIENTS[tool.iconKey] ?? MODULE_ICON_GRADIENTS[tool.moduleKey] ?? "from-white/15 via-white/5 to-white/10";
    const iconBgStyle =
      MODULE_ICON_BG_STYLES[tool.iconKey] ??
      "linear-gradient(145deg, rgba(34,211,238,0.82) 0%, rgba(96,165,250,0.72) 48%, rgba(167,139,250,0.82) 100%)";
    const iconSurfaceGlow =
      MODULE_ICON_SURFACE_GLOWS[tool.iconKey] ??
      "shadow-[inset_0_1px_0_rgba(255,255,255,0.48),0_22px_42px_rgba(34,211,238,0.34)]";
    const canHide = canCustomizeTools && !NON_HIDEABLE_DASHBOARD_TOOL_IDS.has(tool.id);
    const customAppIconSrc = TOOL_CUSTOM_ICON_BY_ID[tool.id];
    const isCustomAppIcon = Boolean(customAppIconSrc);
    const cardInner = (
      <div
        className={cn(
          "group relative flex min-h-[172px] flex-col items-center justify-center gap-3 px-3 py-4 text-center sm:min-h-[192px] sm:gap-4 sm:px-4 sm:py-5",
          isCustomAppIcon
            ? "w-full min-h-[214px] gap-1 overflow-visible py-1 sm:min-h-[248px] sm:gap-2"
            : "overflow-hidden rounded-[26px] border border-white/22 bg-[linear-gradient(180deg,rgba(255,255,255,0.11),rgba(255,255,255,0.03)_48%,rgba(20,20,20,0.88))] shadow-[0_24px_70px_rgba(0,0,0,0.6)] transition hover:-translate-y-0.5 hover:border-[#22D3EE]/42 hover:shadow-[0_28px_78px_rgba(0,0,0,0.68)]",
        )}
      >
        <div className="pointer-events-none absolute inset-0">
          {!isCustomAppIcon && <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/35 to-transparent" />}
        </div>
        {canHide && !isCustomAppIcon && (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setPendingToolVisibilityRemoval(tool);
            }}
            aria-label="Ocultar ferramenta"
            className="absolute right-2 top-2 z-[1] flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-black/30 text-[14px] text-white/80 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-white/10"
          >
            ×
          </button>
        )}
        {customAppIconSrc ? (
          <div className="relative mx-auto flex items-center justify-center transition-transform duration-300 ease-out group-hover:-translate-y-1">
            <span className="pointer-events-none absolute inset-0 scale-[0.86] rounded-full bg-[radial-gradient(circle,rgba(148,190,255,0.26)_0%,rgba(148,190,255,0.08)_48%,transparent_74%)] opacity-0 blur-xl transition-opacity duration-300 ease-out group-hover:opacity-100" />
            {canHide && (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setPendingToolVisibilityRemoval(tool);
                }}
                aria-label="Ocultar ferramenta"
                className="absolute -right-2 -top-2 z-[2] flex h-7 w-7 items-center justify-center rounded-full border border-white/25 bg-black/45 text-[14px] text-white/85 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-white/10"
              >
                ×
              </button>
            )}
            <Image
              src={customAppIconSrc}
              alt=""
              aria-hidden="true"
              width={1024}
              height={1024}
              priority
              className="tool-custom-icon pointer-events-none h-[188px] w-[188px] select-none object-contain [transform:translateZ(0)] drop-shadow-[0_12px_20px_rgba(0,0,0,0.38)] transition-all duration-300 ease-out group-hover:scale-[1.085] group-hover:brightness-110 group-hover:drop-shadow-[0_18px_28px_rgba(0,0,0,0.48)] sm:h-[220px] sm:w-[220px]"
              draggable={false}
            />
          </div>
        ) : (
          <div
            className={cn(
              "relative flex items-center justify-center border border-white/32 text-white transition-transform duration-200 group-hover:scale-[1.04]",
              "h-[84px] w-[84px] rounded-full sm:h-[102px] sm:w-[102px]",
              iconGradient,
              iconSurfaceGlow,
            )}
            style={{ background: iconBgStyle }}
          >
            <span className="pointer-events-none absolute inset-[2px] rounded-full bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.34),rgba(255,255,255,0.1)_40%,rgba(255,255,255,0)_70%)]" />
            <span className="pointer-events-none absolute inset-[8px] rounded-full bg-[radial-gradient(circle_at_50%_55%,rgba(8,12,20,0.12),rgba(8,12,20,0.28)_72%,rgba(6,10,18,0.38)_100%)]" />
            <span className="pointer-events-none absolute inset-[10px] rounded-full border border-white/18" />
            <span className="pointer-events-none absolute inset-x-5 top-2 h-4 rounded-full bg-white/35 blur-[6px] sm:inset-x-6 sm:top-2.5 sm:h-5" />
            <ModuleIcon moduleKey={tool.iconKey} className="relative h-9 w-9 sm:h-11 sm:w-11" aria-hidden="true" />
          </div>
        )}
        <span
          className={cn(
            "relative mx-auto leading-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.62)]",
            isCustomAppIcon
              ? "max-w-[220px] text-[15px] font-semibold sm:max-w-[250px] sm:text-[17px]"
              : "text-[14px] font-extrabold sm:text-[16px]",
          )}
        >
          {tool.title}
        </span>
      </div>
    );

    if (tool.href) {
      return (
        <Link
          key={tool.id}
          href={tool.href}
          className={cn(
            "block rounded-[24px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1014]",
            isCustomAppIcon && "rounded-[32px] transition-transform duration-300 ease-out hover:-translate-y-0.5",
          )}
        >
          {cardInner}
        </Link>
      );
    }
    return (
      <div key={tool.id} className="block">
        {cardInner}
      </div>
    );
  };

  const renderAddToolGhostCard = () => (
    <button
      type="button"
      onClick={() => setToolsModalOpen(true)}
      aria-label="Adicionar ferramenta"
      className="group flex h-full min-h-[172px] w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-[26px] border border-dashed border-white/28 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.03)_52%,rgba(20,20,20,0.88))] px-3 py-4 text-center text-white/80 transition hover:border-[#22D3EE]/45 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.04)_52%,rgba(20,20,20,0.92))] hover:text-white sm:min-h-[192px] sm:gap-4 sm:px-4 sm:py-5"
    >
      <div className="relative flex h-[84px] w-[84px] items-center justify-center rounded-full border border-white/30 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),rgba(255,255,255,0.14)_32%,rgba(8,12,20,0.88)_78%,rgba(6,10,18,0.96)_100%)] text-4xl leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.46),0_14px_32px_rgba(0,0,0,0.56),0_0_24px_rgba(34,211,238,0.25)] sm:h-[102px] sm:w-[102px] sm:text-5xl">
        <span className="pointer-events-none absolute inset-[8px] rounded-full bg-[radial-gradient(circle_at_50%_48%,rgba(34,211,238,0.14),rgba(7,11,18,0.88)_72%)]" />
        <span className="pointer-events-none absolute inset-[10px] rounded-full border border-white/18" />
        <span className="pointer-events-none absolute inset-x-5 top-2 h-4 rounded-full bg-white/30 blur-[6px] sm:inset-x-6 sm:top-2.5 sm:h-5" />
        <span className="relative">+</span>
      </div>
      <span className="text-[14px] font-bold text-white sm:text-[16px]">Adicionar ferramenta</span>
    </button>
  );

  const renderToolPickerCard = (tool: DashboardToolCard) => {
    const iconGradient = MODULE_ICON_GRADIENTS[tool.iconKey] ?? MODULE_ICON_GRADIENTS[tool.moduleKey] ?? "from-white/15 via-white/5 to-white/10";
    const customAppIconSrc = TOOL_CUSTOM_ICON_BY_ID[tool.id];
    return (
      <div
        key={`picker-${tool.id}`}
        className="rounded-2xl border border-white/12 bg-white/5 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.4)] transition"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            {customAppIconSrc ? (
              <div className="relative h-14 w-14 overflow-hidden rounded-[16px] border border-white/20 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_12px_28px_rgba(0,0,0,0.32)]">
                <Image src={customAppIconSrc} alt="" fill sizes="56px" className="object-cover" aria-hidden="true" />
              </div>
            ) : (
              <div
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-[16px] border border-white/20 bg-gradient-to-br text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_12px_28px_rgba(0,0,0,0.32)]",
                  iconGradient,
                )}
              >
                <ModuleIcon moduleKey={tool.iconKey} className="h-6 w-6" aria-hidden="true" />
              </div>
            )}
            <div className="flex-1 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-white">{tool.title}</p>
                  <p className="text-[12px] text-white/65">{tool.summary}</p>
                </div>
                <span className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-100">
                  Oculta
                </span>
              </div>
              <ul className="space-y-1 text-[11px] text-white/60">
                {tool.bullets.map((bullet) => (
                  <li key={`${tool.id}-${bullet}`} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-white/40" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] uppercase tracking-[0.2em] text-white/40">{tool.flow}</span>
            <button
              type="button"
              onClick={() => showDashboardTool(tool.id)}
              className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white transition hover:border-white/40 hover:bg-white/15"
            >
              Mostrar
            </button>
          </div>
        </div>
      </div>
    );
  };

  const toolsModal =
    toolsModalOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
            role="dialog"
            aria-modal="true"
            aria-label="Ferramentas ocultas"
            onClick={(event) => {
              if (event.target === event.currentTarget) setToolsModalOpen(false);
            }}
          >
            <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-white/12 bg-[#050915]/95 p-5 text-white shadow-[0_28px_80px_rgba(0,0,0,0.75)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Ferramentas ocultas</p>
                  <h3 className="text-xl font-semibold text-white">Mostrar ferramentas</h3>
                  <p className="text-[12px] text-white/65">
                    Estas ferramentas continuam ativas no sistema, apenas estão ocultas no dashboard.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setToolsModalOpen(false)}
                  className="self-end rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-white/70 hover:border-white/30 hover:bg-white/10"
                >
                  Fechar
                </button>
              </div>

              <div className="mt-4 max-h-[60vh] space-y-6 overflow-y-auto pr-1">
                {hiddenToolGroups.length > 0 ? (
                  hiddenToolGroups.map((group) => (
                    <div key={group.flow} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-white/50">{group.flow}</p>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-2">
                        {group.tools.map((tool) => renderToolPickerCard(tool))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/70">
                    Não tens ferramentas ocultas neste momento.
                  </div>
                )}
              </div>

            </div>
          </div>,
          document.body,
        )
      : null;

  if (loading && !loadingTimedOut) {
    return (
      <div className={`${containerClasses} space-y-6`}>
        <div className="rounded-3xl border border-white/12 bg-white/5 p-5">
          <SkeletonLine className="h-3 w-40" />
          <SkeletonLine className="mt-3 h-8 w-64" />
          <SkeletonLine className="mt-2 h-4 w-52" />
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <SkeletonBlock className="h-32" />
          <SkeletonBlock className="h-32" />
          <SkeletonBlock className="h-32" />
        </div>
        <div className="rounded-3xl border border-white/12 bg-white/5 p-5">
          <SkeletonLine className="h-3 w-28" />
          <div className="mt-4 grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonBlock key={`module-skel-${index}`} className="h-14 rounded-2xl" />
            ))}
          </div>
        </div>
        <SkeletonBlock className="h-40" />
      </div>
    );
  }

  if (loadingTimedOut && !organizationData) {
    return (
      <div className={`${containerClasses} space-y-6`}>
        <div className="max-w-xl space-y-3 rounded-3xl border border-rose-400/40 bg-rose-500/10 p-6 text-rose-100 backdrop-blur-2xl">
          <p className="text-[11px] uppercase tracking-[0.24em] text-rose-100/80">Timeout de carregamento</p>
          <h1 className="text-2xl font-semibold text-white">O dashboard demorou demasiado tempo a abrir.</h1>
          <p className="text-sm text-rose-100/80">
            Atualiza o contexto da organização e tenta novamente.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setLoadingTimedOut(false);
                loadingRetryAttemptRef.current = false;
                trackEvent("org_dashboard_load_retry", {
                  organizationId: organization?.id ?? organizationId ?? null,
                  reason: "manual_retry",
                });
                mutateOrganization();
              }}
              className={cn(CTA_PRIMARY, "justify-center")}
            >
              Tentar novamente
            </button>
            <Link href="/org-hub/organizations" className={cn(CTA_SECONDARY, "justify-center")}>
              Ir para organizações
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (organizationError && !organizationData) {
    return (
      <div className={`${containerClasses} space-y-6`}>
        <div className="max-w-xl space-y-3 rounded-3xl border border-rose-400/40 bg-rose-500/10 p-6 text-rose-100 backdrop-blur-2xl">
          <p className="text-[11px] uppercase tracking-[0.24em] text-rose-100/80">Erro de contexto</p>
          <h1 className="text-2xl font-semibold text-white">Não foi possível carregar a organização.</h1>
          <p className="text-sm text-rose-100/80">
            Recarrega a página. Se persistir, troca de organização no topo e volta a abrir o dashboard.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                trackEvent("org_dashboard_load_retry", {
                  organizationId: organization?.id ?? organizationId ?? null,
                  reason: "error_retry",
                });
                mutateOrganization();
              }}
              className={cn(CTA_PRIMARY, "justify-center")}
            >
              Tentar novamente
            </button>
            <Link href="/org-hub/organizations" className={cn(CTA_SECONDARY, "justify-center")}>
              Ir para organizações
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!hasOrganization || !organization) {
    return (
      <div className={`${containerClasses} space-y-6`}>
        <div className="max-w-xl space-y-3 rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-6 backdrop-blur-2xl">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/70">Sem organização ativa</p>
          <h1 className="text-2xl font-semibold text-white">Liga-te a uma organização.</h1>
          <p className="text-sm text-white/70">Cria ou escolhe uma organização para entrar.</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/org-hub/create" className={cn(CTA_PRIMARY, "justify-center")}>
              Criar organização
            </Link>
            <Link href="/org-hub/organizations" className={cn(CTA_SECONDARY, "justify-center")}>
              Escolher organização
            </Link>
          </div>
        </div>
      </div>
    );
  }
  if (isPending) {
    return (
      <div className={`${containerClasses} space-y-6`}>
        <div className="max-w-xl space-y-3 rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-6 backdrop-blur-2xl">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/70">Organização pendente</p>
          <h1 className="text-2xl font-semibold text-white">A tua organização ainda não está ativa.</h1>
          <p className="text-sm text-white/70">Estamos a rever a tua organização. Vais receber uma notificação.</p>
        </div>
      </div>
    );
  }
  if (isSuspended) {
    return (
      <div className={`${containerClasses} space-y-6`}>
        <div className="max-w-xl space-y-3 rounded-3xl border border-amber-400/40 bg-gradient-to-br from-amber-500/15 via-[#0b1124]/75 to-[#050810]/90 p-6 text-amber-50 backdrop-blur-2xl">
          <p className="text-[11px] uppercase tracking-[0.24em] text-amber-100/80">Organização suspensa</p>
          <h1 className="text-2xl font-semibold text-white">Acesso apenas de leitura.</h1>
          {reactivationWindowOpen ? (
            <p className="text-sm text-amber-100/80">
              {remainingReactivationDays === 0
                ? "Último dia para reativar a organização."
                : `Reativação disponível por mais ${remainingReactivationDays ?? "?"} dias.`}
            </p>
          ) : (
            <p className="text-sm text-amber-100/80">A janela de reativação já terminou.</p>
          )}
          {reactivationDeadlineDate ? (
            <p className="text-[12px] text-amber-100/70">
              Prazo de reativação: {formatDateTime(reactivationDeadlineDate)}.
            </p>
          ) : null}
          <p className="text-sm text-amber-100/80">
            Se precisares de ajuda,{" "}
            {platformSupportEmail ? (
              <>
                contacta{" "}
                <a
                  href={`mailto:${platformSupportEmail}`}
                  className="underline decoration-amber-200/70 underline-offset-4"
                >
                  {platformSupportEmail}
                </a>
                .
              </>
            ) : (
              "contacta o suporte."
            )}
          </p>
          {canReactivateSuspendedOrganization ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleReactivateOrganization}
                disabled={suspensionActionLoading}
                className={cn(CTA_PRIMARY, "disabled:opacity-60")}
              >
                {suspensionActionLoading ? "A reativar…" : "Reativar organização"}
              </button>
              {suspensionActionMessage ? (
                <p className="text-[12px] text-amber-100">{suspensionActionMessage}</p>
              ) : null}
            </div>
          ) : suspensionActionMessage ? (
            <p className="text-[12px] text-amber-100">{suspensionActionMessage}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={`${containerClasses} space-y-6 text-white`}>
      {activeObjective === "create" && (
        <section className="space-y-4">
          <div id="overview" className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.26em] text-white/60">Painel</p>
              <h1 className="text-2xl sm:text-3xl font-semibold text-white">Visão geral</h1>
              <p className="text-sm text-white/70">
                {orgDisplayName} · {operationLabel}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={primaryCreateMeta.href} className={CTA_PRIMARY}>
                {primaryCreateMeta.label}
              </Link>
              {canCustomizeTools && (
                <button
                  type="button"
                  onClick={() => setToolsModalOpen(true)}
                  className={CTA_SECONDARY}
                >
                  Ferramentas
                </button>
              )}
            </div>
          </div>

          <div className={cn("space-y-4", fadeClass)}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-3xl border border-white/16 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(20,20,20,0.92))] p-4 shadow-[0_22px_70px_rgba(0,0,0,0.58)]">
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
                      {organization?.status === "ACTIVE"
                        ? "Ativa"
                        : organization?.status === "SUSPENDED"
                          ? "Suspensa"
                          : "Pendente"}
                    </span>
                  </div>
                </div>
              </div>

              {isReservasOrg ? (
                <div className="rounded-3xl border border-white/16 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(20,20,20,0.92))] p-4 shadow-[0_22px_70px_rgba(0,0,0,0.58)]">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Serviços</p>
                  <h3 className="text-lg font-semibold text-white">Oferta ativa</h3>
                  <div className="mt-3 grid gap-2 text-[12px] text-white/75">
                    <div className="flex items-center justify-between">
                      <span>Serviços ativos</span>
                      <span className="font-semibold text-white">{servicesStats.active}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Serviços totais</span>
                      <span className="font-semibold text-white">{servicesStats.total}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Horários publicados</span>
                      <span className="font-semibold text-white">{servicesStats.availabilityCount}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-white/16 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(20,20,20,0.92))] p-4 shadow-[0_22px_70px_rgba(0,0,0,0.58)]">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">
                    {primaryOperation === "TORNEIOS" ? "Torneios" : "Eventos"}
                  </p>
                  <h3 className="text-lg font-semibold text-white">Atividade recente</h3>
                  <div className="mt-3 grid gap-2 text-[12px] text-white/75">
                    <div className="flex items-center justify-between">
                      <span>{primaryOperation === "TORNEIOS" ? "Torneios ativos" : "Eventos ativos"}</span>
                      <span className="font-semibold text-white">{overview?.activeEventsCount ?? eventsTotal}</span>
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
              )}

              {isReservasOrg ? (
                <div className="rounded-3xl border border-white/16 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(20,20,20,0.92))] p-4 shadow-[0_22px_70px_rgba(0,0,0,0.58)]">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Reservas</p>
                  <h3 className="text-lg font-semibold text-white">Agenda 7 dias</h3>
                  <div className="mt-3 grid gap-2 text-[12px] text-white/75">
                    <div className="flex items-center justify-between">
                      <span>Agendadas</span>
                      <span className="font-semibold text-white">{bookingsStats.upcoming}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Confirmadas</span>
                      <span className="font-semibold text-white">{bookingsStats.confirmed}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Pendentes</span>
                      <span className="font-semibold text-white">{bookingsStats.pending}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Receita confirmada</span>
                      <span className="font-semibold text-white">
                        {(bookingsStats.revenueCents / 100).toFixed(2)} €
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-white/16 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(20,20,20,0.92))] p-4 shadow-[0_22px_70px_rgba(0,0,0,0.58)]">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Finanças</p>
                  <h3 className="text-lg font-semibold text-white">Últimos 30 dias</h3>
                  <div className="mt-3 grid gap-2 text-[12px] text-white/75">
                    <div className="flex items-center justify-between">
                      <span>{salesUnitLabel}</span>
                      <span className="font-semibold text-white">{overview?.totalTickets ?? "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Receita líquida</span>
                      <span className="font-semibold text-white">
                        {overview ? `${((overview.netRevenueCents ?? overview.totalRevenueCents ?? 0) / 100).toFixed(2)} €` : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{primaryOperation === "TORNEIOS" ? "Torneios com vendas" : "Eventos com vendas"}</span>
                      <span className="font-semibold text-white">{overview?.eventsWithSalesCount ?? "—"}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div
              id="ferramentas"
              className="rounded-3xl border border-white/16 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(20,20,20,0.92))] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.58)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Ferramentas</p>
                  <h2 className="text-xl font-semibold text-white">Apps da organização</h2>
                  <p className="text-[12px] text-white/65">Cada ferramenta mantém domínio próprio e acesso direto.</p>
                </div>
              </div>
              {toolVisibilityError && (
                <p className="mt-3 text-[12px] text-amber-200">{toolVisibilityError}</p>
              )}
              <div className="mt-4 space-y-4">
                {toolGroups.map((group) => (
                  <div key={`flow-${group.flow}`} className="space-y-2.5">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex rounded-full border border-white/14 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-white/68">
                        {group.flow}
                      </span>
                      <span className="h-px flex-1 bg-gradient-to-r from-white/16 to-transparent" />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
                      {group.tools.map((tool) => renderToolCard(tool))}
                      {canCustomizeTools && hasHiddenTools && group.flow === "Operações" && renderAddToolGhostCard()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </section>
      )}

      {activeObjective === "manage" && activeSection === "eventos" && (
        <section className={cn("space-y-4", fadeClass)} id="eventos">
          <div className="relative overflow-hidden rounded-3xl border border-white/16 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(20,20,20,0.92))] p-5 backdrop-blur-3xl">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -left-20 top-2 h-56 w-56 rounded-full bg-[#22D3EE]/10 blur-[120px]" />
              <div className="absolute right-10 top-0 h-48 w-48 rounded-full bg-white/6 blur-[120px]" />
              <div className="absolute -right-18 -bottom-20 h-64 w-64 rounded-full bg-[#22D3EE]/8 blur-[120px]" />
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/8 to-transparent" />
            </div>

            <div className="relative space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-[0.26em] text-white/70">{managePrimaryLabel}</p>
                  <h2 className="text-2xl font-semibold text-white drop-shadow-[0_14px_40px_rgba(0,0,0,0.45)]">
                    Gestão de {managePrimaryLabel.toLowerCase()}
                  </h2>
                  <p className="text-sm text-white/80">Pesquisa por estado e período.</p>
                </div>
                <Link
                  href={manageCreateMeta.href}
                  className={cn(CTA_PRIMARY, "text-[12px]")}
                >
                  {manageCreateMeta.label}
                </Link>
              </div>

              <div
                ref={manageFiltersRef}
                className="relative z-20 rounded-2xl border border-white/12 bg-gradient-to-br from-[#0b1226]/85 via-[#0b1124]/70 to-[#050912]/90 p-3 shadow-[0_22px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
              >
                <div className="space-y-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="flex-1 rounded-2xl border border-white/12 bg-white/5 px-3 py-3 shadow-[0_16px_50px_rgba(0,0,0,0.35)]">
                      <label className="text-[10px] uppercase tracking-[0.24em] text-white/55">Pesquisa</label>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          type="search"
                          placeholder={`Procurar por ${managePrimaryLabelLower}...`}
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
                        />
                        <div className="hidden text-[12px] text-white/50 md:inline">⌘/</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setManageFiltersOpen((open) => (open === "status" ? null : "status"))}
                          className={cn(
                            "inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-3 py-2 text-[12px] font-semibold text-white/80 shadow-[0_14px_40px_rgba(0,0,0,0.35)] transition hover:bg-white/10",
                            eventStatusFilter !== "all" &&
                              "bg-gradient-to-r from-[#FF7AD1]/60 via-[#7FE0FF]/35 to-[#6A7BFF]/55 text-white shadow-[0_14px_36px_rgba(34,211,238,0.45)]",
                          )}
                        >
                          Estado: {statusLabelMap[eventStatusFilter]} <span className="text-white/50">▾</span>
                        </button>
                        {manageFiltersOpen === "status" && (
                          <div className="absolute left-0 z-[var(--z-popover)] mt-2 w-48 rounded-2xl orya-menu-surface p-2 backdrop-blur-2xl animate-popover">
                            <p className="px-2 pb-1 text-[10px] uppercase tracking-[0.22em] text-white/50">Estado</p>
                            {(["all", "active", "ongoing", "finished", "draft", "archived"] as const).map((key) => (
                              <button
                                key={key}
                                type="button"
                                onClick={() => {
                                  setEventStatusFilter(key);
                                  setManageFiltersOpen(null);
                                }}
                                className={cn(
                                  "orya-menu-item text-[12px]",
                                  eventStatusFilter === key ? "bg-[var(--orya-menu-hover)] text-white" : "text-white/80",
                                )}
                              >
                                {statusLabelMap[key]}
                                {eventStatusFilter === key && <span className="text-white/60">✓</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setManageFiltersOpen((open) => (open === "period" ? null : "period"))}
                          className={cn(
                            "inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-3 py-2 text-[12px] font-semibold text-white/80 shadow-[0_14px_40px_rgba(0,0,0,0.35)] transition hover:bg-white/10",
                            timeScope !== "all" &&
                              "bg-gradient-to-r from-[#FF7AD1]/60 via-[#7FE0FF]/35 to-[#6A7BFF]/55 text-white shadow-[0_14px_36px_rgba(34,211,238,0.45)]",
                          )}
                        >
                          Período: {timeScopeLabels[timeScope]} <span className="text-white/50">▾</span>
                        </button>
                        {manageFiltersOpen === "period" && (
                          <div className="absolute left-0 z-[var(--z-popover)] mt-2 w-44 rounded-2xl orya-menu-surface p-2 backdrop-blur-2xl animate-popover">
                            <p className="px-2 pb-1 text-[10px] uppercase tracking-[0.22em] text-white/50">Período</p>
                            {(["all", "upcoming", "ongoing", "past"] as const).map((key) => (
                              <button
                                key={key}
                                type="button"
                                onClick={() => {
                                  setTimeScope(key);
                                  setManageFiltersOpen(null);
                                }}
                                className={cn(
                                  "orya-menu-item text-[12px]",
                                  timeScope === key ? "bg-[var(--orya-menu-hover)] text-white" : "text-white/80",
                                )}
                              >
                                {timeScopeLabels[key]}
                                {timeScope === key && <span className="text-white/60">✓</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setManageFiltersOpen((open) => (open === "filters" ? null : "filters"))}
                          className={cn(
                            "inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-3 py-2 text-[12px] font-semibold text-white/80 shadow-[0_14px_40px_rgba(0,0,0,0.35)] transition hover:bg-white/10",
                            activeFilterCount > 0 &&
                              "bg-gradient-to-r from-[#FF7AD1]/60 via-[#7FE0FF]/35 to-[#6A7BFF]/55 text-white shadow-[0_14px_36px_rgba(34,211,238,0.45)]",
                          )}
                        >
                          Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""} <span className="text-white/50">▾</span>
                        </button>
                        {manageFiltersOpen === "filters" && (
                          <div className="absolute right-0 z-[var(--z-popover)] mt-2 w-[260px] rounded-2xl orya-menu-surface p-3 backdrop-blur-2xl animate-popover">
                            <div className="flex items-center justify-between px-1 pb-2 text-[10px] uppercase tracking-[0.22em] text-white/50">
                              <span>Filtros</span>
                              {activeFilterCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEventStatusFilter("all");
                                    setEventCategoryFilter("all");
                                    setEventPartnerClubFilter("all");
                                    setSearchTerm("");
                                    setTimeScope("all");
                                    setManageFiltersOpen(null);
                                  }}
                                  className="text-[10px] font-semibold text-white/70 hover:text-white"
                                >
                                  Limpar tudo
                                </button>
                              )}
                            </div>

                            <div className="space-y-2">
                              <div>
                                <p className="px-1 pb-1 text-[10px] uppercase tracking-[0.2em] text-white/40">Categoria</p>
                                <div className="space-y-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEventCategoryFilter("all");
                                      setManageFiltersOpen(null);
                                    }}
                                    className={cn(
                                      "orya-menu-item text-[12px]",
                                      eventCategoryFilter === "all"
                                        ? "bg-[var(--orya-menu-hover)] text-white"
                                        : "text-white/80",
                                    )}
                                  >
                                    Todas
                                    {eventCategoryFilter === "all" && <span className="text-white/60">✓</span>}
                                  </button>
                                  {categoryOptions.length === 0 && (
                                    <div className="px-2 py-2 text-[12px] text-white/45">Sem categorias.</div>
                                  )}
                                  {categoryOptions.map((cat) => (
                                    <button
                                      key={cat}
                                      type="button"
                                      onClick={() => {
                                        setEventCategoryFilter(cat);
                                        setManageFiltersOpen(null);
                                      }}
                                      className={cn(
                                        "orya-menu-item text-[12px]",
                                        eventCategoryFilter === cat
                                          ? "bg-[var(--orya-menu-hover)] text-white"
                                          : "text-white/80",
                                      )}
                                    >
                                      {cat}
                                      {eventCategoryFilter === cat && <span className="text-white/60">✓</span>}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <p className="px-1 pb-1 text-[10px] uppercase tracking-[0.2em] text-white/40">Clube</p>
                                <div className="space-y-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEventPartnerClubFilter("all");
                                      setManageFiltersOpen(null);
                                    }}
                                    className={cn(
                                      "orya-menu-item text-[12px]",
                                      eventPartnerClubFilter === "all"
                                        ? "bg-[var(--orya-menu-hover)] text-white"
                                        : "text-white/80",
                                    )}
                                  >
                                    Todos
                                    {eventPartnerClubFilter === "all" && <span className="text-white/60">✓</span>}
                                  </button>
                                  {partnerClubOptions.length === 0 && (
                                    <div className="px-2 py-2 text-[12px] text-white/45">Sem clubes.</div>
                                  )}
                                  {partnerClubOptions.map((club) => (
                                    <button
                                      key={club.id}
                                      type="button"
                                      onClick={() => {
                                        setEventPartnerClubFilter(`${club.id}`);
                                        setManageFiltersOpen(null);
                                      }}
                                      className={cn(
                                        "orya-menu-item text-[12px]",
                                        eventPartnerClubFilter === `${club.id}`
                                          ? "bg-[var(--orya-menu-hover)] text-white"
                                          : "text-white/80",
                                      )}
                                    >
                                      {club.name}
                                      {eventPartnerClubFilter === `${club.id}` && <span className="text-white/60">✓</span>}
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
                                  setManageFiltersOpen(null);
                                }}
                                className={cn(CTA_SECONDARY, "w-full text-[12px]")}
                              >
                                Limpar filtros
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="inline-flex items-center rounded-2xl border border-white/15 bg-white/5 p-1 text-[12px]">
                        <button
                          type="button"
                          onClick={() => setEventView("list")}
                          className={cn(
                            "rounded-xl px-3 py-1.5 font-semibold transition",
                            eventView === "list"
                              ? "bg-gradient-to-r from-[#FF7AD1]/60 via-[#7FE0FF]/35 to-[#6A7BFF]/55 text-white shadow-[0_14px_36px_rgba(34,211,238,0.45)]"
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
                              ? "bg-gradient-to-r from-[#FF7AD1]/60 via-[#7FE0FF]/35 to-[#6A7BFF]/55 text-white shadow-[0_14px_36px_rgba(34,211,238,0.45)]"
                              : "text-white/70 hover:bg-white/10",
                          )}
                        >
                          Galeria
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="relative z-10 mt-4 space-y-4">
                {activeFilterCount > 0 && (
                  <div className="relative z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-white/12 bg-gradient-to-r from-white/8 via-white/6 to-white/4 px-3 py-2 text-[12px] text-white/80 shadow-[0_12px_36px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
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
                      <h3 className="text-lg font-semibold">{managePrimaryLabel}</h3>
                      <span className="text-[11px] rounded-full bg-white/10 px-2 py-0.5">{filteredEvents.length}</span>
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
                  <p className="font-semibold">Não foi possível carregar.</p>
                  <p className="text-[12px] text-red-100/80">Tenta novamente.</p>
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

            {!eventsListLoading && eventsList.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-8 text-center text-sm text-white/70 space-y-3">
                <svg
                  viewBox="0 0 240 160"
                  role="img"
                  aria-label={`Sem ${managePrimaryLabelLower}s`}
                  className="mx-auto h-32 w-32"
                >
                  <defs>
                    <linearGradient id="calendarGlow" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.5" />
                      <stop offset="50%" stopColor="#FF7AD1" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#6A7BFF" stopOpacity="0.5" />
                    </linearGradient>
                  </defs>
                  <rect x="32" y="34" width="176" height="104" rx="18" fill="rgba(255,255,255,0.06)" stroke="url(#calendarGlow)" strokeWidth="2" />
                  <rect x="32" y="34" width="176" height="22" rx="12" fill="rgba(255,255,255,0.12)" />
                  <circle cx="64" cy="30" r="8" fill="rgba(255,255,255,0.25)" />
                  <circle cx="176" cy="30" r="8" fill="rgba(255,255,255,0.25)" />
                  <rect x="70" y="74" width="36" height="28" rx="8" fill="rgba(255,255,255,0.12)" />
                  <rect x="118" y="74" width="36" height="28" rx="8" fill="rgba(255,255,255,0.12)" />
                  <rect x="166" y="74" width="28" height="28" rx="8" fill="rgba(255,255,255,0.12)" />
                  <circle cx="54" cy="120" r="10" fill="rgba(34,211,238,0.4)" />
                  <circle cx="186" cy="120" r="10" fill="rgba(255,122,209,0.4)" />
                  <path
                    d="M120 96c6 0 10-6 10-12h-20c0 6 4 12 10 12Z"
                    fill="rgba(255,255,255,0.5)"
                  />
                  <path
                    d="M112 96h16v10c0 4-4 8-8 8s-8-4-8-8V96Z"
                    fill="rgba(255,255,255,0.25)"
                  />
                </svg>
                <p className="text-base font-semibold text-white">
                  Ainda sem {managePrimaryLabelLower}s.
                </p>
                <p className="text-white/65">Cria o primeiro para começar.</p>
              </div>
            )}

            {!eventsListLoading && eventsList.length > 0 && filteredEvents.length === 0 && (
              <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-6 text-center text-sm text-white/70 space-y-2">
                <p className="text-base font-semibold text-white">
                  Sem resultados.
                </p>
                <p className="text-white/65">Troca o período ou limpa filtros.</p>
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
                    href={manageCreateMeta.href}
                    className={cn(CTA_PRIMARY, "text-[12px]")}
                  >
                    {manageCreateMeta.label}
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
                              <th className="px-4 py-3 font-semibold">
                                {managePrimarySingularLabel.charAt(0).toUpperCase() + managePrimarySingularLabel.slice(1)}
                              </th>
                              <th className="px-4 py-3 font-semibold">Data</th>
                              <th className="px-4 py-3 font-semibold">Estado</th>
                              <th className="px-4 py-3 font-semibold">Tipo</th>
                              <th className="px-4 py-3 font-semibold">{salesUnitLabel}</th>
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
                                      ? { label: "Rascunho", classes: "border-white/20 bg-white/5 text-white/70" }
                                      : isOngoing
                                        ? { label: "A decorrer", classes: "border-emerald-400/60 bg-emerald-500/10 text-emerald-100" }
                                        : isFuture
                                          ? { label: "Publicado", classes: "border-sky-400/60 bg-sky-500/10 text-sky-100" }
                                          : isFinished
                                            ? { label: "Concluído", classes: "border-purple-400/60 bg-purple-500/10 text-purple-100" }
                                            : { label: ev.status, classes: "border-white/20 bg-white/5 text-white/70" };
                              const salesLabel = normalizedTemplate === "PADEL" ? "Inscrições" : "Bilhetes";

                              return (
                                <tr key={ev.id} className="hover:bg-white/10 transition duration-150">
                                  <td className="px-4 py-3">
                                    <Link
                                      href={`${eventRouteBase}/${ev.id}`}
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
                                        href={`${eventRouteBase}/${ev.id}/edit`}
                                        className={cn(CTA_SECONDARY, "px-3 py-1 text-[11px]")}
                                      >
                                        Editar
                                      </Link>
                                      <Link
                                        href={`${eventRouteBase}/${ev.id}`}
                                        className={cn(CTA_SECONDARY, "px-3 py-1 text-[11px]")}
                                      >
                                        Operação
                                      </Link>
                                      {ev.status !== "ARCHIVED" && (
                                        <Link
                                          href={`${eventRouteBase}/${ev.id}`}
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
                          const cardSalesLabel = normalizedTemplate === "PADEL" ? "Inscrições" : "Bilhetes";
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
                                  ? { label: "Rascunho", classes: "border-white/20 bg-white/5 text-white/70" }
                                  : isOngoing
                                    ? { label: "A decorrer", classes: "border-emerald-400/60 bg-emerald-500/10 text-emerald-100" }
                                    : isFuture
                                      ? { label: "Publicado", classes: "border-sky-400/60 bg-sky-500/10 text-sky-100" }
                                      : isFinished
                                      ? { label: "Concluído", classes: "border-purple-400/60 bg-purple-500/10 text-purple-100" }
                                      : { label: ev.status, classes: "border-white/20 bg-white/5 text-white/70" };
                          const coverSuggestions = getEventCoverSuggestionIds({
                            templateType: normalizedTemplate,
                            primaryModule: organization?.primaryModule ?? null,
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
                                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.12),transparent_55%),radial-gradient(circle_at_80%_30%,rgba(255,122,209,0.12),transparent_55%),linear-gradient(135deg,rgba(11,17,36,0.85),rgba(5,10,18,0.95))]" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-b from-[#050810]/35 via-[#050810]/75 to-[#050810]/95" />
                              </div>

                              <div className="relative z-10">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 space-y-1">
                                    <Link
                                      href={`${eventRouteBase}/${ev.id}`}
                                      className="text-lg font-semibold text-white hover:underline"
                                    >
                                      {ev.title}
                                    </Link>
                                    <p className="text-[12px] text-white/70">{dateLabel}</p>
                                    <p className="text-[12px] text-white/55">
                                      {ev.locationFormattedAddress || "Local a confirmar"}
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
                                    <p className="text-[11px] text-white/50">{cardSalesLabel}</p>
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
                                    href={`${eventRouteBase}/${ev.id}/edit`}
                                    className={cn(CTA_SECONDARY, "px-3 py-1 text-[11px]")}
                                  >
                                    Editar
                                  </Link>
                                  <Link
                                    href={`${eventRouteBase}/${ev.id}`}
                                    className={cn(CTA_SECONDARY, "px-3 py-1 text-[11px]")}
                                  >
                                    Operação
                                  </Link>
                                  {ev.status !== "ARCHIVED" && (
                                    <Link
                                      href={`${eventRouteBase}/${ev.id}`}
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

      {activeObjective === "manage" && activeSection === "inscricoes" && hasInscricoesModule && (
        <section className={cn("space-y-4", fadeClass)} id="inscricoes">
          <InscricoesPage embedded />
        </section>
      )}

      {activeObjective === "manage" && activeSection === PADEL_CLUB_SECTION && showPadelHub && (
        <section className={cn("space-y-4", fadeClass)} id={PADEL_CLUB_SECTION}>
          {organization?.id ? (
            <PadelHubSection
              organizationId={organization.id}
              organizationKind={organization.organizationKind ?? null}
              toolMode="CLUB"
              canEditPadel={canAccessTorneios}
            />
          ) : (
            <div className="rounded-2xl border border-white/12 bg-white/5 px-4 py-6 text-sm text-white/70">
              Organização indisponível para carregar o hub.
            </div>
          )}
        </section>
      )}

      {activeObjective === "manage" && activeSection === PADEL_TOURNAMENTS_SECTION && showPadelHub && (
        <section className={cn("space-y-4", fadeClass)} id={PADEL_TOURNAMENTS_SECTION}>
          {organization?.id ? (
            <PadelHubSection
              organizationId={organization.id}
              organizationKind={organization.organizationKind ?? null}
              toolMode="TOURNAMENTS"
              canEditPadel={canAccessTorneios}
            />
          ) : (
            <div className="rounded-2xl border border-white/12 bg-white/5 px-4 py-6 text-sm text-white/70">
              Organização indisponível para carregar o hub.
            </div>
          )}
        </section>
      )}

      {activeObjective === "manage" && activeSection === "reservas" && (
        <section className={cn("space-y-4", fadeClass)} id="reservas">
          <ReservasDashboardPage />
        </section>
      )}

      {activeObjective === "analyze" && (
        <section className={cn("space-y-3", fadeClass)} id="analisar">
          <div className="rounded-3xl border border-white/12 bg-gradient-to-r from-[#0b1226]/80 via-[#101b39]/75 to-[#050811]/90 px-4 py-4 sm:px-6 sm:py-5 backdrop-blur-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl sm:text-3xl font-semibold text-white drop-shadow-[0_12px_45px_rgba(0,0,0,0.6)]">
                  {activeSection === "overview"
                    ? "Resumo financeiro"
                    : activeSection === "vendas"
                      ? "Vendas"
                      : activeSection === "financas" && financeFocus === "payouts"
                        ? "Transferências"
                      : activeSection === "financas" && financeFocus === "refunds"
                          ? "Reembolsos"
                      : activeSection === "invoices"
                        ? "Faturação"
                        : activeSection === "ops"
                          ? "Operações"
                          : "Finanças"}
                </h2>
              </div>
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
                        className="relative mt-2 inline-flex text-[11px] text-[#22D3EE] hover:underline"
                      >
                        Ver {managePrimaryLabelLower} →
                      </Link>
                    )}
                  </div>
                ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-[#0b1226]/80 via-[#101c38]/75 to-[#050810]/95 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.55)]">
              <p className="text-[11px] uppercase tracking-[0.26em] text-white/60">Faturação</p>
              <h3 className="text-lg font-semibold text-white">Recibos e documentos</h3>
              <p className="text-[12px] text-white/65">Invoices e dados fiscais.</p>
              <Link
                href={organization?.id ? `/org/${organization.id}/finance?view=invoicing` : "/org/finance?view=invoicing"}
                className={cn(CTA_SECONDARY, "mt-3 text-[12px]")}
              >
                Abrir faturação
              </Link>
            </div>
            <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-[#0a1120]/85 via-[#0b1428]/80 to-[#05080f]/95 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.55)]">
              <p className="text-[11px] uppercase tracking-[0.26em] text-white/60">Transferências</p>
              <h3 className="text-lg font-semibold text-white">Detalhe de receitas</h3>
              <p className="text-[12px] text-white/65">Detalhe de reservas e releases.</p>
              <Link
                href={organization?.id ? `/org/${organization.id}/finance` : "/org/finance"}
                className={cn(CTA_SECONDARY, "mt-3 text-[12px]")}
              >
                Ver detalhe
              </Link>
            </div>
          </div>

          {analyticsDimensions?.ok && (
            <div className="rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-[12px] text-white/70">
              Dimensões macro/micro ativas:{" "}
              <span className="font-semibold text-white">{Object.keys(analyticsDimensions.items ?? {}).length}</span>
            </div>
          )}

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
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/70">
                  {salesUnitLabel} &amp; Vendas
                </p>
                <h2 className="text-2xl font-semibold text-white">Vendas por {managePrimaryLabelLower}</h2>
                <p className="text-sm text-white/70">Escolhe um {managePrimaryLabelLower} para ver evolução.</p>
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
                <label className="text-xs uppercase tracking-[0.18em] text-white/65 block mb-1">
                  {managePrimaryLabelTitle}
                </label>
                <select
                  value={salesEventId ?? ""}
                  onChange={(e) => setSalesEventId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#22D3EE] focus:ring-2 focus:ring-[rgba(34,211,238,0.35)]"
                >
                  <option value="">Seleciona</option>
                  {eventsList.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title}
                    </option>
                  ))}
                </select>
              </div>
              {!eventsList.length && <span className="text-[12px] text-white/65">Sem {managePrimaryLabelLower}s.</span>}
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
                Seleciona um {managePrimaryLabelLower} para ver métricas.
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
                Sem dados neste período.
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
                  <p className="text-[11px] text-white/60">{salesCountLabel}</p>
                  <p className="text-2xl font-bold text-white mt-1">{salesKpis.tickets}</p>
                  <p className="text-[11px] text-white/50">No período</p>
                </div>
                <div className="rounded-2xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/70 to-[#050912]/90 p-3 shadow-[0_14px_45px_rgba(0,0,0,0.5)]">
                  <p className="text-[11px] text-white/60">{managePrimaryLabel} com vendas</p>
                  <p className="text-2xl font-bold text-white mt-1">{salesKpis.eventsWithSales}</p>
                  <p className="text-[11px] text-white/50">≥1 venda</p>
                </div>
                <div className="rounded-2xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/70 to-[#050912]/90 p-3 shadow-[0_14px_45px_rgba(0,0,0,0.5)]">
                  <p className="text-[11px] text-white/60">Ocupação média</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {salesKpis.avgOccupancy !== null ? `${salesKpis.avgOccupancy}%` : "—"}
                  </p>
                  <p className="text-[11px] text-white/50">Só com capacidade</p>
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
                  <span className="text-white/40 text-xs">Escolhe um {managePrimaryLabelLower}.</span>
                ) : salesSeries?.points?.length ? (
                  <SalesAreaChart
                    data={salesChartPoints}
                    periodLabel={salesRangeLabelLong(salesRange)}
                  />
              ) : (
                <span className="text-white/40 text-xs">Sem dados.</span>
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
                <h3 className="text-lg font-semibold">{managePrimaryLabel} com mais vendas</h3>
                <p className="text-[11px] text-white/60">Maior receita.</p>
              </div>
            </div>

            {topEvents.length === 0 && (
              <p className="text-sm text-white/60">Sem {managePrimaryLabelLower}s com vendas.</p>
            )}
            {topEvents.length > 0 && (
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-[11px] text-white/60">
                    <tr>
                      <th className="py-2 pr-3">{managePrimaryLabelTitle}</th>
                      <th className="py-2 pr-3">{salesUnitLabel}</th>
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
                            ? { label: "Rascunho", classes: "border-white/20 bg-white/5 text-white/70" }
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
                                href={
                                  scopedOrganizationId
                                    ? `/org/${scopedOrganizationId}/analytics?view=buyers&eventId=${ev.id}`
                                    : `/org/analytics?view=buyers&eventId=${ev.id}`
                                }
                                className={cn(CTA_SECONDARY, "px-3 py-1 text-[11px]")}
                              >
                                Ver vendas
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
                <p className="text-[11px] text-white/60">Lista rápida. Exporta CSV.</p>
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
              <p className="text-sm text-white/60">Escolhe um {managePrimaryLabelLower}.</p>
            )}
            {!buyersLoading && salesEventId && buyers && buyers.ok === false && (
              <p className="text-sm text-red-400">Não foi possível carregar os compradores.</p>
            )}
            {!buyersLoading && salesEventId && buyers && buyers.ok !== false && buyersItems.length === 0 && (
              <p className="text-sm text-white/60">Sem compras.</p>
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
          {showFinanceStripeStateBanners && paymentsMode === "CONNECT" && paymentsStatus !== "READY" && (
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
                    {stripeIncomplete ? "Configuração incompleta no Stripe." : "Liga o Stripe para começar a receber."}
                  </p>
                  <p className="text-[12px] text-amber-100/85">
                    {paymentsStatus === "NO_STRIPE"
                      ? "Sem Stripe não há transferências."
                      : stripeRequirements.length > 0
                        ? `Faltam ${stripeRequirements.length} passos.`
                        : "Conclui a configuração para transferências."}
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
          {showFinanceStripeStateBanners && paymentsMode === "PLATFORM" && (
            <div className="rounded-2xl border border-emerald-400/45 bg-gradient-to-r from-emerald-500/20 via-emerald-500/15 to-teal-500/20 px-4 py-3 text-sm text-emerald-50 shadow-[0_18px_60px_rgba(0,0,0,0.55)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  <p className="font-semibold">Conta interna ORYA</p>
                  <p className="text-[12px] text-emerald-50/85">
                    Pagamentos na conta ORYA. Sem Stripe Connect.
                  </p>
                </div>
              </div>
            </div>
          )}
          {showFinanceStripeStateBanners && stripeSuccessMessage && (
            <div className="rounded-2xl border border-emerald-400/45 bg-gradient-to-r from-emerald-500/20 via-emerald-500/15 to-teal-500/20 px-4 py-3 text-sm text-emerald-50 shadow-[0_18px_60px_rgba(0,0,0,0.55)]">
              {stripeSuccessMessage}
            </div>
          )}

          {showFinanceControlPanel && (
            <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/92 backdrop-blur-3xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-semibold text-white">Controlos financeiros</h3>
                <div className="text-[11px] text-white/60">
                  {financeExportRange.from} → {financeExportRange.to}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleUpdateInvoicing("MANUAL_OUTSIDE_ORYA")}
                  disabled={financeActionSaving !== null}
                  className={cn(CTA_SECONDARY, "px-3 py-1 text-[11px] disabled:opacity-60")}
                >
                  Faturação manual
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateInvoicing("EXTERNAL_SOFTWARE")}
                  disabled={financeActionSaving !== null}
                  className={cn(CTA_SECONDARY, "px-3 py-1 text-[11px] disabled:opacity-60")}
                >
                  Software externo
                </button>
                <button
                  type="button"
                  onClick={handlePayoutSettingsHardcut}
                  disabled={financeActionSaving !== null}
                  className={cn(CTA_SECONDARY, "px-3 py-1 text-[11px] disabled:opacity-60")}
                >
                  Guardar transferência
                </button>
                <a href={buildFinanceExportHref("fees")} className={cn(CTA_SECONDARY, "px-3 py-1 text-[11px]")} download>
                  Taxas CSV
                </a>
                <a href={buildFinanceExportHref("ledger")} className={cn(CTA_SECONDARY, "px-3 py-1 text-[11px]")} download>
                  Livro-razão CSV
                </a>
                <a href={buildFinanceExportHref("payouts")} className={cn(CTA_SECONDARY, "px-3 py-1 text-[11px]")} download>
                  Transferências CSV
                </a>
              </div>
              <div className="text-[12px] text-white/70">
                Modo:{" "}
                <span className="font-semibold text-white">
                  {financeInvoicingModeLabel}
                </span>
              </div>
              {financeActionMessage && (
                <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-100">
                  {financeActionMessage}
                </div>
              )}
              {financeActionError && (
                <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-100">
                  {financeActionError}
                </div>
              )}
            </div>
          )}

          {showFinanceSummaryCards && (
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
                },
                {
                  label: "Receita últimos 30d",
                  value:
                    financeData?.rolling.last30.netCents !== undefined
                      ? `${(financeData.rolling.last30.netCents / 100).toFixed(2)} €`
                      : "—",
                },
                {
                  label: "Taxas",
                  value:
                    financeData?.totals.feesCents !== undefined
                      ? `${(financeData.totals.feesCents / 100).toFixed(2)} €`
                      : financeSummary
                        ? `${(financeSummary.platformFeesCents / 100).toFixed(2)} €`
                        : "—",
                },
                {
                  label: `${managePrimaryLabel} com vendas`,
                  value: financeData?.totals.eventsWithSales ?? financeSummary?.eventsWithSales ?? "—",
                },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-2xl border border-white/12 bg-gradient-to-br from-white/10 via-[#0b1124]/65 to-[#050810]/90 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
                >
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/70">{card.label}</p>
                  <p className="mt-1 text-2xl font-bold text-white drop-shadow-[0_10px_25px_rgba(0,0,0,0.45)]">{card.value}</p>
                </div>
              ))}
            </div>
          )}

          {(showFinanceStripeCard || showFinancePayoutInfoCard) && (
            <div className={cn("grid gap-4", showFinanceStripeCard && showFinancePayoutInfoCard ? "md:grid-cols-2" : "md:grid-cols-1")}>
              {showFinanceStripeCard && (
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
                    <p className="text-white/70">Transferências: {organization.stripePayoutsEnabled ? "Ativo" : "Inativo"}</p>
                  </div>
                  <div className="text-[11px] text-white/75 space-y-2">
                    <p>{stripeState.desc}</p>
                    {stripeRequirements.length > 0 && (
                      <p className="text-white/70">
                        {stripeRequirements.length} itens pendentes.
                      </p>
                    )}
                  </div>
                  {stripeCtaError && <div className="text-xs text-red-300">{stripeCtaError}</div>}
                </div>
              )}

              {showFinancePayoutInfoCard && (
                <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/10 via-[#0b1124]/70 to-[#050810]/90 backdrop-blur-3xl p-4 space-y-3">
                  <h3 className="text-lg font-semibold text-white">Transferências</h3>
                  <div className="grid gap-2 sm:grid-cols-2 text-sm">
                    <div className="rounded-2xl border border-white/12 bg-white/8 p-3">
                      <p className="text-white/70 text-xs">Próxima transferência (estimada)</p>
                      <p className="text-xl font-semibold text-white">
                        {financeData ? (financeData.upcomingPayoutCents / 100).toFixed(2) : financeSummary ? (financeSummary.estimatedPayoutCents / 100).toFixed(2) : "—"} €
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/12 bg-white/8 p-3">
                      <p className="text-white/70 text-xs">Receita bruta (total)</p>
                      <p className="text-xl font-semibold text-white">
                        {financeData ? (financeData.totals.grossCents / 100).toFixed(2) : financeSummary ? (financeSummary.revenueCents / 100).toFixed(2) : "—"} €
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 text-sm">
                    <div className="rounded-2xl border border-white/12 bg-white/8 p-3">
                      <p className="text-white/70 text-xs">Taxas acumuladas</p>
                      <p className="text-xl font-semibold text-white">
                        {financeData ? (financeData.totals.feesCents / 100).toFixed(2) : financeSummary ? (financeSummary.platformFeesCents / 100).toFixed(2) : "—"} €
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/12 bg-white/8 p-3">
                      <p className="text-white/70 text-xs">{managePrimaryLabel} com vendas</p>
                      <p className="text-xl font-semibold text-white">
                        {financeData ? financeData.totals.eventsWithSales : financeSummary ? financeSummary.eventsWithSales : "—"}
                      </p>
                    </div>
                  </div>
                  {payoutAlerts && (
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {payoutAlerts.holdUntil && (
                        <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-white/80">
                          Pendente (em espera até{" "}
                          {formatDateTime(new Date(payoutAlerts.holdUntil), {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          )
                        </span>
                      )}
                      {payoutAlerts.actionRequired && (
                        <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-amber-100">
                          Ação necessária: completar Stripe
                        </span>
                      )}
                      {payoutAlerts.nextAttemptAt && (
                        <span className="rounded-full border border-sky-300/40 bg-sky-300/10 px-3 py-1 text-sky-100">
                          A tentar novamente em:{" "}
                          {formatDateTime(new Date(payoutAlerts.nextAttemptAt), {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {showFinanceLedgerTable && (
            <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/92 backdrop-blur-3xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Por {managePrimaryLabelLower}</h3>
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

              {!financeData && <p className="text-sm text-white/60">A carregar…</p>}
              {financeData && financeData.events.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-4 text-sm text-white/70">
                  Sem vendas ainda.
                </div>
              )}

              {financeData && financeData.events.length > 0 && (
                <div className="overflow-auto">
                  <table className="min-w-full text-sm text-white/80">
                    <thead className="text-left text-[11px] uppercase tracking-wide text-white/60">
                      <tr>
                        <th className="px-4 py-3">{managePrimaryLabelTitle}</th>
                        <th className="px-4 py-3">{salesUnitLabel}</th>
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
                                {ev.startsAt ? formatDateOnly(new Date(ev.startsAt)) : "Data por definir"}
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
          )}

          {showFinancePayoutsPanel && <PayoutsPanel />}
          {showFinanceRefundsPanel && <RefundsPanel />}
        </section>
      )}

      {activeObjective === "analyze" && activeSection === "invoices" && (
        <section className={cn("space-y-4", fadeClass)} id="invoices">
          <InvoicesClient
            basePath={organization?.id ? `/org/${organization.id}/finance?view=invoicing` : "/org/finance?view=invoicing"}
            fullWidth
            organizationId={organization?.id ?? null}
          />
        </section>
      )}

      {activeObjective === "analyze" && activeSection === "ops" && (
        <section className={cn("space-y-4", fadeClass)} id="ops">
          <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/10 via-[#0d1530]/75 to-[#050912]/90 px-5 py-4 backdrop-blur-3xl">
            <h2 className="text-3xl font-semibold text-white drop-shadow-[0_12px_40px_rgba(0,0,0,0.55)]">Feed operacional</h2>
            <p className="text-sm text-white/70">Atividade operacional recente com correlação.</p>
          </div>
          {!opsFeed && (
            <div className="rounded-2xl border border-white/12 bg-white/5 px-4 py-4 text-sm text-white/70">
              A carregar feed operacional...
            </div>
          )}
          {opsFeed?.ok && (opsFeed.items?.length ?? 0) === 0 && (
            <div className="rounded-2xl border border-white/12 bg-white/5 px-4 py-4 text-sm text-white/70">
              Sem eventos no feed operacional.
            </div>
          )}
          {opsFeed?.ok && (opsFeed.items?.length ?? 0) > 0 && (
            <div className="rounded-2xl border border-white/12 bg-white/5 p-3">
              <div className="overflow-auto">
                <table className="min-w-full text-sm text-white/80">
                  <thead className="text-left text-[11px] uppercase tracking-wide text-white/60">
                    <tr>
                      <th className="px-3 py-2">Data</th>
                      <th className="px-3 py-2">Evento</th>
                      <th className="px-3 py-2">Origem</th>
                      <th className="px-3 py-2">Correlação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {(opsFeed.items ?? []).map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2 text-white/75">{formatDateTime(new Date(item.createdAt))}</td>
                        <td className="px-3 py-2 text-white">{item.eventType}</td>
                        <td className="px-3 py-2 text-white/70">
                          {item.sourceType ?? "—"} {item.sourceId ? `#${item.sourceId}` : ""}
                        </td>
                        <td className="px-3 py-2 text-white/60">{item.correlationId ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {opsFeed && !opsFeed.ok && (
            <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
              Não foi possível carregar o feed operacional.
            </div>
          )}
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
                <h2 className="text-2xl sm:text-3xl font-semibold text-white drop-shadow-[0_12px_45px_rgba(0,0,0,0.6)]">
                  Promoções
                </h2>
                <p className="text-sm text-white/70">Promoções e audiência.</p>
              </div>
            </div>
          </div>

          {!canPromote && (
            <div className="mt-4 rounded-2xl border border-white/12 bg-white/5 px-4 py-4 text-sm text-white/70">
              Sem permissões para promoções.
            </div>
          )}

          {canPromote && !hasMarketingModule && (
            <div className="mt-4 rounded-2xl border border-white/12 bg-white/5 px-4 py-4 text-sm text-white/70">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">Ferramenta de Promoções desativada.</p>
                  <p className="text-[12px] text-white/60">Ativa a ferramenta para usar promoções e campanhas.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setToolsModalOpen(true)}
                  className={cn(CTA_SECONDARY, "text-[12px]")}
                >
                  Ativar ferramenta
                </button>
              </div>
            </div>
          )}

          {canUseMarketing && marketingSection === "overview" && (
            <div className={cn("mt-4 space-y-4", fadeClass)}>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {marketingOverview
                ? [
                    {
                      label: "Receita atribuída a promoções",
                      value: marketingKpis.marketingRevenueCents ? `${(marketingKpis.marketingRevenueCents / 100).toFixed(2)} €` : "—",
                      hint: "Estimado via códigos.",
                    },
                    {
                      label: `${salesUnitLabel} via promoções`,
                      value: marketingKpis.ticketsWithPromo,
                      hint: "Usos de códigos.",
                    },
                    {
                      label: "Top código",
                      value: marketingKpis.topPromo ? marketingKpis.topPromo.code : "—",
                      hint: marketingKpis.topPromo ? `${marketingKpis.topPromo.redemptionsCount ?? 0} usos` : "Sem dados.",
                    },
                    {
                      label: "Códigos promocionais ativos",
                      value: marketingKpis.activePromos,
                      hint: "Ativos agora.",
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
                  <h3 className="text-lg font-semibold text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.45)]">Encher a casa</h3>
                  <p className="text-[12px] text-white/65">Ações sugeridas.</p>
                </div>
                <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[12px] text-white/70">
                  Ações sugeridas
                </span>
              </div>

              {fillTheRoomEvents.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-4 text-sm text-white/70">
                  Sem {managePrimaryLabelLower}s futuros.
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
                              : "Data por definir"}
                          </span>
                          <span>·</span>
                          <span>{ev.locationFormattedAddress || "Local a anunciar"}</span>
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
                            href={appendOrganizationIdToHref("/org/marketing?marketing=promos", scopedOrganizationId)}
                            className={cn(CTA_SECONDARY, "px-3 py-1 text-[11px]")}
                          >
                            {ev.tag.suggestion}
                          </Link>
                          <Link
                            href={`${eventRouteBase}/${ev.id}/edit`}
                            className={cn(CTA_SECONDARY, "px-3 py-1 text-[11px]")}
                          >
                            Editar {managePrimaryLabelTitle.toLowerCase()}
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
                  <h4 className="text-lg font-semibold text-white">Funil de promoções (v1)</h4>
                  <p className="text-[12px] text-white/65">Totais vs promo vs convidados.</p>
                </div>
                <span className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white/70">Baseado em códigos</span>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {[
                  { label: `${salesUnitLabel} totais`, value: marketingKpis.totalTickets ?? "—" },
                  { label: `${salesUnitLabel} com promo`, value: marketingKpis.ticketsWithPromo ?? 0 },
                  { label: "Convidados", value: marketingKpis.guestTickets ?? 0 },
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

        {canUseMarketing && marketingSection === "promos" && (
          <div className={cn("mt-4", fadeClass)}>
            <PromoCodesPage />
          </div>
        )}

        {canUseMarketing && marketingSection === "promoters" && (
          <div className={cn("mt-4 space-y-3", fadeClass)}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-white">Promotores &amp; Parcerias</h3>
                <p className="text-[12px] text-white/65">
                  {roleFlags.isPromoterOnly ? "O teu desempenho por código." : "Pessoas e parceiros."}
                </p>
              </div>
              {!roleFlags.isPromoterOnly && (
                <button
                  type="button"
                  className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/70 cursor-not-allowed"
                  disabled
                >
                  Em breve
                </button>
              )}
            </div>
            {roleFlags.isPromoterOnly ? (
              <div className="rounded-3xl border border-white/10 bg-black/35 p-4 text-sm text-white/70 space-y-4">
                {marketingPromos.length === 0 ? (
                  <p className="text-[12px] text-white/65">
                    Ainda não tens códigos atribuídos. Pede à organização para criar um código com o teu nome.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {marketingPromos.map((promo) => {
                      const stats = promoStats.find((s) => s.promoCodeId === promo.id);
                      const event = promo.eventId
                        ? promoEvents.find((e) => e.id === promo.eventId) ?? null
                        : null;
                      const promoLink = event?.slug
                        ? `${window.location.origin}/eventos/${event.slug}?promo=${encodeURIComponent(promo.code)}&checkout=1`
                        : null;
                      return (
                        <div
                          key={promo.id}
                          className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_16px_45px_rgba(0,0,0,0.35)]"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Código</p>
                              <p className="text-lg font-semibold text-white">{promo.code}</p>
                              <p className="text-[12px] text-white/60">
                                {event?.title ?? "Código global"}
                              </p>
                            </div>
                            {promoLink && (
                              <button
                                type="button"
                                onClick={() => navigator.clipboard.writeText(promoLink)}
                                className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-white/70 hover:border-white/40"
                              >
                                Copiar link
                              </button>
                            )}
                          </div>
                          <div className="mt-3 grid gap-2 text-[12px] text-white/70 sm:grid-cols-3">
                            <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-white/50">Usos</p>
                              <p className="text-sm font-semibold text-white">{stats?.usesTotal ?? promo.redemptionsCount ?? 0}</p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-white/50">{salesUnitLabel}</p>
                              <p className="text-sm font-semibold text-white">{stats?.tickets ?? 0}</p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-white/50">Receita líquida</p>
                              <p className="text-sm font-semibold text-white">
                                {stats?.netCents ? `${(stats.netCents / 100).toFixed(2)} €` : "—"}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-3xl border border-white/10 bg-black/35 p-4 text-sm text-white/70 space-y-3">
                <p className="text-white/80 font-semibold">Em breve</p>
                <p className="text-[12px] text-white/65">Painel por promotor.</p>
              </div>
            )}
          </div>
        )}

        {canUseMarketing && marketingSection === "content" && (
          <div className={cn("mt-4 space-y-3", fadeClass)}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-white">Conteúdo &amp; Kits</h3>
                <p className="text-[12px] text-white/65">Textos rápidos por {managePrimaryLabelLower}.</p>
              </div>
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/70">Kit ativo</span>
            </div>
            <MarketingContentKit
              events={
                marketingOverview?.events && marketingOverview.events.length > 0
                  ? marketingOverview.events
                  : eventsList
              }
              promoCodes={marketingPromos}
              organizationId={scopedOrganizationId}
            />
          </div>
        )}
        </section>
      )}

      {checklistVisible && (
        <div className="fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6">
          <div
            className={cn(
              "rounded-3xl border border-white/15 bg-[#050a14]/95 text-white shadow-[0_24px_80px_rgba(0,0,0,0.65)] backdrop-blur-2xl",
              checklistCollapsed ? "p-2" : "p-4 w-[320px] max-w-[calc(100vw-2rem)]",
            )}
          >
            {checklistCollapsed ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleChecklist}
                  aria-label="Abrir checklist"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 transition hover:border-white/30 hover:bg-white/10"
                >
                  {renderChecklistRing(progressPercent)}
                </button>
                <button
                  type="button"
                  onClick={handleDismissChecklist}
                  aria-label="Fechar checklist"
                  disabled={!canDismissChecklist}
                  title={checklistDismissHint}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:border-white/30 hover:bg-white/10",
                    !canDismissChecklist && "cursor-not-allowed opacity-50 hover:border-white/15 hover:bg-white/5",
                  )}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M6 6l12 12M18 6l-12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {renderChecklistRing(progressPercent)}
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Checklist</p>
                      <p className="text-sm font-semibold text-white">
                        {checklistComplete ? "Tudo pronto" : `Progresso ${progressPercent}%`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleToggleChecklist}
                      aria-label="Recolher checklist"
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:border-white/30 hover:bg-white/10"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={handleDismissChecklist}
                      aria-label="Fechar checklist"
                      disabled={!canDismissChecklist}
                      title={checklistDismissHint}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:border-white/30 hover:bg-white/10",
                        !canDismissChecklist && "cursor-not-allowed opacity-50 hover:border-white/15 hover:bg-white/5",
                      )}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M6 6l12 12M18 6l-12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="mt-4 max-h-[50vh] space-y-2 overflow-y-auto pr-1">
                  {orderedChecklistSteps.map((step) => {
                    const iconGradient =
                      MODULE_ICON_GRADIENTS[step.iconKey] ?? "from-white/15 via-white/5 to-white/10";
                    return (
                      <Link
                        key={step.id}
                        href={step.href}
                        className="group flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:border-white/25 hover:bg-white/10"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "flex h-9 w-9 items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-br text-white/80",
                              iconGradient,
                            )}
                          >
                            <ModuleIcon moduleKey={step.iconKey} className="h-4 w-4" aria-hidden="true" />
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-[12px] font-semibold text-white/90">{step.label}</p>
                            <p className="text-[11px] text-white/60">{step.description}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {step.required && (
                            <span className="rounded-full border border-amber-300/40 bg-amber-400/10 px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-amber-100">
                              Obrigatório
                            </span>
                          )}
                          <span
                            className={cn(
                              "rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em]",
                              step.done
                                ? "border-emerald-300/40 bg-emerald-500/15 text-emerald-100"
                                : "border-white/15 bg-white/5 text-white/70",
                            )}
                          >
                            {step.done ? "Feito" : "Abrir"}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                  <div className="flex items-center justify-between text-[11px] text-white/60">
                    <span>
                      {completedSteps}/{summarySteps.length} concluídos
                    </span>
                    {!checklistComplete && (
                      <span className="text-white/45">
                        {requiredComplete ? "Passos opcionais pendentes" : "Passos obrigatórios pendentes"}
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {toolsModal}
      {pendingToolVisibilityRemoval && (
        <ConfirmDestructiveActionDialog
          open
          title={`Ocultar ${pendingToolVisibilityRemoval.title}?`}
          description="Esta ferramenta deixa de aparecer no dashboard, mas continua ativa no sistema."
          consequences={[
            "Podes voltar a mostrar a qualquer momento no gestor de ferramentas.",
            "As configurações e os dados da ferramenta mantêm-se.",
          ]}
          confirmLabel="Ocultar ferramenta"
          dangerLevel="medium"
          onConfirm={() => {
            hideDashboardTool(pendingToolVisibilityRemoval);
            setPendingToolVisibilityRemoval(null);
          }}
          onClose={() => setPendingToolVisibilityRemoval(null)}
        />
      )}
      {eventDialog && (
        <ConfirmDestructiveActionDialog
          open
          title={
            eventDialog.mode === "delete"
              ? "Apagar rascunho?"
              : eventDialog.mode === "unarchive"
                ? `Reativar ${eventDialogLabel}?`
                : `Arquivar ${eventDialogLabel}?`
          }
          description={
            eventDialog.mode === "delete"
              ? "Esta ação remove o rascunho e bilhetes associados."
              : eventDialog.mode === "unarchive"
                ? `O ${eventDialogLabel} volta a aparecer nas listas e dashboards.`
                : `O ${eventDialogLabel} deixa de estar visível para o público. Vendas e relatórios mantêm-se.`
          }
          consequences={
            eventDialog.mode === "delete"
              ? [`Podes criar outro ${eventDialogLabel} quando quiseres.`]
              : eventDialog.mode === "unarchive"
                ? ["Podes sempre voltar a arquivar mais tarde."]
                : ["Sai de /descobrir e das listas do dashboard.", "Mantém histórico para relatórios/finanças."]
          }
          confirmLabel={
            eventDialog.mode === "delete"
              ? "Apagar rascunho"
              : eventDialog.mode === "unarchive"
                ? `Reativar ${eventDialogLabel}`
                : `Arquivar ${eventDialogLabel}`
          }
          dangerLevel={eventDialog.mode === "delete" ? "high" : eventDialog.mode === "archive" ? "high" : "medium"}
          onConfirm={() => archiveEvent(eventDialog.ev, eventDialog.mode)}
          onClose={() => setEventDialog(null)}
        />
      )}
    </div>
  );
}

export default function DashboardClient({
  hasOrganization = false,
  defaultObjective,
  defaultSection,
}: { hasOrganization?: boolean } & DashboardClientDefaults) {
  return (
    <AuthModalProvider>
      <OrganizacaoPageInner
        hasOrganization={hasOrganization}
        defaultObjective={defaultObjective}
        defaultSection={defaultSection}
      />
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
