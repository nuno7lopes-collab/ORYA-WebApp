// app/eventos/[slug]/page.tsx
import { prisma } from "@/lib/prisma";
import { CheckoutProvider } from "@/app/components/checkout/contextoCheckout";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import WavesSectionClient, { type WaveTicket, type WaveStatus } from "./WavesSectionClient";
import Link from "next/link";
import EventPageClient from "./EventPageClient";
import PadelMatchesByCategoryClient from "./PadelMatchesByCategoryClient";
import EventDescriptionReadMore from "./EventDescriptionReadMore";
import { createSupabaseServer } from "@/lib/supabaseServer";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Image from "next/image";
import { defaultBlurDataURL, optimizeImageUrl } from "@/lib/image";
import { getEventCoverSuggestionIds, getEventCoverUrl } from "@/lib/eventCover";
import { buildPadelEventSnapshot } from "@/lib/padel/eventSnapshot";
import { checkPadelRegistrationWindow } from "@/domain/padelRegistration";
import { resolvePadelCompetitionState } from "@/domain/padelCompetitionState";
import type { CSSProperties } from "react";
import EventBackgroundTuner from "./EventBackgroundTuner";
import { normalizeEmail } from "@/lib/utils/email";
import { sanitizeUsername } from "@/lib/username";
import { Avatar } from "@/components/ui/avatar";
import { CTA_PRIMARY } from "@/app/org/_shared/dashboardUi";
import { getTicketCopy } from "@/app/components/checkout/checkoutCopy";
import { resolveEventLocation } from "@/lib/location/eventLocation";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { resolveTicketPricingSummary } from "@/domain/events/ticketPricing";
import { resolveInviteTokenGrant } from "@/lib/invites/inviteTokens";
import { formatCurrency, resolveLocale, t } from "@/lib/i18n";
import CrmEngagementTracker from "@/app/components/crm/CrmEngagementTracker";
import EventShareButton from "./EventShareButton";
import {
  ORYA_APP_INSTALL_CTA_LABEL,
  ORYA_APP_INSTALL_HINT,
  ORYA_APP_INSTALL_URL,
} from "@/lib/mobileAppInstall";

type EventPageParams = { slug: string };
type EventPageParamsInput = EventPageParams | Promise<EventPageParams>;
type EventPageSearchParams = Record<string, string | string[] | undefined>;
type EventPageSearchParamsInput = EventPageSearchParams | Promise<EventPageSearchParams>;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function generateMetadata(
  { params }: { params: EventPageParamsInput },
): Promise<Metadata> {
  const resolved = await params;
  const slug = resolved?.slug;
  const headersList = await headers();
  const acceptLanguage = headersList.get("accept-language");
  const locale = resolveLocale(acceptLanguage ? acceptLanguage.split(",")[0] : null);

  if (!slug) {
    return {
      title: t("eventMetaTitleDefault", locale),
      description: t("eventMetaDescDefault", locale),
    };
  }

  let event = await prisma.event.findFirst({
    where: { slug, isDeleted: false },
    select: {
      title: true,
      description: true,
      addressRef: { select: { formattedAddress: true } },
      organizationId: true,
      coverImageUrl: true,
    },
  });
  if (!event) {
    const normalized = slugify(slug);
    if (normalized && normalized !== slug) {
      event = await prisma.event.findFirst({
        where: { slug: normalized, isDeleted: false },
        select: {
          title: true,
          description: true,
          addressRef: { select: { formattedAddress: true } },
          organizationId: true,
          coverImageUrl: true,
        },
      });
    }
  }

  if (!event || !event.organizationId) {
    return {
      title: t("eventMetaNotFoundTitle", locale),
      description: t("eventMetaNotFoundDesc", locale),
    };
  }

  const location = event.addressRef?.formattedAddress || "ORYA";
  const baseTitle = event.title || t("eventMetaBaseTitle", locale);
  const baseUrl = getAppBaseUrl();
  const canonicalUrl = `${baseUrl}/eventos/${slug}`;
  const coverUrl = event.coverImageUrl
    ? event.coverImageUrl.startsWith("http")
      ? event.coverImageUrl
      : `${baseUrl}${event.coverImageUrl.startsWith("/") ? "" : "/"}${event.coverImageUrl}`
    : null;

  const description =
    event.description && event.description.trim().length > 0
      ? event.description
      : t("eventMetaDescFallback", locale)
          .replace("{event}", baseTitle)
          .replace("{location}", location);

  return {
    metadataBase: new URL(baseUrl),
    alternates: { canonical: canonicalUrl },
    title: `${baseTitle} | ORYA`,
    description,
    openGraph: {
      title: `${baseTitle} | ORYA`,
      description,
      url: canonicalUrl,
      type: "website",
      images: coverUrl ? [{ url: coverUrl }] : undefined,
    },
    twitter: {
      card: coverUrl ? "summary_large_image" : "summary",
      title: `${baseTitle} | ORYA`,
      description,
      images: coverUrl ? [coverUrl] : undefined,
    },
  };
}

const EVENT_BG_MASK = `linear-gradient(
  to bottom,
  rgba(0,0,0,var(--event-bg-mask-alpha-1,1)) var(--event-bg-mask-stop-1,0%),
  rgba(0,0,0,var(--event-bg-mask-alpha-2,0.98)) var(--event-bg-mask-stop-2,24%),
  rgba(0,0,0,var(--event-bg-mask-alpha-3,0.82)) var(--event-bg-mask-stop-3,46%),
  rgba(0,0,0,var(--event-bg-mask-alpha-4,0.5)) var(--event-bg-mask-stop-4,68%),
  rgba(0,0,0,var(--event-bg-mask-alpha-5,0.2)) var(--event-bg-mask-stop-5,86%),
  rgba(0,0,0,var(--event-bg-mask-alpha-6,0)) var(--event-bg-mask-stop-6,100%)
)`;

const EVENT_BG_OVERLAY = `linear-gradient(
  to bottom,
  rgba(var(--orya-route-bg-rgb,5,6,10),var(--event-bg-overlay-top,0.38)) 0%,
  rgba(var(--orya-route-bg-rgb,5,6,10),var(--event-bg-overlay-mid,0.22)) 45%,
  rgba(var(--orya-route-bg-rgb,5,6,10),var(--event-bg-overlay-bottom,0.06)) 100%
)`;

