// app/org/events/[id]/page.tsx
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { OrganizationModule, Prisma } from "@prisma/client";
import { ACTIVE_PAIRING_REGISTRATION_WHERE } from "@/domain/padelRegistration";
import { notFound, redirect } from "next/navigation";
import PadelTournamentTabs from "./PadelTournamentTabs";
import EventAttendeesPanel from "./EventAttendeesPanel";
import PadelTournamentLifecyclePanel from "./PadelTournamentLifecyclePanel";
import PadelTournamentRolesPanel from "./PadelTournamentRolesPanel";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/app/org/_internal/core/dashboardUi";
import { getEventCoverSuggestionIds, getEventCoverUrl } from "@/lib/eventCover";
import { cn } from "@/lib/utils";
import { getEventLocationDisplay } from "@/lib/location/eventLocation";
import { TOURNAMENT_LIFECYCLE_LABELS, TOURNAMENT_LIFECYCLE_ORDER } from "@/domain/padel/tournamentLifecycle";
import { toPadelFormatLabel } from "@/domain/padel/formatPresentation";
import { appendOrganizationIdToHref, buildOrgHref } from "@/lib/organizationIdUtils";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type EventWithTickets = {
  id: number;
  organizationId: number | null;
  slug: string;
  title: string;
  description: string;
  templateType: string | null;
  tournament?: { id: number } | null;
  startsAt: Date;
  endsAt: Date;
  addressId: string | null;
  addressRef?: {
    formattedAddress: string | null;
    canonical: Prisma.JsonValue | null;
  } | null;
  status: string;
  coverImageUrl: string | null;
  isGratis: boolean;
  ticketTypes: Array<{
    id: number;
    name: string;
    description: string | null;
    price: number;
    currency: string;
    totalQuantity: number | null;
    soldQuantity: number;
    status: string;
    startsAt: Date | null;
    endsAt: Date | null;
    padelEventCategoryLinkId?: number | null;
  }>;
  padelCategoryLinks?: Array<{
    id: number;
    padelCategoryId: number;
    capacityTeams?: number | null;
    capacityPlayers?: number | null;
    format?: string | null;
    isEnabled?: boolean;
    category?: { label: string | null } | null;
  }>;
  padelTournamentConfig: {
    numberOfCourts: number;
    format?: string | null;
    club?: {
      name: string;
      addressRef?: { formattedAddress: string | null; canonical?: Prisma.JsonValue | null } | null;
    } | null;
    partnerClubIds?: number[];
    advancedSettings?: Record<string, unknown> | null;
    lifecycleStatus?: string | null;
  } | null;
};

const pickCanonicalField = (
  canonical: Prisma.JsonValue | null | undefined,
  keys: string[],
) => {
  if (!canonical || typeof canonical !== "object" || Array.isArray(canonical)) return null;
  const record = canonical as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
};

const resolveCanonicalCity = (canonical?: Prisma.JsonValue | null) =>
  pickCanonicalField(canonical, ["city", "addressLine2", "locality"]);

