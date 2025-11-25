

// app/api/staff/validate-qr/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, assertStaffForEvent } from "@/lib/security";
import { parseQrToken, isQrTokenExpired } from "@/lib/qr";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const body = await req.json().catch(() => null) as
      | { token?: string; eventId?: number }
      | null;

    if (!body || !body.token || !body.eventId) {
      return NextResponse.json(
        {
          ok: false,
          reason: "INVALID_BODY",
          message: "Token e eventId são obrigatórios.",
        },
        { status: 400 }
      );
    }

    const { token, eventId } = body;

    // 1) Extrair informação básica do token (ex.: ticketId)
    const parsed = parseQrToken(token);

    if (!parsed.ok) {
      return NextResponse.json(
        {
          ok: false,
          reason: "INVALID_TOKEN",
          message: "QR inválido ou corrompido.",
        },
        { status: 400 }
      );
    }

    const ticketId = parsed.payload.tid;

    // 2) Carregar o bilhete + evento associado
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        event: true,
      },
    });

    if (!ticket || !ticket.event) {
      return NextResponse.json(
        {
          ok: false,
          reason: "TICKET_NOT_FOUND",
          message: "Bilhete não encontrado.",
        },
        { status: 404 }
      );
    }

    const event = ticket.event;

    // Verificar se o QR é mesmo para este evento
    if (event.id !== eventId) {
      return NextResponse.json(
        {
          ok: false,
          reason: "NOT_FOR_EVENT",
          message: "Este bilhete não pertence a este evento.",
        },
        { status: 400 }
      );
    }

    // 3) Verificar se o utilizador tem permissões de staff para este evento
    const assignments = await prisma.staffAssignment.findMany({
      where: {
        userId: user.id,
        revokedAt: null,
      },
    });

    try {
      assertStaffForEvent(user, assignments, event);
    } catch (err) {
      return NextResponse.json(
        {
          ok: false,
          reason: "NOT_STAFF_FOR_EVENT",
          message: "Não tens permissão para validar bilhetes neste evento.",
        },
        { status: 403 }
      );
    }

    // 4) Regras do bilhete
    if (ticket.status !== "ACTIVE") {
      const reason = ticket.usedAt ? "ALREADY_USED" : "NOT_ACTIVE";
      const message = ticket.usedAt
        ? "Este bilhete já foi usado."
        : "Este bilhete não está activo.";

      return NextResponse.json(
        {
          ok: false,
          reason,
          message,
        },
        { status: 400 }
      );
    }

    // Verificar expiração do QR, se aplicável
    if (isQrTokenExpired(token)) {
      return NextResponse.json(
        {
          ok: false,
          reason: "QR_EXPIRED",
          message: "Este QR já expirou, pede ao participante para actualizar.",
        },
        { status: 400 }
      );
    }

    // 5) Marcar como usado
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: "USED",
        usedAt: new Date(),
      },
    });

    return NextResponse.json(
      {
        ok: true,
        status: "USED",
        message: "Entrada registada com sucesso.",
        ticketId: ticket.id,
        eventId: event.id,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("POST /api/staff/validate-qr error:", err);
    return NextResponse.json(
      {
        ok: false,
        reason: "INTERNAL_ERROR",
        message: "Ocorreu um erro interno ao validar o QR.",
      },
      { status: 500 }
    );
  }
}
