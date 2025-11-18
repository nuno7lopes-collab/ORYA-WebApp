// app/api/eventos/[slug]/comprar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  try {
    // -------- 0) Obter utilizador autenticado (se existir) --------
    const supabase = await createSupabaseServer();
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id ?? null;

    // -------- 1) Obter o slug diretamente da URL --------
    // /api/eventos/kakkaak/comprar
    const { pathname } = req.nextUrl;
    const segments = pathname.split("/").filter(Boolean);
    // ["api", "eventos", "{slug}", "comprar"]
    const slug = segments[2];

    if (!slug) {
      return NextResponse.json(
        { error: "Slug do evento em falta (não encontrado na URL)." },
        { status: 400 }
      );
    }

    // -------- 2) Ler body (ticketId + quantity) --------
    const body = await req.json().catch(() => null);
    const { ticketId, quantity } = body ?? {};

    const qty =
      typeof quantity === "number" && quantity > 0 ? Math.floor(quantity) : 1;

    if (!ticketId || typeof ticketId !== "string") {
      return NextResponse.json(
        { error: "ticketId em falta ou inválido." },
        { status: 400 }
      );
    }

    // -------- 3) Buscar ticket deste evento --------
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        event: { slug },
      },
      select: {
        id: true,
        name: true,
        price: true,
        currency: true,
        available: true,
        isVisible: true,
        totalQuantity: true,
        soldQuantity: true,
        startsAt: true,
        endsAt: true,
        eventId: true,
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: "Bilhete não encontrado para este evento." },
        { status: 404 }
      );
    }

    const now = new Date();

    // -------- 4) Validar estado base (disponível + visível) --------
    if (!ticket.available || !ticket.isVisible) {
      return NextResponse.json(
        { error: "Este bilhete não está disponível." },
        { status: 400 }
      );
    }

    // -------- 5) Validar janela da wave (tempo) --------
    if (ticket.startsAt && now < ticket.startsAt) {
      return NextResponse.json(
        { error: "Esta wave ainda não abriu." },
        { status: 400 }
      );
    }

    if (ticket.endsAt && now > ticket.endsAt) {
      return NextResponse.json(
        { error: "Esta wave já terminou." },
        { status: 400 }
      );
    }

    // -------- 6) Validar stock --------
    if (
      ticket.totalQuantity !== null &&
      ticket.totalQuantity !== undefined
    ) {
      const remaining = ticket.totalQuantity - ticket.soldQuantity;

      if (remaining <= 0) {
        return NextResponse.json(
          { error: "Esta wave está esgotada." },
          { status: 400 }
        );
      }

      if (qty > remaining) {
        return NextResponse.json(
          {
            error: `Só há ${remaining} bilhete(s) disponíveis para esta wave.`,
          },
          { status: 400 }
        );
      }
    }

    // -------- 7) Transação: atualizar stock + registar compra --------
    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
      const updatedTicket = await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          soldQuantity: {
            increment: qty,
          },
        },
        select: {
          id: true,
          name: true,
          price: true,
          currency: true,
          totalQuantity: true,
          soldQuantity: true,
        },
      });

      const purchase = await tx.ticketPurchase.create({
        data: {
          eventId: ticket.eventId,
          ticketId: ticket.id,
          quantity: qty,
          pricePaid: updatedTicket.price * qty, // total pago
          currency: updatedTicket.currency,
          // liga a compra ao utilizador autenticado (se existir)
          userId: userId ?? undefined,
        },
      });

      return { updatedTicket, purchase };
      },
    );

    return NextResponse.json(
      {
        success: true,
        quantity: qty,
        ticket: result.updatedTicket,
        purchase: result.purchase,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/eventos/[slug]/comprar]", err);
    return NextResponse.json(
      { error: "Erro ao processar compra do bilhete." },
      { status: 500 }
    );
  }
}