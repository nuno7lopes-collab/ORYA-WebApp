// app/api/organizador/events/list/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated } from "@/lib/security";
import { TicketStatus } from "@prisma/client";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";

export async function GET() {
  try {
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
            "Perfil não encontrado. Completa o onboarding antes de gerires eventos como organizador.",
        },
        { status: 403 }
      );
    }

    // 3) Encontrar o organizer ligado a este perfil (membership > legacy)
    const { organizer } = await getActiveOrganizerForUser(profile.id);

    if (!organizer) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Ainda não és organizador. Usa o botão 'Quero ser organizador' para começar.",
        },
        { status: 403 }
      );
    }

    const events = await prisma.event.findMany({
      where: { organizerId: organizer.id },
      orderBy: {
        startsAt: "asc",
      },
      include: {
        categories: true,
      },
    });

    const capacityAgg = await prisma.ticketType.groupBy({
      by: ["eventId"],
      where: { eventId: { in: events.map((e) => e.id) } },
      _sum: { totalQuantity: true },
    });

    const capacityMap = new Map<number, number>();
    capacityAgg.forEach((row) => {
      const sum = row._sum.totalQuantity ?? 0;
      capacityMap.set(row.eventId, sum);
    });

    const ticketStats = await prisma.ticket.groupBy({
      by: ["eventId"],
      where: {
        status: { in: [TicketStatus.ACTIVE, TicketStatus.USED] },
        event: { organizerId: organizer.id },
      },
      _count: { _all: true },
      _sum: { pricePaid: true, totalPaidCents: true, platformFeeCents: true },
    });

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
      isFree: event.isFree,
      ticketsSold: statsMap.get(event.id)?.tickets ?? 0,
      revenueCents: statsMap.get(event.id)?.revenueCents ?? 0,
      totalPaidCents: statsMap.get(event.id)?.totalPaidCents ?? 0,
      platformFeeCents: statsMap.get(event.id)?.platformFeeCents ?? 0,
      capacity: capacityMap.get(event.id) ?? null,
      categories: event.categories.map((c) => c.category),
    }));

    return NextResponse.json(
      {
        ok: true,
        items,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/organizador/events/list error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Erro interno ao carregar eventos do organizador.",
      },
      { status: 500 }
    );
  }
}
