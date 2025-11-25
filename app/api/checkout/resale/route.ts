import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import Stripe from "stripe";

/**
 * Instância Stripe local a este route.
 * Usa a STRIPE_SECRET_KEY já configurada no projeto.
 */
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-10-29.clover" as Stripe.LatestApiVersion,
});

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

    // 7. Criar sessão Stripe para pagamento da revenda
    const origin = req.nextUrl.origin;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: amountCents,
            product_data: {
              name: `Bilhete – ${event.title}`,
              description: "Revenda de bilhete entre utilizadores via ORYA",
            },
          },
        },
      ],
      metadata: {
        mode: "RESALE",
        resaleId: resale.id,
        ticketId: ticket.id,
        eventId: event.id,
        eventSlug: event.slug ?? "",
        buyerUserId,
      },
      success_url: `${origin}/me/tickets?checkout=success&mode=resale`,
      cancel_url: `${origin}/me/tickets?checkout=cancelled&mode=resale`,
    });

    if (!session.url) {
      return NextResponse.json(
        { ok: false, error: "SESSION_URL_MISSING" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        url: session.url,
        sessionId: session.id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in /api/checkout/resale:", error);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
