import { NextRequest, NextResponse } from "next/server";
import { TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { canScanTickets } from "@/lib/organizerAccess";

type ScanResponseStatus = "OK" | "ALREADY_USED" | "CANCELLED" | "REFUNDED" | "INVALID" | "WRONG_EVENT";

function buildResponse(
  status: ScanResponseStatus,
  message: string,
  ticket?: {
    id: string;
    holderName: string | null;
    ticketTypeName: string | null;
    checkins: number;
    maxCheckins: number;
  },
  timestamps?: { checkedInAt?: Date | null; firstCheckinAt?: Date | null },
  httpStatus = 200,
) {
  return NextResponse.json(
    {
      status,
      message,
      ticket: ticket ?? null,
      checkedInAt: timestamps?.checkedInAt ?? null,
      firstCheckinAt: timestamps?.firstCheckinAt ?? null,
    },
    { status: httpStatus },
  );
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const eventId = Number(body?.eventId);
    const ticketCode = typeof body?.ticketCode === "string" ? body.ticketCode.trim() : null;
    const deviceId = typeof body?.deviceId === "string" ? body.deviceId.slice(0, 120) : null;

    if (!eventId || Number.isNaN(eventId) || !ticketCode) {
      return NextResponse.json({ ok: false, error: "INVALID_PAYLOAD" }, { status: 400 });
    }

    const access = await canScanTickets(user.id, eventId);
    if (!access.allowed) {
      return NextResponse.json({ ok: false, error: "NO_SCAN_PERMISSION", reason: access.reason }, { status: 403 });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { qrSecret: ticketCode },
      include: {
        ticketType: { select: { name: true } },
        event: { select: { id: true, title: true } },
      },
    });

    if (!ticket) {
      return buildResponse("INVALID", "Bilhete não encontrado.");
    }

    if (ticket.eventId !== eventId) {
      return buildResponse("WRONG_EVENT", "O bilhete não pertence a este evento.");
    }

    if (ticket.status === TicketStatus.REFUNDED) {
      return buildResponse("REFUNDED", "Bilhete reembolsado — entrada não permitida.");
    }
    if (ticket.status === TicketStatus.RESALE_LISTED || ticket.status === TicketStatus.TRANSFERRED) {
      return buildResponse("INVALID", "Bilhete em transferência/revenda — confirma o estado antes de aceitar.");
    }
    if (ticket.status === TicketStatus.USED && ticket.usedAt) {
      return buildResponse(
        "ALREADY_USED",
        "Este bilhete já está marcado como usado.",
        {
          id: ticket.id,
          holderName: ticket.user?.fullName ?? null,
          ticketTypeName: ticket.ticketType?.name ?? null,
          checkins: 1,
          maxCheckins: 1,
        },
        { firstCheckinAt: ticket.usedAt, checkedInAt: ticket.usedAt },
      );
    }

    if (ticket.usedAt) {
      return buildResponse(
        "ALREADY_USED",
        "Este bilhete já foi usado.",
        {
          id: ticket.id,
          holderName: null,
          ticketTypeName: ticket.ticketType?.name ?? null,
          checkins: 1,
          maxCheckins: 1,
        },
        { firstCheckinAt: ticket.usedAt, checkedInAt: ticket.usedAt },
      );
    }

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: ticket.status === TicketStatus.ACTIVE ? TicketStatus.USED : ticket.status,
        usedAt: new Date(),
      },
    });

    return buildResponse(
      "OK",
      "Entrada validada.",
      {
        id: ticket.id,
        holderName: null,
        ticketTypeName: ticket.ticketType?.name ?? null,
        checkins: 1,
        maxCheckins: 1,
      },
      { checkedInAt: updated.usedAt, firstCheckinAt: updated.usedAt },
    );
  } catch (err) {
    console.error("[tickets/scan][POST]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
