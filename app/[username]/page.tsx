import Link from "next/link";
import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import ProfileHeader from "@/app/components/profile/ProfileHeader";
import OrganizationProfileHeader from "@/app/components/profile/OrganizationProfileHeader";
import OrganizationAgendaTabs from "@/app/components/profile/OrganizationAgendaTabs";
import MobileTopBar from "@/app/components/mobile/MobileTopBar";
import MobileProfileOverview from "@/app/components/mobile/MobileProfileOverview";
import { FilterChip } from "@/app/components/mobile/MobileFilters";
import InterestIcon from "@/app/components/interests/InterestIcon";
import { getEventCoverUrl } from "@/lib/eventCover";
import { getProfileCoverUrl } from "@/lib/profileCover";
import { getPadelOnboardingMissing, isPadelOnboardingComplete } from "@/domain/padelOnboarding";
import {
  CORE_ORGANIZATION_MODULES,
  parseOrganizationModules,
  resolvePrimaryModule,
} from "@/lib/organizationCategories";
import { normalizeInterestSelection, resolveInterestLabel } from "@/lib/interests";
import { getPaidSalesGate } from "@/lib/organizationPayments";
import { isStoreFeatureEnabled, isStorePublic } from "@/lib/storeAccess";
import { normalizeOfficialEmail } from "@/lib/organizationOfficialEmail";
import { OrganizationFormStatus } from "@prisma/client";
import { deriveIsFreeEvent } from "@/domain/events/derivedIsFree";
import ReservasBookingSection from "@/app/[username]/_components/ReservasBookingSection";
import { ensurePublicProfileLayout, type PublicProfileModuleType } from "@/lib/publicProfileLayout";
import { formatEventLocationLabel } from "@/lib/location/eventLocation";
import { getUserFollowCounts, isUserFollowing } from "@/domain/social/follows";
import type { Metadata } from "next";
import { getAppBaseUrl } from "@/lib/appBaseUrl";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: { username: string } | Promise<{ username: string }>;
  searchParams?: { serviceId?: string } | Promise<{ serviceId?: string }>;
};

export async function generateMetadata({
  params,
}: {
  params: PageProps["params"];
}): Promise<Metadata> {
  const resolved = await params;
  const username = resolved?.username?.trim();
  const baseUrl = getAppBaseUrl();

  if (!username) {
    return {
      metadataBase: new URL(baseUrl),
      title: "Perfil | ORYA",
      description: "Perfil público na ORYA.",
    };
  }

  const [profile, organization] = await Promise.all([
    prisma.profile.findUnique({
      where: { username },
      select: { fullName: true, username: true, bio: true, coverUrl: true, avatarUrl: true },
    }),
    prisma.organization.findFirst({
      where: { username, status: "ACTIVE" },
      select: {
        publicName: true,
        businessName: true,
        publicDescription: true,
        brandingCoverUrl: true,
        brandingAvatarUrl: true,
      },
    }),
  ]);

  const canonicalUrl = `${baseUrl}/${username}`;
  const isOrg = Boolean(organization);
  const displayName = isOrg
    ? organization?.publicName?.trim() ||
      organization?.businessName?.trim() ||
      "Organização ORYA"
    : profile?.fullName?.trim() || username;
  const description =
    (isOrg ? organization?.publicDescription : profile?.bio)?.trim() ||
    `Perfil público de ${displayName} na ORYA.`;
  const rawCover = isOrg ? organization?.brandingCoverUrl : profile?.coverUrl;
  const coverUrl = rawCover
    ? rawCover.startsWith("http")
      ? rawCover
      : `${baseUrl}${rawCover.startsWith("/") ? "" : "/"}${rawCover}`
    : null;

  return {
    metadataBase: new URL(baseUrl),
    alternates: { canonical: canonicalUrl },
    title: `${displayName} | ORYA`,
    description,
    openGraph: {
      title: `${displayName} | ORYA`,
      description,
      url: canonicalUrl,
      type: "profile",
      images: coverUrl ? [{ url: coverUrl }] : undefined,
    },
    twitter: {
      card: coverUrl ? "summary_large_image" : "summary",
      title: `${displayName} | ORYA`,
      description,
      images: coverUrl ? [coverUrl] : undefined,
    },
  };
}

async function getViewerId() {
  try {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

function formatDate(date?: Date | null) {
  if (!date) return "";
  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDayLabel(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: timezone,
  }).format(date);
}

function formatTimeLabel(date: Date | null, timezone: string) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(date);
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

type OrganizationEvent = {
  id: number;
  slug: string;
  title: string;
  startsAt: Date | null;
  endsAt: Date | null;
  locationName: string | null;
  locationCity: string | null;
  address: string | null;
  locationSource: "OSM" | "MANUAL" | null;
  locationFormattedAddress: string | null;
  locationComponents: Record<string, unknown> | null;
  locationOverrides: Record<string, unknown> | null;
  timezone: string | null;
  templateType: string | null;
  coverImageUrl: string | null;
  isGratis: boolean;
};

type OrganizationFormPreview = {
  id: number;
  title: string;
  description: string | null;
  startAt: Date | null;
  endAt: Date | null;
  capacity: number | null;
  waitlistEnabled: boolean;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
};

type AgendaItem = {
  id: number;
  slug: string;
  title: string;
  timeLabel: string;
  locationLabel: string;
  isPast: boolean;
  isGratis: boolean;
  templateType?: string | null;
};

type AgendaGroup = {
  key: string;
  label: string;
  items: AgendaItem[];
};

type OperationModule = "EVENTOS" | "RESERVAS" | "TORNEIOS";

const OPERATION_META: Record<
  OperationModule,
  { label: string; cta: string; noun: string; nounPlural: string }
> = {
  EVENTOS: {
    label: "Eventos",
    cta: "Ver eventos",
    noun: "evento",
    nounPlural: "eventos",
  },
  TORNEIOS: {
    label: "Torneios",
    cta: "Ver torneios",
    noun: "torneio",
    nounPlural: "torneios",
  },
  RESERVAS: {
    label: "Reservas",
    cta: "Ver reservas",
    noun: "evento",
    nounPlural: "eventos",
  },
};

const OPERATION_TEMPLATE: Record<OperationModule, "PADEL" | null> = {
  EVENTOS: null,
  TORNEIOS: "PADEL",
  RESERVAS: null,
};

function formatEventDateRange(start: Date | null, end: Date | null, timezone?: string | null) {
  if (!start) return "Data a definir";
  const safeTimezone = timezone || "Europe/Lisbon";
  const optsDay: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "2-digit",
    month: "short",
  };
  const optsTime: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
  };
  const dayStr = new Intl.DateTimeFormat("pt-PT", { ...optsDay, timeZone: safeTimezone }).format(start);
  const startTimeStr = new Intl.DateTimeFormat("pt-PT", { ...optsTime, timeZone: safeTimezone }).format(start);
  const endTimeStr = end
    ? new Intl.DateTimeFormat("pt-PT", { ...optsTime, timeZone: safeTimezone }).format(end)
    : null;
  return `${dayStr} · ${startTimeStr}${endTimeStr ? ` – ${endTimeStr}` : ""}`;
}

