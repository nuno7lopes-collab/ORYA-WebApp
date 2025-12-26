import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import ProfileHeader from "@/app/components/profile/ProfileHeader";
import OrganizationProfileHeader from "@/app/components/profile/OrganizationProfileHeader";
import OrganizerAgendaTabs from "@/app/components/profile/OrganizerAgendaTabs";
import { optimizeImageUrl } from "@/lib/image";
import {
  getCustomPremiumKey,
  getCustomPremiumProfileModules,
  isCustomPremiumActive,
} from "@/lib/organizerPremium";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: { username: string } | Promise<{ username: string }>;
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

type OrganizationCategory = "EVENTOS" | "PADEL" | "VOLUNTARIADO";

type OrganizerEvent = {
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

const CATEGORY_META: Record<
  OrganizationCategory,
  { label: string; cta: string; noun: string; nounPlural: string }
> = {
  EVENTOS: {
    label: "Eventos",
    cta: "Ver eventos",
    noun: "evento",
    nounPlural: "eventos",
  },
  PADEL: {
    label: "PADEL",
    cta: "Ver torneios",
    noun: "torneio",
    nounPlural: "torneios",
  },
  VOLUNTARIADO: {
    label: "Voluntariado",
    cta: "Participar",
    noun: "ação",
    nounPlural: "ações",
  },
};

const CATEGORY_TEMPLATE: Record<OrganizationCategory, "PADEL" | "VOLUNTEERING" | null> = {
  EVENTOS: null,
  PADEL: "PADEL",
  VOLUNTARIADO: "VOLUNTEERING",
};

const UPDATE_CATEGORY_LABELS: Record<string, string> = {
  TODAY: "Hoje",
  CHANGES: "Alterações",
  RESULTS: "Resultados",
  CALL_UPS: "Convocatórias",
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

function buildAgendaGroups(events: OrganizerEvent[], pastEventIds?: Set<number>) {
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

export default async function UserProfilePage({ params }: PageProps) {
  const resolvedParams = await params;
  const usernameParam = resolvedParams?.username;

  if (!usernameParam || usernameParam.toLowerCase() === "me") {
    redirect("/me");
  }

  const [viewerId, profile, organizerProfileRaw] = await Promise.all([
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
        visibility: true,
        createdAt: true,
      },
    }),
    prisma.organizer.findFirst({
      where: { username: usernameParam, status: "ACTIVE" },
      select: {
        id: true,
        userId: true,
        username: true,
        publicName: true,
        businessName: true,
        city: true,
        organizationCategory: true,
        brandingAvatarUrl: true,
        brandingCoverUrl: true,
        officialEmail: true,
        officialEmailVerifiedAt: true,
        publicListingEnabled: true,
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
        liveHubPremiumEnabled: true,
        organizationModules: {
          where: { enabled: true },
          select: { moduleKey: true },
        },
      },
    }),
  ]);

  const organizerProfile =
    organizerProfileRaw && organizerProfileRaw.publicListingEnabled !== false ? organizerProfileRaw : null;

  if (!profile?.username && !organizerProfile) {
    notFound();
  }

  if (!profile?.username && organizerProfile) {
    const now = new Date();
    const organizationCategory =
      (organizerProfile.organizationCategory as OrganizationCategory | null) ?? "EVENTOS";
    const categoryMeta = CATEGORY_META[organizationCategory];
    const categoryTemplate = CATEGORY_TEMPLATE[organizationCategory];
    const orgDisplayName =
      organizerProfile.publicName?.trim() ||
      organizerProfile.businessName?.trim() ||
      "Organização ORYA";
    const modules =
      (organizerProfile.organizationModules?.map((module) => module.moduleKey) ?? []) as string[];
    const ownerMembership = viewerId
      ? await prisma.organizerMember.findFirst({
          where: { organizerId: organizerProfile.id, userId: viewerId, role: "OWNER" },
          select: { userId: true },
        })
      : null;
    const isOrgOwner = Boolean(ownerMembership);
    const contactEmail = organizerProfile.officialEmail?.trim() || null;
    const publicWebsite = organizerProfile.publicWebsite?.trim() || null;
    const publicInstagram = organizerProfile.publicInstagram?.trim() || null;
    const publicYoutube = organizerProfile.publicYoutube?.trim() || null;
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
    const publicDescription = organizerProfile.publicDescription?.trim() || null;
    const premiumKey = getCustomPremiumKey(organizerProfile);
    const premiumActive = isCustomPremiumActive(organizerProfile);
    const premiumModules = premiumActive ? getCustomPremiumProfileModules(organizerProfile) ?? {} : {};
    const isOneVOnePremium = premiumActive && premiumKey === "ONEVONE";
    const hasInscricoes = modules.includes("INSCRICOES") && Boolean(premiumModules.inscricoes);
    const hasLoja = modules.includes("LOJA") && Boolean(premiumModules.loja);
    const hasGaleria = modules.includes("GALERIA") && Boolean(premiumModules.galeria);
    const shouldLoadForms = hasInscricoes || isOrgOwner;

    const formsWhere = {
      organizerId: organizerProfile.id,
      status: { in: ["PUBLISHED", "DRAFT"] },
    };

    const [events, updates, followersCount, followRow, forms] = await Promise.all([
      prisma.event.findMany({
        where: {
          organizerId: organizerProfile.id,
          status: "PUBLISHED",
          isDeleted: false,
          type: "ORGANIZER_EVENT",
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
      prisma.organizationUpdate.findMany({
        where: { organizerId: organizerProfile.id, status: "PUBLISHED" },
        include: {
          event: { select: { slug: true, title: true } },
        },
        orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
        take: 6,
      }),
      prisma.organizer_follows.count({
        where: { organizer_id: organizerProfile.id },
      }),
      viewerId
        ? prisma.organizer_follows.findFirst({
            where: { organizer_id: organizerProfile.id, follower_id: viewerId },
            select: { follower_id: true },
          })
        : Promise.resolve(null),
      shouldLoadForms
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
    ]);

    const formattedUpdates = updates.map((update) => ({
      ...update,
      dateLabel: formatDate(update.publishedAt ?? update.createdAt),
      categoryLabel: UPDATE_CATEGORY_LABELS[update.category] ?? update.category,
    }));

    const categoryEvents = categoryTemplate
      ? (events as OrganizerEvent[]).filter(
          (event) =>
            event.templateType === categoryTemplate ||
            event.templateType === null ||
            event.templateType === "OTHER",
        )
      : (events as OrganizerEvent[]);
    const upcomingEvents = categoryEvents
      .filter((event) => event.startsAt && event.startsAt >= now)
      .sort((a, b) => (a.startsAt?.getTime() ?? 0) - (b.startsAt?.getTime() ?? 0));
    const pastEvents = categoryEvents
      .filter((event) => event.startsAt && event.startsAt < now)
      .sort((a, b) => (b.startsAt?.getTime() ?? 0) - (a.startsAt?.getTime() ?? 0));
    const spotlightEvent = upcomingEvents[0] ?? null;
    const coverCandidate =
      organizerProfile.brandingCoverUrl?.trim() ||
      spotlightEvent?.coverImageUrl ||
      upcomingEvents.find((event) => event.coverImageUrl)?.coverImageUrl ||
      pastEvents.find((event) => event.coverImageUrl)?.coverImageUrl ||
      null;
    const headerCoverUrl = coverCandidate ? optimizeImageUrl(coverCandidate, 1400, 72) : null;
    const galleryItems = categoryEvents.filter((event) => event.coverImageUrl).slice(0, 6);
    const initialIsFollowing = Boolean(followRow);
    const isVerified = Boolean(organizerProfile.officialEmailVerifiedAt);
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
    const inscriptionsCoverUrl = spotlightEvent?.coverImageUrl
      ? optimizeImageUrl(spotlightEvent.coverImageUrl, 900, 70)
      : "/images/placeholder-event.jpg";
    const featuredFormDateLabel = featuredForm
      ? formatFormDateRange(featuredForm.startAt, featuredForm.endAt)
      : null;
    const featuredFormCapacityLabel = featuredForm?.capacity
      ? `${featuredForm.capacity} vagas`
      : null;
    const merchItems = hasLoja
      ? isOneVOnePremium
        ? [
            {
              title: "Camisola OneVOne",
              description: "Edição limitada oficial dos torneios.",
              price: "Em breve",
              href: publicWebsiteHref,
            },
            {
              title: "Pulseira OneVOne",
              description: "Identidade premium para atletas e staff.",
              price: "Em breve",
              href: publicWebsiteHref,
            },
          ]
        : [
            {
              title: "Camisola oficial",
              description: "Edição limitada com assinatura da organização.",
              price: "Em breve",
              href: publicWebsiteHref,
            },
            {
              title: "Pulseira de evento",
              description: "Identidade premium para a equipa e atletas.",
              price: "Em breve",
              href: publicWebsiteHref,
            },
          ]
      : [];
    const agendaTotal = upcomingEvents.length + pastEvents.length;
    const galleryPreview = galleryItems.slice(0, 4);
    const galleryHref = publicInstagram || null;
    const galleryLinkLabel = publicInstagram ? "Instagram" : null;

    const padelPlayersCount =
      organizationCategory === "PADEL"
        ? await prisma.padelPlayerProfile.count({ where: { organizerId: organizerProfile.id } })
        : 0;

    const padelTopPlayers =
      organizationCategory === "PADEL"
        ? await prisma.padelPlayerProfile.findMany({
            where: { organizerId: organizerProfile.id, isActive: true },
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

    return (
      <main className="relative orya-body-bg min-h-screen w-full overflow-hidden text-white">
        <section className="relative orya-page-width flex flex-col gap-8 py-10">
          <OrganizationProfileHeader
            name={orgDisplayName}
            username={organizerProfile.username ?? usernameParam}
            avatarUrl={organizerProfile.brandingAvatarUrl ?? null}
            coverUrl={headerCoverUrl}
            bio={publicDescription}
            city={organizerProfile.city ?? null}
            followersCount={followersTotal}
            followingCount={0}
            organizerId={organizerProfile.id}
            initialIsFollowing={initialIsFollowing}
            isOwner={isOrgOwner}
            isPublic={organizerProfile.publicListingEnabled !== false}
            isVerified={isVerified}
            instagramHref={publicInstagram}
            youtubeHref={publicYoutube}
            websiteHref={publicWebsiteHref}
            contactEmail={contactEmail}
          />

          <section className="grid gap-6 px-5 sm:px-8 md:grid-cols-3 md:grid-rows-[auto_1fr] md:items-start">
            <OrganizerAgendaTabs
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
                  label={`Próximo ${categoryMeta.noun}`}
                  emptyLabel={`Sem ${categoryMeta.noun} anunciado`}
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
                      Inscrições
                    </p>
                    <h3 className="text-lg font-semibold text-white">
                      {featuredForm?.title ||
                        (isOneVOnePremium ? "Ficha Guarda-Redes OneVOne" : "Inscrições em preparação")}
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
                          Inscrever-me
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

              {hasLoja && (
                <section className="rounded-3xl border border-white/12 bg-white/5 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Loja</p>
                      <h3 className="text-base font-semibold text-white">Merch premium</h3>
                    </div>
                    {publicWebsiteHref && (
                      <a
                        href={publicWebsiteHref}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/80 hover:border-white/30 hover:bg-white/10"
                      >
                        Ver loja
                      </a>
                    )}
                  </div>
                  {merchItems.length === 0 ? (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-[12px] text-white/70">
                      Produtos em preparação. Vamos lançar novidades em breve.
                    </div>
                  ) : (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {merchItems.slice(0, 2).map((item) => {
                        const titleLower = item.title.toLowerCase();
                        const isCamisola = titleLower.includes("camisola");
                        const isPulseira = titleLower.includes("pulseira");
                        const imageStyle = isCamisola
                          ? { backgroundImage: "url(/ov1.png)" }
                          : isPulseira
                            ? { backgroundImage: "url(/onevone-pulseira.png)" }
                            : undefined;
                        return (
                          <div
                            key={item.title}
                            className="overflow-hidden rounded-2xl border border-white/12 bg-[#05070f]/85 text-[12px] text-white/80 shadow-[0_16px_50px_rgba(0,0,0,0.5)]"
                          >
                            <div className="relative aspect-square w-full overflow-hidden border-b border-white/10">
                              <div
                                className={`absolute inset-0 bg-cover bg-center ${
                                  isCamisola
                                    ? ""
                                    : "bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.25),transparent_55%),linear-gradient(135deg,#0b1124,#05070f)]"
                                }`}
                                style={imageStyle}
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                              <div className="relative z-10 flex h-full flex-col justify-end p-3">
                                <p className="text-sm font-semibold text-white drop-shadow">
                                  {item.title}
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  {item.href ? (
                                    <a
                                      href={item.href}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex rounded-full border border-white/30 bg-white/15 px-3 py-1 text-[10px] text-white"
                                    >
                                      Comprar
                                    </a>
                                  ) : (
                                    <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[10px] text-white/80">
                                      Comprar
                                    </span>
                                  )}
                                  <span className="text-[10px] text-white/70">{item.price}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {hasGaleria && (
                <section className="rounded-3xl border border-white/12 bg-white/5 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Galeria</p>
                      <h3 className="text-base font-semibold text-white">Highlights</h3>
                    </div>
                    {galleryHref && galleryLinkLabel && (
                      <a
                        href={galleryHref}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/80 hover:border-white/30 hover:bg-white/10"
                      >
                        Ver {galleryLinkLabel}
                      </a>
                    )}
                  </div>
                  {galleryPreview.length === 0 ? (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-[12px] text-white/70">
                      Ainda não existem imagens publicadas.
                    </div>
                  ) : (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {galleryPreview.map((event) => {
                        const coverUrl = optimizeImageUrl(event.coverImageUrl, 600, 70);
                        const content = (
                          <div className="group relative h-20 overflow-hidden rounded-xl border border-white/10">
                            <div
                              className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-[1.04]"
                              style={{ backgroundImage: `url(${coverUrl})` }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                          </div>
                        );

                        return galleryHref ? (
                          <a
                            key={event.id}
                            href={galleryHref}
                            target="_blank"
                            rel="noreferrer"
                            className="block"
                          >
                            {content}
                          </a>
                        ) : (
                          <div key={event.id}>{content}</div>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}
            </aside>
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Canal oficial</p>
              <h2 className="text-xl font-semibold text-white">Atualizações da organização</h2>
            </div>
            {formattedUpdates.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/70 shadow-[0_20px_70px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
                Sem atualizações oficiais por agora. As novidades aparecem sempre aqui primeiro.
              </div>
            ) : (
              <div className="grid gap-3">
                {formattedUpdates.map((update) => (
                  <div
                    key={update.id}
                    className="rounded-2xl border border-white/12 bg-white/5 p-4 text-sm text-white/80 shadow-[0_18px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">
                          {update.categoryLabel}
                          {update.isPinned ? " · Fixado" : ""}
                        </p>
                        <h3 className="text-base font-semibold text-white">{update.title}</h3>
                        {update.event?.slug && (
                          <Link
                            href={`/eventos/${update.event.slug}`}
                            className="text-[12px] text-white/60 hover:text-white"
                          >
                            Evento: {update.event.title}
                          </Link>
                        )}
                      </div>
                      <span className="text-[11px] text-white/55">{update.dateLabel}</span>
                    </div>
                    {update.body && (
                      <p className="mt-2 text-[12px] text-white/70 whitespace-pre-line">
                        {update.body}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {organizationCategory === "PADEL" && (
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
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Ranking & histórico</p>
                  <p className="mt-2 text-[12px] text-white/70">
                    Aqui vês rankings, campeões e resultados oficiais assim que forem publicados.
                  </p>
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/70">
                    Temporada atual em preparação.
                  </div>
                </div>
              </div>
            </section>
          )}

          {organizationCategory === "VOLUNTARIADO" && (
            <section className="space-y-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Missão</p>
                <h2 className="text-xl font-semibold text-white">Impacto e participação</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-white/12 bg-white/5 p-5 text-sm text-white/75 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Missão</p>
                  <p className="mt-2 text-[12px] text-white/70">
                    {publicDescription ||
                      "Esta organização cria ações com impacto real. A missão e os objetivos serão atualizados em breve."}
                  </p>
                </div>
                <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050912]/90 p-5 text-sm text-white/75 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Como participar</p>
                  <p className="mt-2 text-[12px] text-white/70">
                    {organizerProfile.infoRequirements ||
                      organizerProfile.infoRules ||
                      "Segue a organização, inscreve-te nas próximas ações e confirma a tua disponibilidade."}
                  </p>
                </div>
              </div>
            </section>
          )}

        </section>
      </main>
    );
  }

  const isOwner = viewerId === profile.id;
  const isPrivate = profile.visibility === "PRIVATE";
  const canShowPrivate = isOwner || !isPrivate;
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
  }> = [];

  if (prisma.follows) {
    const [followers, following] = await Promise.all([
      prisma.follows.count({ where: { following_id: profile.id } }),
      prisma.follows.count({ where: { follower_id: profile.id } }),
    ]);
    followersCount = followers;
    followingCount = following;

    if (!isOwner && viewerId) {
      const followRow = await prisma.follows.findFirst({
        where: { follower_id: viewerId, following_id: profile.id },
        select: { id: true },
      });
      initialIsFollowing = Boolean(followRow);
    }
  }

  if (canShowPrivate && (prisma as any).entitlement) {
    const now = new Date();
    try {
      const [total, upcoming, past, recentEntitlements] = await Promise.all([
        (prisma as any).entitlement.count({ where: { ownerUserId: profile.id } }),
        (prisma as any).entitlement.count({
          where: { ownerUserId: profile.id, snapshotStartAt: { gte: now } },
        }),
        (prisma as any).entitlement.count({
          where: { ownerUserId: profile.id, snapshotStartAt: { lt: now } },
        }),
        (prisma as any).entitlement.findMany({
          where: { ownerUserId: profile.id },
          orderBy: [{ snapshotStartAt: "desc" }],
          take: 4,
          select: {
            id: true,
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

      recent = (recentEntitlements ?? []).map((r: any) => ({
        id: r.id,
            title: r.snapshotTitle,
            venueName: r.snapshotVenueName,
            coverUrl: r.snapshotCoverUrl,
            startAt: r.snapshotStartAt,
            isUpcoming: r.snapshotStartAt ? new Date(r.snapshotStartAt) >= now : false,
          }));
    } catch (err) {
      console.warn("[profile] falha ao carregar entitlements", err);
    }
  }

  const displayName =
    organizerProfile?.publicName?.trim() ||
    profile.fullName?.trim() ||
    profile.username ||
    "Utilizador ORYA";
  const coverCandidate =
    profile.coverUrl?.trim() ||
    recent.find((item) => item.coverUrl)?.coverUrl ||
    profile.avatarUrl ||
    null;
  const headerCoverUrl = coverCandidate ? optimizeImageUrl(coverCandidate, 1400, 72) : null;
  const isOrganizationProfile = Boolean(organizerProfile);

  return (
    <main className="relative orya-body-bg min-h-screen w-full overflow-hidden text-white">
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        <div className="absolute -top-36 right-[-140px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_35%_35%,rgba(255,0,200,0.28),transparent_60%)] opacity-80 blur-3xl" />
        <div className="absolute top-[22vh] -left-40 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(107,255,255,0.22),transparent_60%)] opacity-80 blur-3xl" />
        <div className="absolute bottom-[-180px] right-[12%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_40%_40%,rgba(22,70,245,0.25),transparent_60%)] opacity-70 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_35%,rgba(0,0,0,0.65))] mix-blend-screen" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.05),transparent_60%)]" />
      <section className="relative flex flex-col gap-6 py-10">
        <ProfileHeader
          isOwner={isOwner}
          name={displayName}
          username={profile.username}
          avatarUrl={profile.avatarUrl}
          coverUrl={headerCoverUrl}
          bio={profile.bio}
          city={profile.city}
          visibility={profile.visibility as "PUBLIC" | "PRIVATE" | null}
          createdAt={profile.createdAt?.toISOString?.() ?? null}
          followers={followersCount}
          following={followingCount}
          targetUserId={profile.id}
          initialIsFollowing={initialIsFollowing}
          isOrganization={isOrganizationProfile}
        />

        <div className="px-5 sm:px-8">
          <div className="orya-page-width flex flex-col gap-6">
            {canShowPrivate ? (
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
                      subtitle="Bruto - taxas."
                      tone="purple"
                    />
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
                        href="/me/carteira"
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
                  {displayName} mantém a timeline privada. Só o próprio consegue ver os eventos e
                  bilhetes.
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
  event: OrganizerEvent | null;
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
        <p className="mt-1 text-[12px] text-white/60">A equipa atualiza as próximas datas aqui.</p>
      </div>
    );
  }

  const cover = event.coverImageUrl ? optimizeImageUrl(event.coverImageUrl, 1400, 72) : null;
  const eventHref = `/eventos/${event.slug}`;
  const wrapperClass =
    variant === "embedded"
      ? "relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4"
      : "relative overflow-hidden rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_26px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl";

  return (
    <div className={wrapperClass}>
      {cover && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${cover})` }}
        />
      )}
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

function RecentCard({
  item,
}: {
  item: { id: string; title: string; venueName: string | null; coverUrl: string | null; startAt: Date | null };
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-white/5 p-3 shadow-[0_12px_36px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_30%_30%,rgba(255,0,200,0.14),transparent_45%),radial-gradient(circle_at_70%_70%,rgba(107,255,255,0.14),transparent_50%),#0b0f1b]">
          {item.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.coverUrl}
              alt={item.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-wide text-white/55">
              ORYA
            </div>
          )}
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
