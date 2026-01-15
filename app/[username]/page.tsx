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
import { resolvePadelMatchStats } from "@/domain/padel/score";
import {
  CORE_ORGANIZATION_MODULES,
  parseOrganizationModules,
  resolvePrimaryModule,
} from "@/lib/organizationCategories";
import { normalizeInterestSelection, resolveInterestLabel } from "@/lib/interests";
import { getPaidSalesGate } from "@/lib/organizationPayments";
import { OrganizationFormStatus } from "@prisma/client";
import ReservasBookingSection from "@/app/[username]/_components/ReservasBookingSection";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: { username: string } | Promise<{ username: string }>;
  searchParams?: { serviceId?: string } | Promise<{ serviceId?: string }>;
};

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

function buildPairingLabel(pairing?: {
  slots: Array<{ playerProfile?: { displayName?: string | null; fullName?: string | null } | null }>;
} | null) {
  if (!pairing) return "—";
  const names = pairing.slots
    .map((slot) => slot.playerProfile?.displayName || slot.playerProfile?.fullName)
    .filter(Boolean) as string[];
  return names.length ? names.join(" / ") : "Dupla";
}

function formatScoreSummary(match: {
  scoreSets: Array<{ teamA: number; teamB: number }> | null;
  score: Record<string, unknown> | null;
}) {
  const score = match.score || {};
  const sets =
    match.scoreSets?.length
      ? match.scoreSets
      : Array.isArray((score as { sets?: unknown }).sets)
        ? ((score as { sets?: Array<{ teamA: number; teamB: number }> }).sets ?? null)
        : null;
  if (sets?.length) {
    return sets.map((set) => `${set.teamA}-${set.teamB}`).join(", ");
  }
  const resultType =
    score.resultType === "WALKOVER" || score.walkover === true
      ? "WALKOVER"
      : score.resultType === "RETIREMENT"
        ? "RETIREMENT"
        : score.resultType === "INJURY"
          ? "INJURY"
          : null;
  if (resultType === "WALKOVER") return "WO";
  if (resultType === "RETIREMENT") return "Desistência";
  if (resultType === "INJURY") return "Lesão";
  return "—";
}

type OrganizationEvent = {
  id: number;
  slug: string;
  title: string;
  startsAt: Date | null;
  endsAt: Date | null;
  locationName: string | null;
  locationCity: string | null;
  timezone: string | null;
  templateType: string | null;
  coverImageUrl: string | null;
  isFree: boolean;
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
  isFree: boolean;
};

type AgendaGroup = {
  key: string;
  label: string;
  items: AgendaItem[];
};

