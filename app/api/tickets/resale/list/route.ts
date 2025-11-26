import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";

/**
 * F5-7 – Criar revenda (listar bilhete)
 *
 * Body esperado:
 * {
 *   ticketId: string;
 *   price: number; // em cêntimos
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("Error getting user in resale/list:", authError);
    }

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => null)) as
      | { ticketId?: string; price?: number }
      | null;

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const { ticketId, price } = body;

    if (!ticketId || typeof ticketId !== "string") {
      return NextResponse.json(
        { ok: false, error: "MISSING_TICKET_ID" },
        { status: 400 }
      );
    }

    if (
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      return NextResponse.json(
        { ok: false, error: "INVALID_PRICE" },
        { status: 400 }
      );
    }

    const userId = user.id;

    // 1. Validar que o bilhete pertence ao utilizador atual e está ACTIVE
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        userId,
        status: "ACTIVE",
      },
      include: {
        event: {
          include: {
            ticketTypes: true,
          },
        },
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
        status: "PENDING",
      },
    });

    if (existingPendingTransfer) {
      return NextResponse.json(
        { ok: false, error: "TRANSFER_ALREADY_PENDING" },
        { status: 400 }
      );
    }

    // 3. Verificar se o bilhete já está em revenda LISTED
    const existingResale = await prisma.ticketResale.findFirst({
      where: {
        ticketId: ticket.id,
        status: "LISTED",
      },
    });

    if (existingResale) {
      return NextResponse.json(
        { ok: false, error: "TICKET_ALREADY_IN_RESALE" },
        { status: 400 }
      );
    }

    // 4. Validar configuração de revenda ao nível do evento
    const event = ticket.event;
    if (event) {
      const resaleMode =
        (event as { resaleMode?: string }).resaleMode ?? "ALWAYS";

      if (resaleMode === "DISABLED") {
        return NextResponse.json(
          { ok: false, error: "RESALE_DISABLED_FOR_EVENT" },
          { status: 400 }
        );
      }

      if (resaleMode === "AFTER_SOLD_OUT") {
        const ticketTypes = event.ticketTypes ?? [];
        const hasUnlimited = ticketTypes.some(
          (tt) => tt.totalQuantity === null || tt.totalQuantity === undefined,
        );
        const soldOut =
          !hasUnlimited &&
          ticketTypes.length > 0 &&
          ticketTypes.every((tt) => {
            if (tt.totalQuantity === null || tt.totalQuantity === undefined)
              return false;
            return tt.soldQuantity >= tt.totalQuantity;
          });

        if (!soldOut) {
          return NextResponse.json(
            { ok: false, error: "RESALE_ONLY_AFTER_SOLD_OUT" },
            { status: 400 }
          );
        }
      }
    }

    // 5. Criar registo em ticket_resales com status LISTED
    const resale = await prisma.ticketResale.create({
      data: {
        ticketId: ticket.id,
        sellerUserId: userId,
        price,
        currency: ticket.currency ?? "EUR",
        status: "LISTED",
      },
    });

    // (Opcional) Se no futuro adicionares um estado específico no TicketStatus
    // para bilhetes em revenda (ex.: RESALE_LISTED), podes atualizar aqui o ticket.

    return NextResponse.json(
      {
        ok: true,
        resaleId: resale.id,
        status: resale.status,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in /api/tickets/resale/list:", error);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
