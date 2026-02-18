import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import ProfileHeader from "@/app/components/profile/ProfileHeader";
import OrganizationProfileHeader from "@/app/components/profile/OrganizationProfileHeader";
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
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { shouldShowStoreOnPublicProfile } from "@/lib/publicOrganizationProfile";
import { normalizeOfficialEmail } from "@/lib/organizationOfficialEmailUtils";
import { getUserIdentityIds } from "@/lib/ownership/identity";
import { OrganizationFormStatus, type Prisma } from "@prisma/client";
import { deriveIsFreeEvent } from "@/domain/events/derivedIsFree";
import { PUBLIC_EVENT_DISCOVER_STATUSES } from "@/domain/events/publicStatus";
import ReservasBookingSection from "@/app/[username]/_components/ReservasBookingSection";
import { formatEventLocationLabel, pickCanonicalField } from "@/lib/location/eventLocation";
import { getUserFollowCounts, isUserFollowing } from "@/domain/social/follows";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { isReservedUsername } from "@/lib/reservedUsernames";
import { normalizeUsernameInput } from "@/lib/username";
import CrmEngagementTracker from "@/app/components/crm/CrmEngagementTracker";

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
  const username = normalizeUsernameInput(resolved?.username ?? "");
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

type OrganizationEvent = {
  id: number;
  slug: string;
  title: string;
  startsAt: Date | null;
  endsAt: Date | null;
  addressId?: string | null;
  addressRef?: {
    formattedAddress: string | null;
    canonical?: Prisma.JsonValue | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
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
  if (!start) return null;
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
    if (!event.startsAt) {
      continue;
    }
    const key = new Intl.DateTimeFormat("pt-PT", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: timezone,
    }).format(event.startsAt as Date);
    const label = formatDayLabel(event.startsAt as Date, timezone);
    const locationLabel = formatEventLocationLabel(
      { addressRef: event.addressRef ?? null },
      "",
    ).trim();
    const item: AgendaItem = {
      id: event.id,
      slug: event.slug,
      title: event.title,
      timeLabel: formatTimeLabel(event.startsAt as Date, timezone),
      locationLabel: locationLabel || "Local por anunciar",
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
  const rawUsernameParam = resolvedParams?.username ?? "";
  const usernameParam = normalizeUsernameInput(rawUsernameParam);
  const serviceIdParam = resolvedSearchParams && "serviceId" in resolvedSearchParams
    ? resolvedSearchParams.serviceId
    : undefined;

  if (!usernameParam) {
    notFound();
  }
  if (usernameParam === "me") {
    redirect("/me");
  }
  if (isReservedUsername(usernameParam)) {
    notFound();
  }
  if (rawUsernameParam !== usernameParam) {
    const query = serviceIdParam ? `?serviceId=${encodeURIComponent(serviceIdParam)}` : "";
    redirect(`/${usernameParam}${query}`);
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
        addressId: true,
        addressRef: { select: { formattedAddress: true, canonical: true } },
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
        publicTiktok: true,
        publicLinkedin: true,
        publicDescription: true,
        publicHours: true,
        infoRules: true,
        infoRequirements: true,
        infoPolicies: true,
        infoLocationNotes: true,
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
  const organizationCity = organizationProfile
    ? pickCanonicalField(
        organizationProfile.addressRef?.canonical ?? null,
        "city",
        "locality",
        "addressLine2",
        "region",
        "state",
      )
    : null;
  const organizationAddress = organizationProfile?.addressRef?.formattedAddress ?? null;
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
    const publicTiktok = (organizationProfile as { publicTiktok?: string | null }).publicTiktok?.trim() || null;
    const publicLinkedin = (organizationProfile as { publicLinkedin?: string | null }).publicLinkedin?.trim() || null;
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

    const [events, followersCount, followRow, forms, services, professionals, resources] = await Promise.all([
      prisma.event.findMany({
        where: {
          organizationId: organizationProfile.id,
          status: { in: PUBLIC_EVENT_DISCOVER_STATUSES },
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
          addressId: true,
          addressRef: { select: { formattedAddress: true, canonical: true, latitude: true, longitude: true } },
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
              assignmentMode: true,
              partySizeRequired: true,
              partySizeMin: true,
              partySizeMax: true,
              partySizeStep: true,
              durationMinutes: true,
              unitPriceCents: true,
            currency: true,
            isActive: true,
            categoryTag: true,
            coverImageUrl: true,
            locationMode: true,
            addressId: true,
            addressRef: { select: { formattedAddress: true, canonical: true } },
            addons: {
              where: { isActive: true },
              orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
              select: {
                id: true,
                label: true,
                description: true,
                deltaMinutes: true,
                deltaPriceCents: true,
                maxQty: true,
                category: true,
                sortOrder: true,
              },
            },
            packages: {
              where: { isActive: true },
              orderBy: [{ recommended: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
              select: {
                id: true,
                label: true,
                description: true,
                durationMinutes: true,
                priceCents: true,
                recommended: true,
                sortOrder: true,
              },
            },
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
            assignmentMode: "PROFESSIONAL_ONLY" | "RESOURCE_ONLY" | "PROFESSIONAL_AND_RESOURCE" | null;
            partySizeRequired: boolean;
            partySizeMin: number;
            partySizeMax: number;
            partySizeStep: number;
            durationMinutes: number;
            unitPriceCents: number;
            currency: string;
            isActive: boolean;
            categoryTag: string | null;
            coverImageUrl: string | null;
            locationMode: string | null;
            addressId: string | null;
            addressRef?: {
              formattedAddress: string | null;
              canonical?: Prisma.JsonValue | null;
            } | null;
            addons?: Array<{
              id: number;
              label: string;
              description: string | null;
              deltaMinutes: number;
              deltaPriceCents: number;
              maxQty: number | null;
              category: string | null;
              sortOrder: number;
            }>;
            packages?: Array<{
              id: number;
              label: string;
              description: string | null;
              durationMinutes: number;
              priceCents: number;
              recommended: boolean;
              sortOrder: number;
            }>;
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
    ]);

    const orgEvents: OrganizationEvent[] = events.map((event) => {
      const ticketPrices = event.ticketTypes?.map((t) => t.price ?? 0) ?? [];
      const isGratis = deriveIsFreeEvent({ ticketPrices });
      return {
        id: event.id,
        slug: event.slug,
        title: event.title,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        addressId: event.addressId ?? null,
        addressRef: event.addressRef ?? null,
        timezone: event.timezone,
        templateType: event.templateType,
        coverImageUrl: event.coverImageUrl,
        isGratis,
      };
    });

    const store = await prisma.store.findFirst({
      where: { ownerOrganizationId: organizationProfile.id },
      select: { id: true, status: true, showOnProfile: true, catalogLocked: true, checkoutEnabled: true, currency: true },
    });
    const storeEnabled = isStoreFeatureEnabled();
    const storeId = store?.id ?? null;
    const storeProductsCount = storeId !== null
      ? await prisma.storeProduct.count({
          where: { storeId, visibility: "PUBLIC" },
        })
      : 0;

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
    const agendaEvents = [...upcomingEvents, ...pastEvents].sort(
      (a, b) => (b.startsAt?.getTime() ?? 0) - (a.startsAt?.getTime() ?? 0),
    );
    const agendaGroups = buildAgendaGroups(agendaEvents, pastEventIds);
    const agendaTotal = agendaEvents.length;
    const publicForms = forms.filter((form) => form.status !== "ARCHIVED");
    const featuredForm =
      publicForms.find((form) => /guarda[-\s]?redes/i.test(form.title)) ?? publicForms[0] ?? null;
    const agendaPreviewGroups = agendaGroups
      .slice(0, 1)
      .map((group) => ({ ...group, items: group.items.slice(0, 1) }));
    const agendaPreviewCount = agendaPreviewGroups.reduce((acc, group) => acc + group.items.length, 0);
    const remainingAgendaCount = Math.max(0, agendaTotal - agendaPreviewCount);
    const agendaDiscoverHref = `${
      primaryOperation === "TORNEIOS" ? "/descobrir/torneios" : "/descobrir/eventos"
    }?query=${encodeURIComponent(orgDisplayName)}`;
    const agendaLeadEvent = spotlightEvent ?? agendaEvents[0] ?? null;
    const spotlightCtaLabel = agendaLeadEvent
      ? pastEventIds.has(agendaLeadEvent.id)
        ? "Ver resumo"
        : agendaLeadEvent.templateType === "PADEL"
          ? "Inscrever agora"
          : agendaLeadEvent.isGratis
            ? "Garantir lugar"
            : "Comprar bilhete"
      : "Ver evento";
    const spotlightCtaHref = agendaLeadEvent
      ? pastEventIds.has(agendaLeadEvent.id)
        ? `/eventos/${agendaLeadEvent.slug}`
        : buildTicketHref(agendaLeadEvent.slug)
      : null;
    const featuredFormDateLabel = featuredForm
      ? formatFormDateRange(featuredForm.startAt, featuredForm.endAt)
      : null;
    const featuredFormCapacityLabel = featuredForm?.capacity
      ? `${featuredForm.capacity} vagas`
      : null;
    const showAgendaSection = showAgenda && agendaTotal > 0;
    const showReservasSection = hasReservasModule && services.length > 0;
    const showFormsSection = hasInscricoes && publicForms.length > 0;

    const storeBaseHref = `/${organizationProfile.username ?? usernameParam}/loja`;
    const legalBaseHref = `/${organizationProfile.username ?? usernameParam}/legal`;
    const showStoreSection =
      storeEnabled &&
      shouldShowStoreOnPublicProfile({
        status: store?.status ?? null,
        showOnProfile: store?.showOnProfile ?? false,
        publicProductCount: storeProductsCount,
      });

    const quickActionCards = [
      showAgendaSection
        ? {
            id: "quick-agenda",
            title: "Agenda pública",
            subtitle: `${agendaTotal} ${agendaTotal === 1 ? "item" : "itens"} publicados`,
            href: agendaDiscoverHref,
            cta: "Ver agenda",
          }
        : null,
      showReservasSection
        ? {
            id: "quick-reservas",
            title: "Reservas",
            subtitle: `${services.length} ${services.length === 1 ? "serviço" : "serviços"} disponíveis`,
            href: "#reservar",
            cta: "Reservar agora",
          }
        : null,
      showFormsSection && featuredForm
        ? {
            id: "quick-formularios",
            title: "Formulários",
            subtitle: `${publicForms.length} ${publicForms.length === 1 ? "ativo" : "ativos"}`,
            href: `/inscricoes/${featuredForm.id}`,
            cta: "Ver formulários ativos",
          }
        : null,
    ].filter(Boolean) as Array<{ id: string; title: string; subtitle: string; href: string; cta: string }>;

    const fixedSections = [
      showAgendaSection
        ? {
            id: "agenda-publica",
            content: (
              <section id="agenda-publica" className="rounded-3xl border border-white/12 bg-white/5 p-4 sm:p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold text-white">Agenda pública</h2>
                    <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] text-white/70">
                      {agendaTotal} itens
                    </span>
                  </div>
                  <EventSpotlightCard
                    event={agendaLeadEvent}
                    label={`Próximo ${operationMeta.noun}`}
                    emptyLabel={`Sem ${operationMeta.noun} anunciado`}
                    ctaLabel={spotlightCtaLabel}
                    ctaHref={spotlightCtaHref}
                    variant="embedded"
                  />
                  <div className="space-y-3">
                    {agendaPreviewGroups.map((group) => (
                      <div key={group.key} className="space-y-2">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">{group.label}</p>
                        <div className="space-y-2">
                          {group.items.map((item) => {
                            const href = item.isPast
                              ? `/eventos/${item.slug}`
                              : `/eventos/${item.slug}?checkout=1#bilhetes`;
                            return (
                              <Link
                                key={item.id}
                                href={href}
                                className="group flex items-center justify-between gap-3 rounded-2xl border border-white/12 bg-white/5 px-3 py-3 text-sm text-white/80 transition hover:border-white/30 hover:bg-white/10"
                              >
                                <div>
                                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">{item.timeLabel}</p>
                                  <p className="text-sm font-semibold text-white">{item.title}</p>
                                  <p className="text-[12px] text-white/60">{item.locationLabel}</p>
                                </div>
                                <span
                                  className={`rounded-full border px-3 py-1 text-[11px] ${
                                    item.isPast
                                      ? "border-white/15 bg-white/5 text-white/60"
                                      : "border-emerald-300/40 bg-emerald-400/10 text-emerald-100"
                                  }`}
                                >
                                  {item.isPast
                                    ? "Ver resumo"
                                    : item.templateType === "PADEL"
                                      ? "Inscrever agora"
                                      : item.isGratis
                                        ? "Garantir lugar"
                                        : "Comprar bilhete"}
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  {remainingAgendaCount > 0 ? (
                    <div className="flex justify-end">
                      <Link href={agendaDiscoverHref} className="text-[11px] text-white/65 hover:text-white/90">
                        Ver mais {remainingAgendaCount}
                      </Link>
                    </div>
                  ) : null}
                </div>
              </section>
            ),
          }
        : null,
      showReservasSection
        ? {
            id: "reservas",
            content: (
              <section className="space-y-4">
                <div className="rounded-3xl border border-white/12 bg-white/5 p-4 sm:p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Reservas</p>
                      <h2 className="text-xl font-semibold text-white sm:text-2xl">{orgDisplayName}</h2>
                      <p className="mt-2 text-[12px] text-white/70">
                        Gestão pública de serviços e disponibilidade da organização.
                      </p>
                    </div>
                    <a
                      href="#reservar"
                      className="w-full rounded-full bg-white px-5 py-2 text-center text-[12px] font-semibold text-black shadow-[0_10px_30px_rgba(255,255,255,0.25)] sm:w-auto"
                    >
                      Reservar agora
                    </a>
                  </div>
                </div>
                <div id="reservar">
                  <ReservasBookingSection
                    organization={{
                      id: organizationProfile.id,
                      publicName: organizationProfile.publicName,
                      businessName: organizationProfile.businessName,
                      city: organizationCity,
                      username: organizationProfile.username ?? null,
                      timezone: organizationProfile.timezone ?? "Europe/Lisbon",
                      address: organizationAddress,
                      reservationAssignmentMode:
                        organizationProfile.reservationAssignmentMode ?? "PROFESSIONAL_ONLY",
                    }}
                    services={services.map((service) => ({
                      ...service,
                      coverImageUrl: service.coverImageUrl ?? null,
                      locationMode: (service.locationMode ?? "FIXED") as "FIXED" | "CHOOSE_AT_BOOKING",
                    }))}
                    professionals={professionalsList}
                    resources={resourcesList}
                    initialServiceId={initialServiceId}
                    featuredServiceIds={[]}
                    servicesLayout="grid"
                  />
                </div>
              </section>
            ),
          }
        : null,
      showFormsSection
        ? {
            id: "formularios",
            content: (
              <section className="rounded-3xl border border-white/12 bg-[#05070f]/80 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Formulários</p>
                  <h3 className="text-lg font-semibold text-white">{featuredForm!.title}</h3>
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
                    <Link
                      href={`/inscricoes/${featuredForm!.id}`}
                      className="rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-black shadow-[0_10px_30px_rgba(255,255,255,0.25)]"
                    >
                      {publicForms.length > 1 ? "Ver formulários ativos" : "Abrir formulário ativo"}
                    </Link>
                  </div>
                </div>
              </section>
            ),
          }
        : null,
      {
        id: "legal",
        content: (
          <section className="rounded-3xl border border-white/12 bg-white/5 p-4 shadow-[0_18px_54px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Legal</p>
            <h3 className="text-lg font-semibold text-white">Políticas e termos</h3>
            <p className="mt-2 text-sm text-white/70">
              Consulta os termos, privacidade, reservas e políticas de loja desta organização numa página única.
            </p>
            <div className="mt-4">
              <Link
                href={legalBaseHref}
                className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white/85 hover:border-white/40"
              >
                Abrir página legal
              </Link>
            </div>
          </section>
        ),
      },
    ].filter(Boolean) as Array<{ id: string; content: ReactNode }>;

    return (
      <main className="relative min-h-screen w-full overflow-hidden text-white">
        {viewerId ? (
          <CrmEngagementTracker
            type="PROFILE_VIEWED"
            organizationId={organizationProfile.id}
            enabled
          />
        ) : null}
        <section className="relative flex flex-col gap-8 py-10">
          <OrganizationProfileHeader
            name={orgDisplayName}
            username={organizationProfile.username ?? usernameParam}
            avatarUrl={organizationProfile.brandingAvatarUrl ?? null}
            coverUrl={headerCoverUrl}
            bio={publicDescription}
            city={organizationCity ?? null}
            followersCount={followersTotal}
            organizationId={organizationProfile.id}
            initialIsFollowing={initialIsFollowing}
            isPublic
            isVerified={isVerified}
            instagramHref={publicInstagram}
            youtubeHref={publicYoutube}
            websiteHref={publicWebsiteHref}
            contactEmail={contactEmail}
            tiktokHref={publicTiktok}
            linkedinHref={publicLinkedin}
          />

          <div className="px-5 sm:px-8">
            <div className="orya-page-width flex flex-col gap-8">
              {showStoreSection ? (
                <section className="mx-auto w-full max-w-3xl rounded-3xl border border-white/12 bg-gradient-to-br from-[#0c1736]/88 via-[#101a37]/78 to-[#060b14]/95 p-5 text-center shadow-[0_20px_64px_rgba(0,0,0,0.6)] backdrop-blur-2xl sm:p-6">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Loja</p>
                  <h2 className="mt-2 text-xl font-semibold text-white sm:text-2xl">Produtos oficiais da organização</h2>
                  <p className="mt-2 text-sm text-white/70">
                    {storeProductsCount > 0
                      ? `${storeProductsCount} ${storeProductsCount === 1 ? "produto público disponível" : "produtos públicos disponíveis"}`
                      : "Loja pública pronta para receber produtos."}
                  </p>
                  <div className="mt-5 flex items-center justify-center">
                    <Link
                      href={storeBaseHref}
                      className="inline-flex rounded-full bg-white px-6 py-2 text-[12px] font-semibold text-black shadow-[0_10px_30px_rgba(255,255,255,0.25)]"
                    >
                      Abrir loja
                    </Link>
                  </div>
                </section>
              ) : null}

              {quickActionCards.length > 0 ? (
                <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {quickActionCards.map((card) => (
                    <Link
                      key={card.id}
                      href={card.href}
                      className="rounded-2xl border border-white/12 bg-white/6 px-4 py-4 shadow-[0_16px_48px_rgba(0,0,0,0.45)] backdrop-blur-xl transition hover:border-white/25 hover:bg-white/10"
                    >
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">{card.title}</p>
                      <p className="mt-1 text-sm font-semibold text-white">{card.subtitle}</p>
                      <p className="mt-3 text-[12px] text-white/75">{card.cta} →</p>
                    </Link>
                  ))}
                </section>
              ) : null}

              {fixedSections.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2">
                  {fixedSections.map((section) => (
                    <div
                      key={section.id}
                      className={section.id === "agenda-publica" || section.id === "reservas" ? "md:col-span-2" : ""}
                    >
                      {section.content}
                    </div>
                  ))}
                </div>
              ) : (
                <section className="rounded-3xl border border-white/12 bg-white/5 p-4 text-sm text-white/70 shadow-[0_18px_54px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
                  Este perfil público está em preparação.
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
      const identityIds = await getUserIdentityIds(resolvedProfile.id);
      const ownerFilter =
        identityIds.length > 0
          ? { ownerIdentityId: { in: identityIds } }
          : { ownerUserId: resolvedProfile.id };
      const [total, upcoming, past, recentEntitlements] = await Promise.all([
        (prisma as any).entitlement.count({ where: ownerFilter }),
        (prisma as any).entitlement.count({
          where: { ...ownerFilter, snapshotStartAt: { gte: now } },
        }),
        (prisma as any).entitlement.count({
          where: { ...ownerFilter, snapshotStartAt: { lt: now } },
        }),
        (prisma as any).entitlement.findMany({
          where: ownerFilter,
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
          city={null}
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
          city={null}
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
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/10">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-6 w-6 text-white/90"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M7 11V8a5 5 0 0 1 10 0v3" />
                    <rect x="5" y="11" width="14" height="9" rx="2" />
                  </svg>
                </div>
                <h2 className="mt-3 text-lg font-semibold text-white">Esta conta é privada</h2>
                <p className="mt-2 text-sm text-white/70">
                  {displayName} mantém a timeline privada. Segue para veres publicações, eventos e
                  detalhes de padel.
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
        {formatEventDateRange(event.startsAt, event.endsAt, event.timezone) ? (
          <p className="text-[12px] text-white/75">
            {formatEventDateRange(event.startsAt, event.endsAt, event.timezone)}
          </p>
        ) : null}
        {formatEventLocationLabel({ addressRef: event.addressRef ?? null }, "") ? (
          <p className="text-[12px] text-white/65">
            {formatEventLocationLabel({ addressRef: event.addressRef ?? null }, "")}
          </p>
        ) : null}
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
          {item.venueName ? (
            <p className="text-[11px] text-white/70 line-clamp-1">{item.venueName}</p>
          ) : null}
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
