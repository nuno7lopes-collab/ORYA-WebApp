// app/organizacao/eventos/[id]/page.tsx
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { OrganizationModule } from "@prisma/client";
import { ACTIVE_PAIRING_REGISTRATION_WHERE } from "@/domain/padelRegistration";
import { notFound, redirect } from "next/navigation";
import PadelTournamentTabs from "./PadelTournamentTabs";
import EventAttendeesPanel from "./EventAttendeesPanel";
import PadelTournamentLifecyclePanel from "./PadelTournamentLifecyclePanel";
import PadelTournamentRolesPanel from "./PadelTournamentRolesPanel";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/app/organizacao/dashboardUi";
import { getEventCoverSuggestionIds, getEventCoverUrl } from "@/lib/eventCover";
import { cn } from "@/lib/utils";
import { getEventLocationDisplay } from "@/lib/location/eventLocation";
import { TOURNAMENT_LIFECYCLE_LABELS, TOURNAMENT_LIFECYCLE_ORDER } from "@/domain/padel/tournamentLifecycle";

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
  locationName: string | null;
  locationCity: string | null;
  address: string | null;
  locationSource: "OSM" | "MANUAL" | null;
  locationFormattedAddress: string | null;
  locationComponents: Record<string, unknown> | null;
  locationOverrides: Record<string, unknown> | null;
  status: string;
  liveHubVisibility: "PUBLIC" | "PRIVATE" | "DISABLED";
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
    isEnabled?: boolean;
    category?: { label: string | null } | null;
  }>;
  padelTournamentConfig: {
    numberOfCourts: number;
    club?: { name: string; city: string | null; address: string | null } | null;
    partnerClubIds?: number[];
    advancedSettings?: Record<string, unknown> | null;
    lifecycleStatus?: string | null;
  } | null;
};

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
            include: { club: true },
          },
        },
      })) as (EventWithTickets & { padelTournamentConfig: { numberOfCourts: number; club?: { name: string; city: string | null; address: string | null } | null; partnerClubIds?: number[]; advancedSettings?: Record<string, unknown> | null } | null }) | null;

  if (!event) {
    notFound();
  }
  if (!event.organizationId) {
    notFound();
  }

  const isPadelEvent = event.templateType === "PADEL";
  const eventRouteBase = isPadelEvent ? "/organizacao/torneios" : "/organizacao/eventos";
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
    redirect("/organizacao");
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
    redirect(fallbackHref);
  }

  const locationDisplay = getEventLocationDisplay(
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
  const padelMatchesCount = isPadelEvent
    ? await prisma.eventMatchSlot.count({
        where: {
          eventId: event.id,
          status: { not: "CANCELLED" },
        },
      })
    : 0;

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
            ? "Oculto"
            : "Público";

  const partnerClubs =
    event.padelTournamentConfig?.partnerClubIds?.length
      ? await prisma.padelClub.findMany({
          where: { id: { in: event.padelTournamentConfig.partnerClubIds as number[] } },
          select: { id: true, name: true, city: true },
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
  const liveHref = `${eventRouteBase}/${event.id}/live`;
  const hubBaseHref = isPadelEvent ? `${eventRouteBase}?section=padel-hub` : null;
  const hubCalendarHref = hubBaseHref ? `${hubBaseHref}&padel=calendar&eventId=${event.id}` : null;
  const hubClubHref = hubBaseHref ? `${hubBaseHref}&padel=clubs` : null;
  const hubCourtsHref = hubBaseHref ? `${hubBaseHref}&padel=courts` : null;
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
  const liveHubReady = event.liveHubVisibility !== "DISABLED";
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
          label: "Courts",
          status: courtsCount > 0 ? "ok" : "missing",
          detail: courtsCount > 0 ? `${courtsCount} court(s)` : "Sem courts",
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
          key: "live",
          label: "LiveHub",
          status: liveHubReady ? "ok" : "missing",
          detail: liveHubReady ? "Visível" : "Desativado",
        },
        {
          key: "staff",
          label: "Staff",
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
  const categoriesWithPairings = activePadelCategoryIds.filter(
    (id) => (padelPairingsByCategoryMap.get(id) ?? 0) >= 2,
  );
  const readyToGenerateMatches = activePadelCategoryIds.length > 0 && categoriesWithPairings.length > 0;
  const generateIssues: string[] = [];
  if (activePadelCategoryIds.length === 0) generateIssues.push("Sem categorias ativas");
  if (categoriesWithPairings.length === 0) generateIssues.push("Duplas insuficientes (mín. 2)");

  const readyForLive = padelMatchesCount > 0 && liveHubReady;
  const liveIssues: string[] = [];
  if (padelMatchesCount === 0) liveIssues.push("Sem jogos gerados");
  if (!liveHubReady) liveIssues.push("LiveHub desativado");

  const generateMatchesHref = isPadelEvent ? "#padel-torneio" : null;

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
        { key: "OCULTO", label: "Oculto", active: ["DRAFT"].includes(event.status), done: event.status !== "DRAFT" },
        { key: "INSCRICOES", label: "Inscrições", active: event.status === "PUBLISHED", done: ["PUBLISHED", "FINISHED", "CANCELLED"].includes(event.status) },
        { key: "PUBLICO", label: "Público", active: event.status === "PUBLISHED", done: ["PUBLISHED", "FINISHED", "CANCELLED"].includes(event.status) },
        { key: "TERMINADO", label: "Terminado", active: event.status === "FINISHED", done: event.status === "FINISHED" },
      ];

  return (
    <div className={cn("w-full space-y-7 py-8 text-white")}>
      <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/70">Gestão de {primaryLabel}</p>
            <h1 className="text-2xl font-semibold tracking-tight">Detalhes &amp; waves</h1>
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
            <a href={liveHref} className={CTA_SECONDARY}>
              Preparar Live
            </a>
            {event.tournament?.id && (
              <a href={`${liveHref}?tab=preview&edit=1`} className={CTA_SECONDARY}>
                Live Ops
              </a>
            )}
            <a
              href={`/eventos/${event.slug}`}
              className={CTA_PRIMARY}
            >
              Ver página pública
            </a>
          </div>
        </div>
      </div>

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
                      Courts
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
                  <a href={liveHref} className={CTA_SECONDARY}>
                    LiveHub
                  </a>
                </div>
              )}

              <div className="mt-4 grid gap-3 md:grid-cols-2">
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
                    readyForLive ? "border-emerald-400/50 bg-emerald-500/10" : "border-amber-400/50 bg-amber-500/10"
                  }`}
                >
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Pronto para Live</p>
                  <p className="mt-2 text-sm text-white/80">
                    {readyForLive
                      ? `OK · ${padelMatchesCount} jogo(s) prontos`
                      : liveIssues.join(" · ")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <a href={liveHref} className={CTA_SECONDARY}>
                      Preparar Live
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
              ({totalWaves} wave{totalWaves !== 1 ? "s" : ""})
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
                {event.padelTournamentConfig.club?.city ?? "Cidade —"} ·{" "}
                {event.padelTournamentConfig.club?.address ?? "Morada em falta"}
              </p>
              <p className="text-white/75">
                Courts usados: {event.padelTournamentConfig.numberOfCourts}
              </p>
              {partnerClubs.length > 0 && (
                <div className="text-[12px] text-white/70">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/55 mt-2">Clubes parceiros</p>
                  <div className="flex flex-wrap gap-2">
                    {partnerClubs.map((c) => (
                      <span key={c.id} className="rounded-full border border-white/15 bg-white/10 px-2 py-1">
                        {c.name} {c.city ? `· ${c.city}` : ""}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {advancedSettings && (
                <div className="text-[12px] text-white/70">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/55 mt-2">Opções avançadas</p>
                  <p className="text-white/75">
                    Limite total: {advancedSettings.maxEntriesTotal ?? "—"} · Waitlist:{" "}
                    {advancedSettings.waitlistEnabled ? "on" : "off"} · 2ª categoria:{" "}
                    {advancedSettings.allowSecondCategory ? "sim" : "não"} · Cancelar jogos:{" "}
                    {advancedSettings.allowCancelGames ? "sim" : "não"} · Jogo padrão:{" "}
                    {advancedSettings.gameDurationMinutes ?? "—"} min
                  </p>
                  {advancedSettings.courtsFromClubs?.length ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-white/55">Courts incluídos</p>
                      <div className="flex flex-wrap gap-2">
                        {advancedSettings.courtsFromClubs.map((c, idx) => (
                          <span key={`${c.id}-${idx}`} className="rounded-full border border-white/15 bg-white/10 px-2 py-1">
                            {c.name || "Court"} · {c.clubName || `Clube ${c.clubId ?? ""}`} {c.indoor ? "(Indoor)" : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {advancedSettings.staffFromClubs?.length ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-white/55">Staff herdado</p>
                      <div className="flex flex-wrap gap-2">
                        {advancedSettings.staffFromClubs.map((s, idx) => (
                          <span key={`${s.email}-${idx}`} className="rounded-full border border-white/15 bg-white/10 px-2 py-1">
                            {s.email || s.role || "Staff"} · {s.role || "Role"} · {s.clubName || "Clube"}
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#6BFFFF]/40 bg-[#02040b]/95 backdrop-blur-xl px-4 py-3.5">
            <p className="text-[11px] text-[#6BFFFF]/80">
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
                  className="h-full rounded-full bg-gradient-to-r from-[#6BFFFF] to-[#FF00C8]"
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
        </div>
      </div>

      {isPadelEvent && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <PadelTournamentLifecyclePanel eventId={event.id} />
          <PadelTournamentRolesPanel eventId={event.id} />
        </div>
      )}

      <section className="rounded-2xl border border-white/12 bg-black/40 backdrop-blur-xl p-5 space-y-4">
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

        {isPadelEvent ? (
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
                          className="h-full rounded-full bg-gradient-to-r from-[#6BFFFF] to-[#FF00C8]"
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
                            className="h-full rounded-full bg-gradient-to-r from-[#6BFFFF] to-[#FF00C8]"
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

      <EventAttendeesPanel eventId={event.id} isPadelEvent={isPadelEvent} />

      {event.templateType === "PADEL" && (
        <section id="padel-torneio" className="scroll-mt-24">
          <PadelTournamentTabs eventId={event.id} eventSlug={event.slug} categoriesMeta={categoriesMeta} />
        </section>
      )}
    </div>
  );
}