export default async function OrganizationEventDetailPage({ params }: PageProps) {
  const resolved = await params;

  // 1) Garante auth
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    redirect("/login");
  }

  const userId = data.user.id;

  const eventId = Number.parseInt(resolved.id, 10);
  if (!Number.isFinite(eventId)) {
    notFound();
  }

  // 2) Buscar evento + tipos de bilhete (waves)
  const event = (await prisma.event.findUnique({
        where: {
          id: eventId,
        },
        include: {
          tournament: {
            select: { id: true },
          },
          ticketTypes: {
            orderBy: {
              sortOrder: "asc",
            },
          },
          padelCategoryLinks: {
            include: { category: { select: { label: true } } },
          },
          padelTournamentConfig: {
            include: {
              club: {
                select: {
                  name: true,
                  addressRef: { select: { formattedAddress: true, canonical: true } },
                },
              },
            },
          },
          addressRef: {
            select: {
              formattedAddress: true,
              canonical: true,
            },
          },
        },
      })) as (EventWithTickets & {
        padelTournamentConfig: {
          numberOfCourts: number;
          format?: string | null;
          club?: {
            name: string;
            addressRef?: { formattedAddress: string | null; canonical?: Record<string, unknown> | null } | null;
          } | null;
          partnerClubIds?: number[];
          advancedSettings?: Record<string, unknown> | null;
        } | null;
      }) | null;

  if (!event) {
    notFound();
  }
  if (!event.organizationId) {
    notFound();
  }

  const isPadelEvent = event.templateType === "PADEL";
  const eventRouteBase = buildOrgHref(
    event.organizationId,
    isPadelEvent ? "/padel/tournaments" : "/events",
  );
  const primaryLabel = isPadelEvent ? "torneio" : "evento";
  const ticketLabelPlural = isPadelEvent ? "inscrições" : "bilhetes";
  const ticketLabelPluralCap = isPadelEvent ? "Inscrições" : "Bilhetes";
  const ticketsSoldLabel = isPadelEvent ? "Inscrições registadas" : "Bilhetes vendidos";
  const revenueHint = isPadelEvent
    ? "Calculado com base em bilhetes vendidos."
    : "Calculado com base em preço × bilhetes vendidos, por wave.";
  const fallbackHref = eventRouteBase;

  const { organization, membership } = await getActiveOrganizationForUser(userId, {
    organizationId: event.organizationId,
    allowFallback: true,
  });

  if (!organization || !membership) {
    redirect(appendOrganizationIdToHref("/org", event.organizationId));
  }
  const access = await ensureMemberModuleAccess({
    organizationId: event.organizationId,
    userId,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.EVENTOS,
    required: "EDIT",
  });
  if (!access.ok) {
    redirect(appendOrganizationIdToHref(fallbackHref, event.organizationId));
  }

  const locationDisplay = getEventLocationDisplay(
    {
      addressRef: event.addressRef ?? null,
    },
    "Local a anunciar",
  );

  const now = new Date();
  const padelLinks = Array.isArray(event.padelCategoryLinks) ? event.padelCategoryLinks : [];
  const advancedSettings = event.padelTournamentConfig?.advancedSettings as
    | {
        maxEntriesTotal?: number | null;
        waitlistEnabled?: boolean;
        allowSecondCategory?: boolean;
        allowCancelGames?: boolean;
        gameDurationMinutes?: number | null;
        courtIds?: number[];
        staffIds?: number[];
        courtsFromClubs?: Array<{ id?: number; clubId?: number | null; clubName?: string | null; name?: string | null; indoor?: boolean }>;
        staffFromClubs?: Array<{ clubName?: string | null; email?: string | null; role?: string | null }>;
        categoriesMeta?: Array<{ name?: string; categoryId?: number | null; capacity?: number | null; registrationType?: string | null }>;
      }
    | null;

  const padelCapacity = (() => {
    if (!isPadelEvent) return null;
    const maxEntriesTotal =
      typeof advancedSettings?.maxEntriesTotal === "number" && Number.isFinite(advancedSettings.maxEntriesTotal)
        ? Math.floor(advancedSettings.maxEntriesTotal)
        : null;
    if (maxEntriesTotal && maxEntriesTotal > 0) return maxEntriesTotal;
    const enabledLinks = padelLinks.filter((link) => link.isEnabled !== false);
    if (enabledLinks.length === 0) return null;
    const capacities = enabledLinks.map((link) => link.capacityTeams ?? link.capacityPlayers ?? null);
    const normalizedCapacities = capacities.filter((cap): cap is number => typeof cap === "number");
    if (normalizedCapacities.length !== capacities.length) return null;
    return normalizedCapacities.reduce((sum, cap) => sum + cap, 0);
  })();

  const padelPairingsCount = isPadelEvent
    ? await prisma.padelPairing.count({
        where: {
          eventId: event.id,
          pairingStatus: { not: "CANCELLED" },
          ...ACTIVE_PAIRING_REGISTRATION_WHERE,
        },
      })
    : 0;
  const padelPairingsByCategory = isPadelEvent
    ? await prisma.padelPairing.groupBy({
        by: ["categoryId"],
        where: {
          eventId: event.id,
          pairingStatus: { not: "CANCELLED" },
          ...ACTIVE_PAIRING_REGISTRATION_WHERE,
        },
        _count: { _all: true },
      })
    : [];
  const padelPairingsByCategoryMap = new Map<number | null, number>();
  padelPairingsByCategory.forEach((row) => {
    padelPairingsByCategoryMap.set(row.categoryId ?? null, row._count._all);
  });
  const [padelMatchesCount, padelScheduledMatchesCount] = isPadelEvent
    ? await Promise.all([
        prisma.eventMatchSlot.count({
          where: {
            eventId: event.id,
            status: { not: "CANCELLED" },
          },
        }),
        prisma.eventMatchSlot.count({
          where: {
            eventId: event.id,
            status: { not: "CANCELLED" },
            OR: [{ plannedStartAt: { not: null } }, { startTime: { not: null } }],
          },
        }),
      ])
    : [0, 0];
  const padelUnscheduledMatchesCount = Math.max(0, padelMatchesCount - padelScheduledMatchesCount);

  // 3) Métricas agregadas
  const totalWaves = event.ticketTypes.length;
  const totalTicketsSold = isPadelEvent
    ? padelPairingsCount
    : event.ticketTypes.reduce((sum, t) => sum + t.soldQuantity, 0);
  const totalStock = isPadelEvent
    ? padelCapacity ?? 0
    : event.ticketTypes.reduce(
        (sum, t) =>
          sum +
          (t.totalQuantity !== null && t.totalQuantity !== undefined
            ? t.totalQuantity
            : 0),
        0,
      );
  const overallOccupancy = isPadelEvent
    ? padelCapacity && padelCapacity > 0
      ? Math.min(100, Math.round((totalTicketsSold / padelCapacity) * 100))
      : null
    : totalStock > 0
      ? Math.min(100, Math.round((totalTicketsSold / totalStock) * 100))
      : null;

  const totalRevenueCents = event.ticketTypes.reduce(
    (sum, t) => sum + t.soldQuantity * (t.price ?? 0),
    0,
  );
  const totalRevenue = (totalRevenueCents / 100).toFixed(2);

  const cheapestWave = event.ticketTypes.length
    ? event.ticketTypes.reduce((min, t) =>
        ((t.price ?? 0) < (min.price ?? 0) ? t : min)
      )
    : null;

  const formatDateTime = (d: Date | null | undefined) => {
    if (!d) return null;
    return new Date(d).toLocaleString("pt-PT", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatMoney = (cents: number) =>
    `${(cents / 100).toFixed(2)} €`.replace(".", ",");
  const formatLabel = (value?: string | null) => {
    if (!value) return "Formato não definido";
    return toPadelFormatLabel(value) ?? value;
  };

  const startDateFormatted = formatDateTime(event.startsAt);
  const endDateFormatted = formatDateTime(event.endsAt);
  const coverUrl = getEventCoverUrl(event.coverImageUrl, {
    seed: event.slug ?? event.id,
    suggestedIds: getEventCoverSuggestionIds({ templateType: event.templateType ?? null }),
    width: 420,
    quality: 70,
    format: "webp",
  });

  const padelLifecycleStatus = event.padelTournamentConfig?.lifecycleStatus ?? null;
  const tournamentState =
    isPadelEvent && padelLifecycleStatus
      ? TOURNAMENT_LIFECYCLE_LABELS[padelLifecycleStatus as keyof typeof TOURNAMENT_LIFECYCLE_LABELS] ??
        padelLifecycleStatus
      : event.status === "CANCELLED"
        ? "Cancelado"
        : event.status === "FINISHED"
          ? "Terminado"
          : event.status === "DRAFT"
            ? "Nao publicado (legado)"
            : "Público";

  const partnerClubs =
    event.padelTournamentConfig?.partnerClubIds?.length
      ? await prisma.padelClub.findMany({
          where: { id: { in: event.padelTournamentConfig.partnerClubIds as number[] } },
          select: {
            id: true,
            name: true,
            addressRef: { select: { formattedAddress: true, canonical: true } },
          },
        })
      : [];
  const categoriesMeta =
    padelLinks.length > 0
      ? padelLinks.map((link) => ({
          name: link.category?.label ?? `Categoria ${link.padelCategoryId}`,
          categoryId: link.padelCategoryId,
          capacity: link.capacityTeams ?? link.capacityPlayers ?? null,
          registrationType: undefined,
        }))
      : advancedSettings?.categoriesMeta ?? [];
  const padelCategorySummary = isPadelEvent
    ? categoriesMeta.map((category, index) => {
        const categoryId =
          typeof category.categoryId === "number" && Number.isFinite(category.categoryId)
            ? category.categoryId
            : null;
        const capacity =
          typeof category.capacity === "number" && Number.isFinite(category.capacity)
            ? Math.floor(category.capacity)
            : null;
        const count = padelPairingsByCategoryMap.get(categoryId ?? null) ?? 0;
        const occupancy = capacity && capacity > 0 ? Math.min(100, Math.round((count / capacity) * 100)) : null;
        const label = category.name || (categoryId ? `Categoria ${categoryId}` : `Categoria ${index + 1}`);
        return {
          key: categoryId ?? `padel-cat-${index}`,
          label,
          count,
          capacity,
          occupancy,
        };
      })
    : [];
  const backHref = eventRouteBase;
  const operationsHref = isPadelEvent ? "#padel-torneio" : `${eventRouteBase}/${event.id}`;
  const hubBaseHref = isPadelEvent
    ? buildOrgHref(event.organizationId, "/padel/tournaments", {
        section: "padel-tournaments",
      })
    : null;
  const hubCalendarHref = hubBaseHref ? `${hubBaseHref}&padel=calendar&eventId=${event.id}` : null;
  const hubCalendarAutoHref = hubCalendarHref ? `${hubCalendarHref}#auto-schedule` : null;
  const hubClubHref = isPadelEvent
    ? buildOrgHref(event.organizationId, "/padel/clubs", {
        section: "padel-club",
        padel: "clubs",
      })
    : null;
  const hubCourtsHref = isPadelEvent
    ? buildOrgHref(event.organizationId, "/padel/clubs", {
        section: "padel-club",
        padel: "clubs",
      })
    : null;
  const hubCategoriesHref = hubBaseHref ? `${hubBaseHref}&padel=categories` : null;

  const activePadelLinks = isPadelEvent ? padelLinks.filter((link) => link.isEnabled !== false) : [];
  const activePadelLinkIds = activePadelLinks.map((link) => link.id);
  const ticketLinkIds = new Set(
    event.ticketTypes
      .map((ticket) => ticket.padelEventCategoryLinkId)
      .filter((id): id is number => typeof id === "number" && Number.isFinite(id)),
  );
  const padelTicketsReady =
    activePadelLinkIds.length > 0 && activePadelLinkIds.every((id) => ticketLinkIds.has(id));
  const courtIds =
    Array.isArray(advancedSettings?.courtIds)
      ? advancedSettings.courtIds.filter((id) => typeof id === "number" && Number.isFinite(id))
      : [];
  const staffIds =
    Array.isArray(advancedSettings?.staffIds)
      ? advancedSettings.staffIds.filter((id) => typeof id === "number" && Number.isFinite(id))
      : [];
  const courtsCount = courtIds.length > 0 ? courtIds.length : event.padelTournamentConfig?.numberOfCourts ?? 0;
  const padelStatusItems = isPadelEvent
    ? [
        {
          key: "club",
          label: "Clube",
          status: event.padelTournamentConfig?.club ? "ok" : "missing",
          detail: event.padelTournamentConfig?.club?.name ?? "Sem clube",
        },
        {
          key: "courts",
          label: "Campos",
          status: courtsCount > 0 ? "ok" : "missing",
          detail: courtsCount > 0 ? `${courtsCount} campo(s)` : "Sem campos",
        },
        {
          key: "categories",
          label: "Categorias",
          status: activePadelLinkIds.length > 0 ? "ok" : "missing",
          detail: activePadelLinkIds.length > 0 ? `${activePadelLinkIds.length} ativa(s)` : "Sem categorias",
        },
        {
          key: "tickets",
          label: "Inscrições",
          status: padelTicketsReady ? "ok" : "missing",
          detail: padelTicketsReady ? "Por categoria" : "Faltam por categoria",
        },
        {
          key: "staff",
          label: "Equipa",
          status: partnerClubs.length > 0 ? (staffIds.length > 0 ? "ok" : "missing") : staffIds.length > 0 ? "ok" : "optional",
          detail:
            staffIds.length > 0
              ? `${staffIds.length} pessoa(s)`
              : partnerClubs.length > 0
                ? "Obrigatório"
                : "Opcional",
        },
      ]
    : [];
  const padelStatusRequired = padelStatusItems.filter((item) => item.status !== "optional");
  const padelStatusMissing = padelStatusItems.filter((item) => item.status === "missing");
  const padelStatusComplete = padelStatusRequired.filter((item) => item.status === "ok").length;
  const padelStatusLabel =
    padelStatusMissing.length === 0 ? "Pronto" : `${padelStatusComplete}/${padelStatusRequired.length} ok`;

  const activePadelCategoryIds = activePadelLinks.map((link) => link.padelCategoryId);
  const activePadelFormats = Array.from(
    new Set(
      activePadelLinks
        .map((link) => link.format ?? event.padelTournamentConfig?.format ?? null)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  );
  const hasGroupsFormat = activePadelFormats.includes("GRUPOS_ELIMINATORIAS");
  const formatsSummaryLabel =
    activePadelFormats.length > 0 ? activePadelFormats.map((value) => formatLabel(value)).join(" · ") : formatLabel(null);
  const categoriesWithPairings = activePadelCategoryIds.filter(
    (id) => (padelPairingsByCategoryMap.get(id) ?? 0) >= 2,
  );
  const readyToGenerateMatches = activePadelCategoryIds.length > 0 && categoriesWithPairings.length > 0;
  const generateIssues: string[] = [];
  if (activePadelCategoryIds.length === 0) generateIssues.push("Sem categorias ativas");
  if (categoriesWithPairings.length === 0) generateIssues.push("Duplas insuficientes (mín. 2)");

  const readyForSchedule = padelMatchesCount > 0 && padelScheduledMatchesCount > 0 && padelUnscheduledMatchesCount === 0;
  const scheduleIssues: string[] = [];
  if (padelMatchesCount === 0) scheduleIssues.push("Sem jogos gerados");
  if (padelMatchesCount > 0 && padelScheduledMatchesCount === 0) scheduleIssues.push("Sem jogos no calendário");
  if (padelUnscheduledMatchesCount > 0) scheduleIssues.push(`${padelUnscheduledMatchesCount} jogo(s) sem horário`);

  const readyForOperations = padelMatchesCount > 0 && padelScheduledMatchesCount > 0;
  const operationsIssues: string[] = [];
  if (padelMatchesCount === 0) operationsIssues.push("Sem jogos gerados");
  if (padelMatchesCount > 0 && padelScheduledMatchesCount === 0) operationsIssues.push("Calendário por gerar");
  if (padelUnscheduledMatchesCount > 0 && padelScheduledMatchesCount > 0) {
    operationsIssues.push(`${padelUnscheduledMatchesCount} jogo(s) sem horário`);
  }

  const generateMatchesHref = isPadelEvent ? "#padel-torneio" : null;
  const publicPageHref = `/eventos/${event.slug}`;
  const monitorHref = `/eventos/${event.slug}/monitor`;
  const scoreHref = `/eventos/${event.slug}/calendario?view=resultados`;
  const calendarPublicHref = `/eventos/${event.slug}/calendario`;
  const rankingPublicHref = `/eventos/${event.slug}/ranking`;

  const actionToneClasses = (tone: "primary" | "success" | "warning" | "neutral") => {
    switch (tone) {
      case "primary":
        return "border-[#22D3EE]/45 bg-[#22D3EE]/10 text-white hover:border-[#22D3EE]/70";
      case "success":
        return "border-emerald-400/45 bg-emerald-400/10 text-emerald-50 hover:border-emerald-400/70";
      case "warning":
        return "border-amber-400/45 bg-amber-400/10 text-amber-50 hover:border-amber-400/70";
      default:
        return "border-white/15 bg-white/5 text-white/80 hover:border-white/35";
    }
  };

  const opsActions = isPadelEvent
    ? [
        {
          key: "public",
          label: "Página pública",
          description: "Partilha o torneio com jogadores.",
          href: publicPageHref,
          tone: "primary" as const,
          external: true,
        },
        {
          key: "schedule",
          label: "Agenda automática",
          description: readyForSchedule
            ? `${padelScheduledMatchesCount}/${padelMatchesCount} jogo(s) agendados.`
            : scheduleIssues.join(" · ") || "Distribuição automática por campos.",
          href: hubCalendarAutoHref ?? hubCalendarHref ?? "#padel-torneio",
          tone: readyForSchedule ? ("success" as const) : padelMatchesCount > 0 ? ("warning" as const) : ("neutral" as const),
          external: false,
        },
        {
          key: "operations",
          label: "Gestão competitiva",
          description: readyForOperations
            ? `Operação pronta · ${padelScheduledMatchesCount} jogo(s) em agenda.`
            : operationsIssues.join(" · ") || "Configura o torneio.",
          href: operationsHref,
          tone: readyForOperations ? ("success" as const) : ("warning" as const),
        },
        {
          key: "monitor",
          label: "TV Mode",
          description: "Monitor desportivo do live.",
          href: monitorHref,
          tone: "neutral" as const,
          external: true,
        },
        {
          key: "placar",
          label: "Resultados",
          description: "Resultados e classificações.",
          href: scoreHref,
          tone: "neutral" as const,
          external: true,
        },
        {
          key: "calendar",
          label: "Calendário público",
          description: "Agenda e horários por campo.",
          href: calendarPublicHref,
          tone: "neutral" as const,
          external: true,
        },
        {
          key: "ranking",
          label: "Ranking público",
          description: "Classificação por pontos.",
          href: rankingPublicHref,
          tone: "neutral" as const,
          external: true,
        },
        {
          key: "widgets",
          label: "Integrações e exportações",
          description: "Incorporações e ficheiros oficiais.",
          href: "#padel-widgets",
          tone: "neutral" as const,
          external: false,
        },
        {
          key: "governance",
          label: "Funções e ciclo de vida",
          description: "Direção, árbitros e estado.",
          href: "#padel-governance",
          tone: "neutral" as const,
          external: false,
        },
      ]
    : [];
  const operationFlowSteps = isPadelEvent
    ? [
        {
          key: "setup",
          label: "Configuração base",
          detail: padelStatusMissing.length === 0 ? "Concluída" : `${padelStatusMissing.length} pendente(s)`,
          done: padelStatusMissing.length === 0,
          href: "#padel-governance",
        },
        {
          key: "generation",
          label: hasGroupsFormat ? "Gerar grupos e KO" : "Gerar quadro",
          detail: padelMatchesCount > 0 ? `${padelMatchesCount} jogo(s)` : "Sem jogos gerados",
          done: padelMatchesCount > 0,
          href: "#padel-torneio",
        },
        {
          key: "schedule",
          label: "Agendar calendário",
          detail:
            padelScheduledMatchesCount > 0
              ? `${padelScheduledMatchesCount}/${padelMatchesCount} com horário`
              : "Sem horários atribuídos",
          done: readyForSchedule,
          href: hubCalendarAutoHref ?? hubCalendarHref ?? "#padel-torneio",
        },
        {
          key: "live",
          label: "Operação live",
          detail: readyForOperations ? "Pronta" : operationsIssues.join(" · "),
          done: readyForOperations,
          href: operationsHref,
        },
      ]
    : [];

  const standardEventEndedByDate = event.endsAt ? new Date(event.endsAt).getTime() < now.getTime() : false;
  const standardEventCancelled = event.status === "CANCELLED";
  const standardEventFinished = event.status === "FINISHED" || standardEventEndedByDate;
  const standardEventTerminated = standardEventCancelled || standardEventFinished;
  const standardEventLegacyDraft = event.status === "DRAFT";
  const standardEventActive = !standardEventTerminated && !standardEventLegacyDraft;

  const timeline = isPadelEvent && padelLifecycleStatus
    ? TOURNAMENT_LIFECYCLE_ORDER.map((key, idx) => {
        const currentIndex = TOURNAMENT_LIFECYCLE_ORDER.indexOf(padelLifecycleStatus as any);
        return {
          key,
          label: TOURNAMENT_LIFECYCLE_LABELS[key],
          active: padelLifecycleStatus === key,
          done: currentIndex > idx && currentIndex !== -1,
        };
      })
    : [
        {
          key: "LEGACY_UNPUBLISHED",
          label: "Nao publicado (legado)",
          active: standardEventLegacyDraft,
          done: !standardEventLegacyDraft,
        },
        { key: "ATIVO", label: "Ativo", active: standardEventActive, done: standardEventTerminated },
        {
          key: "TERMINADO",
          label: "Terminado",
          active: !standardEventCancelled && standardEventFinished,
          done: !standardEventCancelled && standardEventFinished,
        },
        {
          key: "CANCELADO",
          label: "Cancelado",
          active: standardEventCancelled,
          done: standardEventCancelled,
        },
      ];

  return (
    <div className={cn("w-full space-y-7 py-8 text-white")}>
      <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/70">Gestão de {primaryLabel}</p>
            <h1 className="text-2xl font-semibold tracking-tight">Detalhes e fases</h1>
            <p className="line-clamp-2 text-sm text-white/70">{event.title}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <a href={backHref} className={CTA_SECONDARY}>
              ← Voltar à lista
            </a>
            {hubCalendarHref && (
              <a href={hubCalendarHref} className={CTA_SECONDARY}>
                Calendário do Hub
              </a>
            )}
            {!standardEventCancelled && (
              <a href={operationsHref} className={CTA_SECONDARY}>
                Operação
              </a>
            )}
            <a href={publicPageHref} className={CTA_PRIMARY}>
              Ver página pública
            </a>
          </div>
        </div>
      </div>

      {standardEventCancelled && (
        <section className="rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-4 text-[12px] text-red-100">
          Evento cancelado em estado terminal. Operações de bilhetes, inscrições e check-in estão bloqueadas.
        </section>
      )}

      {isPadelEvent && !standardEventCancelled && (
        <section className="rounded-2xl border border-white/12 bg-gradient-to-br from-[#0b1226]/85 via-[#0b1126]/75 to-[#050810]/90 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Operação premium</p>
              <h2 className="text-xl font-semibold text-white">Atalhos do torneio</h2>
              <p className="text-[12px] text-white/65">
                Abrir operação, calendário e distribuição com um clique.
              </p>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-[11px] ${
                readyForOperations
                  ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-50"
                  : "border-amber-400/50 bg-amber-500/10 text-amber-50"
              }`}
            >
              {readyForOperations ? "Operação pronta" : "Pré-operação"}
            </span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {opsActions.map((action) => (
              <a
                key={action.key}
                href={action.href}
                target={action.external ? "_blank" : undefined}
                rel={action.external ? "noreferrer" : undefined}
                className={`group rounded-2xl border px-4 py-3 text-left transition ${actionToneClasses(action.tone)}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{action.label}</p>
                  <span className="text-[10px] text-white/50 group-hover:text-white/80">→</span>
                </div>
                <p className="mt-1 text-[11px] text-white/60">{action.description}</p>
              </a>
            ))}
          </div>
          {operationFlowSteps.length > 0 && (
            <div className="mt-3 rounded-2xl border border-white/12 bg-black/30 p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Fluxo recomendado</p>
              <p className="mt-1 text-[12px] text-white/70">Formato ativo: {formatsSummaryLabel}</p>
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                {operationFlowSteps.map((step, index) => (
                  <a
                    key={step.key}
                    href={step.href}
                    className={`rounded-xl border px-3 py-2 text-[11px] ${
                      step.done
                        ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-50"
                        : "border-amber-400/40 bg-amber-500/10 text-amber-100"
                    }`}
                  >
                    <p className="font-semibold">{index + 1}. {step.label}</p>
                    <p className="mt-1 text-white/80">{step.detail}</p>
                  </a>
                ))}
              </div>
            </div>
          )}
          {(generateIssues.length > 0 || scheduleIssues.length > 0 || operationsIssues.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/70">
              {generateIssues.length > 0 && (
                <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1">
                  Geração de jogos: {generateIssues.join(" · ")}
                </span>
              )}
              {scheduleIssues.length > 0 && (
                <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1">
                  Agenda: {scheduleIssues.join(" · ")}
                </span>
              )}
              {operationsIssues.length > 0 && (
                <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1">
                  Operação: {operationsIssues.join(" · ")}
                </span>
              )}
            </div>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1.1fr)]">
        <div className="space-y-3 rounded-2xl border border-white/14 bg-gradient-to-br from-white/8 via-[#0b1226]/70 to-[#050912]/90 p-5 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                {event.title}
              </h2>
              <p className="mt-1 text-[11px] text-white/65">
                {startDateFormatted}
                {endDateFormatted ? ` — ${endDateFormatted}` : ""} •{" "}
                {locationDisplay.primary}
              </p>
              {locationDisplay.secondary && (
                <p className="text-[11px] text-white/45">
                  {locationDisplay.secondary}
                </p>
              )}
            </div>
            {coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverUrl}
                alt={event.title}
                className="hidden md:block w-28 h-28 rounded-xl object-cover border border-white/20"
              />
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            {timeline.map((step, idx) => (
              <div key={step.key} className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 ${
                    step.done
                      ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-100"
                      : step.active
                        ? "border-white/30 bg-white/10 text-white"
                        : "border-white/15 bg-black/30 text-white/60"
                  }`}
                >
                  {step.label}
                </span>
                {idx < timeline.length - 1 && <span className="text-white/25">→</span>}
              </div>
            ))}
          </div>

          {isPadelEvent && padelStatusItems.length > 0 && (
            <div className="mt-3 rounded-2xl border border-white/12 bg-black/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Estado operativo</p>
                <span
                  className={`rounded-full border px-2 py-1 text-[11px] ${
                    padelStatusMissing.length === 0
                      ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-50"
                      : "border-amber-400/50 bg-amber-500/10 text-amber-50"
                  }`}
                >
                  {padelStatusLabel}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                {padelStatusItems.map((item) => {
                  const statusClass =
                    item.status === "ok"
                      ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-50"
                      : item.status === "optional"
                        ? "border-white/15 bg-white/5 text-white/60"
                        : "border-amber-400/50 bg-amber-500/10 text-amber-50";
                  return (
                    <span key={item.key} className={`rounded-full border px-2 py-1 ${statusClass}`}>
                      {item.label}: {item.detail}
                    </span>
                  );
                })}
              </div>
              {padelStatusMissing.length > 0 && (
                <p className="mt-2 text-[11px] text-white/60">
                  Faltam {padelStatusMissing.length} passo(s) para ficar pronto.
                </p>
              )}
              {(hubClubHref || hubCourtsHref || hubCategoriesHref || hubCalendarHref) && (
                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                  {hubClubHref && (
                    <a href={hubClubHref} className={CTA_SECONDARY}>
                      Clube
                    </a>
                  )}
                  {hubCourtsHref && (
                    <a href={hubCourtsHref} className={CTA_SECONDARY}>
                      Campos
                    </a>
                  )}
                  {hubCategoriesHref && (
                    <a href={hubCategoriesHref} className={CTA_SECONDARY}>
                      Categorias
                    </a>
                  )}
                  {hubCalendarHref && (
                    <a href={hubCalendarHref} className={CTA_SECONDARY}>
                      Calendário
                    </a>
                  )}
                  <a href={operationsHref} className={CTA_SECONDARY}>
                    Operação
                  </a>
                </div>
              )}

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div
                  className={`rounded-xl border px-3 py-2 ${
                    readyToGenerateMatches
                      ? "border-emerald-400/50 bg-emerald-500/10"
                      : "border-amber-400/50 bg-amber-500/10"
                  }`}
                >
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Pronto para gerar jogos</p>
                  <p className="mt-2 text-sm text-white/80">
                    {readyToGenerateMatches
                      ? `OK · ${categoriesWithPairings.length} categoria(s) com duplas`
                      : generateIssues.join(" · ")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    {generateMatchesHref && (
                      <a href={generateMatchesHref} className={CTA_SECONDARY}>
                        Gerar jogos
                      </a>
                    )}
                    {hubCategoriesHref && (
                      <a href={hubCategoriesHref} className={CTA_SECONDARY}>
                        Rever categorias
                      </a>
                    )}
                  </div>
                </div>

                <div
                  className={`rounded-xl border px-3 py-2 ${
                    readyForSchedule ? "border-emerald-400/50 bg-emerald-500/10" : "border-amber-400/50 bg-amber-500/10"
                  }`}
                >
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Pronto para calendário</p>
                  <p className="mt-2 text-sm text-white/80">
                    {readyForSchedule
                      ? `OK · ${padelScheduledMatchesCount}/${padelMatchesCount} jogo(s) com horário`
                      : scheduleIssues.join(" · ")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    {hubCalendarAutoHref && (
                      <a href={hubCalendarAutoHref} className={CTA_SECONDARY}>
                        Auto-agendar
                      </a>
                    )}
                    {hubCalendarHref && (
                      <a href={hubCalendarHref} className={CTA_SECONDARY}>
                        Calendário
                      </a>
                    )}
                  </div>
                </div>

                <div
                  className={`rounded-xl border px-3 py-2 ${
                    readyForOperations ? "border-emerald-400/50 bg-emerald-500/10" : "border-amber-400/50 bg-amber-500/10"
                  }`}
                >
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Pronto para operação</p>
                  <p className="mt-2 text-sm text-white/80">
                    {readyForOperations
                      ? `OK · ${padelScheduledMatchesCount} jogo(s) em agenda`
                      : operationsIssues.join(" · ")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <a href={operationsHref} className={CTA_SECONDARY}>
                      Operação
                    </a>
                    {hubCalendarHref && (
                      <a href={hubCalendarHref} className={CTA_SECONDARY}>
                        Agenda
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {cheapestWave && (
            <p className="mt-1 text-[11px] text-white/70">
              Preço a partir de{" "}
              <span className="font-semibold">
                {formatMoney(cheapestWave.price ?? 0)}
              </span>{" "}
              ({totalWaves} lote{totalWaves !== 1 ? "s" : ""})
            </p>
          )}

          <p className="mt-1 text-[11px] text-white/60 line-clamp-3">
            {event.description}
          </p>

          <p className="mt-2 text-[10px] text-white/40 font-mono">
            ID: {event.id} • Slug: {event.slug}
          </p>

          {event.padelTournamentConfig && (
            <div className="mt-3 grid gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Torneio de Padel</p>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[12px]">
                  {tournamentState}
                </span>
              </div>
              <p className="font-semibold">
                {event.padelTournamentConfig.club?.name ?? "Clube não definido"}
              </p>
              <p className="text-white/70">
                {resolveCanonicalCity(event.padelTournamentConfig.club?.addressRef?.canonical) ?? "Cidade —"} ·{" "}
                {event.padelTournamentConfig.club?.addressRef?.formattedAddress ?? "Morada em falta"}
              </p>
              <p className="text-white/75">
                Campos usados: {event.padelTournamentConfig.numberOfCourts}
              </p>
              {partnerClubs.length > 0 && (
                <div className="text-[12px] text-white/70">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/55 mt-2">Clubes parceiros</p>
                  <div className="flex flex-wrap gap-2">
                    {partnerClubs.map((c) => {
                      const city = resolveCanonicalCity(c.addressRef?.canonical);
                      return (
                        <span key={c.id} className="rounded-full border border-white/15 bg-white/10 px-2 py-1">
                          {c.name} {city ? `· ${city}` : ""}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              {advancedSettings && (
                <div className="text-[12px] text-white/70">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/55 mt-2">Opções avançadas</p>
                  <p className="text-white/75">
                    Limite total: {advancedSettings.maxEntriesTotal ?? "—"} · Waitlist:{" "}
                    {advancedSettings.waitlistEnabled ? "ativa" : "desativada"} · 2ª categoria:{" "}
                    {advancedSettings.allowSecondCategory ? "sim" : "não"} · Cancelar jogos:{" "}
                    {advancedSettings.allowCancelGames ? "sim" : "não"} · Jogo padrão:{" "}
                    {advancedSettings.gameDurationMinutes ?? "—"} min
                  </p>
                  {advancedSettings.courtsFromClubs?.length ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-white/55">Campos incluídos</p>
                      <div className="flex flex-wrap gap-2">
                        {advancedSettings.courtsFromClubs.map((c, idx) => (
                          <span key={`${c.id}-${idx}`} className="rounded-full border border-white/15 bg-white/10 px-2 py-1">
                            {c.name || "Campo"} · {c.clubName || `Clube ${c.clubId ?? ""}`} {c.indoor ? "(Coberto)" : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {advancedSettings.staffFromClubs?.length ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-white/55">Equipa herdada</p>
                      <div className="flex flex-wrap gap-2">
                        {advancedSettings.staffFromClubs.map((s, idx) => (
                          <span key={`${s.email}-${idx}`} className="rounded-full border border-white/15 bg-white/10 px-2 py-1">
                            {s.email || s.role || "Equipa"} · {s.role || "Função"} · {s.clubName || "Clube"}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>

      <section id="padel-finance" className="scroll-mt-24 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#22D3EE]/40 bg-[#02040b]/95 backdrop-blur-xl px-4 py-3.5">
          <p className="text-[11px] text-[#22D3EE]/80">
            {ticketsSoldLabel}
          </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {totalTicketsSold}
            </p>
            {overallOccupancy !== null && (
              <p className="mt-1 text-[11px] text-white/65">
                {overallOccupancy}% de ocupação (stock total {totalStock})
              </p>
            )}

            {overallOccupancy !== null && (
              <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#22D3EE] to-[#FF00C8]"
                  style={{ width: `${overallOccupancy}%` }}
                />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/14 bg-white/5 backdrop-blur-xl px-4 py-3.5">
            <p className="text-[11px] text-white/65">Receita bruta</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {totalRevenue.replace(".", ",")} €
            </p>
            <p className="mt-1 text-[11px] text-white/55">
              {revenueHint}
            </p>
          </div>
      </section>

      {isPadelEvent && (
        <section id="padel-governance" className="scroll-mt-24 grid grid-cols-1 gap-4 md:grid-cols-2">
          <PadelTournamentLifecyclePanel eventId={event.id} />
          <PadelTournamentRolesPanel eventId={event.id} />
        </section>
      )}

      <section id="padel-categories" className="scroll-mt-24 rounded-2xl border border-white/12 bg-black/40 backdrop-blur-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-white/90">
              {isPadelEvent ? "Categorias & inscrições" : `Waves & ${ticketLabelPlural}`}
            </h2>
            <p className="text-[11px] text-white/65">
              {isPadelEvent
                ? "Visão por categoria: vagas, inscrições e ocupação."
                : "Visão por wave: estado, stock, vendas e receita individual."}
            </p>
          </div>
        </div>

        {event.status === "CANCELLED" ? (
          <div className="mt-2 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-4 text-[11px] text-red-100">
            Evento cancelado. A gestão de bilhetes/inscrições está bloqueada neste estado terminal.
          </div>
        ) : isPadelEvent ? (
          padelCategorySummary.length === 0 ? (
            <div className="mt-2 rounded-xl border border-dashed border-white/20 bg-white/5 px-4 py-4 text-[11px] text-white/70">
              Este torneio ainda não tem categorias ativas.
            </div>
          ) : (
            <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
              {padelCategorySummary.map((category) => {
                const remaining =
                  category.capacity !== null ? Math.max(category.capacity - category.count, 0) : null;
                return (
                  <article
                    key={category.key}
                    className="rounded-xl border border-white/14 bg-gradient-to-br from-white/5 via-black/80 to-black/95 px-4 py-4 flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-white/95">{category.label}</h3>
                        <p className="mt-1 text-[11px] text-white/60">
                          {category.capacity !== null
                            ? `Capacidade: ${category.capacity}`
                            : "Capacidade aberta"}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/20 text-[10px] text-white/80">
                          Inscrições
                        </span>
                        <span className="text-sm font-semibold text-white">{category.count}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/70">
                      <span>
                        Vagas:{" "}
                        <span className="text-white/85">
                          {category.count} / {category.capacity ?? "∞"}
                        </span>
                      </span>
                      {remaining !== null && (
                        <span className="text-[10px] text-white/55">({remaining} restantes)</span>
                      )}
                    </div>

                    {category.occupancy !== null && (
                      <div className="h-1.5 w-40 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#22D3EE] to-[#FF00C8]"
                          style={{ width: `${category.occupancy}%` }}
                        />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )
        ) : (
          <>
            {event.ticketTypes.length === 0 && (
              <div className="mt-2 rounded-xl border border-dashed border-white/20 bg-white/5 px-4 py-4 text-[11px] text-white/70">
                Este {primaryLabel} ainda não tem waves configuradas. Usa o criador de{" "}
                {primaryLabel}s para adicionar {ticketLabelPlural}.
              </div>
            )}

            {event.ticketTypes.length > 0 && (
              <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
                {event.ticketTypes.map((ticket) => {
                  const remaining =
                    ticket.totalQuantity !== null &&
                    ticket.totalQuantity !== undefined
                      ? ticket.totalQuantity - ticket.soldQuantity
                      : null;

              const occupancy =
                ticket.totalQuantity && ticket.totalQuantity > 0
                  ? Math.min(
                      100,
                      Math.round(
                        (ticket.soldQuantity / ticket.totalQuantity) * 100,
                      ),
                    )
                  : null;

              // Determinar estado da wave
              let statusLabel = "A vender";
              let statusBadgeClass =
                "bg-emerald-500/10 border-emerald-400/70 text-emerald-100";
              const nowTime = now.getTime();
              const startsAtTime = ticket.startsAt
                ? new Date(ticket.startsAt).getTime()
                : null;
              const endsAtTime = ticket.endsAt
                ? new Date(ticket.endsAt).getTime()
                : null;

              if (
                ticket.totalQuantity !== null &&
                ticket.totalQuantity !== undefined &&
                ticket.soldQuantity >= ticket.totalQuantity
              ) {
                statusLabel = "Esgotado";
                statusBadgeClass =
                  "bg-red-500/10 border-red-400/70 text-red-100";
              } else if (startsAtTime && nowTime < startsAtTime) {
                statusLabel = "Em breve";
                statusBadgeClass =
                  "bg-amber-500/10 border-amber-400/70 text-amber-100";
              } else if (endsAtTime && nowTime > endsAtTime) {
                statusLabel = "Encerrado";
                statusBadgeClass =
                  "bg-white/8 border-white/30 text-white/75";
              }

              const startsAtLabel = formatDateTime(ticket.startsAt);
              const endsAtLabel = formatDateTime(ticket.endsAt);

              const revenueCents =
                ticket.soldQuantity * (ticket.price ?? 0);
              const revenue = (revenueCents / 100).toFixed(2);

              return (
                <article
                  key={ticket.id}
                  className="rounded-xl border border-white/14 bg-gradient-to-br from-white/5 via-black/80 to-black/95 px-4 py-4 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-white/95">
                        {ticket.name}
                      </h3>
                      {ticket.description && (
                        <p className="mt-0.5 text-[11px] text-white/60 line-clamp-2">
                          {ticket.description}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-white/45 font-mono">
                        ID: {ticket.id}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`px-2 py-1 rounded-full border text-[10px] ${statusBadgeClass}`}
                      >
                        {statusLabel}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/20 text-[10px] text-white/80">
                        {formatMoney(ticket.price ?? 0)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[10px] text-white/65">
                    {startsAtLabel && (
                      <span>
                        ⏱ Abre:{" "}
                        <span className="text-white/85">
                          {startsAtLabel}
                        </span>
                      </span>
                    )}
                    {endsAtLabel && (
                      <span>
                        Fecha:{" "}
                        <span className="text-white/85">{endsAtLabel}</span>
                      </span>
                    )}
                    {!startsAtLabel && !endsAtLabel && (
                      <span>Sem janela definida (sempre ativo).</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-white/80">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white/60">
                          Vendidos / stock:
                        </span>
                        <span className="font-semibold">
                          {ticket.soldQuantity}
                          {ticket.totalQuantity
                            ? ` / ${ticket.totalQuantity}`
                            : " / ∞"}
                        </span>
                        {remaining !== null && remaining >= 0 && (
                          <span className="text-[10px] text-white/55">
                            ({remaining} restantes)
                          </span>
                        )}
                      </div>

                      {occupancy !== null && (
                        <div className="h-1.5 w-40 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#22D3EE] to-[#FF00C8]"
                            style={{ width: `${occupancy}%` }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1 text-right">
                      <span className="text-[10px] text-white/60">
                        Receita estimada
                      </span>
                      <span className="text-sm font-semibold">
                        {revenue.replace(".", ",")} €
                      </span>
                    </div>
                  </div>

                  <p className="mt-1 text-[10px] text-white/40">
                    Funcionalidades avançadas como lista de compras por
                    utilizador, links de promotores e tracking detalhado por
                    wave podem ser geridas na área de gestão avançada do {primaryLabel}.
                  </p>
                </article>
              );
                })}
              </div>
            )}
          </>
        )}
      </section>

      </div>

      <EventAttendeesPanel eventId={event.id} isPadelEvent={isPadelEvent} />

      {event.templateType === "PADEL" && (
        <section id="padel-torneio" className="scroll-mt-24">
          <PadelTournamentTabs
            eventId={event.id}
            eventSlug={event.slug}
            categoriesMeta={categoriesMeta}
            organizationId={event.organizationId}
            coverImageUrl={event.coverImageUrl}
          />
        </section>
      )}
    </div>
  );
}
