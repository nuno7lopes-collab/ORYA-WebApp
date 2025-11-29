// app/api/payments/intent/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { MAX_TICKETS_PER_WAVE } from "@/lib/tickets";
import { stripe } from "@/lib/stripeClient";
import { getPlatformFees } from "@/lib/platformSettings";

type CheckoutItem = {
  ticketId: string;
  quantity: number;
};

type Body = {
  slug?: string;
  items?: CheckoutItem[];
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null;

    if (!body || !body.slug || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Dados inválidos." },
        { status: 400 },
      );
    }

    const { slug, items } = body;

    // Validar que o evento existe (e obter o id + organizer para metadata/Connect)
    const event = await prisma.event.findUnique({
      where: { slug },
      include: {
        organizer: {
          select: {
            id: true,
            stripeAccountId: true,
            stripeChargesEnabled: true,
            stripePayoutsEnabled: true,
            feeMode: true,
            platformFeeBps: true,
            platformFeeFixedCents: true,
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json(
        { ok: false, error: "Evento não encontrado." },
        { status: 404 },
      );
    }

    if (event.isDeleted || event.status !== "PUBLISHED") {
      return NextResponse.json(
        { ok: false, error: "Evento indisponível para compra." },
        { status: 400 },
      );
    }

    if (event.endsAt && event.endsAt < new Date()) {
      return NextResponse.json(
        { ok: false, error: "Vendas encerradas: evento já terminou." },
        { status: 400 },
      );
    }

    // Autenticação do utilizador
    const supabase = await createSupabaseServer();
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id ?? null;

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Precisas de iniciar sessão." },
        { status: 401 },
      );
    }

    const ticketTypeIds = Array.from(
      new Set(
        items
          .map((i) => Number(i.ticketId))
          .filter((v) => Number.isFinite(v) && v > 0),
      ),
    );

    if (ticketTypeIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "IDs de bilhete inválidos." },
        { status: 400 },
      );
    }

    const ticketTypes = await prisma.ticketType.findMany({
      where: {
        id: { in: ticketTypeIds },
        eventId: event.id,
        status: "ON_SALE",
      },
      select: {
        id: true,
        price: true,
        currency: true,
        totalQuantity: true,
        soldQuantity: true,
      },
    });

    if (ticketTypes.length !== ticketTypeIds.length) {
      return NextResponse.json(
        {
          ok: false,
          error: "Um dos bilhetes não foi encontrado ou não pertence a este evento.",
        },
        { status: 400 },
      );
    }

    // Reservas ativas (excluindo as do próprio utilizador) contam para stock
    const now = new Date();
    const activeReservations = await prisma.ticketReservation.findMany({
      where: {
        ticketTypeId: { in: ticketTypeIds },
        status: "ACTIVE",
        expiresAt: { gt: now },
      },
      select: {
        ticketTypeId: true,
        quantity: true,
        userId: true,
      },
    });

    const reservedByType = activeReservations.reduce<Record<number, number>>(
      (acc, r) => {
        // Ignorar reservas do próprio user para não bloquear a compra dele
        if (r.userId && r.userId === userId) return acc;
        acc[r.ticketTypeId] = (acc[r.ticketTypeId] ?? 0) + r.quantity;
        return acc;
      },
      {},
    );

    let amountInCents = 0;
    let currency: string | null = null;
    const ticketTypeMap = new Map<number, (typeof ticketTypes)[number]>(
      ticketTypes.map((t) => [t.id, t]),
    );

    for (const item of items) {
      const ticketTypeId = Number(item.ticketId);
      if (!Number.isFinite(ticketTypeId)) {
        return NextResponse.json(
          { ok: false, error: "ID de bilhete inválido." },
          { status: 400 },
        );
      }

      const ticketType = ticketTypeMap.get(ticketTypeId);
      if (!ticketType) {
        return NextResponse.json(
          { ok: false, error: "Um dos bilhetes não foi encontrado ou não pertence a este evento." },
          { status: 400 },
        );
      }

      const qty = Number(item.quantity ?? 0);
      if (!Number.isInteger(qty) || qty < 1) {
        return NextResponse.json(
          { ok: false, error: "Quantidade inválida." },
          { status: 400 },
        );
      }

      if (qty > MAX_TICKETS_PER_WAVE) {
        return NextResponse.json(
          {
            ok: false,
            error: `Máximo ${MAX_TICKETS_PER_WAVE} bilhetes por wave em cada compra.`,
          },
          { status: 400 },
        );
      }

      // Validação de stock (incluindo reservas ativas de outros)
      if (
        ticketType.totalQuantity !== null &&
        ticketType.totalQuantity !== undefined
      ) {
        const reserved = reservedByType[ticketTypeId] ?? 0;
        const remaining = ticketType.totalQuantity - ticketType.soldQuantity - reserved;
        if (remaining < qty) {
          return NextResponse.json(
            { ok: false, error: "Stock insuficiente para um dos bilhetes." },
            { status: 400 },
          );
        }
      }

      const priceCents = Number(ticketType.price);
      if (!Number.isFinite(priceCents) || priceCents <= 0) {
        return NextResponse.json(
          { ok: false, error: "Preço inválido no servidor." },
          { status: 500 },
        );
      }

      const ticketCurrency = (ticketType.currency || "EUR").toLowerCase();
      if (!currency) {
        currency = ticketCurrency;
      } else if (currency !== ticketCurrency) {
        return NextResponse.json(
          { ok: false, error: "Não é possível misturar moedas diferentes no mesmo checkout." },
          { status: 400 },
        );
      }

      amountInCents += priceCents * qty;
    }

    if (!currency) {
      return NextResponse.json(
        { ok: false, error: "Moeda não determinada para o checkout." },
        { status: 400 },
      );
    }

    if (amountInCents <= 0) {
      return NextResponse.json(
        { ok: false, error: "Montante inválido." },
        { status: 400 },
      );
    }

    const { feeBps: defaultFeeBps, feeFixedCents: defaultFeeFixed } =
      await getPlatformFees();

    const organizer = event.organizer;
    const stripeAccountId = organizer?.stripeAccountId ?? null;
    const isPartnerEvent = Boolean(stripeAccountId);

    if (isPartnerEvent && !organizer?.stripeChargesEnabled) {
      return NextResponse.json(
        { ok: false, error: "Conta Stripe do organizador ainda não está ativa." },
        { status: 400 },
      );
    }

    const feeMode =
      event.feeModeOverride ??
      organizer?.feeMode ??
      ("ADDED" as "ADDED" | "INCLUDED");

    const feeBpsCandidates = [
      event.platformFeeBpsOverride,
      organizer?.platformFeeBps,
      defaultFeeBps,
    ];
    const platformFeeBps =
      feeBpsCandidates.find(
        (n) => typeof n === "number" && Number.isFinite(n),
      ) ?? defaultFeeBps;

    const feeFixedCandidates = [
      event.platformFeeFixedCentsOverride,
      organizer?.platformFeeFixedCents,
      defaultFeeFixed,
    ];
    const platformFeeFixedCents =
      feeFixedCandidates.find(
        (n) => typeof n === "number" && Number.isFinite(n),
      ) ?? defaultFeeFixed;

    const platformFeeCents = Math.max(
      0,
      Math.round((amountInCents * platformFeeBps) / 10_000) +
        platformFeeFixedCents,
    );

    const totalAmountInCents =
      feeMode === "ADDED" ? amountInCents + platformFeeCents : amountInCents;

    if (totalAmountInCents <= 0 || platformFeeCents > totalAmountInCents) {
      return NextResponse.json(
        { ok: false, error: "Montante total inválido para este checkout." },
        { status: 400 },
      );
    }

    const metadata = {
      eventId: String(event.id),
      eventSlug: String(event.slug),
      userId: String(userId),
      items: JSON.stringify(items),
      baseAmountCents: String(amountInCents),
      platformFeeMode: feeMode,
      platformFeeBps: String(platformFeeBps),
      platformFeeFixedCents: String(platformFeeFixedCents),
      platformFeeCents: String(platformFeeCents),
      stripeAccountId: stripeAccountId ?? "orya",
    };

    const intentParams: Parameters<typeof stripe.paymentIntents.create>[0] = {
      amount: totalAmountInCents,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata,
    };

    if (isPartnerEvent && stripeAccountId) {
      intentParams.application_fee_amount = platformFeeCents;
      intentParams.transfer_data = {
        destination: stripeAccountId,
      };
    }

    const paymentIntent = await stripe.paymentIntents.create(intentParams);

    return NextResponse.json({
      ok: true,
      clientSecret: paymentIntent.client_secret,
      amount: totalAmountInCents,
      currency,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error("Erro PaymentIntent:", err);
    return NextResponse.json(
      { ok: false, error: "Erro ao criar PaymentIntent." },
      { status: 500 },
    );
  }
}
