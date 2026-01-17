// app/api/organizacao/events/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { TicketStatus } from "@prisma/client";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { canManageEvents } from "@/lib/organizationPermissions";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);
    const templateTypeParam = url.searchParams.get("templateType");
    const templateType =
      typeof templateTypeParam === "string" && templateTypeParam.trim()
        ? templateTypeParam.trim().toUpperCase()
        : null;
    const excludeTemplateTypeParam = url.searchParams.get("excludeTemplateType");
    const excludeTemplateType =
      typeof excludeTemplateTypeParam === "string" && excludeTemplateTypeParam.trim()
        ? excludeTemplateTypeParam.trim().toUpperCase()
        : null;

    const supabase = await createSupabaseServer();

    // 1) Garante que o utilizador está autenticado
    const user = await ensureAuthenticated(supabase);

    // 2) Buscar o profile correspondente a este user
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return NextResponse.json(
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
      return NextResponse.json(
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

    if (!organization || !membership || !canManageEvents(membership.role)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Ainda não és organização. Usa o botão 'Quero ser organização' para começar.",
        },
        { status: 403 }
      );
    }

    const events = await prisma.event.findMany({
      where: {
        isDeleted: false,
        organizationId: organization.id,
        ...(templateType
          ? { templateType }
          : excludeTemplateType
            ? { NOT: { templateType: excludeTemplateType } }
            : {}),
      },
      orderBy: {
        startsAt: "asc",
      },
      include: {
        padelTournamentConfig: {
          select: { padelClubId: true, partnerClubIds: true },
        },
        tournament: {
          select: { id: true },
        },
      },
      take: limit,
    });

    const eventIds = events.map((e) => e.id);
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
        revenueCents: stat._sum.pricePaid ?? 0,
        totalPaidCents: stat._sum.totalPaidCents ?? 0,
        platformFeeCents: stat._sum.platformFeeCents ?? 0,
      });
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

    const items = events.map((event) => ({
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
      isFree: event.isFree,
      coverImageUrl: event.coverImageUrl ?? null,
      ticketsSold: statsMap.get(event.id)?.tickets ?? 0,
      revenueCents: statsMap.get(event.id)?.revenueCents ?? 0,
      totalPaidCents: statsMap.get(event.id)?.totalPaidCents ?? 0,
      platformFeeCents: statsMap.get(event.id)?.platformFeeCents ?? 0,
      capacity: capacityMap.get(event.id) ?? null,
      padelClubId: event.padelTournamentConfig?.padelClubId ?? null,
      padelPartnerClubIds: event.padelTournamentConfig?.partnerClubIds ?? [],
      padelClubName: event.padelTournamentConfig?.padelClubId ? padelClubMap.get(event.padelTournamentConfig.padelClubId) ?? null : null,
      padelPartnerClubNames: (event.padelTournamentConfig?.partnerClubIds || []).map((id) => padelClubMap.get(id) ?? null),
    }));

    return NextResponse.json(
      {
        ok: true,
        items,
      },
      { status: 200 }
    );
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("GET /api/organizacao/events/list error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Erro interno ao carregar eventos do organização.",
      },
      { status: 500 }
    );
  }
}
