// app/api/checkout/session/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Endpoint responsável por preparar uma "sessão de checkout".
// Nesta fase ainda não chama Stripe/EuPago: apenas valida o bilhete
// e devolve uma checkoutUrl onde o utilizador vai concluir a compra.
//
// Espera um body JSON do tipo:
// {
//   "eventSlug": string,
//   "ticketId": string,
//   "quantity": number,
//   "returnTo"?: string   // opcional, ex: "/eventos/orya-open"
// }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Body inválido." },
        { status: 400 },
      );
    }

    const eventSlug = (body.eventSlug as string | undefined)?.trim();
    const ticketId = body.ticketId as string | undefined;
    const quantityRaw = body.quantity;

    // returnTo opcional (ex: "/eventos/orya-open")
    const returnToRaw = body.returnTo as string | undefined;
    let safeReturnTo: string | undefined;
    if (returnToRaw && typeof returnToRaw === "string") {
      const trimmed = returnToRaw.trim();
      // Só aceitamos paths relativos internos para evitar open redirect
      if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
        safeReturnTo = trimmed;
      }
    }

    const quantity =
      typeof quantityRaw === "number" && quantityRaw > 0
        ? Math.floor(quantityRaw)
        : 1;

    if (!eventSlug) {
      return NextResponse.json(
        { success: false, error: "Slug do evento em falta." },
        { status: 400 },
      );
    }

    if (!ticketId) {
      return NextResponse.json(
        { success: false, error: "ticketId em falta." },
        { status: 400 },
      );
    }

    // 1) Buscar evento + tickets
    const event = await prisma.event.findUnique({
      where: { slug: eventSlug },
      include: {
        tickets: true,
      },
    });

    if (!event) {
      return NextResponse.json(
        { success: false, error: "Evento não encontrado." },
        { status: 404 },
      );
    }

    // 🔥 Aqui garantimos que o parâmetro `t` não é `any`
    const ticket = event.tickets.find(
      (t: {
        id: string;
        name?: string | null;
        price?: number | null;
        currency?: string | null;
        available: boolean;
        isVisible: boolean;
        startsAt?: Date | null;
        endsAt?: Date | null;
        totalQuantity?: number | null;
        soldQuantity: number;
      }) => t.id === ticketId,
    );

    if (!ticket) {
      return NextResponse.json(
        { success: false, error: "Bilhete não encontrado para este evento." },
        { status: 404 },
      );
    }

    const now = new Date();

    // 2) Validar estado base (disponibilidade + visibilidade)
    if (!ticket.available || !ticket.isVisible) {
      return NextResponse.json(
        { success: false, error: "Este bilhete não está disponível." },
        { status: 400 },
      );
    }

    // 3) Validar janela temporal (wave ainda não abriu / já fechou)
    if (ticket.startsAt && now < ticket.startsAt) {
      return NextResponse.json(
        { success: false, error: "Esta wave ainda não abriu." },
        { status: 400 },
      );
    }

    if (ticket.endsAt && now > ticket.endsAt) {
      return NextResponse.json(
        { success: false, error: "Esta wave já terminou." },
        { status: 400 },
      );
    }

    // 4) Validar stock
    if (
      ticket.totalQuantity !== null &&
      ticket.totalQuantity !== undefined
    ) {
      const remaining = ticket.totalQuantity - ticket.soldQuantity;

      if (remaining <= 0) {
        return NextResponse.json(
          { success: false, error: "Esta wave está esgotada." },
          { status: 400 },
        );
      }

      if (quantity > remaining) {
        return NextResponse.json(
          {
            success: false,
            error: `Só há ${remaining} bilhete(s) disponíveis para esta wave.`,
          },
          { status: 400 },
        );
      }
    }

    // 5) Calcular total (ainda sem criar compra, apenas preparar checkout)
    //    Assumimos que ticket.price está em cêntimos (tal como no restante sistema).
    const unitPriceCents = Number(ticket.price ?? 0);
    const amountCents = unitPriceCents * quantity;
    const amountEuros = amountCents / 100;

    // 6) Gerar uma URL de checkout
    //    (já compatível com o que a página /checkout espera)
    const searchParams = new URLSearchParams({
      eventId: String(event.id),
      event: event.slug,
      eventTitle: event.title,
      ticketId: ticket.id,
      ticketName: ticket.name ?? "Bilhete ORYA",
      qty: String(quantity),
      amount: amountEuros.toFixed(2),
      currency: (ticket.currency || "EUR").toUpperCase(),
    });

    if (safeReturnTo) {
      searchParams.set("returnTo", safeReturnTo);
    }

    const checkoutUrl = `/checkout?${searchParams.toString()}`;

    return NextResponse.json(
      {
        success: true,
        checkoutUrl,
        summary: {
          event: {
            id: event.id,
            slug: event.slug,
            title: event.title,
            coverImageUrl: event.coverImageUrl,
            locationName: event.locationName,
            startDate: event.startDate,
          },
          ticket: {
            id: ticket.id,
            name: ticket.name,
            // devolvemos também o preço em euros para consumo fácil no front, se necessário
            price: amountEuros / quantity,
            currency: (ticket.currency || "EUR").toUpperCase(),
          },
          quantity,
          amount: amountEuros,
          currency: (ticket.currency || "EUR").toUpperCase(),
          returnTo: safeReturnTo ?? null,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[POST /api/checkout/session] ERROR", err);
    return NextResponse.json(
      { success: false, error: "Erro interno ao preparar checkout." },
      { status: 500 },
    );
  }
}