const EVENT_BG_FADE = `linear-gradient(
  to bottom,
  rgba(var(--orya-route-bg-rgb,5,6,10),0) 0%,
  rgba(var(--orya-route-bg-rgb,5,6,10),0) var(--event-bg-fade-start,78%),
  rgba(var(--orya-route-bg-rgb,5,6,10),var(--event-bg-fade-dark,0.78)) var(--event-bg-fade-mid,90%),
  rgba(var(--orya-route-bg-rgb,5,6,10),1) var(--event-bg-fade-end,99%)
)`;

function getWaveStatus(ticket: {
  startsAt: Date | null;
  endsAt: Date | null;
  totalQuantity: number | null;
  soldQuantity: number;
}) {
  const now = new Date();

  if (
    ticket.totalQuantity !== null &&
    ticket.totalQuantity !== undefined &&
    ticket.soldQuantity >= ticket.totalQuantity
  ) {
    return "sold_out" as const;
  }

  if (ticket.startsAt && now < ticket.startsAt) {
    return "upcoming" as const;
  }

  if (ticket.endsAt && now > ticket.endsAt) {
    return "closed" as const;
  }

  return "on_sale" as const;
}

export default async function EventPage({
  params,
  searchParams,
}: {
  params: EventPageParamsInput;
  searchParams?: EventPageSearchParamsInput;
}) {
  const { slug } = await params;
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const headersList = await headers();
  const langParam =
    typeof resolvedSearchParams?.lang === "string"
      ? resolvedSearchParams.lang
      : Array.isArray(resolvedSearchParams?.lang)
        ? resolvedSearchParams?.lang?.[0]
        : null;
  const acceptLanguage = headersList.get("accept-language");
  const locale = resolveLocale(langParam ?? (acceptLanguage ? acceptLanguage.split(",")[0] : null));

  if (!slug) {
    return notFound();
  }

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user
    ? await prisma.profile.findUnique({ where: { id: user.id } })
    : null;
  const isAdmin = Array.isArray(profile?.roles) ? profile.roles.includes("admin") : false;

  const eventSelect = {
    id: true,
    slug: true,
    title: true,
    description: true,
    startsAt: true,
    endsAt: true,
    addressId: true,
    addressRef: { select: { formattedAddress: true, canonical: true, latitude: true, longitude: true } },
    pricingMode: true,
    status: true,
    templateType: true,
    coverImageUrl: true,
    timezone: true,
    organizationId: true,
    ticketTypes: {
      select: {
        id: true,
        name: true,
        price: true,
        currency: true,
        publicAccess: true,
        totalQuantity: true,
        soldQuantity: true,
        startsAt: true,
        endsAt: true,
        status: true,
        sortOrder: true,
        padelEventCategoryLinkId: true,
        padelEventCategoryLink: {
          select: {
            padelCategoryId: true,
            category: { select: { label: true } },
          },
        },
      },
    },
    padelCategoryLinks: {
      select: {
        id: true,
        padelCategoryId: true,
        isEnabled: true,
        category: { select: { label: true } },
      },
    },
    padelTournamentConfig: {
      select: {
        padelV2Enabled: true,
        advancedSettings: true,
        lifecycleStatus: true,
        defaultCategoryId: true,
      },
    },
    accessPolicies: {
      orderBy: { policyVersion: "desc" },
      take: 1,
      select: { mode: true },
    },
    organization: {
      select: {
        username: true,
        publicName: true,
        businessName: true,
        brandingAvatarUrl: true,
        status: true,
      },
    },
  } satisfies Prisma.EventSelect;

  type EventWithTickets = Prisma.EventGetPayload<{ select: typeof eventSelect }>;

  const event = await prisma.event.findFirst({
    where: { slug, isDeleted: false },
    select: eventSelect,
  });
  if (!event || !event.organizationId) {
    const normalized = slugify(slug);
    if (normalized && normalized !== slug) {
      const fallback = await prisma.event.findFirst({
        where: { slug: normalized, isDeleted: false },
        select: eventSelect,
      });
      if (fallback && fallback.organizationId) {
        redirect(`/eventos/${fallback.slug}`);
      }
    }
    notFound();
  }
  const pricingSummary = resolveTicketPricingSummary({
    pricingMode: event.pricingMode ?? undefined,
    ticketTypes: event.ticketTypes,
  });
  const isGratis = pricingSummary.isGratis;
  const visibleTicketTypes = event.ticketTypes;
  const userEmailNormalized = user ? normalizeEmail(user.email ?? null) : null;
  const usernameNormalized = profile?.username ? sanitizeUsername(profile.username) : null;
  const hasUsername = Boolean(usernameNormalized);
  const inviteTokenParam =
    typeof resolvedSearchParams?.inviteToken === "string"
      ? resolvedSearchParams.inviteToken.trim()
      : Array.isArray(resolvedSearchParams?.inviteToken)
        ? String(resolvedSearchParams?.inviteToken[0] ?? "").trim()
        : "";
  let inviteTokenTicketTypeId: number | null = null;
  let hasInviteTokenAccess = false;
  if (inviteTokenParam) {
    const grant = await resolveInviteTokenGrant(
      {
        eventId: event.id,
        token: inviteTokenParam,
        emailNormalized: userEmailNormalized ?? undefined,
      },
      prisma,
    );
    if (grant.ok) {
      const grantedTicketTypeId =
        typeof grant.grant.ticketTypeId === "number" && Number.isFinite(grant.grant.ticketTypeId)
          ? grant.grant.ticketTypeId
          : null;
      if (grantedTicketTypeId) {
        hasInviteTokenAccess = true;
        inviteTokenTicketTypeId = grantedTicketTypeId;
      }
    }
  }
  const inviteTokenForCheckout = hasInviteTokenAccess ? inviteTokenParam : null;
  const canFreeCheckout = Boolean(user) && hasUsername;
  const allowCheckoutBase = isGratis ? canFreeCheckout : true;
  const isPadel = event.templateType === "PADEL";
  const ticketCopy = getTicketCopy(isPadel ? "PADEL" : "DEFAULT", locale);
  const ticketSectionLabel = ticketCopy.pluralCap;
  const freeBadgeLabel = ticketCopy.freeLabel;
  const freeInfoDescription = ticketCopy.isPadel
    ? t("freeRegistrationInfo", locale)
    : t("freeTicketInfo", locale);
  const freeGateTitle = ticketCopy.freeLabel;
  const salesNotOpenTitle = ticketCopy.isPadel
    ? t("registrationsNotOpenTitle", locale)
    : t("salesNotOpenTitle", locale);
  const salesNotOpenDescription = ticketCopy.isPadel
    ? t("registrationsNotOpenDesc", locale)
    : t("salesNotOpenDesc", locale);
  const salesClosedTitle = ticketCopy.isPadel
    ? t("registrationsClosedTitle", locale)
    : t("salesClosedTitle", locale);
  const salesClosedDescription = ticketCopy.isPadel
    ? t("registrationsClosedDesc", locale)
    : t("salesClosedDesc", locale);
  const soldOutDescription = ticketCopy.isPadel
    ? t("soldOutPadelDesc", locale)
    : t("soldOutEventDesc", locale);
  const eventEndedCopy = ticketCopy.isPadel
    ? t("eventEndedPadel", locale)
    : t("eventEndedEvent", locale);
  const freeUsernameGateMessage = isGratis
    ? user
      ? hasUsername
        ? null
        : ticketCopy.isPadel
          ? t("freeUsernameGatePadel", locale)
          : t("freeUsernameGateEvent", locale)
      : ticketCopy.isPadel
        ? t("freeLoginGatePadel", locale)
        : t("freeLoginGateEvent", locale)
    : null;
  const checkoutVariant =
    isPadel && event.padelTournamentConfig?.padelV2Enabled ? "PADEL" : "DEFAULT";
  const padelAdvanced = (event.padelTournamentConfig?.advancedSettings || {}) as {
    registrationStartsAt?: string | null;
    registrationEndsAt?: string | null;
    competitionState?: string | null;
  };
  const padelCompetitionState = resolvePadelCompetitionState({
    eventStatus: event.status,
    competitionState: padelAdvanced.competitionState ?? null,
    lifecycleStatus: event.padelTournamentConfig?.lifecycleStatus ?? null,
  });
  const padelRegistrationStartsAt =
    padelAdvanced.registrationStartsAt && !Number.isNaN(new Date(padelAdvanced.registrationStartsAt).getTime())
      ? new Date(padelAdvanced.registrationStartsAt)
      : null;
  const padelRegistrationEndsAt =
    padelAdvanced.registrationEndsAt && !Number.isNaN(new Date(padelAdvanced.registrationEndsAt).getTime())
      ? new Date(padelAdvanced.registrationEndsAt)
      : null;
  const padelRegistrationCheck =
    checkoutVariant === "PADEL"
      ? checkPadelRegistrationWindow({
          eventStatus: event.status,
          eventStartsAt: event.startsAt ?? null,
          registrationStartsAt: padelRegistrationStartsAt,
          registrationEndsAt: padelRegistrationEndsAt,
          competitionState: padelCompetitionState,
          lifecycleStatus: event.padelTournamentConfig?.lifecycleStatus ?? null,
        })
      : { ok: true as const };
  const padelRegistrationMessage = !padelRegistrationCheck.ok
    ? padelRegistrationCheck.code === "EVENT_NOT_PUBLISHED"
      ? t("padelRegistrationEventNotPublished", locale)
      : padelRegistrationCheck.code === "INSCRIPTIONS_NOT_OPEN"
        ? t("padelRegistrationNotOpen", locale)
        : padelRegistrationCheck.code === "INSCRIPTIONS_CLOSED"
          ? t("padelRegistrationClosed", locale)
          : padelRegistrationCheck.code === "TOURNAMENT_STARTED"
            ? t("padelRegistrationTournamentStarted", locale)
            : t("padelRegistrationUnavailable", locale)
    : null;
  const padelSnapshot = isPadel ? await buildPadelEventSnapshot(event.id) : null;
  const padelCompetitionLabel = padelSnapshot
    ? padelSnapshot.competitionState === "HIDDEN"
      ? t("competitionHidden", locale)
      : padelSnapshot.competitionState === "DEVELOPMENT"
        ? t("competitionDevelopment", locale)
        : padelSnapshot.competitionState === "PUBLIC"
          ? t("competitionPublic", locale)
          : t("competitionCancelled", locale)
    : null;
  const resolvedLocation = resolveEventLocation({
    addressRef: event.addressRef ?? null,
  });
  const safeLocationName = resolvedLocation.name || t("locationTbd", locale);
  const safeLocationAddress = resolvedLocation.displayAddress || t("addressTbd", locale);
  const googleMapsUrl = resolvedLocation.mapQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(resolvedLocation.mapQuery)}`
    : null;
  const safeTimezone = event.timezone || "Europe/Lisbon";
  const organizationDisplay =
    event.organization?.publicName ||
    event.organization?.businessName ||
    null;
  const organizationUsername =
    event.organization?.status === "ACTIVE"
      ? event.organization?.username ?? null
      : null;
  const safeOrganization = organizationDisplay || t("organizationFallback", locale);
  const organizationAvatarUrl = event.organization?.brandingAvatarUrl?.trim() || null;
  const organizationHandle = organizationUsername ? `@${organizationUsername}` : null;

  const startDateObj = event.startsAt;
  const endDateObj = event.endsAt ?? event.startsAt;

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: safeTimezone,
  });

  const timeFormatter = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: safeTimezone,
  });

  const date = dateFormatter.format(startDateObj);
  const time = timeFormatter.format(startDateObj);
  const formattedDate = date.charAt(0).toUpperCase() + date.slice(1);
  const descriptionText =
    event.description && event.description.trim().length > 0
      ? event.description.trim()
      : t("eventDescriptionSoon", locale);
  const heroDescription =
    descriptionText.length > 220 ? `${descriptionText.slice(0, 217).trimEnd()}…` : descriptionText;

  const cover = getEventCoverUrl(event.coverImageUrl, {
    seed: event.slug ?? event.title ?? String(event.id),
    suggestedIds: getEventCoverSuggestionIds({ templateType: event.templateType ?? null }),
    width: 1200,
    quality: 72,
    format: "webp",
  });
  const coverSource = cover?.trim() ? cover : null;
  // versão ultra-leve apenas para o blur de fundo (mantém o efeito mas evita puxar MBs)
  const blurredCover = coverSource ? optimizeImageUrl(coverSource, 120, 20, "webp", 120, "cover") : null;
  const backgroundCover = blurredCover || coverSource;
  const hasCover = Boolean(backgroundCover);

  const nowDate = new Date();
  const isCancelledEvent = event.status === "CANCELLED";
  const eventEnded = isCancelledEvent || endDateObj < nowDate;
  const eventIsActive = !eventEnded;
  const shareUrl = `${getAppBaseUrl()}/eventos/${event.slug}`;
  const canSeeTickets = !isCancelledEvent;

  const orderedTickets = visibleTicketTypes
    .filter((t) => {
      if (!t) return false;
      return canSeeTickets;
    })
    .sort((a, b) => {
      const ao = a.sortOrder ?? 0;
      const bo = b.sortOrder ?? 0;
      if (ao !== bo) return ao - bo;
      return a.price - b.price;
    });

  const uiTickets: WaveTicket[] = orderedTickets.map((t, index) => {
    const rawStatus = String(t.status || "").toUpperCase();
    const remaining =
      t.totalQuantity === null || t.totalQuantity === undefined
        ? null
        : t.totalQuantity - t.soldQuantity;

    const statusFromEnum =
      rawStatus === "CLOSED" || rawStatus === "ENDED" || rawStatus === "OFF_SALE"
        ? "closed"
        : rawStatus === "SOLD_OUT"
          ? "sold_out"
          : rawStatus === "UPCOMING"
            ? "upcoming"
            : "on_sale";

    // Override: if remaining is 0, this wave é sold_out (mesmo com status)
    const finalStatus: WaveStatus =
      remaining !== null && remaining <= 0
        ? "sold_out"
        : statusFromEnum !== "on_sale"
          ? (statusFromEnum as WaveStatus)
          : getWaveStatus({
              startsAt: t.startsAt,
              endsAt: t.endsAt,
              totalQuantity: t.totalQuantity,
              soldQuantity: t.soldQuantity,
            });

    const isPrivateTicket = t.publicAccess === false;
    const tokenGrantsTicket = hasInviteTokenAccess && inviteTokenTicketTypeId === t.id;
    const canSeePrivateTicket = isAdmin || tokenGrantsTicket;

    return {
      id: String(t.id),
      name: t.name?.trim() || `Wave ${index + 1}`,
      price: (t.price ?? 0) / 100,
      currency: t.currency,
      totalQuantity: t.totalQuantity,
      soldQuantity: t.soldQuantity,
      remaining,
      status: finalStatus as WaveStatus,
      startsAt: t.startsAt ? t.startsAt.toISOString() : null,
      endsAt: t.endsAt ? t.endsAt.toISOString() : null,
      available:
        finalStatus === "on_sale"
          ? remaining === null
            ? true
            : remaining > 0 && !eventEnded
          : false,
      isVisible: !isPrivateTicket || canSeePrivateTicket,
      padelCategoryId: t.padelEventCategoryLink?.padelCategoryId ?? null,
      padelCategoryLabel: t.padelEventCategoryLink?.category?.label ?? null,
      padelCategoryLinkId: t.padelEventCategoryLinkId ?? null,
    };
  });

  const marketTickets = uiTickets.filter((ticket) => ticket.isVisible);
  const hiddenPrivateTickets = uiTickets.filter((ticket) => !ticket.isVisible);
  const purchasableMarketTickets = marketTickets.filter(
    (ticket) => ticket.status === "on_sale" || ticket.status === "upcoming",
  );
  const cheapestMarketTicket =
    purchasableMarketTickets.length > 0
      ? purchasableMarketTickets.reduce(
          (min, ticket) => (ticket.price < min.price ? ticket : min),
          purchasableMarketTickets[0],
        )
      : null;

  const minTicketPrice = cheapestMarketTicket?.price ?? null;

  const displayPriceFrom = minTicketPrice;
  const displayPriceCurrency =
    cheapestMarketTicket?.currency ??
    pricingSummary.priceCurrency ??
    "EUR";
  const showPriceFrom = !isGratis && minTicketPrice !== null;
  const anyOnSale = marketTickets.some((t) => t.status === "on_sale");
  const anyUpcoming = marketTickets.some((t) => t.status === "upcoming");
  const onSaleCount = marketTickets.filter((t) => t.status === "on_sale").length;
  const upcomingCount = marketTickets.filter((t) => t.status === "upcoming").length;
  const allClosed = marketTickets.length > 0 && marketTickets.every((t) => t.status === "closed");
  const allSoldOut = marketTickets.length > 0 && marketTickets.every((t) => t.status === "sold_out");
  const salesNotOpen = !anyOnSale && anyUpcoming;
  const availabilityLabel = eventEnded
    ? t("availabilityEventEnded", locale)
    : allSoldOut
      ? t("availabilitySoldOut", locale)
      : allClosed
        ? isPadel
          ? t("availabilityRegistrationsClosed", locale)
          : t("availabilitySalesClosed", locale)
        : salesNotOpen
          ? isPadel
            ? t("availabilityRegistrationsSoon", locale)
            : t("availabilitySalesSoon", locale)
          : isGratis
            ? freeBadgeLabel
            : anyOnSale
              ? isPadel
                ? t("availabilityRegistrationsOpen", locale)
                : t("availabilityTicketsOnSale", locale)
              : anyUpcoming
                ? isPadel
                  ? t("availabilityRegistrationsSoon", locale)
                  : t("availabilitySalesSoon", locale)
                : ticketCopy.pluralCap;
  const availabilityTone = eventEnded || allClosed
    ? "border-white/25 bg-white/10 text-white/70"
    : allSoldOut
      ? "border-orange-400/40 bg-orange-500/15 text-orange-100"
      : salesNotOpen
        ? "border-yellow-400/40 bg-yellow-500/15 text-yellow-100"
        : isGratis
          ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
      : anyOnSale
        ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
        : "border-yellow-400/40 bg-yellow-500/15 text-yellow-100";
  const ticketSectionSummary = isCancelledEvent
    ? "Evento cancelado. Compras e inscrições encerradas."
    : eventEnded
      ? eventEndedCopy
    : allSoldOut
      ? soldOutDescription
      : salesNotOpen
        ? salesNotOpenDescription
        : allClosed
          ? salesClosedDescription
            : isGratis
              ? freeInfoDescription
              : showPriceFrom && displayPriceFrom !== null
              ? `${t("fromLabel", locale)} ${formatCurrency(Math.round(displayPriceFrom * 100), displayPriceCurrency, locale)}`
              : t("secureCheckoutHint", locale);
  const heroPrimaryChip = (() => {
    if (eventEnded) {
      return {
        label: t("availabilityEventEnded", locale),
        tone: "border-white/25 bg-white/10 text-white/75",
      };
    }
    if (allSoldOut) {
      return {
        label: t("availabilitySoldOut", locale),
        tone: "border-orange-400/45 bg-orange-500/15 text-orange-100",
      };
    }
    if (salesNotOpen) {
      return {
        label: ticketCopy.isPadel ? t("availabilityRegistrationsSoon", locale) : t("availabilitySalesSoon", locale),
        tone: "border-yellow-400/45 bg-yellow-500/18 text-yellow-100",
      };
    }
    if (allClosed) {
      return {
        label: ticketCopy.isPadel ? t("availabilityRegistrationsClosed", locale) : t("availabilitySalesClosed", locale),
        tone: "border-white/25 bg-white/10 text-white/72",
      };
    }
    if (isGratis) {
      return {
        label: freeBadgeLabel,
        tone: "border-emerald-400/45 bg-emerald-500/18 text-emerald-100",
      };
    }
    if (showPriceFrom) {
      return {
        label: `${t("fromLabel", locale)} ${formatCurrency(Math.round((displayPriceFrom ?? 0) * 100), displayPriceCurrency, locale)}`,
        tone: "border-[#7CFFEA]/45 bg-[#092033]/55 text-[#C9FFF7]",
      };
    }
    return {
      label: availabilityLabel,
      tone: "border-white/20 bg-white/10 text-white/82",
    };
  })();
  const railState = (() => {
    if (isCancelledEvent) return "cancelled" as const;
    if (eventEnded) return "ended" as const;
    if (!allowCheckoutBase && freeUsernameGateMessage) return "free_gate" as const;
    if (padelRegistrationMessage) return "padel_window_closed" as const;
    if (marketTickets.length === 0) return "empty" as const;
    if (allSoldOut) return "sold_out" as const;
    if (salesNotOpen) return "not_open" as const;
    if (allClosed) return "closed" as const;
    return "active" as const;
  })();
  const railMessage = railState === "active"
    ? null
    : railState === "cancelled"
      ? {
          title: "Evento cancelado",
          description: "Este evento foi cancelado pela organização. Novas compras e inscrições estão desativadas.",
          ctaLabel: null,
          ctaHref: null,
          tone: "border-red-400/65 text-red-100",
        }
      : railState === "ended"
        ? {
            title: t("availabilityEventEnded", locale),
            description: eventEndedCopy,
            ctaLabel: null,
            ctaHref: null,
            tone: "border-white/35 text-white/78",
          }
        : railState === "free_gate"
          ? {
              title: freeGateTitle,
              description: freeUsernameGateMessage,
              ctaLabel: ticketCopy.viewLabel,
              ctaHref: "#bilhetes",
              tone: "border-emerald-400/65 text-emerald-100",
            }
          : railState === "padel_window_closed"
            ? {
                title: t("registrationsUnavailableTitle", locale),
                description: padelRegistrationMessage,
                ctaLabel: ticketCopy.viewLabel,
                ctaHref: "#bilhetes",
                tone: "border-amber-400/65 text-amber-100",
              }
            : railState === "sold_out"
              ? {
                  title: t("eventSoldOutTitle", locale),
                  description: soldOutDescription,
                  ctaLabel: t("availabilitySoldOut", locale),
                  ctaHref: null,
                  tone: "border-orange-400/65 text-orange-100",
                }
              : railState === "not_open"
                ? {
                    title: salesNotOpenTitle,
                    description: salesNotOpenDescription,
                    ctaLabel: t("availabilitySalesSoon", locale),
                    ctaHref: null,
                    tone: "border-yellow-400/65 text-yellow-100",
                  }
                : railState === "closed"
                  ? {
                      title: salesClosedTitle,
                      description: salesClosedDescription,
                      ctaLabel: t("availabilitySalesClosed", locale),
                      ctaHref: null,
                      tone: "border-white/35 text-white/78",
                    }
                  : hiddenPrivateTickets.length > 0
                    ? {
                        title: t("inviteAccessLabel", locale),
                        description: `Existem ${ticketCopy.plural} privados para convidados.`,
                        ctaLabel: null,
                        ctaHref: null,
                        tone: "border-amber-400/65 text-amber-100",
                      }
                    : {
                        title: t("noTicketWaves", locale),
                        description: t("noTicketsAvailable", locale).replace("{items}", ticketCopy.plural),
                        ctaLabel: ticketCopy.viewLabel,
                        ctaHref: "#bilhetes",
                        tone: "border-white/35 text-white/78",
                      };

  const padelV2Enabled = Boolean(event.padelTournamentConfig?.padelV2Enabled);
  const padelCategoryLinks = Array.isArray(event.padelCategoryLinks) ? event.padelCategoryLinks : [];
  const padelDefaultCategoryId =
    event.padelTournamentConfig?.defaultCategoryId ??
    padelCategoryLinks.find((link) => link.isEnabled)?.padelCategoryId ??
    null;
  const padelDefaultCategoryLinkId =
    padelDefaultCategoryId != null
      ? padelCategoryLinks.find((link) => link.padelCategoryId === padelDefaultCategoryId)?.id ?? null
      : null;
  const defaultPadelTicketId = (() => {
    const eligible = orderedTickets.filter((t) => {
      const remaining =
        t.totalQuantity === null || t.totalQuantity === undefined
          ? null
          : t.totalQuantity - t.soldQuantity;
      const onSale = String(t.status || "").toUpperCase() === "ON_SALE";
      const hasStock = remaining === null ? true : remaining > 0;
      return onSale && hasStock;
    });
    const filtered =
      padelV2Enabled && padelDefaultCategoryLinkId
        ? eligible.filter((t) => t.padelEventCategoryLinkId === padelDefaultCategoryLinkId)
        : eligible;
    if (!filtered.length) return null;
    const cheapest = filtered.reduce((min, cur) => (cur.price < min.price ? cur : min), filtered[0]);
    return cheapest.id ?? null;
  })();

  const backgroundDefaults = {
    blur: 46,
    scale: 1.24,
    saturate: 1.08,
    brightness: 0.82,
    maskStops: [0, 18, 38, 62, 84, 100] as [number, number, number, number, number, number],
    maskAlphas: [1, 0.98, 0.9, 0.68, 0.36, 0] as [number, number, number, number, number, number],
    overlayTop: 0.64,
    overlayMid: 0.46,
    overlayBottom: 0.24,
    fadeStart: 68,
    fadeMid: 84,
    fadeEnd: 98,
    fadeDark: 0.94,
  };

  const backgroundVars = {
    "--event-bg-blur": `${backgroundDefaults.blur}px`,
    "--event-bg-scale": `${backgroundDefaults.scale}`,
    "--event-bg-saturate": `${backgroundDefaults.saturate}`,
    "--event-bg-brightness": `${backgroundDefaults.brightness}`,
    "--event-bg-mask-stop-1": `${backgroundDefaults.maskStops[0]}%`,
    "--event-bg-mask-stop-2": `${backgroundDefaults.maskStops[1]}%`,
    "--event-bg-mask-stop-3": `${backgroundDefaults.maskStops[2]}%`,
    "--event-bg-mask-stop-4": `${backgroundDefaults.maskStops[3]}%`,
    "--event-bg-mask-stop-5": `${backgroundDefaults.maskStops[4]}%`,
    "--event-bg-mask-stop-6": `${backgroundDefaults.maskStops[5]}%`,
    "--event-bg-mask-alpha-1": `${backgroundDefaults.maskAlphas[0]}`,
    "--event-bg-mask-alpha-2": `${backgroundDefaults.maskAlphas[1]}`,
    "--event-bg-mask-alpha-3": `${backgroundDefaults.maskAlphas[2]}`,
    "--event-bg-mask-alpha-4": `${backgroundDefaults.maskAlphas[3]}`,
    "--event-bg-mask-alpha-5": `${backgroundDefaults.maskAlphas[4]}`,
    "--event-bg-mask-alpha-6": `${backgroundDefaults.maskAlphas[5]}`,
    "--event-bg-overlay-top": `${backgroundDefaults.overlayTop}`,
    "--event-bg-overlay-mid": `${backgroundDefaults.overlayMid}`,
    "--event-bg-overlay-bottom": `${backgroundDefaults.overlayBottom}`,
    "--event-bg-fade-start": `${backgroundDefaults.fadeStart}%`,
    "--event-bg-fade-mid": `${backgroundDefaults.fadeMid}%`,
    "--event-bg-fade-end": `${backgroundDefaults.fadeEnd}%`,
    "--event-bg-fade-dark": `${backgroundDefaults.fadeDark}`,
  } as CSSProperties;

  return (
    <main
      id="event-page"
      className="relative min-h-screen w-full overflow-hidden text-white"
      style={backgroundVars}
    >
      {user?.id && event.organizationId ? (
        <CrmEngagementTracker
          type="EVENT_VIEWED"
          eventId={event.id}
          organizationId={event.organizationId}
          enabled
        />
      ) : null}
      <CheckoutProvider>
        {hasCover && <EventBackgroundTuner targetId="event-page" defaults={backgroundDefaults} />}
        {hasCover && (
          <div
            className="pointer-events-none fixed inset-0 overflow-hidden"
            aria-hidden="true"
          >
            {/* camada principal: cover blur com máscara para fazer o fade vertical muito suave */}
            <div
              className="h-full w-full"
              style={{
                backgroundImage: `url(${backgroundCover})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter:
                  "blur(var(--event-bg-blur, 56px)) saturate(var(--event-bg-saturate, 1.28)) brightness(var(--event-bg-brightness, 1.06))",
                WebkitFilter:
                  "blur(var(--event-bg-blur, 56px)) saturate(var(--event-bg-saturate, 1.28)) brightness(var(--event-bg-brightness, 1.06))",
                transform: "scale(var(--event-bg-scale, 1.28))",
                WebkitTransform: "scale(var(--event-bg-scale, 1.28))",
                WebkitMaskImage: EVENT_BG_MASK,
                maskImage: EVENT_BG_MASK,
              }}
            />
            {/* overlay extra para garantir legibilidade no topo da hero e uma transição ainda mais orgânica */}
            <div className="absolute inset-0" style={{ background: EVENT_BG_OVERLAY }} />
            {/* fade tardio para preto para unir com o fundo */}
            <div
              className="absolute inset-0"
              style={{
                background: EVENT_BG_FADE,
              }}
            />
            <div className="absolute inset-0 bg-[radial-gradient(120%_78%_at_50%_-4%,rgba(26,76,160,0.26)_0%,rgba(7,14,30,0.72)_54%,rgba(2,5,12,0.96)_78%,rgba(2,4,10,1)_100%)]" />
          </div>
        )}

        {/* ========== HERO ============ */}
        <section className="relative z-10 w-full pb-10 pt-12 md:pb-12 md:pt-16">
          <div
            data-testid="event-detail-dice-split"
            className="orya-page-width grid grid-cols-1 gap-6 px-4 md:grid-cols-[minmax(300px,0.76fr)_minmax(0,1.24fr)] md:items-start md:gap-8 md:px-8 lg:grid-cols-[minmax(340px,0.72fr)_minmax(0,1.28fr)]"
          >
            <div
              data-testid="event-cover-square"
              className="relative order-1 mx-auto w-full max-w-[430px] md:mx-0 md:max-w-none md:self-start"
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-[30px] border border-white/16 bg-black/35 shadow-[0_26px_64px_rgba(0,0,0,0.72)] md:aspect-[4/5] lg:aspect-square">
                <Image
                  src={cover}
                  alt={`${t("eventCoverAlt", locale)} ${event.title}`}
                  fill
                  priority
                  fetchPriority="high"
                  sizes="(max-width: 768px) 88vw, (max-width: 1200px) 36vw, 480px"
                  className="object-cover object-center"
                  placeholder="blur"
                  blurDataURL={defaultBlurDataURL}
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/72 via-black/22 to-transparent" />
              </div>
            </div>

            <div className="relative order-2 max-w-4xl md:pt-1">
              <div className="animate-fade-slide">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <h1 className="max-w-3xl text-[clamp(2.2rem,4.4vw,4rem)] font-semibold leading-[0.98] tracking-[-0.015em] text-white">
                    {event.title}
                  </h1>
                  <EventShareButton
                    url={shareUrl}
                    title={event.title}
                  />
                </div>

                <p className="mt-3 text-lg font-medium text-white/88 md:text-2xl">{safeLocationName}</p>
                <p className="mt-1 text-base font-semibold text-[#F2E97E] md:text-xl">
                  {formattedDate} · {time}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                  <span
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] ${heroPrimaryChip.tone}`}
                  >
                    {heroPrimaryChip.label}
                  </span>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/62">
                    {t("organizedByLabel", locale)}
                  </p>
                  {organizationUsername ? (
                    <Link
                      href={`/${organizationUsername}`}
                      className="inline-flex items-center gap-2 rounded-full border border-white/18 px-3 py-1.5 transition hover:border-white/32 hover:bg-white/6"
                    >
                      <Avatar
                        src={organizationAvatarUrl}
                        name={safeOrganization}
                        className="h-7 w-7 border border-white/20"
                        textClassName="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80"
                        fallbackText="OR"
                      />
                      <span className="text-sm font-semibold text-white">{safeOrganization}</span>
                      {organizationHandle ? (
                        <span className="text-xs text-white/58">{organizationHandle}</span>
                      ) : null}
                    </Link>
                  ) : (
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/18 px-3 py-1.5">
                      <Avatar
                        src={organizationAvatarUrl}
                        name={safeOrganization}
                        className="h-7 w-7 border border-white/20"
                        textClassName="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80"
                        fallbackText="OR"
                      />
                      <span className="text-sm font-semibold text-white">{safeOrganization}</span>
                    </div>
                  )}
                </div>

                <div className="mt-6" data-testid="event-hero-purchase-rail">
                  {railState === "active" ? (
                    <WavesSectionClient
                      slug={event.slug}
                      tickets={marketTickets}
                      layout="rail"
                      isGratisEvent={isGratis}
                      checkoutUiVariant={checkoutVariant}
                      locale={locale}
                      inviteToken={inviteTokenForCheckout}
                      padelMeta={
                        checkoutVariant === "PADEL"
                          ? {
                              eventId: event.id,
                              organizationId: event.organizationId ?? null,
                              categoryId: padelDefaultCategoryId ?? null,
                              categoryLinkId: padelDefaultCategoryLinkId ?? null,
                            }
                          : undefined
                      }
                    />
                  ) : (
                    <div
                      data-testid="event-purchase-rail"
                      className={`flex flex-col gap-3 border-l-2 pl-4 text-sm ${railMessage?.tone ?? "border-white/35 text-white/82"}`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight">{railMessage?.title}</p>
                        {railMessage?.description ? (
                          <p className="mt-1 text-xs opacity-85">{railMessage.description}</p>
                        ) : null}
                      </div>
                      {railMessage?.ctaLabel ? (
                        railMessage.ctaHref ? (
                          <a
                            href={railMessage.ctaHref}
                            className="inline-flex h-9 w-fit items-center justify-center rounded-full border border-white/25 px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/90 transition hover:bg-white/10"
                          >
                            {railMessage.ctaLabel}
                          </a>
                        ) : (
                          <span
                            aria-disabled
                            className="inline-flex h-9 w-fit cursor-not-allowed items-center justify-center rounded-full border border-white/20 px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/62"
                          >
                            {railMessage.ctaLabel}
                          </span>
                        )
                      ) : null}
                    </div>
                  )}
                </div>

                <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-white/76 md:text-base">
                  {heroDescription}
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  {!isCancelledEvent ? (
                    <a
                      href="#bilhetes"
                      className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black shadow-[0_0_22px_rgba(255,255,255,0.28)] transition hover:brightness-110 active:scale-95 md:text-sm"
                    >
                      {ticketCopy.viewLabel}
                    </a>
                  ) : null}
                  {googleMapsUrl ? (
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-white/24 px-4 py-2 text-xs font-semibold text-white/90 transition hover:border-white/38 hover:bg-white/8 md:text-sm"
                    >
                      Abrir mapa
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div
          className="pointer-events-none relative z-10 orya-page-width px-6 md:px-10"
          aria-hidden="true"
        >
          <div className="relative my-7 md:my-9">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-white/22 to-transparent" />
            <div className="absolute inset-0 blur-2xl">
              <div className="h-px w-full bg-gradient-to-r from-transparent via-[#6BFFFF]/28 to-transparent" />
            </div>
          </div>
        </div>

        {/* ========== CONTENT AREA ============ */}
        <section className="relative z-10 orya-page-width grid grid-cols-1 gap-12 px-6 pb-24 pt-4 md:grid-cols-[minmax(0,1fr)_minmax(290px,0.44fr)] md:gap-12 md:px-10">
          <div className="space-y-12">
            <section
              id="sobre"
              className="animate-fade-slide border-t border-white/16 pt-7"
            >
              <h2 className="text-3xl font-semibold tracking-[-0.01em] text-white">{t("aboutEventTitle", locale)}</h2>
              <div className="mt-4 max-w-3xl">
                <EventDescriptionReadMore
                  text={descriptionText}
                  locale={locale}
                  collapsedLines={6}
                />
              </div>
            </section>

            <section
              id="local"
              className="border-t border-white/16 pt-7"
            >
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/56">{t("locationLabel", locale)}</p>
              <h3 className="mt-2 text-3xl font-semibold tracking-[-0.01em] text-white md:text-[2.15rem]">{safeLocationName}</h3>
              <p className="mt-2 max-w-2xl text-sm text-white/74 md:text-base">{safeLocationAddress}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {googleMapsUrl ? (
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-white/24 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/90 transition hover:border-white/40 hover:bg-white/8"
                  >
                    Abrir em mapas
                  </a>
                ) : null}
                <span className="text-xs text-white/56">Portas abrem às {time}</span>
              </div>
            </section>

            {checkoutVariant === "PADEL" && (
              <section className="border-t border-white/16 pt-7">
                <PadelMatchesByCategoryClient slug={event.slug} />
              </section>
            )}

            {padelSnapshot && (
              <section className="border-t border-white/16 pt-7">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">
                      {t("padel", locale)}
                    </p>
                    <h3 className="text-base font-semibold">{t("padelCompetitionDetailTitle", locale)}</h3>
                    <p className="text-[12px] text-white/65">
                      {padelSnapshot.clubName || t("padelClubTbd", locale)} ·{" "}
                      {padelSnapshot.clubCity || t("padelCitySoon", locale)}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/20 px-2 py-1 text-[11px] text-white/75">
                    {t("statusLabel", locale)}: {padelCompetitionLabel ?? padelSnapshot.status}
                  </span>
                </div>
                {padelSnapshot.timeline && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {padelSnapshot.timeline.map((step) => (
                      <div
                        key={step.key}
                        className={`border-l-2 px-3 py-1 text-sm ${
                          step.state === "done"
                            ? "border-emerald-400/65 text-emerald-50"
                            : step.state === "active"
                              ? "border-[#6BFFFF]/70 text-white"
                              : "border-white/22 text-white/70"
                        }`}
                      >
                        <p className="font-semibold">{step.label}</p>
                        <p className="text-[12px] opacity-80">
                          {step.cancelled
                            ? t("cancelledLabel", locale)
                            : step.date
                              ? dateFormatter.format(new Date(step.date))
                              : t("dateTbd", locale)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            <section
              id="download-app"
              className="border-t border-white/16 pt-7"
            >
              <h3 className="text-2xl font-semibold tracking-[-0.01em] text-white md:text-3xl">
                Leva a ORYA no telemóvel
              </h3>
              <p className="mt-3 max-w-2xl text-sm text-white/74 md:text-base">
                Descobre eventos, guarda bilhetes e entra mais rápido nos teus próximos planos.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <a href={ORYA_APP_INSTALL_URL} className={`${CTA_PRIMARY} px-5 py-2.5 text-sm`}>
                  {ORYA_APP_INSTALL_CTA_LABEL}
                </a>
                <span className="text-xs text-white/58">{ORYA_APP_INSTALL_HINT}</span>
              </div>
            </section>
          </div>

          <aside className="space-y-10 md:sticky md:top-28 md:self-start">
            <section id="bilhetes" className="scroll-mt-28 border-t border-white/18 pt-7">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[2rem] font-semibold leading-[1] tracking-[-0.01em] text-white">
                      {ticketSectionLabel}
                    </h3>
                    <p className="mt-2 max-w-md text-sm text-white/72">{ticketSectionSummary}</p>
                  </div>
                  {!isCancelledEvent ? (
                    <span
                      className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.16em] ${availabilityTone}`}
                    >
                      {availabilityLabel}
                    </span>
                  ) : null}
                </div>
                {!isCancelledEvent ? (
                  <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-white/58">
                    <span className="rounded-full border border-white/18 px-2.5 py-1">
                      {marketTickets.length} {ticketSectionLabel.toLowerCase()}
                    </span>
                    {onSaleCount > 0 ? (
                      <span className="rounded-full border border-emerald-400/35 px-2.5 py-1 text-emerald-100/92">
                        {onSaleCount} ativos
                      </span>
                    ) : null}
                    {upcomingCount > 0 ? (
                      <span className="rounded-full border border-yellow-400/35 px-2.5 py-1 text-yellow-100/92">
                        {upcomingCount} em breve
                      </span>
                    ) : null}
                    {hiddenPrivateTickets.length > 0 ? (
                      <span className="rounded-full border border-amber-400/35 px-2.5 py-1 text-amber-100/92">
                        {hiddenPrivateTickets.length} privados
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {isCancelledEvent ? (
                <div className="mt-6 border-l-2 border-red-400/70 pl-3 text-sm text-red-100/95">
                  <p className="font-semibold">Evento cancelado</p>
                  <p className="text-[11px] text-red-100/85">
                    Este evento foi cancelado pela organização. Compras e inscrições estão permanentemente desativadas.
                  </p>
                </div>
              ) : !eventEnded ? (
                <div className="mt-6 space-y-5">
                  <>
                      {isGratis && (
                        <div className="border-l-2 border-emerald-400/70 pl-3 text-sm text-emerald-100/95">
                          <p className="font-semibold">{freeBadgeLabel}</p>
                          <p className="text-[11px] text-emerald-100/85">{freeInfoDescription}</p>
                          {freeUsernameGateMessage ? (
                            <p className="mt-2 text-[11px] text-white/80">{freeUsernameGateMessage}</p>
                          ) : null}
                        </div>
                      )}

                      {allowCheckoutBase ? (
                        padelRegistrationMessage ? (
                          <div className="border-l-2 border-amber-400/70 pl-3 text-sm text-amber-100/95">
                            <p className="font-semibold">{t("registrationsUnavailableTitle", locale)}</p>
                            <p className="text-[11px] text-amber-100/85">{padelRegistrationMessage}</p>
                          </div>
                        ) : marketTickets.length === 0 ? (
                          hiddenPrivateTickets.length > 0 ? (
                            <div className="border-l-2 border-amber-400/70 pl-3 text-sm text-amber-100/95">
                              <p className="font-semibold">{t("inviteAccessLabel", locale)}</p>
                              <p className="text-[11px] text-amber-100/85">
                                Existem {ticketCopy.plural} privados para convidados.
                              </p>
                            </div>
                          ) : (
                            <p className="text-sm text-white/74">{t("noTicketWaves", locale)}</p>
                          )
                        ) : allSoldOut ? (
                          <div className="border-l-2 border-orange-400/70 pl-3 text-sm text-orange-100/95">
                            <p className="font-semibold">{t("eventSoldOutTitle", locale)}</p>
                            <p className="text-[11px] text-orange-100/85">{soldOutDescription}</p>
                          </div>
                        ) : !anyOnSale && anyUpcoming ? (
                          <div className="border-l-2 border-yellow-400/70 pl-3 text-sm text-yellow-100/95">
                            <p className="font-semibold">{salesNotOpenTitle}</p>
                            <p className="text-[11px] text-yellow-100/85">{salesNotOpenDescription}</p>
                          </div>
                        ) : allClosed ? (
                          <div className="border-l-2 border-white/40 pl-3 text-sm text-white/80">
                            <p className="font-semibold">{salesClosedTitle}</p>
                            <p className="text-[11px] text-white/70">{salesClosedDescription}</p>
                          </div>
                        ) : (
                          <WavesSectionClient
                            slug={event.slug}
                            tickets={marketTickets}
                            layout="panel"
                            isGratisEvent={isGratis}
                            checkoutUiVariant={checkoutVariant}
                            locale={locale}
                            inviteToken={inviteTokenForCheckout}
                            padelMeta={
                              checkoutVariant === "PADEL"
                                ? {
                                    eventId: event.id,
                                    organizationId: event.organizationId ?? null,
                                    categoryId: padelDefaultCategoryId ?? null,
                                    categoryLinkId: padelDefaultCategoryLinkId ?? null,
                                  }
                                : undefined
                            }
                          />
                        )
                      ) : null}
                    </>
                </div>
              ) : (
                <p className="mt-4 text-sm text-white/76">
                  {eventEndedCopy}
                </p>
              )}
            </section>
          </aside>
        </section>

        <EventPageClient
          slug={event.slug}
          uiTickets={marketTickets}
          checkoutUiVariant={checkoutVariant === "PADEL" ? "PADEL" : "DEFAULT"}
          locale={locale}
          eventIsActive={eventIsActive}
          padelMeta={
            checkoutVariant === "PADEL"
              ? {
                  eventId: event.id,
                  organizationId: event.organizationId ?? null,
                  categoryId: padelDefaultCategoryId ?? null,
                  categoryLinkId: padelDefaultCategoryLinkId ?? null,
                }
              : undefined
          }
          defaultPadelTicketId={defaultPadelTicketId}
        />
      </CheckoutProvider>
    </main>
  );
}
export const dynamic = "force-dynamic";
export const revalidate = 0;
