import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { TicketStatus, TransferStatus } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { ok: false, error: "NOT_AUTHENTICATED" },
        { status: 401 }
      );
    }
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { roles: true },
    });
    const roles = Array.isArray(profile?.roles) ? (profile?.roles as string[]) : [];
    const isAdmin = roles.some((r) => r?.toLowerCase() === "admin");
    if (!isAdmin) {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN" },
        { status: 403 },
      );
    }

    const body = (await req.json().catch(() => null)) as
      | { ticketId?: string; targetIdentifier?: string }
      | null;

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const { ticketId, targetIdentifier } = body;

    if (!ticketId || typeof ticketId !== "string") {
      return NextResponse.json(
        { ok: false, error: "MISSING_TICKET_ID" },
        { status: 400 }
      );
    }

    if (!targetIdentifier || typeof targetIdentifier !== "string") {
      return NextResponse.json(
        { ok: false, error: "MISSING_TARGET_IDENTIFIER" },
        { status: 400 }
      );
    }

    const userId = user.id;

    // 1. Validar que o bilhete pertence ao utilizador atual e está ACTIVE
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        userId,
        status: TicketStatus.ACTIVE,
      },
      include: {
        event: true,
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { ok: false, error: "TICKET_NOT_FOUND_OR_NOT_ACTIVE" },
        { status: 404 }
      );
    }

    // 2. Verificar se já existe transferência PENDING para este bilhete
    const existingPendingTransfer = await prisma.ticketTransfer.findFirst({
      where: {
        ticketId: ticket.id,
        status: TransferStatus.PENDING,
      },
    });

    if (existingPendingTransfer) {
      return NextResponse.json(
        { ok: false, error: "TRANSFER_ALREADY_PENDING" },
        { status: 400 }
      );
    }

    // 3. Verificar se o bilhete está listado em revenda
    const existingResale = await prisma.ticketResale.findFirst({
      where: {
        ticketId: ticket.id,
        status: "LISTED", // aqui podes manter string se o enum tiver outro nome
      },
    });

    if (existingResale) {
      return NextResponse.json(
        { ok: false, error: "TICKET_ALREADY_IN_RESALE" },
        { status: 400 }
      );
    }

    // 4. Resolver o target pelo username ORYA (profiles.username)
    const targetProfile = await prisma.profile.findUnique({
      where: {
        username: targetIdentifier,
      },
    });

    if (!targetProfile) {
      return NextResponse.json(
        { ok: false, error: "TARGET_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (targetProfile.id === userId) {
      return NextResponse.json(
        { ok: false, error: "CANNOT_TRANSFER_TO_SELF" },
        { status: 400 }
      );
    }

    // TODO(followers): quando existir tabela de seguidores, garantir follow mútuo
    // Exemplo esperado:
    // const isFriend = await isMutualFollower(userId, targetProfile.id);
    // if (!isFriend) return NextResponse.json({ ok: false, error: "NOT_FRIEND" }, { status: 403 });
    // Por agora, esta regra fica desativada até termos o modelo de followers.

    // 5. Criar registo em ticket_transfers com status PENDING
    const transfer = await prisma.ticketTransfer.create({
      data: {
        ticketId: ticket.id,
        fromUserId: userId,
        toUserId: targetProfile.id,
        status: TransferStatus.PENDING,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        transferId: transfer.id,
        status: transfer.status,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in /api/tickets/transfer/start:", error);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
