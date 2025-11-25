// app/api/me/tickets/transfers/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";

/**
 * F5-4 – Listar transferências do utilizador
 *
 * GET /api/me/tickets/transfers
 *
 * Resposta:
 * {
 *   ok: true,
 *   incoming: [...], // transferências onde o user é o destino (toUserId)
 *   outgoing: [...], // transferências onde o user é o emissor (fromUserId)
 * }
 */
export async function GET(_req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error(
        "Error getting user in /api/me/tickets/transfers:",
        authError
      );
    }

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Buscar todas as transferências onde este user é from OU to
    const transfers = await prisma.ticketTransfer.findMany({
      where: {
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      },
      include: {
        ticket: {
          include: {
            event: true,
            ticketType: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Separar em incoming vs outgoing
    const incoming = transfers
      .filter((t) => t.toUserId === userId)
      .map((t) => ({
        id: t.id,
        status: t.status,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
        fromUserId: t.fromUserId,
        toUserId: t.toUserId,
        ticket: t.ticket
          ? {
            id: t.ticket.id,
            status: t.ticket.status,
            eventId: t.ticket.eventId,
            ticketTypeId: t.ticket.ticketTypeId,
            event: t.ticket.event
              ? {
                id: t.ticket.event.id,
                slug: t.ticket.event.slug,
                title: t.ticket.event.title,
                startsAt: t.ticket.event.startsAt,
                locationName: t.ticket.event.locationName,
                locationCity: t.ticket.event.locationCity,
              }
              : null,
            ticketType: t.ticket.ticketType
              ? {
                id: t.ticket.ticketType.id,
                name: t.ticket.ticketType.name,
                price: t.ticket.ticketType.price,
                currency: t.ticket.ticketType.currency,
              }
              : null,
          }
          : null,
      }));

    const outgoing = transfers
      .filter((t) => t.fromUserId === userId)
      .map((t) => ({
        id: t.id,
        status: t.status,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
        fromUserId: t.fromUserId,
        toUserId: t.toUserId,
        ticket: t.ticket
          ? {
            id: t.ticket.id,
            status: t.ticket.status,
            eventId: t.ticket.eventId,
            ticketTypeId: t.ticket.ticketTypeId,
            event: t.ticket.event
              ? {
                id: t.ticket.event.id,
                slug: t.ticket.event.slug,
                title: t.ticket.event.title,
                startsAt: t.ticket.event.startsAt,
                locationName: t.ticket.event.locationName,
                locationCity: t.ticket.event.locationCity,
              }
              : null,
            ticketType: t.ticket.ticketType
              ? {
                id: t.ticket.ticketType.id,
                name: t.ticket.ticketType.name,
                price: t.ticket.ticketType.price,
                currency: t.ticket.ticketType.currency,
              }
              : null,
          }
          : null,
      }));

    return NextResponse.json(
      {
        ok: true,
        incoming,
        outgoing,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in /api/me/tickets/transfers:", error);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}