type PadelMatchPreview = {
  id: number;
  status: string;
  roundLabel: string | null;
  groupLabel: string | null;
  startAt: Date | null;
  scoreSets: Array<{ teamA: number; teamB: number }> | null;
  score: Record<string, unknown> | null;
  winnerSide: "A" | "B" | null;
  mySide: "A" | "B" | null;
  event: { title: string; slug: string };
  pairingA: {
    slots: Array<{
      profileId?: string | null;
      playerProfile?: { displayName?: string | null; fullName?: string | null } | null;
    }>;
  } | null;
  pairingB: {
    slots: Array<{
      profileId?: string | null;
      playerProfile?: { displayName?: string | null; fullName?: string | null } | null;
    }>;
  } | null;
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
    const locationLabel =
      [event.locationName, event.locationCity].filter(Boolean).join(" · ") || "Local a anunciar";
    const item: AgendaItem = {
      id: event.id,
      slug: event.slug,
      title: event.title,
      timeLabel: hasDate ? formatTimeLabel(event.startsAt as Date, timezone) : "—",
      locationLabel,
      isPast: pastEventIds?.has(event.id) ?? false,
      isFree: event.isFree,
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
      .map((module) => module.moduleKey)
      .filter((module): module is string => typeof module === "string")
      .map((module) => module.trim().toUpperCase());
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
    const isVerified = Boolean(organizationProfile.officialEmailVerifiedAt);
    const contactEmail = isVerified ? organizationProfile.officialEmail?.trim() || null : null;
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
          isFree: true,
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
      ? (events as OrganizationEvent[]).filter(
          (event) =>
            event.templateType === operationTemplate ||
            event.templateType === null ||
            event.templateType === "OTHER",
        )
      : (events as OrganizationEvent[]);
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
    const showInscricoes = hasInscricoes;
    const spotlightCtaLabel = spotlightEvent?.isFree ? "Garantir lugar" : "Comprar bilhete";
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
              {hasReservasModule && (
                <section className="space-y-5 sm:space-y-6">
                  <div className="rounded-3xl border border-white/12 bg-white/5 p-4 sm:p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Reservas</p>
                        <h2 className="text-xl font-semibold text-white sm:text-2xl">{orgDisplayName}</h2>
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
                      </div>
                      <a
                        href="#reservar"
                        className="w-full rounded-full bg-white px-5 py-2 text-center text-[12px] font-semibold text-black shadow-[0_10px_30px_rgba(255,255,255,0.25)] sm:w-auto"
                      >
                        Agendar
                      </a>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/12 bg-white/5 p-4 sm:p-5 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Sobre</p>
                    <p className="mt-2 text-[13px] text-white/70 sm:text-sm">
                      {publicDescription || "Descrição indisponível."}
                    </p>
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
                    />
                  </div>

                  <div className="rounded-3xl border border-white/12 bg-white/5 p-4 sm:p-5 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Avaliações</p>
                    {reviews.length === 0 ? (
                      <p className="mt-2 text-[13px] text-white/70 sm:text-sm">Ainda sem avaliações verificadas.</p>
                    ) : (
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {reviews.map((review) => (
                          <div key={review.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-white">
                                {review.user?.fullName || "Cliente"}
                              </p>
                              <span className="text-[12px] text-white/70">{review.rating} ★</span>
                            </div>
                            {review.comment && (
                              <p className="mt-2 text-[12px] text-white/70">{review.comment}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              )}
              {showAgenda && (
                <section className="grid gap-6 md:grid-cols-3 md:grid-rows-[auto_1fr] md:items-start">
                  <OrganizationAgendaTabs
                    title="Agenda pública"
                    anchorId="agenda"
                    layout="grid"
                    upcomingGroups={upcomingGroups}
                    pastGroups={pastGroups}
                    allGroups={allGroups}
                    upcomingCount={upcomingEvents.length}
                    pastCount={pastEvents.length}
                    totalCount={agendaTotal}
                    prelude={
                      <EventSpotlightCard
                        event={spotlightEvent}
                        label={`Próximo ${operationMeta.noun}`}
                        emptyLabel={`Sem ${operationMeta.noun} anunciado`}
                        ctaLabel={spotlightCtaLabel}
                        ctaHref={spotlightCtaHref}
                        variant="embedded"
                      />
                    }
                  />

                  <aside className="space-y-4 md:col-span-1 md:row-start-2 min-w-0">
                    {showInscricoes && (
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
                          <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">
                            Formulários
                          </p>
                          <h3 className="text-lg font-semibold text-white">
                            {featuredForm?.title ||
                              "Formulário em preparação"}
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
                                Responder
                              </Link>
                            ) : (
                              <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white/70">
                                Em breve
                              </span>
                            )}
                          </div>
                        </div>
                      </section>
                    )}

                  </aside>
                </section>
              )}

              {hasTorneiosModule && (
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

              {hasTorneiosModule && trainerProfiles.length > 0 && (
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
  let padelMatches: PadelMatchPreview[] = [];
  let padelUpcoming: PadelMatchPreview[] = [];
  let padelRecent: PadelMatchPreview[] = [];
  let padelSummary = {
    total: 0,
    wins: 0,
    losses: 0,
    upcoming: 0,
    winRate: "—",
  };

  if (prisma.follows) {
    const [followers, following] = await Promise.all([
      prisma.follows.count({ where: { following_id: resolvedProfile.id } }),
      prisma.follows.count({ where: { follower_id: resolvedProfile.id } }),
    ]);
    followersCount = followers;
    followingCount = following;

    if (!isOwner && viewerId) {
      const followRow = await prisma.follows.findFirst({
        where: { follower_id: viewerId, following_id: resolvedProfile.id },
        select: { id: true },
      });
      initialIsFollowing = Boolean(followRow);
      isFollowing = Boolean(followRow);
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
  const padelMissingCount = Object.keys(padelMissing).length;

  type PadelActionTone = "emerald" | "amber" | "ghost";
  type PadelStatusTone = "emerald" | "amber" | "slate";

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
  const padelStatus: { label: string; tone?: PadelStatusTone } | null = isOwner
    ? {
        label: padelComplete
          ? "Padel completo"
          : `Padel incompleto${padelMissingCount ? ` · ${padelMissingCount}` : ""}`,
        tone: padelComplete ? "emerald" : "amber",
      }
    : padelComplete
      ? { label: "Padel ativo", tone: "emerald" }
      : null;
  const padelHubHref = padelAction?.href ?? (padelComplete ? `/${profileHandle}/padel` : null);
  const padelHubLabel = padelAction?.label ?? "Ver Padel";

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
        new Set(
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

  if (canSeePrivateTimeline) {
    try {
      const matchRows = await prisma.padelMatch.findMany({
        where: {
          OR: [
            { pairingA: { slots: { some: { profileId: resolvedProfile.id } } } },
            { pairingB: { slots: { some: { profileId: resolvedProfile.id } } } },
          ],
        },
        include: {
          event: { select: { title: true, slug: true } },
          pairingA: {
            include: {
              slots: { select: { profileId: true, playerProfile: { select: { displayName: true, fullName: true } } } },
            },
          },
          pairingB: {
            include: {
              slots: { select: { profileId: true, playerProfile: { select: { displayName: true, fullName: true } } } },
            },
          },
        },
        orderBy: [{ startTime: "desc" }, { plannedStartAt: "desc" }, { id: "desc" }],
        take: 12,
      });

      padelMatches = matchRows.map((match) => {
        const scoreObj = match.score && typeof match.score === "object" ? (match.score as Record<string, unknown>) : null;
        const stats = resolvePadelMatchStats(match.scoreSets, scoreObj);
        const winnerSide =
          stats?.winner ??
          (scoreObj?.winnerSide === "A" || scoreObj?.winnerSide === "B"
            ? (scoreObj.winnerSide as "A" | "B")
            : null);
        const isInA = match.pairingA?.slots?.some((slot) => slot.profileId === resolvedProfile.id);
        const isInB = match.pairingB?.slots?.some((slot) => slot.profileId === resolvedProfile.id);
        const mySide = isInA ? "A" : isInB ? "B" : null;

        return {
          id: match.id,
          status: match.status,
          roundLabel: match.roundLabel ?? null,
          groupLabel: match.groupLabel ?? null,
          startAt: match.startTime ?? match.plannedStartAt ?? match.actualStartAt ?? null,
          scoreSets: Array.isArray(match.scoreSets)
            ? (match.scoreSets as Array<{ teamA: number; teamB: number }>)
            : null,
          score: scoreObj,
          winnerSide,
          mySide,
          event: { title: match.event.title, slug: match.event.slug },
          pairingA: match.pairingA,
          pairingB: match.pairingB,
        };
      });

      padelUpcoming = padelMatches
        .filter((match) => match.startAt && match.startAt >= now)
        .sort((a, b) => (a.startAt?.getTime() ?? 0) - (b.startAt?.getTime() ?? 0))
        .slice(0, 3);
      padelRecent = padelMatches
        .filter((match) => !match.startAt || match.startAt < now)
        .sort((a, b) => (b.startAt?.getTime() ?? 0) - (a.startAt?.getTime() ?? 0))
        .slice(0, 3);
    } catch (err) {
      console.warn("[profile] falha ao carregar jogos padel", err);
    }
  }

  if (canSeePrivateTimeline) {
    const completed = padelMatches.filter(
      (match) => match.status === "DONE" && match.winnerSide && match.mySide,
    );
    const wins = completed.filter((match) => match.winnerSide === match.mySide).length;
    const losses = completed.filter((match) => match.winnerSide !== match.mySide).length;
    const total = wins + losses;
    padelSummary = {
      total,
      wins,
      losses,
      upcoming: padelUpcoming.length,
      winRate: total > 0 ? `${Math.round((wins / total) * 100)}% vitórias` : "Sem resultados",
    };
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
          isOwner={isOwner}
          targetUserId={resolvedProfile.id}
          initialIsFollowing={initialIsFollowing}
          followersCount={followersCount}
          followingCount={followingCount}
          eventsCount={stats.total}
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
          padelStatus={padelStatus ?? undefined}
        />

        <div className="px-5 sm:px-8">
          <div className="orya-page-width flex flex-col gap-6">
            {(desktopInterests.length > 0 || isOwner) && (
              <section className="rounded-3xl border border-white/15 bg-white/5 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
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
                  <div className="mt-4 flex flex-wrap gap-2">
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
                      tone="cyan"
                    />
                    <StatCard
                      title="Total investido"
                      value={stats.totalSpent}
                      subtitle="Total pago."
                      tone="purple"
                    />
                  </div>
                </section>

                <section className="rounded-3xl border border-white/15 bg-white/5 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Padel</p>
                      <h2 className="mt-2 text-sm font-semibold text-white/95">Jogos e resultados</h2>
                      <p className="text-[12px] text-white/70">Próximos jogos, histórico e forma recente.</p>
                    </div>
                    {padelHubHref && (
                      <Link
                        href={padelHubHref}
                        className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[11px] font-semibold text-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.25)] hover:border-white/40 hover:bg-white/15 transition-colors"
                      >
                        {padelHubLabel}
                      </Link>
                    )}
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <PadelSummaryCard label="Jogos" value={padelSummary.total} subtitle={padelSummary.winRate} />
                    <PadelSummaryCard label="Vitórias" value={padelSummary.wins} tone="emerald" />
                    <PadelSummaryCard label="Derrotas" value={padelSummary.losses} tone="rose" />
                    <PadelSummaryCard label="Próximos" value={padelSummary.upcoming} tone="sky" />
                  </div>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Próximos</p>
                      {padelUpcoming.length === 0 && (
                        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/70">
                          Sem jogos agendados.
                        </div>
                      )}
                      {padelUpcoming.map((match) => (
                        <div
                          key={`padel-up-${match.id}`}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] text-white/60">{match.event.title}</p>
                            <PadelOutcomeBadge outcome={resolvePadelOutcome(match)} />
                          </div>
                          <p className="text-sm text-white/90">
                            {buildPairingLabel(match.pairingA)} vs {buildPairingLabel(match.pairingB)}
                          </p>
                          <p className="text-[11px] text-white/60">
                            {match.roundLabel || match.groupLabel || "Jogo"} · {formatDate(match.startAt) || "Data a anunciar"}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Últimos</p>
                      {padelRecent.length === 0 && (
                        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/70">
                          Sem histórico recente.
                        </div>
                      )}
                      {padelRecent.map((match) => (
                        <div
                          key={`padel-recent-${match.id}`}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] text-white/60">{match.event.title}</p>
                            <PadelOutcomeBadge outcome={resolvePadelOutcome(match)} />
                          </div>
                          <p className="text-sm text-white/90">
                            {buildPairingLabel(match.pairingA)} vs {buildPairingLabel(match.pairingB)}
                          </p>
                          <p className="text-[11px] text-white/60">
                            {match.roundLabel || match.groupLabel || "Jogo"} · {formatDate(match.startAt) || "Data a anunciar"}
                          </p>
                          <p className="text-[11px] text-white/70">Resultado: {formatScoreSummary(match)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {isOwner ? (
                  <section className="rounded-3xl border border-white/15 bg-white/5 backdrop-blur-2xl p-5 space-y-4 shadow-[0_24px_60px_rgba(0,0,0,0.6)] min-h-[280px] relative overflow-hidden">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.04),transparent_38%),radial-gradient(circle_at_85%_18%,rgba(255,255,255,0.03),transparent_34%),radial-gradient(circle_at_50%_85%,rgba(255,255,255,0.03),transparent_40%)]" />
                    <div className="flex items-center justify-between gap-3 flex-wrap">
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
                      <div className="flex h-48 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-sm text-white/80">
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
          {event.locationName}
          {event.locationCity ? ` · ${event.locationCity}` : ""}
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

type StatTone = "default" | "emerald" | "cyan" | "purple";

function toneClasses(tone: StatTone) {
  switch (tone) {
    case "emerald":
      return "border-emerald-300/30 from-emerald-500/16 via-emerald-500/9 to-[#0c1a14] shadow-[0_12px_26px_rgba(16,185,129,0.18)] text-emerald-50";
    case "cyan":
      return "border-cyan-300/30 from-cyan-500/16 via-cyan-500/9 to-[#08171c] shadow-[0_12px_26px_rgba(34,211,238,0.18)] text-cyan-50";
    case "purple":
      return "border-purple-300/30 from-purple-500/16 via-purple-500/9 to-[#120d1f] shadow-[0_12px_26px_rgba(168,85,247,0.18)] text-purple-50";
    default:
      return "border-white/15 from-white/12 via-[#0b1224]/78 to-[#0a0f1d] shadow-[0_12px_26px_rgba(0,0,0,0.45)] text-white";
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
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-4 transition-transform duration-150 hover:-translate-y-[3px] hover:shadow-[0_22px_50px_rgba(0,0,0,0.65)] ${toneClasses(
        tone,
      )}`}
    >
      <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/10 mix-blend-screen" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-white/5 blur-2xl" />
      <p
        className={`text-[11px] uppercase tracking-[0.16em] ${
          tone === "default" ? "text-white/65" : "text-white/75"
        }`}
      >
        {title}
      </p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
      <p className="text-[12px] text-white/70">{subtitle}</p>
    </div>
  );
}

type PadelSummaryTone = "default" | "emerald" | "rose" | "sky";

function padelSummaryToneClasses(tone: PadelSummaryTone) {
  switch (tone) {
    case "emerald":
      return "border-emerald-300/30 bg-emerald-400/12 text-emerald-50";
    case "rose":
      return "border-rose-300/30 bg-rose-400/12 text-rose-50";
    case "sky":
      return "border-sky-300/30 bg-sky-400/12 text-sky-50";
    default:
      return "border-white/12 bg-white/5 text-white";
  }
}

function PadelSummaryCard({
  label,
  value,
  subtitle,
  tone = "default",
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  tone?: PadelSummaryTone;
}) {
  return (
    <div
      className={`rounded-2xl border px-3 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-2xl ${padelSummaryToneClasses(
        tone,
      )}`}
    >
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/60">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      {subtitle ? <p className="text-[11px] text-white/60">{subtitle}</p> : null}
    </div>
  );
}

type PadelOutcomeTone = "emerald" | "rose" | "slate";
type PadelOutcome = { label: string; tone: PadelOutcomeTone };

function resolvePadelOutcome(match: PadelMatchPreview): PadelOutcome | null {
  if (match.status === "CANCELLED") return { label: "Cancelado", tone: "slate" };
  if (match.status !== "DONE") return null;
  if (!match.winnerSide || !match.mySide) return { label: "Final", tone: "slate" };
  return match.winnerSide === match.mySide
    ? { label: "Vitória", tone: "emerald" }
    : { label: "Derrota", tone: "rose" };
}

function padelOutcomeToneClasses(tone: PadelOutcomeTone) {
  switch (tone) {
    case "emerald":
      return "border-emerald-300/30 bg-emerald-400/15 text-emerald-100";
    case "rose":
      return "border-rose-300/30 bg-rose-400/15 text-rose-100";
    default:
      return "border-white/20 bg-white/10 text-white/70";
  }
}

function PadelOutcomeBadge({ outcome }: { outcome: PadelOutcome | null }) {
  if (!outcome) return null;
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${padelOutcomeToneClasses(
        outcome.tone,
      )}`}
    >
      {outcome.label}
    </span>
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
