

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Precisas de iniciar sessão.", code: "NOT_AUTHENTICATED" },
        { status: 401 }
      );
    }

    const { reservationId } = await req.json();

    if (!reservationId) {
      return NextResponse.json(
        { ok: false, error: "reservationId obrigatório.", code: "MISSING_FIELDS" },
        { status: 400 }
      );
    }

    const reservation = await prisma.ticketReservation.findUnique({
      where: { id: reservationId },
      include: { ticket: true },
    });

    if (!reservation) {
      return NextResponse.json(
        { ok: false, error: "Reserva não encontrada.", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (reservation.userId !== user.id) {
      return NextResponse.json(
        { ok: false, error: "Reserva não te pertence.", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    if (reservation.status !== "ACTIVE") {
      return NextResponse.json(
        { ok: false, error: "Reserva já não está ativa.", code: "NOT_ACTIVE" },
        { status: 400 }
      );
    }

    // Marcar reserva como COMPLETED
    await prisma.ticketReservation.update({
      where: { id: reservation.id },
      data: { status: "COMPLETED" },
    });

    // Atualizar soldQuantity
    await prisma.ticket.update({
      where: { id: reservation.ticketId },
      data: {
        soldQuantity: {
          increment: reservation.quantity,
        },
      },
    });

    return NextResponse.json({ ok: true, completed: true }, { status: 200 });
  } catch (err) {
    console.error("[POST /api/checkout/reserve/complete] ERROR", err);
    return NextResponse.json(
      { ok: false, error: "Erro interno.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}