function buildAgendaGroups(events: OrganizationEvent[], pastEventIds?: Set<number>) {
  const groups: AgendaGroup[] = [];
  const groupMap = new Map<string, AgendaGroup>();

  for (const event of events) {
    const timezone = event.timezone || "Europe/Lisbon";
    const hasDate = Boolean(event.startsAt);
    const key = hasDate
      ? new Intl.DateTimeFormat("pt-PT", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          timeZone: timezone,
        }).format(event.startsAt as Date)
      : "data-a-definir";
    const label = hasDate ? formatDayLabel(event.startsAt as Date, timezone) : "Data a definir";
    const locationLabel = formatEventLocationLabel(
      {
        locationName: event.locationName,
        locationCity: event.locationCity,
        address: event.address,
        locationSource: event.locationSource,
        locationFormattedAddress: event.locationFormattedAddress,
        locationComponents: event.locationComponents,
        locationOverrides: event.locationOverrides,
      },
      "Local a anunciar",
    );
    const item: AgendaItem = {
      id: event.id,
      slug: event.slug,
      title: event.title,
      timeLabel: hasDate ? formatTimeLabel(event.startsAt as Date, timezone) : "—",
      locationLabel,
      isPast: pastEventIds?.has(event.id) ?? false,
      isGratis: event.isGratis,
      templateType: event.templateType ?? null,
    };

    if (!groupMap.has(key)) {
      groupMap.set(key, { key, label, items: [item] });
    } else {
      groupMap.get(key)?.items.push(item);
    }
  }

  for (const group of groupMap.values()) {
    groups.push(group);
  }

  return groups;
}

