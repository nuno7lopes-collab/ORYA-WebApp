// app/api/organizador/estatisticas/audience/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { TicketStatus } from "@prisma/client";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { resolveOrganizerIdFromRequest } from "@/lib/organizerId";
import { isOrgAdminOrAbove } from "@/lib/organizerPermissions";

function getDateRangeFromSearchParams(searchParams: URLSearchParams) {
  const range = searchParams.get("range") || "30d";
  const now = new Date();

  if (range === "all") {
    return { from: null as Date | null, to: null as Date | null };
  }

  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const from = new Date(now);
  from.setDate(from.getDate() - days);

  return { from, to: now };
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[audience] Error getting user:", authError);
    }

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const searchParams = url.searchParams;

    const eventIdParam = searchParams.get("eventId");
    let eventId: number | null = null;

    if (eventIdParam) {
      const parsed = Number(eventIdParam);
      if (!Number.isNaN(parsed)) {
        eventId = parsed;
      }
    }

    const { from, to } = getDateRangeFromSearchParams(searchParams);

    // Garantir que o utilizador é organizador com permissões de gestão
    const organizerId = resolveOrganizerIdFromRequest(req);
    const { organizer, membership } = await getActiveOrganizerForUser(user.id, {
      organizerId: organizerId ?? undefined,
      roles: ["OWNER", "CO_OWNER", "ADMIN"],
    });

    if (!organizer || !membership || !isOrgAdminOrAbove(membership.role)) {
      return NextResponse.json({ ok: false, error: "NOT_ORGANIZER" }, { status: 403 });
    }

    // 1) Buscar tickets relevantes (status ACTIVE/USED) deste organizer
    const tickets = await prisma.ticket.findMany({
      where: {
        status: {
          in: [TicketStatus.ACTIVE, TicketStatus.USED],
        },
        purchasedAt: {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        },
        event: {
          organizerId: organizer.id,
          ...(eventId ? { id: eventId } : {}),
        },
      },
      select: {
        userId: true,
      },
    });

    if (!tickets.length) {
      return NextResponse.json(
        {
          ok: true,
          totalBuyers: 0,
          cities: [],
          interests: [],
        },
        { status: 200 }
      );
    }

    // 2) Extrair userIds únicos
    const userIdSet = new Set<string>();
    for (const t of tickets) {
      if (t.userId) {
        userIdSet.add(t.userId);
      }
    }

    const userIds = Array.from(userIdSet);

    if (!userIds.length) {
      return NextResponse.json(
        {
          ok: true,
          totalBuyers: 0,
          cities: [],
          interests: [],
        },
        { status: 200 }
      );
    }

    // 3) Buscar perfis desses utilizadores
    const profiles = await prisma.profile.findMany({
      where: {
        id: {
          in: userIds,
        },
      },
      select: {
        id: true,
        city: true,
        favouriteCategories: true,
      },
    });

    // 4) Agregar cidades e interesses
    const cityCounts = new Map<string, number>();
    const interestCounts = new Map<string, number>();

    for (const p of profiles) {
      const cityKey = (p.city || "Desconhecida").trim() || "Desconhecida";
      cityCounts.set(cityKey, (cityCounts.get(cityKey) ?? 0) + 1);

      const favs = p.favouriteCategories || [];
      for (const raw of favs) {
        const cat = (raw || "").trim();
        if (!cat) continue;
        interestCounts.set(cat, (interestCounts.get(cat) ?? 0) + 1);
      }
    }

    const cities = Array.from(cityCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([city, count]) => ({ city, count }));

    const interests = Array.from(interestCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    return NextResponse.json(
      {
        ok: true,
        totalBuyers: userIds.length,
        cities,
        interests,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[audience] Internal error:", error);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
