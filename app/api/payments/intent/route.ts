// app/api/payments/intent/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { stripe } from "@/lib/stripeClient";
import { getPlatformFees } from "@/lib/platformSettings";
import { parsePhoneNumberFromString } from "libphonenumber-js/min";

type CheckoutItem = {
  ticketId: string;
  quantity: number;
};

type Guest = {
  name?: string;
  email?: string;
  phone?: string | null;
};

function isValidEmail(email: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

type Body = {
  slug?: string;
  items?: CheckoutItem[];
  contact?: string;
  guest?: Guest;
  promoCode?: string | null;
};

function normalizePhone(phone: string | null | undefined, defaultCountry: string = "PT") {
  if (!phone) return null;
  const cleaned = phone.trim();
  if (!cleaned) return null;

  const parsed = parsePhoneNumberFromString(cleaned, defaultCountry);
  if (parsed && parsed.isPossible() && parsed.isValid()) {
    return parsed.number; // E.164
  }

  // fallback: regex simples para PT
  const regexPT = /^(?:\+351)?9[1236]\d{7}$/;
  if (regexPT.test(cleaned)) {
    const digits = cleaned.replace(/[^\d]/g, "");
    return digits.startsWith("351") ? `+${digits}` : `+351${digits}`;
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null;

    if (!body || !body.slug || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Dados inválidos." },
        { status: 400 },
      );
    }

    const { slug, items, contact, guest, promoCode: rawPromo } = body;
    const promoCodeInput = typeof rawPromo === "string" ? rawPromo.trim() : "";

    // Validar que o evento existe (fetch raw para evitar issues com enum legacy "ADDED")
    // Autenticação do utilizador
    const supabase = await createSupabaseServer();
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id ?? null;

    const guestEmailRaw = guest?.email?.trim() ?? "";
    const guestName = guest?.name?.trim() ?? "";
    const guestPhoneRaw = guest?.phone?.trim() ?? "";
    const guestPhone = guestPhoneRaw ? normalizePhone(guestPhoneRaw) : "";
    const guestEmail = guestEmailRaw && isValidEmail(guestEmailRaw) ? guestEmailRaw : "";

    if (!userId) {
      if (!guestEmail || !guestName) {
        return NextResponse.json(
          { ok: false, error: "Precisas de iniciar sessão ou preencher nome e email para convidado." },
          { status: 400 },
        );
      }
      if (!isValidEmail(guestEmailRaw)) {
        return NextResponse.json(
          { ok: false, error: "Email inválido para checkout como convidado." },
          { status: 400 },
        );
      }
      if (guestPhoneRaw && !guestPhone) {
        return NextResponse.json(
          { ok: false, error: "Telemóvel inválido. Usa formato PT: 9XXXXXXXX ou +3519XXXXXXXX." },
          { status: 400 },
        );
      }
    }

    const eventRows = await prisma.$queryRaw<
      {
        id: number;
        slug: string;
        title: string;
        status: string;
        type: string;
        is_deleted: boolean;
        is_test: boolean;
        ends_at: Date | null;
        fee_mode: string | null;
        organizer_id: number | null;
        org_user_id: string | null;
        org_stripe_account_id: string | null;
        org_stripe_charges_enabled: boolean | null;
        org_stripe_payouts_enabled: boolean | null;
        org_fee_mode: string | null;
        org_platform_fee_bps: number | null;
        org_platform_fee_fixed_cents: number | null;
        payout_mode: string | null;
      }[]
    >`
      SELECT
        e.id,
        e.slug,
        e.title,
        e.status,
        e.type,
        e.is_deleted,
        e.is_test,
        e.ends_at,
        e.fee_mode,
        e.organizer_id,
        o.user_id AS org_user_id,
        o.stripe_account_id AS org_stripe_account_id,
        o.stripe_charges_enabled AS org_stripe_charges_enabled,
        o.stripe_payouts_enabled AS org_stripe_payouts_enabled,
        o.fee_mode AS org_fee_mode,
        o.platform_fee_bps AS org_platform_fee_bps,
        o.platform_fee_fixed_cents AS org_platform_fee_fixed_cents,
        e.payout_mode
      FROM app_v3.events e
      LEFT JOIN app_v3.organizers o ON o.id = e.organizer_id
      WHERE e.slug = ${slug}
      LIMIT 1;
    `;

    const event = eventRows[0];

    if (!event) {
      return NextResponse.json({ ok: false, error: "Evento não encontrado." }, { status: 404 });
    }
    const profile = userId
      ? await prisma.profile.findUnique({ where: { id: userId } })
      : null;
    const isAdmin = Array.isArray(profile?.roles) ? profile.roles.includes("admin") : false;
    if (event.is_test && !isAdmin) {
      return NextResponse.json({ ok: false, error: "Evento não disponível." }, { status: 404 });
    }

    // Atualizar contacto no perfil se fornecido (normalizado)
    if (userId && contact && contact.trim()) {
      const normalizedContact = normalizePhone(contact.trim());
      if (normalizedContact) {
        await prisma.profile.update({
          where: { id: userId },
          data: { contactPhone: normalizedContact },
        });
      }
    }

    if (event.is_deleted || event.status !== "PUBLISHED" || event.type !== "ORGANIZER_EVENT") {
      return NextResponse.json({ ok: false, error: "Evento indisponível para compra." }, { status: 400 });
    }

    if (event.ends_at && event.ends_at < new Date()) {
      return NextResponse.json({ ok: false, error: "Vendas encerradas: evento já terminou." }, { status: 400 });
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
    let totalQuantity = 0;
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

      // limite agora é apenas o stock disponível; o cap de 6 foi removido

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
      totalQuantity += qty;
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

    const promoRepo = (prisma as unknown as {
      promoCode?: {
        findFirst: typeof prisma.promoCode.findFirst;
        findMany: typeof prisma.promoCode.findMany;
      };
    }).promoCode;
    // Promo code (apenas validação; redemptions serão registados no webhook após sucesso)
    let discountCents = 0;
    let promoCodeId: number | null = null;
    const nowDate = new Date();

    const validatePromo = async (codeFilter: { id?: number; code?: string }) => {
      if (!promoRepo) {
        throw new Error("PROMO_UNAVAILABLE");
      }
      const promo = await prisma.promoCode.findFirst({
        where: {
          ...(codeFilter.id ? { id: codeFilter.id } : {}),
          ...(codeFilter.code
            ? { code: { equals: codeFilter.code, mode: "insensitive" } }
            : {}),
          active: true,
          OR: [{ eventId: event.id }, { eventId: null }],
        },
      });

      if (!promo) {
        throw new Error("PROMO_INVALID");
      }

      if (promo.validFrom && promo.validFrom > nowDate) {
        throw new Error("PROMO_NOT_ACTIVE");
      }
      if (promo.validUntil && promo.validUntil < nowDate) {
        throw new Error("PROMO_EXPIRED");
      }
      if (
        promo.minQuantity !== null &&
        promo.minQuantity !== undefined &&
        totalQuantity < promo.minQuantity
      ) {
        throw new Error("PROMO_MIN_QTY");
      }
      if (
        promo.minTotalCents !== null &&
        promo.minTotalCents !== undefined &&
        amountInCents < promo.minTotalCents
      ) {
        throw new Error("PROMO_MIN_TOTAL");
      }

      // Contagem de redemptions passadas
      const totalUses = await prisma.promoRedemption.count({
        where: { promoCodeId: promo.id },
      });
      if (promo.maxUses !== null && promo.maxUses !== undefined && totalUses >= promo.maxUses) {
        throw new Error("PROMO_MAX_USES");
      }

      if (promo.perUserLimit !== null && promo.perUserLimit !== undefined) {
        if (userId) {
          const userUses = await prisma.promoRedemption.count({
            where: { promoCodeId: promo.id, userId },
          });
          if (userUses >= promo.perUserLimit) {
            throw new Error("PROMO_USER_LIMIT");
          }
        } else if (guestEmail) {
          const guestUses = await prisma.promoRedemption.count({
            where: { promoCodeId: promo.id, guestEmail: { equals: guestEmail, mode: "insensitive" } },
          });
          if (guestUses >= promo.perUserLimit) {
            throw new Error("PROMO_USER_LIMIT");
          }
        }
      }

      if (promo.type === "PERCENTAGE") {
        discountCents = Math.floor((amountInCents * promo.value) / 10_000);
      } else {
        discountCents = Math.max(0, promo.value);
      }
      discountCents = Math.min(discountCents, amountInCents);
      promoCodeId = promo.id;
      amountInCents = amountInCents - discountCents;
    };

    if (promoCodeInput) {
      try {
        await validatePromo({ code: promoCodeInput });
      } catch (err) {
        const msg = (err as Error).message;
        const map: Record<string, string> = {
          PROMO_INVALID: "Código promocional inválido ou inativo.",
          PROMO_NOT_ACTIVE: "Código ainda não está ativo.",
          PROMO_EXPIRED: "Código expirado.",
          PROMO_MAX_USES: "Código já atingiu o limite de utilizações.",
          PROMO_USER_LIMIT: "Já utilizaste este código o número máximo de vezes.",
          PROMO_MIN_QTY: "Quantidade insuficiente para aplicar este código.",
          PROMO_MIN_TOTAL: "Valor mínimo não atingido para aplicar este código.",
          PROMO_UNAVAILABLE: "Descontos temporariamente indisponíveis.",
        };
        return NextResponse.json(
          { ok: false, error: map[msg] ?? "Código promocional inválido." },
          { status: 400 },
        );
      }
    } else if (promoRepo) {
      // Auto-apply: escolher o melhor desconto elegível (event/global, autoApply=true)
      const autoPromos = await promoRepo.findMany({
        where: {
          autoApply: true,
          active: true,
          OR: [{ eventId: event.id }, { eventId: null }],
          NOT: [
            {
              validFrom: { gt: nowDate },
            },
          ],
        },
      });

      let best: { promoId: number; discount: number } | null = null;

      for (const promo of autoPromos) {
        discountCents = 0;
        promoCodeId = null;
        try {
          await validatePromo({ id: promo.id });
          const d = discountCents;
          if (!best || d > best.discount) {
            best = { promoId: promo.id, discount: d };
          }
        } catch {
          // ignora promo não elegível
        }
      }

      if (best) {
        promoCodeId = best.promoId;
        discountCents = best.discount;
      }
    }

    const { feeBps: defaultFeeBps, feeFixedCents: defaultFeeFixed } = await getPlatformFees();

    const feeModeRaw = (event.org_fee_mode ?? event.fee_mode ?? "ON_TOP").toString();
    const feeMode = feeModeRaw === "ADDED" ? "ON_TOP" : (feeModeRaw as "ON_TOP" | "INCLUDED");

    // Organizer admin? (conta oficial)
    const orgProfile =
      event.org_user_id
        ? await prisma.profile.findUnique({ where: { id: event.org_user_id } })
        : null;
    const isOrganizerAdmin =
      Array.isArray(orgProfile?.roles) && orgProfile.roles.includes("admin");

    const stripeAccountId = event.org_stripe_account_id ?? null;
    const payoutModeRaw = (event.payout_mode || "ORGANIZER").toString().toUpperCase();
    // Hotfix: se não existir conta Connect, tratamos como payout na plataforma
    const payoutMode =
      payoutModeRaw === "PLATFORM" ? "PLATFORM" : stripeAccountId ? "ORGANIZER" : "PLATFORM";
    const paymentsStatus = stripeAccountId
      ? event.org_stripe_charges_enabled && event.org_stripe_payouts_enabled
        ? "READY"
        : "PENDING"
      : "NO_STRIPE";

    if (payoutMode === "ORGANIZER" && paymentsStatus !== "READY") {
      return NextResponse.json(
        {
          ok: false,
          code: "ORGANIZER_STRIPE_INACTIVE",
          error: "Ocorreu um problema com este evento. Tenta novamente mais tarde.",
        },
        { status: 409 },
      );
    }

    const isPartnerEvent = payoutMode === "ORGANIZER" && Boolean(stripeAccountId);

    const platformFeeBps = isOrganizerAdmin
      ? 0
      : event.org_platform_fee_bps ?? defaultFeeBps;
    const platformFeeFixedCents = isOrganizerAdmin
      ? 0
      : event.org_platform_fee_fixed_cents ?? defaultFeeFixed;

    const platformFeeCents = Math.max(
      0,
      Math.round((amountInCents * platformFeeBps) / 10_000) + platformFeeFixedCents,
    );

    const totalAmountInCents =
      feeMode === "ON_TOP" ? amountInCents + platformFeeCents : amountInCents;

    if (totalAmountInCents <= 0 || platformFeeCents > totalAmountInCents) {
      return NextResponse.json(
        { ok: false, error: "Montante total inválido para este checkout." },
        { status: 400 },
      );
    }

    const metadata = {
      eventId: String(event.id),
      eventSlug: String(event.slug),
      userId: userId ? String(userId) : "",
      items: JSON.stringify(items),
      baseAmountCents: String(amountInCents),
      discountCents: String(discountCents),
      platformFeeMode: feeMode,
      platformFeeBps: String(platformFeeBps),
      platformFeeFixedCents: String(platformFeeFixedCents),
      platformFeeCents: String(platformFeeCents),
      contact: contact?.trim() ?? "",
      stripeAccountId: stripeAccountId ?? "orya",
      guestName: guestName ?? "",
      guestEmail: guestEmail ?? "",
      guestPhone: guestPhone ?? "",
      mode: guestName && guestEmail && !userId ? "GUEST" : "USER",
      promoCode: promoCodeId ? String(promoCodeId) : "",
      promoCodeRaw: promoCodeInput,
      totalQuantity: String(totalQuantity),
    };

    const intentParams: Parameters<typeof stripe.paymentIntents.create>[0] = {
      amount: totalAmountInCents,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata,
    };

    if (!userId && guestEmail) {
      intentParams.receipt_email = guestEmail;
    }

    if (isPartnerEvent && stripeAccountId) {
      intentParams.transfer_data = {
        destination: stripeAccountId,
      };
      // Apenas aplica application_fee se não for organizer admin
      if (!isOrganizerAdmin) {
        intentParams.application_fee_amount = platformFeeCents;
      }
    }

    const paymentIntent = await stripe.paymentIntents.create(intentParams);

    return NextResponse.json({
      ok: true,
      clientSecret: paymentIntent.client_secret,
      amount: totalAmountInCents,
      currency,
      discountCents,
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