export default async function UserProfilePage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const usernameParam = resolvedParams?.username;

  if (!usernameParam || usernameParam.toLowerCase() === "me") {
    redirect("/me");
  }

  const [viewerId, profile, organizationProfileRaw] = await Promise.all([
    getViewerId(),
    prisma.profile.findUnique({
      where: { username: usernameParam },
      select: {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
        coverUrl: true,
        bio: true,
        city: true,
        contactPhone: true,
        gender: true,
        padelLevel: true,
        padelPreferredSide: true,
        padelClubName: true,
        favouriteCategories: true,
        visibility: true,
        is_verified: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.organization.findFirst({
      where: { username: usernameParam, status: "ACTIVE" },
      select: {
        id: true,
        username: true,
        publicName: true,
        businessName: true,
        city: true,
        primaryModule: true,
        reservationAssignmentMode: true,
        brandingAvatarUrl: true,
        brandingCoverUrl: true,
        orgType: true,
        stripeAccountId: true,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
        officialEmail: true,
        officialEmailVerifiedAt: true,
        status: true,
        publicWebsite: true,
        publicInstagram: true,
        publicYoutube: true,
        publicDescription: true,
        publicHours: true,
        publicProfileLayout: true,
        infoRules: true,
        infoFaq: true,
        infoRequirements: true,
        infoPolicies: true,
        infoLocationNotes: true,
        address: true,
        showAddressPublicly: true,
        timezone: true,
        organizationModules: {
          where: { enabled: true },
          select: { moduleKey: true },
        },
      },
    }),
  ]);

  const organizationProfile = organizationProfileRaw;
  const initialServiceId =
    resolvedSearchParams?.serviceId && Number.isFinite(Number(resolvedSearchParams.serviceId))
      ? Number(resolvedSearchParams.serviceId)
      : null;

  if (!profile && !organizationProfile) {
    notFound();
  }

  if (!profile && organizationProfile) {
    const now = new Date();
    const moduleKeys = (organizationProfile.organizationModules ?? [])
      .map((module) => String(module.moduleKey).trim().toUpperCase());
    const normalizedModules = parseOrganizationModules(moduleKeys) ?? [];
    const primaryOperation = resolvePrimaryModule(
      organizationProfile.primaryModule ?? null,
      normalizedModules,
    ) as OperationModule;
    const moduleSet = new Set<string>([...normalizedModules, ...CORE_ORGANIZATION_MODULES]);
    moduleSet.add(primaryOperation);
    const hasEventosModule = moduleSet.has("EVENTOS");
    const hasReservasModule = moduleSet.has("RESERVAS");
    const hasTorneiosModule = moduleSet.has("TORNEIOS");
    const showAgenda = hasEventosModule || hasTorneiosModule;
    const operationMeta = OPERATION_META[primaryOperation];
    const operationTemplate = OPERATION_TEMPLATE[primaryOperation];
    const orgDisplayName =
      organizationProfile.publicName?.trim() ||
      organizationProfile.businessName?.trim() ||
      "Organização ORYA";
    const officialEmailNormalized = normalizeOfficialEmail(organizationProfile.officialEmail ?? null);
    const isVerified = Boolean(officialEmailNormalized && organizationProfile.officialEmailVerifiedAt);
    const contactEmail = isVerified ? officialEmailNormalized : null;
    const publicWebsite = organizationProfile.publicWebsite?.trim() || null;
    const publicInstagram = organizationProfile.publicInstagram?.trim() || null;
    const publicYoutube = organizationProfile.publicYoutube?.trim() || null;
    const publicWebsiteHref = publicWebsite
      ? (() => {
          const normalized = /^https?:\/\//i.test(publicWebsite)
            ? publicWebsite
            : `https://${publicWebsite}`;
          try {
            new URL(normalized);
            return normalized;
          } catch {
            return null;
          }
        })()
      : null;
    const publicDescription = organizationProfile.publicDescription?.trim() || null;
    const hasInscricoes = moduleSet.has("INSCRICOES");
    const formsWhere = {
      organizationId: organizationProfile.id,
      status: OrganizationFormStatus.PUBLISHED,
    };
    const paidGate = getPaidSalesGate({
      officialEmail: organizationProfile.officialEmail ?? null,
      officialEmailVerifiedAt: organizationProfile.officialEmailVerifiedAt ?? null,
      stripeAccountId: organizationProfile.stripeAccountId ?? null,
      stripeChargesEnabled: organizationProfile.stripeChargesEnabled ?? false,
      stripePayoutsEnabled: organizationProfile.stripePayoutsEnabled ?? false,
      requireStripe: organizationProfile.orgType !== "PLATFORM",
    });
    const allowPaidServices = paidGate.ok;

    const [events, followersCount, followRow, forms, services, professionals, resources, reviews] = await Promise.all([
      prisma.event.findMany({
        where: {
          organizationId: organizationProfile.id,
          status: "PUBLISHED",
          isDeleted: false,
          type: "ORGANIZATION_EVENT",
        },
        orderBy: [{ startsAt: "asc" }],
        select: {
          id: true,
          slug: true,
          title: true,
          startsAt: true,
          endsAt: true,
          locationName: true,
          locationCity: true,
          address: true,
          locationSource: true,
          locationFormattedAddress: true,
          locationComponents: true,
          locationOverrides: true,
          pricingMode: true,
          timezone: true,
          templateType: true,
          coverImageUrl: true,
          ticketTypes: { select: { price: true } },
        },
      }),
      prisma.organization_follows.count({
        where: { organization_id: organizationProfile.id },
      }),
      viewerId
        ? prisma.organization_follows.findFirst({
            where: { organization_id: organizationProfile.id, follower_id: viewerId },
            select: { follower_id: true },
          })
        : Promise.resolve(null),
      hasInscricoes
        ? prisma.organizationForm.findMany({
            where: formsWhere,
            orderBy: [{ createdAt: "desc" }],
            select: {
              id: true,
              title: true,
              description: true,
              startAt: true,
              endAt: true,
              capacity: true,
              waitlistEnabled: true,
              status: true,
            },
          })
        : Promise.resolve([] as OrganizationFormPreview[]),
      hasReservasModule
        ? prisma.service.findMany({
            where: {
              organizationId: organizationProfile.id,
              isActive: true,
              ...(allowPaidServices ? {} : { unitPriceCents: 0 }),
            },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              title: true,
              description: true,
              kind: true,
              durationMinutes: true,
              unitPriceCents: true,
            currency: true,
            isActive: true,
            categoryTag: true,
            coverImageUrl: true,
            locationMode: true,
            defaultLocationText: true,
              professionalLinks: { select: { professionalId: true } },
              resourceLinks: { select: { resourceId: true } },
              packs: {
                where: allowPaidServices ? { isActive: true } : { id: -1 },
                orderBy: [{ recommended: "desc" }, { quantity: "asc" }],
                select: {
                  id: true,
                  quantity: true,
                  packPriceCents: true,
                  label: true,
                  recommended: true,
                },
              },
            },
          })
        : Promise.resolve([] as Array<{
            id: number;
            title: string;
            description: string | null;
            kind: string;
            durationMinutes: number;
            unitPriceCents: number;
            currency: string;
            isActive: boolean;
            categoryTag: string | null;
            coverImageUrl: string | null;
            locationMode: string | null;
            defaultLocationText: string | null;
            packs: Array<{ id: number; quantity: number; packPriceCents: number; label: string | null; recommended: boolean }>;
          }>),
      hasReservasModule
        ? prisma.reservationProfessional.findMany({
            where: { organizationId: organizationProfile.id, isActive: true },
            orderBy: [{ priority: "asc" }, { name: "asc" }],
            select: {
              id: true,
              name: true,
              roleTitle: true,
              user: { select: { avatarUrl: true, username: true } },
            },
          })
        : Promise.resolve([] as Array<{ id: number; name: string; roleTitle: string | null; user: { avatarUrl: string | null; username: string | null } | null }>),
      hasReservasModule
        ? prisma.reservationResource.findMany({
            where: { organizationId: organizationProfile.id, isActive: true },
            orderBy: [{ capacity: "asc" }, { priority: "asc" }, { id: "asc" }],
            select: { id: true, label: true, capacity: true },
          })
        : Promise.resolve([] as Array<{ id: number; label: string; capacity: number }>),
      hasReservasModule
        ? prisma.serviceReview.findMany({
            where: { organizationId: organizationProfile.id, isVerified: true },
            orderBy: { createdAt: "desc" },
            take: 8,
            select: {
              id: true,
              rating: true,
              comment: true,
              createdAt: true,
              user: { select: { fullName: true, avatarUrl: true } },
            },
          })
        : Promise.resolve([] as Array<{ id: number; rating: number; comment: string | null; createdAt: Date; user: { fullName: string | null; avatarUrl: string | null } | null }>),
    ]);

    const orgEvents: OrganizationEvent[] = events.map((event) => {
      const ticketPrices = event.ticketTypes?.map((t) => t.price ?? 0) ?? [];
      const isGratis = deriveIsFreeEvent({
        pricingMode: event.pricingMode ?? undefined,
        ticketPrices,
      });
      const locationComponents =
        event.locationComponents && typeof event.locationComponents === "object"
          ? (event.locationComponents as Record<string, unknown>)
          : null;
      const locationOverrides =
        event.locationOverrides && typeof event.locationOverrides === "object"
          ? (event.locationOverrides as Record<string, unknown>)
          : null;
      return {
        id: event.id,
        slug: event.slug,
        title: event.title,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        locationName: event.locationName,
        locationCity: event.locationCity,
        address: event.address,
        locationSource: event.locationSource,
        locationFormattedAddress: event.locationFormattedAddress,
        locationComponents,
        locationOverrides,
        timezone: event.timezone,
        templateType: event.templateType,
        coverImageUrl: event.coverImageUrl,
        isGratis,
      };
    });

    const store = await prisma.store.findFirst({
      where: { ownerOrganizationId: organizationProfile.id },
      select: { id: true, status: true, showOnProfile: true, catalogLocked: true, currency: true },
    });
    const storeEnabled = isStoreFeatureEnabled();
    const storeVisibleOnProfile = Boolean(store?.showOnProfile);
    const storeId = store?.id ?? null;
    const storePublic = storeEnabled && !!store && isStorePublic(store) && !store.catalogLocked;
    const [storeProducts, storeProductsCount] = storePublic && storeId !== null
      ? await Promise.all([
          prisma.storeProduct.findMany({
            where: { storeId, status: "ACTIVE", isVisible: true },
            orderBy: [{ createdAt: "desc" }],
            take: 8,
            select: {
              id: true,
              name: true,
              slug: true,
              priceCents: true,
              compareAtPriceCents: true,
              currency: true,
              createdAt: true,
              images: {
                select: { url: true, altText: true, isPrimary: true, sortOrder: true },
                orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
                take: 1,
              },
            },
          }),
          prisma.storeProduct.count({
            where: { storeId, status: "ACTIVE", isVisible: true },
          }),
        ])
      : [[], 0];

    const professionalsList = professionals.map((pro) => ({
      id: pro.id,
      name: pro.name,
      roleTitle: pro.roleTitle,
      avatarUrl: pro.user?.avatarUrl ?? null,
      username: pro.user?.username ?? null,
    }));
    const resourcesList = resources.map((resource) => ({
      id: resource.id,
      label: resource.label,
      capacity: resource.capacity,
    }));
    const reviewsCount = reviews.length;
    const reviewsAverage =
      reviewsCount > 0
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviewsCount
        : null;

    const categoryEvents = operationTemplate
      ? orgEvents.filter(
          (event) =>
            event.templateType === operationTemplate ||
            event.templateType === null ||
            event.templateType === "OTHER",
        )
      : orgEvents;
    const upcomingEvents = categoryEvents
      .filter((event) => event.startsAt && event.startsAt >= now)
      .sort((a, b) => (a.startsAt?.getTime() ?? 0) - (b.startsAt?.getTime() ?? 0));
    const pastEvents = categoryEvents
      .filter((event) => event.startsAt && event.startsAt < now)
      .sort((a, b) => (b.startsAt?.getTime() ?? 0) - (a.startsAt?.getTime() ?? 0));
    const spotlightEvent = upcomingEvents[0] ?? null;
    const coverCandidate = organizationProfile.brandingCoverUrl?.trim() || null;
    const headerCoverUrl = coverCandidate
      ? getProfileCoverUrl(coverCandidate, {
          width: 1500,
          height: 500,
          quality: 72,
          format: "webp",
        })
      : null;
    const initialIsFollowing = Boolean(followRow);
    const followersTotal = followersCount ?? 0;
    const pastEventIds = new Set(pastEvents.map((event) => event.id));
    const agendaUpcomingEvents = spotlightEvent
      ? upcomingEvents.filter((event) => event.id !== spotlightEvent.id)
      : upcomingEvents;
    const upcomingGroups = buildAgendaGroups(agendaUpcomingEvents, pastEventIds);
    const pastGroups = buildAgendaGroups(pastEvents, pastEventIds);
    const allGroups = buildAgendaGroups([...upcomingEvents, ...pastEvents], pastEventIds);
    const publicForms = forms.filter((form) => form.status !== "ARCHIVED");
    const featuredForm =
      publicForms.find((form) => /guarda[-\s]?redes/i.test(form.title)) ?? publicForms[0] ?? null;
    const spotlightCtaLabel = spotlightEvent
      ? spotlightEvent.templateType === "PADEL"
        ? "Inscrever agora"
        : spotlightEvent.isGratis
          ? "Garantir lugar"
          : "Comprar bilhete"
      : "Comprar bilhete";
    const spotlightCtaHref = spotlightEvent ? buildTicketHref(spotlightEvent.slug) : null;
    const inscriptionsCoverUrl = getEventCoverUrl(spotlightEvent?.coverImageUrl ?? null, {
      seed:
        spotlightEvent?.slug ??
        spotlightEvent?.id ??
        organizationProfile.username ??
        organizationProfile.id,
      width: 900,
      quality: 70,
      format: "webp",
    });
    const featuredFormDateLabel = featuredForm
      ? formatFormDateRange(featuredForm.startAt, featuredForm.endAt)
      : null;
    const featuredFormCapacityLabel = featuredForm?.capacity
      ? `${featuredForm.capacity} vagas`
      : null;
    const agendaTotal = upcomingEvents.length + pastEvents.length;
    const profileLayout = ensurePublicProfileLayout(organizationProfile.publicProfileLayout ?? null);
    const showServicesModule = hasReservasModule && services.length > 0;
    const showAgendaModule = showAgenda && agendaTotal > 0;
    const showFormsModule = hasInscricoes && publicForms.length > 0;
    const showReviewsModule = reviews.length > 0;
    const showAboutModule = Boolean(publicDescription?.trim());
    const servicesLayoutModule = profileLayout.modules.find((module) => module.type === "SERVICOS");
    const servicesSettings = servicesLayoutModule?.settings ?? {};
    const featuredServiceIds = Array.isArray(servicesSettings.featuredServiceIds)
      ? servicesSettings.featuredServiceIds
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id))
      : [];
    const servicesCarouselEnabled = servicesSettings.carouselEnabled !== false;
    const servicesCtaLabel =
      typeof servicesSettings.ctaLabel === "string" && servicesSettings.ctaLabel.trim().length > 0
        ? servicesSettings.ctaLabel.trim()
        : "Agendar";
    const servicesCtaHref =
      typeof servicesSettings.ctaHref === "string" && servicesSettings.ctaHref.trim().length > 0
        ? servicesSettings.ctaHref.trim()
        : "#reservar";
    const servicesShowStats = servicesSettings.showStats !== false;
    const agendaLayoutModule = profileLayout.modules.find((module) => module.type === "AGENDA");
    const agendaSettings = agendaLayoutModule?.settings ?? {};
    const agendaShowSpotlight = agendaSettings.showSpotlight !== false;
    const formsLayoutModule = profileLayout.modules.find((module) => module.type === "FORMULARIOS");
    const formsSettings = formsLayoutModule?.settings ?? {};
    const formsCtaLabel =
      typeof formsSettings.ctaLabel === "string" && formsSettings.ctaLabel.trim().length > 0
        ? formsSettings.ctaLabel.trim()
        : "Responder";
    const reviewsLayoutModule = profileLayout.modules.find((module) => module.type === "AVALIACOES");
    const reviewsSettings = reviewsLayoutModule?.settings ?? {};
    const reviewsMaxItems =
      typeof reviewsSettings.maxItems === "number" && Number.isFinite(reviewsSettings.maxItems)
        ? Math.max(1, Math.min(12, Math.floor(reviewsSettings.maxItems)))
        : 8;
    const displayReviews = reviews.slice(0, reviewsMaxItems);

    const padelPlayersCount =
      hasTorneiosModule
        ? await prisma.padelPlayerProfile.count({ where: { organizationId: organizationProfile.id } })
        : 0;

    const padelTopPlayers =
      hasTorneiosModule
        ? await prisma.padelPlayerProfile.findMany({
            where: { organizationId: organizationProfile.id, isActive: true },
            orderBy: { createdAt: "desc" },
            take: 4,
            select: {
              id: true,
              displayName: true,
              fullName: true,
              level: true,
              gender: true,
            },
          })
        : [];

    const trainerProfiles =
      hasTorneiosModule
        ? await prisma.trainerProfile.findMany({
            where: { organizationId: organizationProfile.id, isPublished: true, reviewStatus: "APPROVED" },
            include: { user: { select: { id: true, fullName: true, username: true, avatarUrl: true } } },
            orderBy: { updatedAt: "desc" },
          })
        : [];
    const trainerUserIds = trainerProfiles.map((trainer) => trainer.userId);
    const trainerServices = trainerUserIds.length
      ? await prisma.service.findMany({
          where: {
            organizationId: organizationProfile.id,
            instructorId: { in: trainerUserIds },
            isActive: true,
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            durationMinutes: true,
            unitPriceCents: true,
            currency: true,
            instructorId: true,
          },
        })
      : [];
    const trainerServicesByUser = new Map<string, typeof trainerServices>();
    trainerServices.forEach((service) => {
      if (!service.instructorId) return;
      const current = trainerServicesByUser.get(service.instructorId) ?? [];
      trainerServicesByUser.set(service.instructorId, [...current, service]);
    });

    const servicesModuleContent = showServicesModule ? (
      <section className="space-y-5 sm:space-y-6">
        <div className="rounded-3xl border border-white/12 bg-white/5 p-4 sm:p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Reservas</p>
              <h2 className="text-xl font-semibold text-white sm:text-2xl">{orgDisplayName}</h2>
              {servicesShowStats && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-white/65 sm:gap-2 sm:text-[12px]">
                  <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1">
                    {reviewsAverage ? `${reviewsAverage.toFixed(1)} ★` : "Novo"}
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1">
                    {reviewsCount} avaliações
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1">
                    {organizationProfile.city ?? "Localização"}
                  </span>
                </div>
              )}
            </div>
            <a
              href={servicesCtaHref}
              className="w-full rounded-full bg-white px-5 py-2 text-center text-[12px] font-semibold text-black shadow-[0_10px_30px_rgba(255,255,255,0.25)] sm:w-auto"
            >
              {servicesCtaLabel}
            </a>
          </div>
        </div>

        <div id="reservar">
          <ReservasBookingSection
            organization={{
              id: organizationProfile.id,
              publicName: organizationProfile.publicName,
              businessName: organizationProfile.businessName,
              city: organizationProfile.city,
              username: organizationProfile.username ?? null,
              timezone: organizationProfile.timezone ?? "Europe/Lisbon",
              address: organizationProfile.address ?? null,
              reservationAssignmentMode:
                organizationProfile.reservationAssignmentMode ?? "PROFESSIONAL",
            }}
            services={services.map((service) => ({
              ...service,
              coverImageUrl: service.coverImageUrl ?? null,
              locationMode: (service.locationMode ?? "FIXED") as "FIXED" | "CHOOSE_AT_BOOKING",
            }))}
            professionals={professionalsList}
            resources={resourcesList}
            initialServiceId={initialServiceId}
            featuredServiceIds={featuredServiceIds}
            servicesLayout={servicesCarouselEnabled ? "carousel" : "grid"}
          />
        </div>
      </section>
    ) : null;

    const aboutModuleContent = showAboutModule ? (
      <div className="rounded-3xl border border-white/12 bg-white/5 p-4 sm:p-5 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Sobre</p>
        <p className="mt-2 text-[13px] text-white/70 sm:text-sm">
          {publicDescription || "Descrição indisponível."}
        </p>
      </div>
    ) : null;

    const reviewsModuleContent = showReviewsModule ? (
      <div className="rounded-3xl border border-white/12 bg-white/5 p-4 sm:p-5 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Avaliações</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {displayReviews.map((review) => (
            <div key={review.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white">{review.user?.fullName || "Cliente"}</p>
                <span className="text-[12px] text-white/70">{review.rating} ★</span>
              </div>
              {review.comment && <p className="mt-2 text-[12px] text-white/70">{review.comment}</p>}
            </div>
          ))}
        </div>
      </div>
    ) : null;

    const agendaModuleContent = showAgendaModule ? (
      <div className="rounded-3xl border border-white/12 bg-white/5 p-4 sm:p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <OrganizationAgendaTabs
          title="Agenda pública"
          anchorId="agenda"
          layout="stack"
          upcomingGroups={upcomingGroups}
          pastGroups={pastGroups}
          allGroups={allGroups}
          upcomingCount={upcomingEvents.length}
          pastCount={pastEvents.length}
          totalCount={agendaTotal}
          prelude={
            agendaShowSpotlight ? (
              <EventSpotlightCard
                event={spotlightEvent}
                label={`Próximo ${operationMeta.noun}`}
                emptyLabel={`Sem ${operationMeta.noun} anunciado`}
                ctaLabel={spotlightCtaLabel}
                ctaHref={spotlightCtaHref}
                variant="embedded"
              />
            ) : null
          }
        />
      </div>
    ) : null;

    const formsModuleContent = showFormsModule ? (
      <section className="relative overflow-hidden rounded-3xl border border-white/12 bg-[#05070f]/80 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        <div className="absolute inset-0" aria-hidden="true">
          <div className="absolute inset-0 bg-gradient-to-r from-[#05070f]/95 via-[#0b1124]/85 to-transparent" />
          <div className="absolute inset-y-0 right-0 w-2/3">
            <div
              className="absolute inset-0 bg-cover bg-center opacity-80"
              style={{ backgroundImage: `url(${inscriptionsCoverUrl})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-l from-transparent via-black/40 to-[#05070f]/95" />
          </div>
        </div>

        <div className="relative z-10 space-y-2">
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Formulários</p>
          <h3 className="text-lg font-semibold text-white">
            {featuredForm?.title || "Formulário em preparação"}
          </h3>
          {featuredFormDateLabel || featuredFormCapacityLabel ? (
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/70">
              {featuredFormDateLabel && (
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                  {featuredFormDateLabel}
                </span>
              )}
              {featuredFormCapacityLabel && (
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                  {featuredFormCapacityLabel}
                </span>
              )}
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {featuredForm ? (
              <Link
                href={`/inscricoes/${featuredForm.id}`}
                className="rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-black shadow-[0_10px_30px_rgba(255,255,255,0.25)]"
              >
                {formsCtaLabel}
              </Link>
            ) : (
              <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white/70">
                Em breve
              </span>
            )}
          </div>
        </div>
      </section>
    ) : null;

    const storeBaseHref = `/${organizationProfile.username ?? usernameParam}/loja`;
    const storeHasProducts = storeProducts.length > 0;
    const storePreviewLimit = 8;
    const storePreviewItems = storeProducts.slice(0, storePreviewLimit);
    const storeHasMore = storeProductsCount > storePreviewLimit;
    const storeCompactGrid = storeProductsCount > 0 && storeProductsCount <= 4;
    const storeStatus = !storeEnabled
      ? {
          label: "Loja indisponivel",
          description: "A funcionalidade da loja esta temporariamente desativada.",
          tone: "amber",
        }
      : store?.catalogLocked
        ? {
            label: "Catalogo fechado",
            description: "O catalogo esta em manutencao e sera atualizado em breve.",
            tone: "amber",
          }
        : store?.status !== "OPEN"
          ? {
              label: "Loja fechada",
              description: "Volta em breve para veres os produtos disponiveis.",
              tone: "slate",
            }
          : storeHasProducts
            ? {
                label: "Loja ativa",
                description: "Produtos oficiais com checkout rapido ORYA.",
                tone: "emerald",
              }
            : {
                label: "Produtos em preparacao",
                description: "Os primeiros produtos vao aparecer aqui muito em breve.",
                tone: "slate",
              };
    const storeStatusClasses =
      storeStatus.tone === "emerald"
        ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100"
        : storeStatus.tone === "amber"
          ? "border-amber-300/40 bg-amber-400/10 text-amber-100"
          : "border-white/15 bg-white/10 text-white/70";
    const storeFallbackTitle = storeStatus.tone === "amber" ? "Em atualizacao" : "Em breve";
    const storeFallbackBody =
      storeStatus.tone === "amber"
        ? "Estamos a atualizar o catalogo para garantir a melhor experiencia."
        : "Assim que a loja estiver pronta, vais ver produtos oficiais e compras diretas aqui.";
    const storeFallbackFooter =
      storeStatus.tone === "amber"
        ? "Obrigado pela paciencia."
        : "Segue esta organizacao para receber novidades.";
    const storeCtaClasses = storePublic
      ? "rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-black shadow-[0_10px_30px_rgba(255,255,255,0.25)]"
      : "rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white/80";
    const showStoreModule = storeVisibleOnProfile;
    const storeModuleContent = showStoreModule ? (
      <section className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-[#0b1226]/85 via-[#121a33]/75 to-[#060b14]/95 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-5">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white/8 to-transparent" />
        <div className="relative space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Loja</p>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-white">Produtos oficiais</h3>
                <span
                  className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.2em] ${storeStatusClasses}`}
                >
                  {storeStatus.label}
                </span>
              </div>
              <p className="text-[12px] text-white/60">Checkout ORYA.</p>
            </div>
            <Link href={storeBaseHref} className={storeCtaClasses}>
              Visitar loja
            </Link>
          </div>

          {storePublic && storeHasProducts ? (
            <div
              className={
                storeCompactGrid
                  ? "flex flex-wrap gap-3"
                  : "grid auto-cols-[150px] grid-flow-col gap-3 overflow-x-auto pb-2 sm:auto-cols-[170px]"
              }
            >
              {storePreviewItems.map((product) => {
                const image = product.images[0];
                const compareAt = product.compareAtPriceCents ?? null;
                const hasDiscount =
                  typeof compareAt === "number" && compareAt > product.priceCents;
                const discount = hasDiscount
                  ? Math.round(((compareAt - product.priceCents) / compareAt) * 100)
                  : null;
                const isNew =
                  now.getTime() - product.createdAt.getTime() <= 1000 * 60 * 60 * 24 * 30;
                return (
                  <Link
                    key={product.id}
                    href={`${storeBaseHref}/produto/${product.slug}`}
                    className={`group rounded-2xl border border-white/10 bg-black/40 p-3 transition hover:border-white/30 hover:bg-black/30 ${
                      storeCompactGrid ? "w-[150px] sm:w-[170px]" : "w-full"
                    }`}
                  >
                    <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-white/10 bg-black/60">
                      {image ? (
                        <Image
                          src={image.url}
                          alt={image.altText || product.name}
                          fill
                          sizes="(max-width: 640px) 150px, (max-width: 1024px) 180px, 200px"
                          className="object-cover transition group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-white/40">
                          Sem imagem
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute left-3 top-3 flex gap-2">
                        {isNew ? (
                          <span className="rounded-full border border-emerald-300/40 bg-emerald-400/15 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-emerald-100">
                            Novo
                          </span>
                        ) : null}
                        {discount ? (
                          <span className="rounded-full border border-white/20 bg-black/60 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-white/80">
                            -{discount}%
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 space-y-1">
                      <p className="line-clamp-2 text-sm font-semibold text-white">{product.name}</p>
                      <div className="flex items-center gap-2 text-[11px] text-white/70">
                        <span className="text-white">{formatMoney(product.priceCents, product.currency)}</span>
                        {hasDiscount ? (
                          <span className="text-white/40 line-through">
                            {formatMoney(compareAt, product.currency)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-white/12 bg-white/5 p-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">
                  {storeStatus.label}
                </p>
                <p className="mt-2 text-sm text-white/70">{storeStatus.description}</p>
              </div>
              <div className="rounded-2xl border border-white/12 bg-black/30 p-3 text-sm text-white/70">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">
                  {storeFallbackTitle}
                </p>
                <p className="mt-2">{storeFallbackBody}</p>
                <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/60">
                  {storeFallbackFooter}
                </div>
              </div>
            </div>
          )}
          {storePublic && storeHasProducts && storeHasMore ? (
            <div className="flex justify-end">
              <Link href={storeBaseHref} className="text-[11px] text-white/60 hover:text-white/90">
                Ver todos · {storeProductsCount}+
              </Link>
            </div>
          ) : null}
        </div>
      </section>
    ) : null;

    const moduleContentByType: Record<PublicProfileModuleType, ReactNode> = {
      SERVICOS: servicesModuleContent,
      AGENDA: agendaModuleContent,
      FORMULARIOS: formsModuleContent,
      AVALIACOES: reviewsModuleContent,
      SOBRE: aboutModuleContent,
      LOJA: storeModuleContent,
    };

    const modulesToRender = profileLayout.modules.filter(
      (module) => module.enabled && moduleContentByType[module.type],
    );
    const showPadelSection =
      hasTorneiosModule && (padelPlayersCount > 0 || padelTopPlayers.length > 0);
    const showTrainerSection = hasTorneiosModule && trainerProfiles.length > 0;
    const contactItems = [
      publicWebsiteHref ? { label: "Website", value: publicWebsiteHref, href: publicWebsiteHref } : null,
      publicInstagram ? { label: "Instagram", value: publicInstagram, href: publicInstagram } : null,
      publicYoutube ? { label: "YouTube", value: publicYoutube, href: publicYoutube } : null,
      contactEmail ? { label: "Email", value: contactEmail, href: `mailto:${contactEmail}` } : null,
    ].filter(Boolean) as Array<{ label: string; value: string; href: string }>;
    const secondaryContacts = contactItems.filter((item) => item.label !== "Email");
    const showEmptyModulesFallback =
      modulesToRender.length === 0 && !showPadelSection && !showTrainerSection;
    const emptyModulesFallback = (
      <section className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-[#0b1226]/85 via-[#0b1124]/75 to-[#070c16]/95 p-7 shadow-[0_28px_90px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-12 -top-12 h-48 w-48 rounded-full bg-[#6BFFFF]/12 blur-[120px]" />
          <div className="absolute -right-8 top-6 h-40 w-40 rounded-full bg-[#FF7AD1]/12 blur-[120px]" />
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white/8 to-transparent" />
        </div>
        <div className="relative grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/70">
              <span className="h-2 w-2 rounded-full bg-emerald-300/70 shadow-[0_0_12px_rgba(16,185,129,0.6)]" />
              Perfil em preparação
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-white">Estamos a preparar novidades</h3>
              <p className="text-sm text-white/70">
                Este perfil vai ficar ativo muito em breve. Assim que os primeiros modulos forem publicados,
                vais ver servicos, eventos, torneios, formularios e loja.
              </p>
            </div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/50">
              Sem modulos ativos
            </div>
          </div>
          <div className="rounded-2xl border border-white/12 bg-black/30 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Contacto principal</p>
            {contactEmail ? (
              <a
                href={`mailto:${contactEmail}`}
                className="mt-3 flex items-center justify-between rounded-2xl border border-emerald-300/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100 transition hover:border-emerald-200/70 hover:bg-emerald-400/15"
              >
                <span className="font-semibold">{contactEmail}</span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-200/80">
                  Enviar email
                </span>
              </a>
            ) : (
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
                Email por anunciar.
              </div>
            )}
            {secondaryContacts.length > 0 ? (
              <div className="mt-4 space-y-2 text-[12px] text-white/70">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Outros canais</p>
                {secondaryContacts.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 transition hover:border-white/25"
                  >
                    <span className="text-white/60">{item.label}</span>
                    <span className="text-white">{item.value}</span>
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    );

    return (
      <main className="relative min-h-screen w-full overflow-hidden text-white">
        <section className="relative flex flex-col gap-8 py-10">
          <OrganizationProfileHeader
            name={orgDisplayName}
            username={organizationProfile.username ?? usernameParam}
            avatarUrl={organizationProfile.brandingAvatarUrl ?? null}
            coverUrl={headerCoverUrl}
            bio={publicDescription}
            city={organizationProfile.city ?? null}
            followersCount={followersTotal}
            organizationId={organizationProfile.id}
            initialIsFollowing={initialIsFollowing}
            isPublic
            isVerified={isVerified}
            instagramHref={publicInstagram}
            youtubeHref={publicYoutube}
            websiteHref={publicWebsiteHref}
            contactEmail={contactEmail}
          />

          <div className="px-5 sm:px-8">
            <div className="orya-page-width flex flex-col gap-8">
              {modulesToRender.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2">
                  {modulesToRender.map((module) => {
                    const content = moduleContentByType[module.type];
                    if (!content) return null;
                    return (
                      <div
                        key={module.id}
                        className={module.width === "full" ? "md:col-span-2" : ""}
                      >
                        {content}
                      </div>
                    );
                  })}
                </div>
              ) : showEmptyModulesFallback ? (
                emptyModulesFallback
              ) : null}

              {showPadelSection && (
                <section className="space-y-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Centro de competição</p>
                    <h2 className="text-xl font-semibold text-white">PADEL oficial</h2>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-3xl border border-white/12 bg-white/5 p-5 text-sm text-white/75 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Jogadores</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{padelPlayersCount}</p>
                      <p className="text-[12px] text-white/60">Perfis ativos na competição.</p>
                      {padelTopPlayers.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-white/70">
                          {padelTopPlayers.map((player) => (
                            <span
                              key={player.id}
                              className="rounded-full border border-white/15 bg-white/10 px-3 py-1"
                            >
                              {player.displayName || player.fullName || "Jogador"}{player.level ? ` · ${player.level}` : ""}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-[12px] text-white/50">Top players a definir.</p>
                      )}
                    </div>
                    <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050912]/90 p-5 text-sm text-white/75 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Histórico oficial</p>
                      <p className="mt-2 text-[12px] text-white/70">
                        Aqui vês campeões e resultados oficiais assim que forem publicados.
                      </p>
                      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/70">
                        Temporada atual em preparação.
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {showTrainerSection && (
                <section className="space-y-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Treinadores</p>
                    <h2 className="text-xl font-semibold text-white">Conhece a equipa</h2>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {trainerProfiles.map((trainer) => {
                      const displayName =
                        trainer.user?.fullName || trainer.user?.username || "Treinador";
                      const trainerSlug = trainer.user?.username || trainer.user?.id || "";
                      const trainerHref = trainerSlug
                        ? `/${organizationProfile.username ?? usernameParam}/treinadores/${trainerSlug}`
                        : null;
                      const services = trainerServicesByUser.get(trainer.userId) ?? [];
                      const primaryService = services[0] ?? null;
                      return (
                        <div
                          key={trainer.userId}
                          className="rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 overflow-hidden rounded-full border border-white/15 bg-white/10">
                              {trainer.user?.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={trainer.user.avatarUrl}
                                  alt={displayName}
                                  className="h-full w-full object-cover"
                                />
                              ) : null}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-white">{displayName}</p>
                            </div>
                          </div>
                          {trainer.bio && (
                            <p className="text-[12px] text-white/70 line-clamp-3">{trainer.bio}</p>
                          )}
                          {primaryService ? (
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-white/70">
                              <span>
                                {primaryService.title} · {primaryService.durationMinutes} min
                              </span>
                              <span>
                                {(primaryService.unitPriceCents / 100).toFixed(2)} {primaryService.currency}
                              </span>
                            </div>
                          ) : (
                            <p className="text-[12px] text-white/50">Aulas em breve.</p>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {primaryService && (
                              <Link
                                href={`/${organizationProfile.username ?? usernameParam}?serviceId=${primaryService.id}`}
                                className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-[11px] text-emerald-100"
                              >
                                Reservar aula
                              </Link>
                            )}
                            {trainerHref && (
                              <Link
                                href={trainerHref}
                                className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] text-white/70"
                              >
                                Ver perfil
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!profile) {
    notFound();
  }

  const resolvedProfile = profile;
  const isOwner = viewerId === resolvedProfile.id;
  const isPrivate = resolvedProfile.visibility !== "PUBLIC";
  let isFollowing = false;
  let initialIsFollowing = false;

  let stats = {
    total: 0,
    upcoming: 0,
    past: 0,
    totalSpent: "—",
  };
  let followersCount = 0;
  let followingCount = 0;

  let recent: Array<{
    id: string;
    title: string;
    venueName: string | null;
    coverUrl: string | null;
    startAt: Date | null;
    isUpcoming: boolean;
    slug: string | null;
  }> = [];

  if (prisma.follows) {
    const counts = await getUserFollowCounts(resolvedProfile.id);
    followersCount = counts.followersCount;
    followingCount = counts.followingTotal;

    if (!isOwner && viewerId) {
      isFollowing = await isUserFollowing(viewerId, resolvedProfile.id);
      initialIsFollowing = isFollowing;
    }
  }

  const canSeePrivateTimeline = isOwner || !isPrivate || isFollowing;
  const now = new Date();

  const profileHandle = resolvedProfile.username ?? usernameParam;
  const padelUser = await prisma.users.findUnique({
    where: { id: resolvedProfile.id },
    select: { email: true },
  });
  const padelMissing = getPadelOnboardingMissing({
    profile: {
      fullName: resolvedProfile.fullName,
      username: resolvedProfile.username,
      contactPhone: resolvedProfile.contactPhone ?? null,
      gender: resolvedProfile.gender ?? null,
      padelLevel: resolvedProfile.padelLevel ?? null,
      padelPreferredSide: resolvedProfile.padelPreferredSide ?? null,
    },
    email: padelUser?.email ?? null,
  });
  const padelComplete = isPadelOnboardingComplete(padelMissing);
  type PadelActionTone = "emerald" | "amber" | "ghost";
  const padelAction: { href: string; label: string; tone?: PadelActionTone } | null = canSeePrivateTimeline
    ? isOwner
      ? {
          href: padelComplete
            ? `/${profileHandle}/padel`
            : `/onboarding/padel?redirectTo=${encodeURIComponent(`/${profileHandle}/padel`)}`,
          label: padelComplete ? "Padel" : "Concluir Padel",
          tone: padelComplete ? "emerald" : "amber",
        }
      : padelComplete
        ? { href: `/${profileHandle}/padel`, label: "Padel", tone: "ghost" }
        : null
    : null;

  if (canSeePrivateTimeline && (prisma as any).entitlement) {
    try {
      const [total, upcoming, past, recentEntitlements] = await Promise.all([
        (prisma as any).entitlement.count({ where: { ownerUserId: resolvedProfile.id } }),
        (prisma as any).entitlement.count({
          where: { ownerUserId: resolvedProfile.id, snapshotStartAt: { gte: now } },
        }),
        (prisma as any).entitlement.count({
          where: { ownerUserId: resolvedProfile.id, snapshotStartAt: { lt: now } },
        }),
        (prisma as any).entitlement.findMany({
          where: { ownerUserId: resolvedProfile.id },
          orderBy: [{ snapshotStartAt: "desc" }],
          take: 4,
          select: {
            id: true,
            eventId: true,
            snapshotTitle: true,
            snapshotVenueName: true,
            snapshotCoverUrl: true,
            snapshotStartAt: true,
          },
        }),
      ]);

      stats = {
        total,
        upcoming,
        past,
        totalSpent: "—",
      };

      const eventIds = Array.from(
        new Set<number>(
          (recentEntitlements ?? [])
            .map((r: any) => r.eventId)
            .filter((id: unknown): id is number => typeof id === "number"),
        ),
      );
      const eventSlugRows = eventIds.length
        ? await prisma.event.findMany({
            where: { id: { in: eventIds } },
            select: { id: true, slug: true },
          })
        : [];
      const slugMap = new Map(eventSlugRows.map((row) => [row.id, row.slug]));

      recent = (recentEntitlements ?? []).map((r: any) => ({
        id: r.id,
        title: r.snapshotTitle,
        venueName: r.snapshotVenueName,
        coverUrl: r.snapshotCoverUrl,
        startAt: r.snapshotStartAt,
        isUpcoming: r.snapshotStartAt ? new Date(r.snapshotStartAt) >= now : false,
        slug: typeof r.eventId === "number" ? slugMap.get(r.eventId) ?? null : null,
      }));
    } catch (err) {
      console.warn("[profile] falha ao carregar entitlements", err);
    }
  }

  const displayName =
    organizationProfile?.publicName?.trim() ||
    resolvedProfile.fullName?.trim() ||
    resolvedProfile.username ||
    "Utilizador ORYA";
  const coverCandidate = resolvedProfile.coverUrl?.trim() || null;
  const headerCoverUrl = coverCandidate
    ? getProfileCoverUrl(coverCandidate, {
        width: 1500,
        height: 500,
        quality: 72,
        format: "webp",
      })
    : null;
  const recentMobile = recent.map((item) => ({
    ...item,
    startAt: item.startAt ? item.startAt.toISOString() : null,
  }));
  const desktopInterests = normalizeInterestSelection(resolvedProfile.favouriteCategories ?? []);

  return (
    <main className="relative min-h-screen w-full overflow-hidden text-white">
      <div className="md:hidden">
        <MobileTopBar />
        <MobileProfileOverview
          name={displayName}
          username={resolvedProfile.username}
          avatarUrl={resolvedProfile.avatarUrl}
          avatarUpdatedAt={resolvedProfile.updatedAt ? resolvedProfile.updatedAt.getTime() : null}
          coverUrl={headerCoverUrl}
          city={resolvedProfile.city}
          bio={resolvedProfile.bio}
          isOwner={isOwner}
          targetUserId={resolvedProfile.id}
          initialIsFollowing={initialIsFollowing}
          followersCount={followersCount}
          followingCount={followingCount}
          padelAction={padelAction ?? undefined}
          interests={resolvedProfile.favouriteCategories ?? []}
          recentEvents={recentMobile}
        />
      </div>

      <section className="relative hidden flex-col gap-6 py-10 md:flex">
        <ProfileHeader
          isOwner={isOwner}
          name={displayName}
          username={resolvedProfile.username}
          avatarUrl={resolvedProfile.avatarUrl}
          avatarUpdatedAt={resolvedProfile.updatedAt ? resolvedProfile.updatedAt.getTime() : null}
          coverUrl={headerCoverUrl}
          bio={resolvedProfile.bio}
          city={resolvedProfile.city}
          visibility={resolvedProfile.visibility as "PUBLIC" | "PRIVATE" | "FOLLOWERS" | null}
          followers={followersCount}
          following={followingCount}
          targetUserId={resolvedProfile.id}
          initialIsFollowing={initialIsFollowing}
          isVerified={resolvedProfile.is_verified}
          canOpenLists={canSeePrivateTimeline}
          padelAction={padelAction ?? undefined}
        />

        <div className="px-5 sm:px-8">
          <div className="orya-page-width flex flex-col gap-6">
            {(desktopInterests.length > 0 || isOwner) && (
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Interesses</p>
                    <p className="mt-2 text-sm text-white/70">
                      {desktopInterests.length > 0
                        ? "O que inspira este perfil."
                        : "Ainda não definiste interesses."}
                    </p>
                  </div>
                  {isOwner && desktopInterests.length === 0 && (
                    <Link
                      href="/me/settings"
                      className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[11px] font-semibold text-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.25)] hover:border-white/40 hover:bg-white/15 transition-colors"
                    >
                      Adicionar interesses
                    </Link>
                  )}
                </div>
                {desktopInterests.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {desktopInterests.map((interest) => (
                      <FilterChip
                        key={interest}
                        label={resolveInterestLabel(interest) ?? interest}
                        icon={<InterestIcon id={interest} className="h-3 w-3" />}
                        active
                        className="cursor-default"
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
            {canSeePrivateTimeline ? (
              <>
                <section className="rounded-3xl border border-white/15 bg-white/5 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                      title="Eventos com bilhete"
                      value={stats.total}
                      subtitle="Timeline ORYA."
                      tone="default"
                    />
                    <StatCard
                      title="Próximos"
                      value={stats.upcoming}
                      subtitle="O que vem aí."
                      tone="emerald"
                    />
                    <StatCard
                      title="Passados"
                      value={stats.past}
                      subtitle="Memórias."
                      tone="rose"
                    />
                    <StatCard
                      title="Total investido"
                      value={stats.totalSpent}
                      subtitle="Total pago."
                      tone="purple"
                    />
                  </div>
                </section>

                {isOwner ? (
                  <section className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold text-white/95 tracking-[0.08em]">
                          Carteira ORYA
                        </h2>
                        <p className="text-[11px] text-white/68">
                          Entitlements ativos primeiro; memórias logo atrás. Tudo num só lugar.
                        </p>
                      </div>
                      <Link
                        href="/me/carteira?section=wallet"
                        className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 text-white text-[11px] font-semibold px-4 py-1.5 shadow-[0_10px_26px_rgba(255,255,255,0.15)] hover:border-white/45 hover:bg-white/20 hover:scale-[1.02] active:scale-95 transition-transform backdrop-blur"
                      >
                        Ver carteira
                        <span className="text-[12px]">↗</span>
                      </Link>
                    </div>

                    {recent.length === 0 ? (
                      <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-6 text-sm text-white/80">
                        Ainda não tens bilhetes ORYA.
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        {recent.map((item) => (
                          <RecentCard key={item.id} item={item} />
                        ))}
                      </div>
                    )}
                  </section>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <EventListCard
                      title="Próximos eventos"
                      items={recent.filter((r) => r.isUpcoming)}
                      emptyLabel="Sem eventos futuros para mostrar."
                    />
                    <EventListCard
                      title="Eventos passados"
                      items={recent.filter((r) => !r.isUpcoming)}
                      emptyLabel="Sem eventos passados para mostrar."
                    />
                  </div>
                )}
              </>
            ) : (
              <section className="rounded-3xl border border-white/15 bg-white/5 p-6 shadow-[0_26px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl text-center">
                <h2 className="text-lg font-semibold text-white">Perfil privado</h2>
                <p className="mt-2 text-sm text-white/70">
                  {displayName} mantém a timeline privada. Envia um pedido para seguir e aguarda
                  aprovação.
                </p>
              </section>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function formatFormDateRange(startAt: Date | null, endAt: Date | null) {
  if (!startAt && !endAt) return "Disponível sempre";
  if (startAt && endAt) {
    const startLabel = formatDate(startAt);
    const endLabel = formatDate(endAt);
    return startLabel && endLabel ? `${startLabel} – ${endLabel}` : startLabel || endLabel;
  }
  return formatDate(startAt ?? endAt);
}

function buildTicketHref(slug: string) {
  return `/eventos/${slug}?checkout=1#bilhetes`;
}

function EventSpotlightCard({
  event,
  label,
  emptyLabel,
  ctaLabel,
  ctaHref,
  variant = "default",
}: {
  event: OrganizationEvent | null;
  label: string;
  emptyLabel: string;
  ctaLabel: string;
  ctaHref: string | null;
  variant?: "default" | "embedded";
}) {
  if (!event) {
    return (
      <div className="rounded-3xl border border-white/12 bg-white/5 p-5 text-sm text-white/70 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">{label}</p>
        <h3 className="mt-2 text-xl font-semibold text-white">{emptyLabel}</h3>
        <p className="mt-1 text-[12px] text-white/60">Próximas datas aqui.</p>
      </div>
    );
  }

  const cover = getEventCoverUrl(event.coverImageUrl, {
    seed: event.slug ?? event.id ?? event.title,
    width: 1400,
    quality: 72,
    format: "webp",
  });
  const eventHref = `/eventos/${event.slug}`;
  const wrapperClass =
    variant === "embedded"
      ? "relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4"
      : "relative overflow-hidden rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_26px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl";

  return (
    <div className={wrapperClass}>
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${cover})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-transparent" />
      <Link
        href={eventHref}
        aria-label={`Abrir ${event.title}`}
        className="absolute inset-0 z-0"
      />
      <div className="relative z-10 max-w-xl space-y-2">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/70">{label}</p>
        <h3 className="text-2xl font-semibold text-white">{event.title}</h3>
        <p className="text-[12px] text-white/75">
          {formatEventDateRange(event.startsAt, event.endsAt, event.timezone)}
        </p>
        <p className="text-[12px] text-white/65">
          {formatEventLocationLabel(
            {
              locationName: event.locationName,
              locationCity: event.locationCity,
              address: event.address,
              locationSource: event.locationSource,
              locationFormattedAddress: event.locationFormattedAddress,
              locationComponents: event.locationComponents,
              locationOverrides: event.locationOverrides,
            },
            "Local a anunciar",
          )}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {ctaHref && (
            <Link
              href={ctaHref}
              className="relative z-10 rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-black shadow-[0_10px_30px_rgba(255,255,255,0.35)]"
            >
              {ctaLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

type StatTone = "default" | "emerald" | "rose" | "purple";

function toneClasses(tone: StatTone) {
  switch (tone) {
    case "emerald":
      return "border-emerald-300/30 bg-emerald-400/12 text-emerald-50";
    case "rose":
      return "border-rose-300/30 bg-rose-400/12 text-rose-50";
    case "purple":
      return "border-purple-300/30 bg-purple-400/12 text-purple-50";
    default:
      return "border-white/12 bg-white/5 text-white";
  }
}

function StatCard({
  title,
  value,
  subtitle,
  tone = "default",
}: {
  title: string;
  value: string | number;
  subtitle: string;
  tone?: StatTone;
}) {
  return (
    <div
      className={`rounded-2xl border px-3 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-2xl ${toneClasses(
        tone,
      )}`}
    >
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/60">{title}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      <p className="text-[11px] text-white/60">{subtitle}</p>
    </div>
  );
}

function RecentCard({
  item,
}: {
  item: { id: string; title: string; venueName: string | null; coverUrl: string | null; startAt: Date | null };
}) {
  const coverUrl = getEventCoverUrl(item.coverUrl, {
    seed: item.id ?? item.title,
    width: 200,
    quality: 70,
    format: "webp",
  });
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-white/5 p-3 shadow-[0_12px_36px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_30%_30%,rgba(255,0,200,0.14),transparent_45%),radial-gradient(circle_at_70%_70%,rgba(107,255,255,0.14),transparent_50%),#0b0f1b]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverUrl}
            alt={item.title}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white line-clamp-2">{item.title}</p>
          <p className="text-[11px] text-white/70 line-clamp-1">{item.venueName || "Local a anunciar"}</p>
          <p className="text-[11px] text-white/60">{formatDate(item.startAt)}</p>
        </div>
      </div>
    </div>
  );
}

function EventListCard({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: Array<{ id: string; title: string; venueName: string | null; coverUrl: string | null; startAt: Date | null }>;
  emptyLabel: string;
}) {
  return (
    <section className="rounded-3xl border border-white/15 bg-white/5 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/90">{title}</h3>
      </div>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-6 text-[12px] text-white/80">
          {emptyLabel}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <RecentCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
