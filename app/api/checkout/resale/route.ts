import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { resolveOwner } from "@/lib/ownership/resolveOwner";
import { env } from "@/lib/env";

/**
 * F5-12 – Checkout específico para revenda de bilhetes
 *
 * Body esperado:
 * {
 *   resaleId: string;
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Autenticação – garantir que o comprador está autenticado
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("Error getting user in /api/checkout/resale:", authError);
    }

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }

    const buyerUserId = user.id;

    // 2. Ler body e validar
    const body = (await req.json().catch(() => null)) as
      | { resaleId?: string }
      | null;

    if (!body || typeof body !== "object" || !body.resaleId) {
      return NextResponse.json(
        { ok: false, error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const { resaleId } = body;

    // 3. Carregar revenda + ticket + evento
    const resale = await prisma.ticketResale.findUnique({
      where: { id: resaleId },
      include: {
        ticket: {
          include: {
            event: true,
          },
        },
      },
    });

    if (!resale || !resale.ticket || !resale.ticket.event) {
      return NextResponse.json(
        { ok: false, error: "RESALE_NOT_FOUND" },
        { status: 404 }
      );
    }

    const { ticket } = resale;
    const event = ticket.event;

    // 4. Validar estado da revenda e do bilhete
    if (resale.status !== "LISTED") {
      return NextResponse.json(
        { ok: false, error: "RESALE_NOT_AVAILABLE" },
        { status: 400 }
      );
    }

    if (ticket.status !== "ACTIVE") {
      return NextResponse.json(
        { ok: false, error: "TICKET_NOT_ACTIVE" },
        { status: 400 }
      );
    }

    // 5. Impedir que o vendedor compre o próprio bilhete
    if (resale.sellerUserId === buyerUserId) {
      return NextResponse.json(
        { ok: false, error: "CANNOT_BUY_OWN_RESALE" },
        { status: 400 }
      );
    }

    // 6. Determinar o preço em cêntimos (compatível com diferentes schemas)
    const rawAmount =
      (resale as { priceCents?: number | null; price?: number | null })
        .priceCents ??
      (resale as { priceCents?: number | null; price?: number | null }).price ??
      null;

    if (typeof rawAmount !== "number" || rawAmount <= 0) {
      console.error("Invalid resale price for resaleId:", resaleId, rawAmount);
      return NextResponse.json(
        { ok: false, error: "INVALID_RESALE_PRICE" },
        { status: 400 }
      );
    }

    const amountCents = rawAmount;
    const ownerResolved = await resolveOwner({ sessionUserId: buyerUserId, guestEmail: null });
    const origin = req.nextUrl.origin || env.appBaseUrl || "";

    const res = await fetch(`${origin}/api/payments/intent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: req.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({
        slug: event.slug ?? null,
        items: [
          {
            ticketId: resale.ticket.ticketTypeId,
            quantity: 1,
            unitPriceCents: amountCents,
            currency: (event.currency || "EUR").toUpperCase(),
          },
        ],
        paymentScenario: "RESALE",
        resaleId: resale.id,
        ticketId: resale.ticket.id,
        total: rawAmount / 100,
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok || !data?.clientSecret) {
      console.error("Error in /api/checkout/resale intent:", { status: res.status, data });
      return NextResponse.json(
        { ok: false, error: data?.error ?? "INTENT_CREATION_FAILED", code: data?.code ?? null },
        { status: res.status },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        clientSecret: data.clientSecret,
        paymentIntentId: data.paymentIntentId,
        purchaseId: data.purchaseId,
        paymentScenario: "RESALE",
        preview: {
          title: event.title,
          ticketTypeName: resale.ticket.ticketType?.name ?? null,
          priceCents: amountCents,
          currency: event.currency || "EUR",
          sellerName: resale.ticket.user?.username ?? resale.ticket.user?.fullName ?? null,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in /api/checkout/resale:", error);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
