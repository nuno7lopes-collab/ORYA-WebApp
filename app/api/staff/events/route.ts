

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { Prisma } from "@prisma/client";

export async function GET() {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    // Buscar assignments ativos para este utilizador
    const assignments = await prisma.staffAssignment.findMany({
      where: {
        userId: user.id,
        revokedAt: null,
        status: "ACCEPTED",
      },
      include: {
        organizer: true,
        event: true,
      },
    });

    if (!assignments.length) {
      return NextResponse.json(
        {
          ok: true,
          events: [],
        },
        { status: 200 }
      );
    }

    // Separar os tipos de permissões
    const organizerIds = assignments
      .filter((a) => a.scope === "GLOBAL")
      .map((a) => a.organizerId)
      .filter((id): id is number => id !== null && id !== undefined);

    const eventIds = assignments
      .filter((a) => a.scope === "EVENT")
      .map((a) => a.eventId)
      .filter((id): id is number => id !== null && id !== undefined);

    if (!organizerIds.length && !eventIds.length) {
      return NextResponse.json(
        {
          ok: true,
          events: [],
        },
        { status: 200 }
      );
    }

    const orFilters: Prisma.EventWhereInput[] = [];

    if (organizerIds.length) {
      orFilters.push({ organizerId: { in: organizerIds } });
    }

    if (eventIds.length) {
      orFilters.push({ id: { in: eventIds } });
    }

    const events = await prisma.event.findMany({
      where: {
        OR: orFilters.length ? orFilters : undefined,
      },
      include: {
        organizer: true,
      },
      orderBy: {
        startsAt: "asc",
      },
    });

    const payload = events.map((event) => ({
      id: event.id,
      slug: event.slug,
      title: event.title,
      description: event.description,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      locationName: event.locationName,
      locationCity: event.locationCity,
      organizerName: event.organizer?.publicName ?? null,
    }));

    return NextResponse.json(
      {
        ok: true,
        events: payload,
      },
      { status: 200 }
    );
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("GET /api/staff/events error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Erro interno ao carregar eventos de staff.",
      },
      { status: 500 }
    );
  }
}
