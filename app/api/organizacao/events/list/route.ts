// app/api/organizacao/events/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { deriveIsFreeEvent } from "@/domain/events/derivedIsFree";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { EventTemplateType, OrganizationModule, Prisma, TicketStatus } from "@prisma/client";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { ACTIVE_PAIRING_REGISTRATION_WHERE } from "@/domain/padelRegistration";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);
    const templateTypeParam = url.searchParams.get("templateType");
    const excludeTemplateTypeParam = url.searchParams.get("excludeTemplateType");
    const parseTemplateType = (raw: string | null) => {
      if (!raw) return null;
      const normalized = raw.trim().toUpperCase();
      return (Object.values(EventTemplateType) as string[]).includes(normalized)
        ? (normalized as EventTemplateType)
        : null;
    };
    const templateType = parseTemplateType(templateTypeParam);
    const excludeTemplateType = parseTemplateType(excludeTemplateTypeParam);

    const supabase = await createSupabaseServer();

    // 1) Garante que o utilizador está autenticado
    const user = await ensureAuthenticated(supabase);

    // 2) Buscar o profile correspondente a este user
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return jsonWrap(
        {
          ok: false,
          error:
            "Perfil não encontrado. Completa o onboarding de utilizador antes de gerires eventos como organização.",
        },
        { status: 403 }
      );
    }
    const hasUserOnboarding =
      profile.onboardingDone ||
      (Boolean(profile.fullName?.trim()) && Boolean(profile.username?.trim()));
    if (!hasUserOnboarding) {
      return jsonWrap(
        {
          ok: false,
          error:
            "Completa o onboarding de utilizador (nome e username) antes de gerires eventos de organização.",
        },
        { status: 403 }
      );
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
    });

    if (!organization || !membership) {
      return jsonWrap(
        {
          ok: false,
          error:
            "Ainda não és organização. Usa o botão 'Quero ser organização' para começar.",
        },
        { status: 403 }
      );
    }
    const access = await ensureMemberModuleAccess({
      organizationId: organization.id,
      userId: profile.id,
      role: membership.role,
      rolePack: membership.rolePack,
      moduleKey: OrganizationModule.EVENTOS,
      required: "VIEW",
    });
    if (!access.ok) {
      return jsonWrap(
        {
          ok: false,
          error:
            "Ainda não és organização. Usa o botão 'Quero ser organização' para começar.",
        },
        { status: 403 }
      );
    }

    const where: Prisma.EventWhereInput = {
      isDeleted: false,
      organizationId: organization.id,
      ...(templateType
        ? { templateType }
        : excludeTemplateType
          ? { NOT: { templateType: excludeTemplateType } }
          : {}),
    };
    const eventQuery = {
      where,
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        startsAt: true,
        endsAt: true,
        locationName: true,
        locationCity: true,
        status: true,
        templateType: true,
        coverImageUrl: true,
        padelTournamentConfig: {
          select: { padelClubId: true, partnerClubIds: true, advancedSettings: true },
        },
        tournament: {
          select: { id: true },
        },
        ticketTypes: {
          select: { price: true },
        },
      },
      take: limit,
    } satisfies Prisma.EventFindManyArgs;
    const events = await prisma.event.findMany(eventQuery);

    const eventIds = events.map((e) => e.id);
    const padelEventIds = events.filter((e) => e.templateType === EventTemplateType.PADEL).map((e) => e.id);
    const capacityAgg =
      eventIds.length > 0
        ? await prisma.ticketType.groupBy({
            by: ["eventId"],
            where: { eventId: { in: eventIds } },
            _sum: { totalQuantity: true },
          })
        : [];

    const capacityMap = new Map<number, number>();
    capacityAgg.forEach((row) => {
      const sum = row._sum.totalQuantity ?? 0;
      capacityMap.set(row.eventId, sum);
    });

    const ticketStats =
      eventIds.length > 0
        ? await prisma.ticket.groupBy({
            by: ["eventId"],
            where: {
              status: { in: [TicketStatus.ACTIVE, TicketStatus.USED] },
              eventId: { in: eventIds },
            },
            _count: { _all: true },
            _sum: { pricePaid: true, totalPaidCents: true, platformFeeCents: true },
          })
        : [];

    const statsMap = new Map<
      number,
      {
        tickets: number;
        revenueCents: number;
        totalPaidCents: number;
        platformFeeCents: number;
      }
    >();

    ticketStats.forEach((stat) => {
      statsMap.set(stat.eventId, {
        tickets: stat._count._all,
        revenueCents: stat._sum?.pricePaid ?? 0,
        totalPaidCents: stat._sum?.totalPaidCents ?? 0,
        platformFeeCents: stat._sum?.platformFeeCents ?? 0,
      });
    });

    const padelPairingStats =
      padelEventIds.length > 0
        ? await prisma.padelPairing.groupBy({
            by: ["eventId"],
            where: {
              eventId: { in: padelEventIds },
              pairingStatus: { not: "CANCELLED" },
              ...ACTIVE_PAIRING_REGISTRATION_WHERE,
            },
            _count: { _all: true },
          })
        : [];
    const padelPairingMap = new Map<number, number>();
    padelPairingStats.forEach((row) => {
      padelPairingMap.set(row.eventId, row._count._all);
    });

    const padelCategoryLinks =
      padelEventIds.length > 0
        ? await prisma.padelEventCategoryLink.findMany({
            where: { eventId: { in: padelEventIds }, isEnabled: true },
            select: { eventId: true, capacityTeams: true, capacityPlayers: true },
          })
        : [];
    const padelCapacityBuckets = new Map<number, Array<number | null>>();
    padelCategoryLinks.forEach((link) => {
      const capacity = link.capacityTeams ?? link.capacityPlayers ?? null;
      const current = padelCapacityBuckets.get(link.eventId) ?? [];
      current.push(capacity);
      padelCapacityBuckets.set(link.eventId, current);
    });

    const padelCapacityMap = new Map<number, number | null>();
    events.forEach((event) => {
      if (event.templateType !== EventTemplateType.PADEL) return;
      const advancedSettings = (event.padelTournamentConfig?.advancedSettings ?? {}) as {
        maxEntriesTotal?: number | null;
      };
      const maxEntriesTotal =
        typeof advancedSettings.maxEntriesTotal === "number" && Number.isFinite(advancedSettings.maxEntriesTotal)
          ? Math.floor(advancedSettings.maxEntriesTotal)
          : null;
      if (maxEntriesTotal && maxEntriesTotal > 0) {
        padelCapacityMap.set(event.id, maxEntriesTotal);
        return;
      }
      const capacities = padelCapacityBuckets.get(event.id) ?? [];
      if (capacities.length === 0) {
        padelCapacityMap.set(event.id, null);
        return;
      }
      if (capacities.some((cap) => cap === null)) {
        padelCapacityMap.set(event.id, null);
        return;
      }
      const total = capacities.reduce<number>((sum, cap) => sum + (cap ?? 0), 0);
      padelCapacityMap.set(event.id, total);
    });

    const padelClubIds = new Set<number>();
    events.forEach((ev) => {
      const cfg = ev.padelTournamentConfig;
      if (cfg?.padelClubId) padelClubIds.add(cfg.padelClubId);
      (cfg?.partnerClubIds || []).forEach((id) => padelClubIds.add(id));
    });
    const padelClubs =
      padelClubIds.size > 0
        ? await prisma.padelClub.findMany({
            where: { id: { in: Array.from(padelClubIds) } },
            select: { id: true, name: true },
          })
        : [];
    const padelClubMap = new Map<number, string>();
    padelClubs.forEach((c) => padelClubMap.set(c.id, c.name || `Clube ${c.id}`));

    const items = events.map((event) => {
      const ticketPrices = event.ticketTypes?.map((t) => t.price ?? 0) ?? [];
      const isGratis = deriveIsFreeEvent({ ticketPrices });
      const partnerClubIds = (event.padelTournamentConfig?.partnerClubIds ?? []) as number[];

      return {
        id: event.id,
        slug: event.slug,
        title: event.title,
        description: event.description,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        locationName: event.locationName,
        locationCity: event.locationCity,
        status: event.status,
        templateType: event.templateType,
        tournamentId: event.tournament?.id ?? null,
        isGratis,
        coverImageUrl: event.coverImageUrl ?? null,
        ticketsSold:
          event.templateType === EventTemplateType.PADEL
            ? padelPairingMap.get(event.id) ?? 0
            : statsMap.get(event.id)?.tickets ?? 0,
        revenueCents: statsMap.get(event.id)?.revenueCents ?? 0,
        totalPaidCents: statsMap.get(event.id)?.totalPaidCents ?? 0,
        platformFeeCents: statsMap.get(event.id)?.platformFeeCents ?? 0,
        capacity:
          event.templateType === EventTemplateType.PADEL
            ? padelCapacityMap.get(event.id) ?? null
            : capacityMap.get(event.id) ?? null,
        padelClubId: event.padelTournamentConfig?.padelClubId ?? null,
        padelPartnerClubIds: partnerClubIds,
        padelClubName: event.padelTournamentConfig?.padelClubId
          ? padelClubMap.get(event.padelTournamentConfig.padelClubId) ?? null
          : null,
        padelPartnerClubNames: partnerClubIds.map((id) => padelClubMap.get(id) ?? null),
        isInterclub: (event.padelTournamentConfig as { isInterclub?: boolean } | null)?.isInterclub ?? false,
        teamSize: (event.padelTournamentConfig as { teamSize?: number | null } | null)?.teamSize ?? null,
      };
    });

    return jsonWrap(
      {
        ok: true,
        items,
      },
      { status: 200 }
    );
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("GET /api/organizacao/events/list error:", err);
    return jsonWrap(
      {
        ok: false,
        error: "Erro interno ao carregar eventos do organização.",
      },
      { status: 500 }
    );
  }
}
export const GET = withApiEnvelope(_GET);
