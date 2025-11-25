// app/api/admin/tickets/list/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import type { Prisma, TicketStatus } from "@prisma/client";

// Pequeno helper para garantir que só admins usam estas rotas
async function ensureAdmin(_req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { ok: false as const, status: 401 as const, reason: "UNAUTHENTICATED" };
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { roles: true },
  });

  const roles = profile?.roles ?? [];
  const isAdmin = Array.isArray(roles) && roles.includes("admin");

  if (!isAdmin) {
    return { ok: false as const, status: 403 as const, reason: "FORBIDDEN" };
  }

  return { ok: true as const, userId: user.id };
}

export async function GET(req: NextRequest) {
  try {
    const adminCheck = await ensureAdmin(req);
    if (!adminCheck.ok) {
      return NextResponse.json(
        { ok: false, error: adminCheck.reason },
        { status: adminCheck.status },
      );
    }

    const { searchParams } = new URL(req.url);

    const rawPage = searchParams.get("page");
    const rawPageSize = searchParams.get("pageSize");
    const rawStatus = searchParams.get("status");
    const rawEventId = searchParams.get("eventId");
    const rawUserId = searchParams.get("userId");
    const search = (searchParams.get("search") || "").trim();

    const page = Math.max(1, Number.parseInt(rawPage || "1", 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(rawPageSize || "25", 10) || 25),
    );
    const skip = (page - 1) * pageSize;

    let statusFilter: TicketStatus | undefined;
    let eventIdFilter: number | undefined;
    let userIdFilter: string | undefined;

    // Filtro por status
    if (rawStatus) {
      // Confiamos que o frontend só manda valores válidos de TicketStatus
      statusFilter = rawStatus as TicketStatus;
    }

    // Filtro por evento
    if (rawEventId) {
      const eventIdNum = Number(rawEventId);
      if (!Number.isNaN(eventIdNum)) {
        eventIdFilter = eventIdNum;
      }
    }

    // Filtro por user
    if (rawUserId) {
      userIdFilter = rawUserId;
    }

    const andConditions: Prisma.TicketWhereInput[] = [];

    if (statusFilter) {
      andConditions.push({ status: statusFilter });
    }

    if (eventIdFilter) {
      andConditions.push({ eventId: eventIdFilter });
    }

    if (userIdFilter) {
      andConditions.push({ userId: userIdFilter });
    }

    // Filtro de pesquisa (id do ticket, evento, user)
    if (search) {
      const orBlocks: Prisma.TicketWhereInput[] = [
        {
          id: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          event: {
            title: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
      ];

      andConditions.push({ OR: orBlocks });
    }

    const where: Prisma.TicketWhereInput =
      andConditions.length === 0
        ? {}
        : andConditions.length === 1
          ? andConditions[0]
          : { AND: andConditions };

    const ticketInclude = {
      event: {
        select: {
          id: true,
          title: true,
          slug: true,
          startsAt: true,
        },
      },
      ticketType: {
        select: {
          id: true,
          name: true,
        },
      },
    } as const;

    type TicketWithRelations = Prisma.TicketGetPayload<{
      include: typeof ticketInclude;
    }>;

    const [total, tickets] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        orderBy: { purchasedAt: "desc" },
        skip,
        take: pageSize,
        include: ticketInclude,
      }),
    ]);

    const items = tickets.map((t: TicketWithRelations) => ({
      id: t.id,
      status: t.status,
      purchasedAt: t.purchasedAt,
      pricePaid: t.pricePaid,
      currency: t.currency,
      stripePaymentIntentId: t.stripePaymentIntentId,
      event: t.event
        ? {
            id: t.event.id,
            title: t.event.title,
            slug: t.event.slug,
            startsAt: t.event.startsAt,
          }
        : null,
      ticketType: t.ticketType
        ? {
            id: t.ticketType.id,
            name: t.ticketType.name,
          }
        : null,
    }));

    return NextResponse.json({
      ok: true,
      page,
      pageSize,
      total,
      items,
    });
  } catch (error) {
    console.error("[admin/tickets/list] Erro ao listar tickets:", error);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}