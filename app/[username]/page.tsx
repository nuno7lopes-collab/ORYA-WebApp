import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
  parseOrganizationTools,
  resolvePrimaryModule,
} from "@/lib/organizationCategories";
import { normalizeInterestSelection, resolveInterestLabel } from "@/lib/interests";
import { getPaidSalesGate } from "@/lib/organizationPayments";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { resolveStorePolicy } from "@/lib/store/policySettings";
import {
  canAcceptPublicReservasBookings,
  canOpenPublicStorefront,
  canShowPublicReservasSection,
} from "@/lib/publicOrganizationProfile";
import { normalizeOfficialEmail } from "@/lib/organizationOfficialEmailUtils";
import { getUserIdentityIds } from "@/lib/ownership/identity";
import { ChatCommunityAccessMode, OrganizationFormStatus, type Prisma } from "@prisma/client";
import { resolveTicketPricingSummary } from "@/domain/events/ticketPricing";
import { PUBLIC_EVENT_DISCOVER_STATUSES } from "@/domain/events/publicStatus";
import { resolveBookingVerticalFromServiceKind } from "@/lib/reservas/bookingVertical";
import ReservasBookingSection from "@/app/[username]/_components/ReservasBookingSection";
import ProfileStoreCatalogSection from "@/app/[username]/_components/ProfileStoreCatalogSection";
import ProfileLegalInlineSection from "@/app/[username]/_components/ProfileLegalInlineSection";
import ProfileCommunitySection, {
  type ProfileCommunityItem,
} from "@/app/[username]/_components/ProfileCommunitySection";
import ProfileSectionsShell from "@/app/[username]/_components/ProfileSectionsShell";
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

const PROFILE_DISCOVERABLE_COMMUNITY_ACCESS_MODES: ChatCommunityAccessMode[] = [
  ChatCommunityAccessMode.PUBLIC,
  ChatCommunityAccessMode.FOLLOWERS,
  ChatCommunityAccessMode.APPROVAL,
];

type PageProps = {
  params: { username: string } | Promise<{ username: string }>;
  searchParams?: { serviceId?: string; sec?: string } | Promise<{ serviceId?: string; sec?: string }>;
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
  const rawAvatar = isOrg ? organization?.brandingAvatarUrl : profile?.avatarUrl;
  const avatarUrl = rawAvatar
    ? rawAvatar.startsWith("http")
      ? rawAvatar
      : `${baseUrl}${rawAvatar.startsWith("/") ? "" : "/"}${rawAvatar}`
    : null;
  const previewImageUrl = avatarUrl ?? `${baseUrl}/brand/logo_icon.png`;

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
      images: [{ url: previewImageUrl }],
    },
    twitter: {
      card: "summary",
      title: `${displayName} | ORYA`,
      description,
      images: [previewImageUrl],
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
  coverUrl: string;
};

type AgendaGroup = {
  key: string;
  label: string;
  items: AgendaItem[];
};

type OperationModule = "EVENTOS" | "RESERVAS" | "TORNEIOS";

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

