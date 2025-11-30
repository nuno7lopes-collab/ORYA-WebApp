import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripeClient";
import { getPlatformFees } from "@/lib/platformSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckoutItem = {
  ticketTypeId?: number;
  ticketId?: number;
  quantity: number;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Body inválido." },
        { status: 400 },
      );
    }

    const { slug, items } = body as {
      slug?: string;
      items?: CheckoutItem[];
    };

    if (!slug || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Dados insuficientes para checkout." },
        { status: 400 },
      );
    }

    // 1️⃣ User autenticado (Supabase)
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado." },
        { status: 401 },
      );
    }

  // 2️⃣ Evento + organizer
  const event = await prisma.event.findUnique({
    where: { slug },
    include: { organizer: true },
  });

    if (!event) {
      return NextResponse.json(
        { ok: false, error: "Evento não encontrado." },
        { status: 404 },
      );
    }
    const profile = await prisma.profile.findUnique({ where: { id: user.id } });
    const isAdmin = Array.isArray(profile?.roles) ? profile.roles.includes("admin") : false;
    if (event.isTest && !isAdmin) {
      return NextResponse.json(
        { ok: false, error: "Evento não disponível." },
        { status: 404 },
      );
    }

    if (event.type !== "ORGANIZER_EVENT" || event.status !== "PUBLISHED") {
      return NextResponse.json(
        { ok: false, error: "Evento inválido para compra." },
        { status: 400 },
      );
    }

    const requestedIds = items
      .map((item) =>
        typeof item.ticketTypeId === "number"
          ? item.ticketTypeId
          : Number(item.ticketId),
      )
      .filter((id) => !Number.isNaN(id));

    const ticketTypesDB = await prisma.ticketType.findMany({
      where: {
        eventId: event.id,
        id: { in: requestedIds },
      },
    });

    // 3️⃣ Validar items + calcular montante em cêntimos
    let amountInCents = 0;
    const itemsForMetadata: {
      ticketId: number;
      ticketTypeId: number;
      quantity: number;
    }[] = [];

    for (const item of items) {
      const idRaw =
        typeof item.ticketTypeId === "number"
          ? item.ticketTypeId
          : Number(item.ticketId);

      const id = Number.isFinite(idRaw) ? Number(idRaw) : NaN;

      const dbType = ticketTypesDB.find((t) => t.id === id);

      if (!dbType) {
        return NextResponse.json(
          { ok: false, error: `Bilhete inválido: ${id}` },
          { status: 400 },
        );
      }

      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty <= 0) {
        return NextResponse.json(
          { ok: false, error: "Quantidade inválida." },
          { status: 400 },
        );
      }

      const remaining =
        dbType.totalQuantity == null
          ? Infinity
          : dbType.totalQuantity - dbType.soldQuantity;

      if (qty > remaining && remaining !== Infinity) {
        return NextResponse.json(
          { ok: false, error: "Stock insuficiente para o bilhete." },
          { status: 400 },
        );
      }

      const priceCents = Number(dbType.price);
      if (Number.isNaN(priceCents)) {
        return NextResponse.json(
          { ok: false, error: "Preço inválido no servidor." },
          { status: 500 },
        );
      }

      amountInCents += priceCents * qty;
      itemsForMetadata.push({ ticketId: id, ticketTypeId: id, quantity: qty });
    }

    if (amountInCents <= 0) {
      return NextResponse.json(
        { ok: false, error: "Montante total inválido." },
        { status: 400 },
      );
    }

    const organizer = event.organizer;

    if (!organizer || organizer.status !== "ACTIVE") {
      return NextResponse.json(
        { ok: false, error: "Organizador inativo ou não encontrado." },
        { status: 400 },
      );
    }

    if (!organizer.stripeAccountId) {
      return NextResponse.json(
        { ok: false, error: "Organizador sem conta Stripe ligada." },
        { status: 400 },
      );
    }

    if (!organizer.stripeChargesEnabled) {
      return NextResponse.json(
        { ok: false, error: "Conta Stripe do organizador ainda não está ativa." },
        { status: 400 },
      );
    }

    const organizerProfile = await prisma.profile.findUnique({
      where: { id: organizer.userId },
      select: { roles: true },
    });
    const isOrganizerAdmin =
      Array.isArray(organizerProfile?.roles) && organizerProfile.roles.includes("admin");

    const { feeBps: defaultFeeBps, feeFixedCents: defaultFeeFixed } = await getPlatformFees();
    const feeModeRaw = (event.organizer?.feeMode ?? event.feeMode ?? "ON_TOP").toString();
    const feeMode = feeModeRaw === "ADDED" ? "ON_TOP" : (feeModeRaw as "ON_TOP" | "INCLUDED");

    const platformFeeBps = isOrganizerAdmin
      ? 0
      : event.organizer?.platformFeeBps ?? defaultFeeBps;
    const platformFeeFixedCents = isOrganizerAdmin
      ? 0
      : event.organizer?.platformFeeFixedCents ?? defaultFeeFixed;

    const platformFeeCents = Math.max(
      0,
      Math.round((amountInCents * platformFeeBps) / 10_000) +
        platformFeeFixedCents,
    );

    const totalAmountInCents =
      feeMode === "ON_TOP" ? amountInCents + platformFeeCents : amountInCents;

    if (totalAmountInCents <= 0) {
      return NextResponse.json(
        { ok: false, error: "Montante total inválido." },
        { status: 400 },
      );
    }

    // 4️⃣ Criar PaymentIntent (Stripe Connect com destination charges)
    const paymentIntentParams: Parameters<typeof stripe.paymentIntents.create>[0] = {
      amount: totalAmountInCents,
      currency: "eur",
      automatic_payment_methods: { enabled: true },
      transfer_data: {
        destination: organizer.stripeAccountId,
      },
      on_behalf_of: organizer.stripeAccountId,
      metadata: {
        source: "orya_checkout_v2",
        userId: user.id,
        eventId: String(event.id),
        eventSlug: slug,
        organizerId: String(organizer.id),
        feeMode,
        platformFeeBps: String(platformFeeBps),
        platformFeeFixedCents: String(platformFeeFixedCents),
        platformFeeCents: String(platformFeeCents),
        baseAmountCents: String(amountInCents),
        items: JSON.stringify(itemsForMetadata),
        itemsJson: JSON.stringify(itemsForMetadata),
      },
    };

    if (!isOrganizerAdmin) {
      paymentIntentParams.application_fee_amount = platformFeeCents;
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    return NextResponse.json({
      ok: true,
      clientSecret: paymentIntent.client_secret,
      amount: totalAmountInCents,
      currency: "eur",
    });
  } catch (err) {
    console.error("Erro no checkout:", err);
    return NextResponse.json(
      { ok: false, error: "Erro inesperado no checkout." },
      { status: 500 },
    );
  }
}
