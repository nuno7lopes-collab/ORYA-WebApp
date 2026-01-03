import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { NotificationType, TransferStatus, TicketStatus } from "@prisma/client";
import { createNotification, shouldNotify } from "@/lib/notifications";

/**
 * F5-3 – Responder à transferência (aceitar / recusar)
 * Body esperado: { transferId: string, action: "ACCEPT" | "DECLINE" }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("Error getting user in transfer/respond:", authError);
    }

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { roles: true, username: true, fullName: true },
    });
    const roles = Array.isArray(profile?.roles) ? (profile?.roles as string[]) : [];
    const isAdmin = roles.some((r) => r?.toLowerCase() === "admin");
    if (!isAdmin) {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null) as
      | { transferId?: string; action?: "ACCEPT" | "DECLINE" }
      | null;

    if (
      !body ||
      typeof body !== "object" ||
      !body.transferId ||
      (body.action !== "ACCEPT" && body.action !== "DECLINE")
    ) {
      return NextResponse.json(
        { ok: false, error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const { transferId, action } = body;
    const userId = user.id;

    // 1. Carregar TicketTransfer PENDING para o to_user_id = auth.uid()
    const transfer = await prisma.ticketTransfer.findUnique({
      where: { id: transferId },
      include: {
        ticket: { include: { event: { select: { id: true, title: true, organizationId: true } } } },
      },
    });

    if (!transfer) {
      return NextResponse.json(
        { ok: false, error: "TRANSFER_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (transfer.toUserId !== userId) {
      return NextResponse.json(
        { ok: false, error: "NOT_TRANSFER_TARGET" },
        { status: 403 }
      );
    }

    if (transfer.status !== TransferStatus.PENDING) {
      return NextResponse.json(
        { ok: false, error: "TRANSFER_NOT_PENDING" },
        { status: 400 }
      );
    }

    // 2. Se for DECLINE -> marcar DECLINED e terminar
    if (action === "DECLINE") {
      const updated = await prisma.ticketTransfer.update({
        where: { id: transfer.id },
        data: {
          status: TransferStatus.CANCELLED,
          completedAt: new Date(),
        },
      });

      if (await shouldNotify(transfer.fromUserId, NotificationType.TICKET_TRANSFER_DECLINED)) {
        const actorName = profile?.username || profile?.fullName || "Um utilizador";
        await createNotification({
          userId: transfer.fromUserId,
          fromUserId: userId,
          organizationId: transfer.ticket.event?.organizationId ?? null,
          eventId: transfer.ticket.event?.id ?? null,
          ticketId: transfer.ticketId,
          type: NotificationType.TICKET_TRANSFER_DECLINED,
          title: "Transferência recusada",
          body: `${actorName} recusou o teu bilhete.`,
          payload: { ticketId: transfer.ticketId, eventId: transfer.ticket.event?.id },
        }).catch((err) => console.warn("[notification][transfer_declined] falhou", err));
      }

      return NextResponse.json(
        {
          ok: true,
          status: updated.status,
        },
        { status: 200 }
      );
    }

    // 3. Se for ACCEPT -> mudar dono do ticket e marcar ACCEPTED
    const ticket = transfer.ticket;

    if (!ticket) {
      return NextResponse.json(
        { ok: false, error: "TICKET_NOT_FOUND_FOR_TRANSFER" },
        { status: 404 }
      );
    }

    if (ticket.status !== TicketStatus.ACTIVE) {
      return NextResponse.json(
        { ok: false, error: "TICKET_NOT_ACTIVE" },
        { status: 400 }
      );
    }

    if (ticket.userId !== transfer.fromUserId) {
      // Algo está inconsistente: o dono atual já não é o fromUserId
      return NextResponse.json(
        { ok: false, error: "TICKET_OWNER_MISMATCH" },
        { status: 409 }
      );
    }

    // Transaction: atualizar ticket + transfer de forma atómica
    const result = await prisma.$transaction(async (tx) => {
      const updatedTicket = await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          userId, // novo dono
          status: TicketStatus.ACTIVE, // garante que fica novamente ACTIVE, caso tenhas usado um estado intermédio
        },
      });

      const updatedTransfer = await tx.ticketTransfer.update({
        where: { id: transfer.id },
        data: {
          status: TransferStatus.ACCEPTED,
          completedAt: new Date(),
        },
      });

      return { updatedTicket, updatedTransfer };
    });

    if (await shouldNotify(transfer.fromUserId, NotificationType.TICKET_TRANSFER_ACCEPTED)) {
      const actorName = profile?.username || profile?.fullName || "Um utilizador";
      await createNotification({
        userId: transfer.fromUserId,
        fromUserId: userId,
        organizationId: transfer.ticket.event?.organizationId ?? null,
        eventId: transfer.ticket.event?.id ?? null,
        ticketId: transfer.ticketId,
        type: NotificationType.TICKET_TRANSFER_ACCEPTED,
        title: "Transferência aceite",
        body: `${actorName} aceitou o bilhete que enviaste.`,
        payload: { ticketId: transfer.ticketId, eventId: transfer.ticket.event?.id },
      }).catch((err) => console.warn("[notification][transfer_accepted] falhou", err));
    }

    return NextResponse.json(
      {
        ok: true,
        status: result.updatedTransfer.status,
        ticketId: result.updatedTicket.id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in /api/tickets/transfer/respond:", error);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