function buildAgendaGroups(events: OrganizationEvent[], isPast: boolean) {
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
      isPast,
      isGratis: event.isGratis,
      templateType: event.templateType ?? null,
      coverUrl: getEventCoverUrl(event.coverImageUrl, {
        seed: event.slug ?? event.id ?? event.title,
        width: 320,
        quality: 70,
        format: "webp",
        square: false,
      }),
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
  const sectionParamRaw = resolvedSearchParams && "sec" in resolvedSearchParams
    ? resolvedSearchParams.sec
    : undefined;
  const sectionParam = typeof sectionParamRaw === "string" ? sectionParamRaw.trim() : undefined;

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
    const nextQuery = new URLSearchParams();
    if (serviceIdParam) nextQuery.set("serviceId", serviceIdParam);
    if (sectionParam) nextQuery.set("sec", sectionParam);
    const query = nextQuery.toString();
    redirect(`/${usernameParam}${query ? `?${query}` : ""}`);
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
        groupId: true,
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
        group: {
          select: {
            showLinkedOrganizationsPublicly: true,
          },
        },
        organizationModules: {
          where: { enabled: true },
          select: { moduleKey: true },
        },
        settings: {
          select: {
            bookingAcceptNewReservations: true,
          },
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
    const normalizedModules = parseOrganizationTools(moduleKeys) ?? [];
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

    const [events, followersCount, followRow, forms, services, professionals, resources, courtBookingConfigs] = await Promise.all([
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
          pricingMode: true,
          ticketTypes: {
            select: {
              price: true,
              status: true,
              totalQuantity: true,
              soldQuantity: true,
            },
          },
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
              categoryId: true,
              categoryTag: true,
              category: {
                select: {
                  id: true,
                  slug: true,
                  label: true,
                  domain: true,
                },
              },
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
              durationPrices: {
                where: { isActive: true },
                orderBy: [{ durationMinutes: "asc" }],
                select: {
                  durationMinutes: true,
                  priceCents: true,
                  isActive: true,
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
            categoryId: number | null;
            categoryTag: string | null;
            category: {
              id: number;
              slug: string;
              label: string;
              domain: "COURT" | "CLASS" | "SERVICE";
            } | null;
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
            durationPrices?: Array<{
              durationMinutes: number;
              priceCents: number;
              isActive: boolean;
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
            select: { id: true, label: true, capacity: true, courtId: true },
          })
        : Promise.resolve([] as Array<{ id: number; label: string; capacity: number; courtId: number | null }>),
      hasReservasModule
        ? prisma.courtBookingConfig.findMany({
            where: { organizationId: organizationProfile.id, isActive: true },
            orderBy: [{ courtId: "asc" }],
            select: {
              courtId: true,
              backingServiceId: true,
              displayName: true,
              displayDescription: true,
              coverImageUrl: true,
              category: {
                select: {
                  id: true,
                  slug: true,
                  label: true,
                  domain: true,
                },
              },
            },
          })
        : Promise.resolve([] as Array<{
            courtId: number;
            backingServiceId: number;
            displayName: string | null;
            displayDescription: string | null;
            coverImageUrl: string | null;
            category: {
              id: number;
              slug: string;
              label: string;
              domain: "COURT" | "CLASS" | "SERVICE";
            } | null;
          }>),
    ]);

    const orgEvents: OrganizationEvent[] = events.map((event) => {
      const pricing = resolveTicketPricingSummary({
        pricingMode: event.pricingMode ?? undefined,
        ticketTypes: event.ticketTypes,
      });
      const isGratis = pricing.isGratis;
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
    const canShowLinkedOrganizationsPublicly =
      organizationProfile.group?.showLinkedOrganizationsPublicly !== false;
    const siblingOrganizations = canShowLinkedOrganizationsPublicly && organizationProfile.groupId !== null
      ? await prisma.organization.findMany({
          where: {
            groupId: organizationProfile.groupId,
            status: "ACTIVE",
            id: { not: organizationProfile.id },
            username: { not: null },
          },
          orderBy: [{ id: "asc" }],
          select: {
            id: true,
            username: true,
            publicName: true,
            businessName: true,
            brandingAvatarUrl: true,
          },
        })
      : [];

    const agendaSourceEvents = orgEvents;
    const upcomingEvents = agendaSourceEvents
      .filter((event) => event.startsAt && event.startsAt >= now)
      .sort((a, b) => (a.startsAt?.getTime() ?? 0) - (b.startsAt?.getTime() ?? 0));
    const pastEvents = agendaSourceEvents
      .filter((event) => event.startsAt && event.startsAt < now)
      .sort((a, b) => (b.startsAt?.getTime() ?? 0) - (a.startsAt?.getTime() ?? 0));
    const spotlightEvent = upcomingEvents[0] ?? null;
    const agendaLeadEvent = spotlightEvent ?? pastEvents[0] ?? null;
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
    const agendaUpcomingGroups = buildAgendaGroups(upcomingEvents, false);
    const agendaPastGroups = buildAgendaGroups(pastEvents, true);
    const agendaTotal = upcomingEvents.length + pastEvents.length;
    const publicForms = forms.filter((form) => form.status !== "ARCHIVED");
    const featuredForm =
      publicForms.find((form) => /guarda[-\s]?redes/i.test(form.title)) ?? publicForms[0] ?? null;
    const agendaKindsLabel =
      hasEventosModule && hasTorneiosModule
        ? "Eventos e torneios"
        : hasTorneiosModule
          ? "Torneios"
          : "Eventos";
    const agendaLeadNoun = agendaLeadEvent?.templateType === "PADEL" ? "torneio" : "evento";
    const agendaLeadIsPast = Boolean(
      agendaLeadEvent &&
      agendaLeadEvent.startsAt &&
      agendaLeadEvent.startsAt.getTime() < now.getTime(),
    );
    const agendaLeadLabel = agendaLeadEvent
      ? agendaLeadIsPast
        ? `Último ${agendaLeadNoun}`
        : `Próximo ${agendaLeadNoun}`
      : `Próximo ${agendaLeadNoun}`;
    const spotlightCtaLabel = agendaLeadEvent
      ? agendaLeadIsPast
        ? "Ver resumo"
        : agendaLeadEvent.templateType === "PADEL"
          ? "Inscrever agora"
          : agendaLeadEvent.isGratis
            ? "Garantir lugar"
            : "Comprar bilhete"
      : "Ver evento";
    const spotlightCtaHref = agendaLeadEvent
      ? agendaLeadIsPast
        ? `/eventos/${agendaLeadEvent.slug}`
        : buildTicketHref(agendaLeadEvent.slug)
      : null;
    const featuredFormDateLabel = featuredForm
      ? formatFormDateRange(featuredForm.startAt, featuredForm.endAt)
      : null;
    const featuredFormCapacityLabel = featuredForm?.capacity
      ? `${featuredForm.capacity} vagas`
      : null;
    const showAgendaSection = showAgenda;
    const reservasOperationalOpen = organizationProfile.settings?.bookingAcceptNewReservations ?? true;
    const showReservasSection = canShowPublicReservasSection({
      moduleEnabled: hasReservasModule,
      organizationAssignmentMode: organizationProfile.reservationAssignmentMode ?? null,
      services,
      professionals,
      resources,
    });
    const reservasAcceptingNewBookings = canAcceptPublicReservasBookings({
      moduleEnabled: hasReservasModule,
      acceptNewBookings: reservasOperationalOpen,
      organizationAssignmentMode: organizationProfile.reservationAssignmentMode ?? null,
      services,
      professionals,
      resources,
    });
    const showFormsSection = hasInscricoes && publicForms.length > 0;
    const activeCommunityCount = await prisma.chatCommunity.count({
      where: {
        organizationId: organizationProfile.id,
        accessMode: { in: PROFILE_DISCOVERABLE_COMMUNITY_ACCESS_MODES },
      },
    });
    const showCommunitySection = activeCommunityCount > 0;
    const reservasHubClubMode = services.some((service) =>
      ["COURT", "CLASS"].includes(String(service.kind ?? "").toUpperCase()),
    );
    const courtConfigByServiceId = new Map(courtBookingConfigs.map((config) => [config.backingServiceId, config]));
    const reservasServicesForPublic = services.map((service) => {
      const bookingVertical = resolveBookingVerticalFromServiceKind(service.kind);
      const courtConfig = bookingVertical === "COURT" ? courtConfigByServiceId.get(service.id) ?? null : null;
      const resolvedCategory = courtConfig?.category ?? service.category ?? null;
      const resolvedTitle = courtConfig?.displayName?.trim() || service.title;
      const resolvedDescription = courtConfig?.displayDescription?.trim() || service.description || null;
      const resolvedCoverImage = courtConfig?.coverImageUrl || service.coverImageUrl || null;

      return {
        ...service,
        title: resolvedTitle,
        description: resolvedDescription,
        bookingVertical,
        category: resolvedCategory
          ? {
              id: resolvedCategory.id,
              slug: resolvedCategory.slug,
              label: resolvedCategory.label,
              domain: resolvedCategory.domain,
            }
          : null,
        categoryTag: resolvedCategory?.label ?? service.categoryTag ?? null,
        coverImageUrl: resolvedCoverImage,
        locationMode: (service.locationMode ?? "FIXED") as "FIXED" | "CHOOSE_AT_BOOKING",
        courtId: courtConfig?.courtId ?? null,
        backingServiceId: bookingVertical === "COURT" ? service.id : null,
      };
    });
    const linkedOrganizations = siblingOrganizations
      .filter((organization): organization is typeof organization & { username: string } => Boolean(organization.username))
      .map((organization) => ({
        id: organization.id,
        username: organization.username,
        name: organization.publicName?.trim() || organization.businessName?.trim() || `Centro #${organization.id}`,
        avatarUrl: organization.brandingAvatarUrl ?? null,
      }));
    const canShowLocation = organizationProfile.showAddressPublicly === true;
    const organizationLocationLabel = canShowLocation ? organizationAddress || organizationCity || null : null;
    const organizationLocationMapHref = organizationLocationLabel
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(organizationLocationLabel)}`
      : null;

    const showStoreSection =
      storeEnabled &&
      canOpenPublicStorefront({
        status: store?.status ?? null,
        showOnProfile: store?.showOnProfile ?? false,
        checkoutEnabled: store?.checkoutEnabled ?? false,
        catalogLocked: store?.catalogLocked ?? false,
        paymentsReady: allowPaidServices,
        publicProductCount: storeProductsCount,
      });
    const organizationSectionNav = [
      showAgendaSection ? { id: "agenda-publica", label: "Agenda" } : null,
      showReservasSection ? { id: "reservas", label: "Reservas" } : null,
      showFormsSection ? { id: "formularios", label: "Formulários" } : null,
      showStoreSection ? { id: "loja", label: "Loja" } : null,
      showCommunitySection ? { id: "comunidade", label: "Comunidade" } : null,
      { id: "legal", label: "Legal" },
    ].filter(Boolean) as Array<{ id: string; label: string }>;
    const defaultSectionId = organizationSectionNav[0]?.id ?? "legal";
    const requestedSectionId = sectionParam ?? null;
    const activeSectionId = organizationSectionNav.some((item) => item.id === requestedSectionId)
      ? requestedSectionId!
      : defaultSectionId;
    const shouldLoadStoreCatalog = showStoreSection && activeSectionId === "loja";
    const shouldLoadLegalSnapshot = activeSectionId === "legal";
    const shouldLoadCommunityItems = showCommunitySection && activeSectionId === "comunidade";

    const [storeCatalogCategories, storeCatalogProducts, legalSnapshot, communityItems] = await Promise.all([
      shouldLoadStoreCatalog && store?.id
        ? prisma.storeCategory.findMany({
            where: { storeId: store.id, isActive: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select: { id: true, name: true, slug: true },
          })
        : Promise.resolve([] as Array<{ id: number; name: string; slug: string }>),
      shouldLoadStoreCatalog && store?.id
        ? prisma.storeProduct.findMany({
            where: { storeId: store.id, visibility: "PUBLIC" },
            orderBy: [{ createdAt: "desc" }],
            select: {
              id: true,
              name: true,
              slug: true,
              priceCents: true,
              compareAtPriceCents: true,
              currency: true,
              category: { select: { id: true, name: true, slug: true } },
              images: {
                select: { url: true, altText: true, isPrimary: true, sortOrder: true },
                orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
              },
            },
          })
        : Promise.resolve([] as Array<{
            id: number;
            name: string;
            slug: string;
            priceCents: number;
            compareAtPriceCents: number | null;
            currency: string;
            category: { id: number; name: string; slug: string } | null;
            images: Array<{ url: string; altText: string | null; isPrimary: boolean; sortOrder: number }>;
          }>),
      shouldLoadLegalSnapshot
        ? Promise.all([
            prisma.organizationSettings.findUnique({
              where: { organizationId: organizationProfile.id },
              select: {
                supportEmail: true,
                supportPhone: true,
                storeReturnPolicyMode: true,
                storeReturnWindowDays: true,
              },
            }),
            prisma.organizationPolicy.findMany({
              where: { organizationId: organizationProfile.id },
              orderBy: [{ createdAt: "asc" }],
              select: {
                policyType: true,
                allowCancellation: true,
                cancellationWindowMinutes: true,
                allowReschedule: true,
                rescheduleWindowMinutes: true,
              },
            }),
          ]).then(([settings, policies]) => {
            const storePolicy = resolveStorePolicy({
              settings,
              fallbackSupportEmail: organizationProfile.officialEmail ?? null,
              organizationUsername: organizationProfile.username ?? null,
            });
            const bookingPolicy = policies.find((policy) => policy.policyType === "MODERATE") ?? policies[0] ?? null;
            return {
              storePolicy,
              bookingPolicy: bookingPolicy
                ? {
                    allowCancellation: bookingPolicy.allowCancellation,
                    cancellationWindowMinutes: bookingPolicy.cancellationWindowMinutes,
                    allowReschedule: bookingPolicy.allowReschedule,
                    rescheduleWindowMinutes: bookingPolicy.rescheduleWindowMinutes,
                  }
                : null,
            };
          })
        : Promise.resolve(
            null as {
              storePolicy: ReturnType<typeof resolveStorePolicy>;
              bookingPolicy: {
                allowCancellation: boolean;
                cancellationWindowMinutes: number | null;
                allowReschedule: boolean;
                rescheduleWindowMinutes: number | null;
              } | null;
            } | null,
          ),
      shouldLoadCommunityItems
        ? prisma.chatCommunity
            .findMany({
              where: {
                organizationId: organizationProfile.id,
                accessMode: { in: PROFILE_DISCOVERABLE_COMMUNITY_ACCESS_MODES },
              },
              orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
              select: {
                conversationId: true,
                title: true,
                description: true,
                accessMode: true,
              },
            })
            .then(async (rows): Promise<ProfileCommunityItem[]> => {
              if (rows.length === 0) return [];
              const conversationIds = rows.map((row) => row.conversationId);
              const participantCounts = await prisma.chatConversationMember.groupBy({
                by: ["conversationId"],
                where: {
                  conversationId: { in: conversationIds },
                  leftAt: null,
                  accessRevokedAt: null,
                  bannedAt: null,
                },
                _count: { _all: true },
              });
              const countsMap = new Map(
                participantCounts.map((item) => [item.conversationId, item._count._all] as const),
              );
              return rows.map((row) => ({
                conversationId: row.conversationId,
                title: row.title,
                description: row.description ?? null,
                accessMode: String(row.accessMode),
                participantsCount: countsMap.get(row.conversationId) ?? 0,
              }));
            })
        : Promise.resolve([] as ProfileCommunityItem[]),
    ]);

    const buildSectionHref = (sectionId: string) => {
      const params = new URLSearchParams();
      if (sectionId !== defaultSectionId) {
        params.set("sec", sectionId);
      }
      if (initialServiceId) {
        params.set("serviceId", String(initialServiceId));
      }
      const query = params.toString();
      return `/${organizationProfile.username ?? usernameParam}${query ? `?${query}` : ""}`;
    };

    const sectionNavItems = organizationSectionNav.map((item) => ({
      ...item,
      href: buildSectionHref(item.id),
    }));

    const fixedSections = [
      showAgendaSection
        ? {
            id: "agenda-publica",
            content: (
              <section id="agenda-publica" className="space-y-5 pb-8">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-white/80">Agenda pública</p>
                    <h2 className="mt-1 text-xl font-semibold text-white sm:text-2xl">{agendaKindsLabel}</h2>
                  </div>
                  <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] text-white/90">
                    {agendaTotal} itens
                  </span>
                </div>
                <EventSpotlightCard
                  event={agendaLeadEvent}
                  label={agendaLeadLabel}
                  emptyLabel={`Sem ${agendaKindsLabel.toLowerCase()} anunciados`}
                  ctaLabel={spotlightCtaLabel}
                  ctaHref={spotlightCtaHref}
                  variant="embedded"
                />
                <OrganizationAgendaTabs
                  upcomingGroups={agendaUpcomingGroups}
                  pastGroups={agendaPastGroups}
                  spotlightEventId={agendaLeadEvent?.id ?? null}
                  initialVisibleUpcoming={5}
                  initialVisiblePast={4}
                  pageSize={5}
                />
              </section>
            ),
          }
        : null,
      showReservasSection
        ? {
            id: "reservas",
            content: (
              <section id="reservas" className="space-y-5 pb-8">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/82">Reservas</p>
                    <h2 className="text-xl font-semibold text-white sm:text-2xl">{orgDisplayName}</h2>
                    <p className="mt-2 text-[12px] text-white/85">
                      {reservasHubClubMode
                        ? "Escolhe entre Reservar Campo, Aulas e Outros serviços para marcar em poucos passos."
                        : "Escolhe serviço e profissional para avançar diretamente para a marcação."}
                    </p>
                  </div>
                  {reservasAcceptingNewBookings ? (
                    <a
                      href={`${buildSectionHref("reservas")}#reservar`}
                      className="w-full rounded-full bg-white px-5 py-2 text-center text-[12px] font-semibold text-black shadow-[0_10px_30px_rgba(255,255,255,0.25)] sm:w-auto"
                    >
                      Reservar agora
                    </a>
                  ) : (
                    <span className="w-full rounded-full border border-amber-300/40 bg-amber-400/10 px-4 py-2 text-center text-[12px] font-semibold text-amber-100 sm:w-auto">
                      Reservas temporariamente indisponíveis
                    </span>
                  )}
                </div>
                {!reservasAcceptingNewBookings ? (
                  <div className="rounded-2xl border border-amber-300/35 bg-amber-400/10 p-4 text-[13px] text-amber-100">
                    Reservas temporariamente indisponíveis. Podes consultar a disponibilidade e os serviços, mas não
                    é possível iniciar novas marcações neste momento.
                  </div>
                ) : null}
                <div id="reservar">
                  {services.length > 0 ? (
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
                      services={reservasServicesForPublic}
                      professionals={professionalsList}
                      resources={resourcesList}
                      initialServiceId={reservasAcceptingNewBookings ? initialServiceId : null}
                      featuredServiceIds={[]}
                      servicesLayout="grid"
                      acceptNewBookings={reservasAcceptingNewBookings}
                      hubMode={reservasHubClubMode ? "club" : "legacy"}
                    />
                  ) : (
                    <div className="rounded-2xl border border-white/18 bg-white/[0.04] p-4 text-[13px] text-white/88">
                      Esta organização ainda não publicou serviços de reserva.
                    </div>
                  )}
                </div>
              </section>
            ),
          }
        : null,
      showFormsSection
        ? {
            id: "formularios",
            content: (
              <section id="formularios" className="space-y-4 pb-8">
                <div className="space-y-4">
                  <div className="border-b border-white/10 pb-3">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/82">Formulários</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-white sm:text-xl">
                      {publicForms.length === 1 ? "Formulário ativo" : "Formulários ativos"}
                    </h3>
                    <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-white/90">
                      {publicForms.length} {publicForms.length === 1 ? "ativo" : "ativos"}
                    </span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {publicForms.slice(0, 4).map((form) => {
                      const dateLabel = formatFormDateRange(form.startAt, form.endAt);
                      const capacityLabel = form.capacity ? `${form.capacity} vagas` : null;
                      return (
                        <article key={form.id} className="rounded-2xl border border-white/18 bg-white/[0.04] p-4">
                          <p className="text-sm font-semibold text-white">{form.title}</p>
                          {form.description ? (
                            <p className="mt-1 line-clamp-2 text-[12px] text-white/84">{form.description}</p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/88">
                            {dateLabel ? (
                              <span className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1">
                                {dateLabel}
                              </span>
                            ) : null}
                            {capacityLabel ? (
                              <span className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1">
                                {capacityLabel}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-4">
                            <Link
                              href={`/inscricoes/${form.id}`}
                              className="inline-flex rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-black shadow-[0_10px_24px_rgba(255,255,255,0.22)]"
                            >
                              Abrir formulário
                            </Link>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  {publicForms.length > 4 && featuredForm ? (
                    <div className="flex justify-end">
                      <Link
                        href={`/inscricoes/${featuredForm.id}`}
                        className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[11px] text-white/90 hover:border-white/40 hover:bg-white/16"
                      >
                        Ver todos os formulários
                      </Link>
                    </div>
                  ) : null}
                  {featuredFormDateLabel || featuredFormCapacityLabel ? (
                    <div className="rounded-2xl border border-white/18 bg-white/[0.04] px-3 py-3 text-[11px] text-white/88">
                      Destaque atual: <span className="font-semibold text-white">{featuredForm?.title}</span>
                    </div>
                  ) : null}
                </div>
              </section>
            ),
          }
        : null,
      showStoreSection
        ? {
            id: "loja",
            content: (
              <section id="loja" className="space-y-4 pb-8">
                <ProfileStoreCatalogSection
                  username={organizationProfile.username ?? usernameParam}
                  categories={storeCatalogCategories}
                  products={storeCatalogProducts}
                />
              </section>
            ),
          }
        : null,
      showCommunitySection
        ? {
            id: "comunidade",
            content: (
              <section id="comunidade" className="space-y-4 pb-8">
                <ProfileCommunitySection
                  username={organizationProfile.username ?? usernameParam}
                  communities={communityItems}
                  isAuthenticated={Boolean(viewerId)}
                />
              </section>
            ),
          }
        : null,
      {
        id: "legal",
        content: legalSnapshot ? (
          <ProfileLegalInlineSection
            displayName={orgDisplayName}
            bookingPolicy={legalSnapshot.bookingPolicy}
            storePolicy={{
              supportEmail: legalSnapshot.storePolicy.supportEmail,
              supportPhone: legalSnapshot.storePolicy.supportPhone,
              returnPolicy: legalSnapshot.storePolicy.returnPolicy,
              privacyPolicy: legalSnapshot.storePolicy.privacyPolicy,
            }}
          />
        ) : (
          <section className="rounded-2xl border border-white/18 bg-white/[0.04] p-4 text-[13px] text-white/84">
            Informação legal indisponível.
          </section>
        ),
      },
    ].filter(Boolean) as Array<{ id: string; content: ReactNode }>;
    const activeSection = fixedSections.find((section) => section.id === activeSectionId) ?? fixedSections[0] ?? null;

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
            addressLabel={organizationLocationLabel}
            addressMapHref={organizationLocationMapHref}
            linkedOrganizations={linkedOrganizations}
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
            <div className="orya-page-width flex flex-col gap-6">
              <ProfileSectionsShell
                navItems={sectionNavItems}
                defaultSectionId={defaultSectionId}
                serverSection={activeSection ? { id: activeSection.id, content: activeSection.content } : null}
                emptyContent={
                  <section className="border-b border-white/10 pb-6 text-sm text-white/85">
                    Este perfil público está em preparação.
                  </section>
                }
              />
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
      <div className="rounded-2xl border border-white/20 bg-white/[0.04] p-5 text-sm text-white/88">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/82">{label}</p>
        <h3 className="mt-2 text-xl font-semibold text-white">{emptyLabel}</h3>
        <p className="mt-1 text-[12px] text-white/82">Próximas datas aqui.</p>
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
      ? "relative overflow-hidden rounded-2xl border border-white/20 bg-white/[0.04] p-4"
      : "relative overflow-hidden rounded-3xl border border-white/15 bg-white/[0.04] p-5 shadow-[0_26px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl";

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
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/85">{label}</p>
        <h3 className="text-2xl font-semibold text-white">{event.title}</h3>
        {formatEventDateRange(event.startsAt, event.endsAt, event.timezone) ? (
          <p className="text-[12px] text-white/88">
            {formatEventDateRange(event.startsAt, event.endsAt, event.timezone)}
          </p>
        ) : null}
        {formatEventLocationLabel({ addressRef: event.addressRef ?? null }, "") ? (
          <p className="text-[12px] text-white/84">
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
