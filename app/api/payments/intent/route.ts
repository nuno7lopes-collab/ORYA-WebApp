// app/api/payments/intent/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { stripe } from "@/lib/stripeClient";
import { getPlatformFees } from "@/lib/platformSettings";
import { shouldNotify, createNotification } from "@/lib/notifications";
import { NotificationType, PaymentEventSource, type FeeMode } from "@prisma/client";
import { paymentScenarioSchema, type PaymentScenario } from "@/lib/paymentScenario";
import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { computePromoDiscountCents } from "@/lib/promoMath";
import { computePricing } from "@/lib/pricing";
import {
  checkoutMetadataSchema,
  createPurchaseId,
  normalizeItemsForMetadata,
} from "@/lib/checkoutSchemas";
import { resolveOwner } from "@/lib/ownership/resolveOwner";

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
  paymentScenario?: string | null;
  idempotencyKey?: string | null;
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

async function upsertPadelPlayerProfile(params: {
  organizerId: number;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  gender?: string | null;
  level?: string | null;
}) {
  const { organizerId, fullName, email, phone, gender, level } = params;
  if (!fullName.trim()) return;
  const emailClean = email?.trim().toLowerCase() || null;
  const phoneClean = phone?.trim() || null;

  try {
    if (emailClean) {
      await prisma.padelPlayerProfile.upsert({
        where: { organizerId_email: { organizerId, email: emailClean } },
        update: {
          fullName,
          phone: phoneClean ?? undefined,
          gender: gender ?? undefined,
          level: level ?? undefined,
        },
        create: {
          organizerId,
          fullName,
          email: emailClean,
          phone: phoneClean ?? undefined,
          gender: gender ?? undefined,
          level: level ?? undefined,
        },
      });
    } else {
      await prisma.padelPlayerProfile.create({
        data: {
          organizerId,
          fullName,
          phone: phoneClean ?? undefined,
          gender: gender ?? undefined,
          level: level ?? undefined,
        },
      });
    }
  } catch (err) {
    console.warn("[padel] upsertPadelPlayerProfile falhou (ignorado)", err);
  }
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

    const { slug, items, contact, guest, promoCode: rawPromo, paymentScenario: rawScenario, idempotencyKey: bodyIdemKey } = body;
    const promoCodeInput = typeof rawPromo === "string" ? rawPromo.trim() : "";
    const idempotencyKeyHeader = req.headers.get("Idempotency-Key");
    const idempotencyKey = (bodyIdemKey || idempotencyKeyHeader || "").trim() || null;

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

    const ownerResolved = await resolveOwner({ sessionUserId: userId, guestEmail });
    const ownerForMetadata =
      ownerResolved.ownerUserId || ownerResolved.ownerIdentityId
        ? {
            ownerUserId: ownerResolved.ownerUserId ?? undefined,
            ownerIdentityId: ownerResolved.ownerIdentityId ?? undefined,
            emailNormalized: ownerResolved.emailNormalized ?? undefined,
          }
        : userId || guestEmail
          ? {
              userId: userId ?? undefined,
              guestEmail: guestEmail || undefined,
              guestName: guestName || undefined,
              guestPhone: guestPhone || undefined,
            }
          : undefined;

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
        fee_mode_override: string | null;
        organizer_id: number | null;
        org_type: string | null;
        org_stripe_account_id: string | null;
        org_stripe_charges_enabled: boolean | null;
        org_stripe_payouts_enabled: boolean | null;
        org_fee_mode: string | null;
        org_platform_fee_bps: number | null;
        org_platform_fee_fixed_cents: number | null;
        platform_fee_bps_override: number | null;
        platform_fee_fixed_cents_override: number | null;
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
        e.fee_mode_override,
        e.organizer_id,
        o.org_type AS org_type,
        o.stripe_account_id AS org_stripe_account_id,
        o.stripe_charges_enabled AS org_stripe_charges_enabled,
        o.stripe_payouts_enabled AS org_stripe_payouts_enabled,
        o.fee_mode AS org_fee_mode,
        o.platform_fee_bps AS org_platform_fee_bps,
        o.platform_fee_fixed_cents AS org_platform_fee_fixed_cents,
        e.platform_fee_bps_override,
        e.platform_fee_fixed_cents_override,
        e.payout_mode
      FROM app_v3.events e
      LEFT JOIN app_v3.organizers o ON o.id = e.organizer_id
      WHERE e.slug = ${slug}
      LIMIT 1;
    `;

    const event = eventRows[0];
    const eventOrganizerId = event?.organizer_id ?? null;

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

    const padelConfig = await prisma.padelTournamentConfig.findUnique({
      where: { eventId: event.id },
      select: { organizerId: true },
    });

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
    const ticketTypeMap = new Map<number, (typeof ticketTypes)[number]>(ticketTypes.map((t) => [t.id, t]));
    const lines: {
      ticketTypeId: number;
      name: string;
      quantity: number;
      unitPriceCents: number;
      currency: string;
      lineTotalCents: number;
    }[] = [];

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

      const lineTotal = priceCents * qty;
      lines.push({
        ticketTypeId,
        name: ticketType.name ?? "Bilhete",
        quantity: qty,
        unitPriceCents: priceCents,
        currency: ticketCurrency.toUpperCase(),
        lineTotalCents: lineTotal,
      });

      amountInCents += lineTotal;
      totalQuantity += qty;
    }

    if (!currency) {
      return NextResponse.json(
        { ok: false, error: "Moeda não determinada para o checkout." },
        { status: 400 },
      );
    }

    // Garantir que não temos montantes negativos após descontos
    if (amountInCents < 0) {
      amountInCents = 0;
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

      // Scope ao evento já garantido no filtro eventId; não há organizerId na tabela nova.
      if (promo.eventId && promo.eventId !== event.id) {
        throw new Error("PROMO_SCOPE");
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
      const minCartCents =
        promo.minTotalCents ?? (promo as { minCartValueCents?: number | null }).minCartValueCents ?? null;
      if (minCartCents !== null && minCartCents !== undefined && amountInCents < minCartCents) {
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

      discountCents = computePromoDiscountCents({
        promo: {
          type: promo.type as "PERCENTAGE" | "FIXED",
          value: promo.value,
          minQuantity: promo.minQuantity,
          minTotalCents: minCartCents ?? promo.minTotalCents,
        },
        totalQuantity,
        amountInCents,
      });
      promoCodeId = promo.id;
      amountInCents = amountInCents - discountCents;
    };

    if (promoCodeInput) {
      try {
        await validatePromo({ code: promoCodeInput });
        console.info("[analytics] promo_applied", {
          code: promoCodeInput,
          eventId: event.id,
          userId,
        });
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
          PROMO_SCOPE: "Este código não é válido para este evento/organização.",
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

    // Org da plataforma? (org_type = PLATFORM → não cobra application fee, usa conta da plataforma)
    const isPlatformOrg = (event.org_type || "").toString().toUpperCase() === "PLATFORM";

    const pricing = computePricing(amountInCents + discountCents, discountCents, {
      eventFeeModeOverride: (event.fee_mode_override as FeeMode | null) ?? undefined,
      eventFeeMode: (event.fee_mode as FeeMode | null) ?? undefined,
      organizerFeeMode: (event.org_fee_mode as FeeMode | null) ?? undefined,
      platformDefaultFeeMode: "ADDED",
      eventPlatformFeeBpsOverride: event.platform_fee_bps_override,
      eventPlatformFeeFixedCentsOverride: event.platform_fee_fixed_cents_override,
      organizerPlatformFeeBps: event.org_platform_fee_bps,
      organizerPlatformFeeFixedCents: event.org_platform_fee_fixed_cents,
      platformDefaultFeeBps: defaultFeeBps,
      platformDefaultFeeFixedCents: defaultFeeFixed,
      isPlatformOrg,
    });
    const platformFeeCents = pricing.platformFeeCents;

    // Stripe account rules
    let stripeAccountId = event.org_stripe_account_id ?? null;
    const payoutModeRaw = (event.payout_mode || "ORGANIZER").toString().toUpperCase();
    const organizerStripeReady = Boolean(event.org_stripe_charges_enabled && event.org_stripe_payouts_enabled);

    // Plataforma ORYA: usa conta da plataforma, não exige Connect
    if (isPlatformOrg || payoutModeRaw === "PLATFORM") {
      stripeAccountId = null;
    } else {
      // Organizadores externos: exigem Connect pronto
      if (!stripeAccountId || !organizerStripeReady) {
        return NextResponse.json(
          {
            ok: false,
            code: "ORGANIZER_STRIPE_NOT_CONNECTED",
            message: "Pagamentos estão desativados porque o organizador ainda não ligou a Stripe.",
            retryable: false,
            nextAction: "CONNECT_STRIPE",
          },
          { status: 409 },
        );
      }
    }

    const isPartnerEvent = Boolean(stripeAccountId);

    const totalAmountInCents = pricing.totalCents;

    if (totalAmountInCents < 0 || platformFeeCents > Math.max(totalAmountInCents, 0)) {
      return NextResponse.json(
        { ok: false, error: "Montante total inválido para este checkout." },
        { status: 400 },
      );
    }

    const purchaseId = createPurchaseId();
    const normalizedItems = normalizeItemsForMetadata(
      lines.map((line) => ({
        ticketTypeId: line.ticketTypeId,
        quantity: line.quantity,
        unitPriceCents: line.unitPriceCents,
        currency: line.currency,
      })),
    );

    const parsedScenario = paymentScenarioSchema.safeParse(
      typeof rawScenario === "string" ? rawScenario.toUpperCase() : rawScenario,
    );
    const requestedScenario: PaymentScenario | null = parsedScenario.success ? parsedScenario.data : null;

    const paymentScenario: PaymentScenario =
      totalAmountInCents === 0
        ? "FREE_CHECKOUT"
        : requestedScenario
          ? requestedScenario
          : "SINGLE";

    const scenarioAdjusted: PaymentScenario = (() => {
      if (paymentScenario === "GROUP_FULL") return "GROUP_FULL";
      if (paymentScenario === "GROUP_SPLIT") return "GROUP_SPLIT";
      if (paymentScenario === "RESALE" || paymentScenario === "SUBSCRIPTION") return paymentScenario;
      if (paymentScenario === "FREE_CHECKOUT") return "FREE_CHECKOUT";
      return "SINGLE";
    })();
    const effectiveDedupeKey = idempotencyKey ?? purchaseId;

    // Idempotência API: se houver payment_event com dedupeKey=idempotencyKey, devolve mesma resposta
    if (idempotencyKey) {
      const existing = await prisma.paymentEvent.findFirst({
        where: { dedupeKey: idempotencyKey },
        select: { stripePaymentIntentId: true, purchaseId: true },
      });
      if (existing) {
        return NextResponse.json(
          {
            ok: true,
            reused: true,
            paymentIntentId: existing.stripePaymentIntentId ?? undefined,
            purchaseId: existing.purchaseId ?? undefined,
          },
          { status: 200 },
        );
      }
    }

    const metadataValidation = checkoutMetadataSchema.safeParse({
      paymentScenario: scenarioAdjusted,
      purchaseId,
      items: normalizedItems,
      eventId: event.id,
      eventSlug: event.slug,
      owner: ownerForMetadata,
    });

    if (!metadataValidation.success) {
      console.warn("[payments/intent] Metadata inválida", metadataValidation.error.format());
      return NextResponse.json(
        {
          ok: false,
          error: "Metadata inválida para checkout.",
          code: "INVALID_METADATA",
          retryable: false,
        },
        { status: 400 },
      );
    }

    // --------------------------
    // CHECKOUT GRATUITO (0 €)
    // --------------------------
    if (totalAmountInCents === 0) {
      if (!userId || !profile?.username?.trim()) {
        return NextResponse.json(
          {
            ok: false,
            error: "Falta terminar o perfil (username) para concluir eventos gratuitos.",
            code: "USERNAME_REQUIRED_FOR_FREE",
            retryable: false,
            nextAction: "NONE",
          },
          { status: 403 },
        );
      }

      // Idempotência anti-double click e 1 por user: se já existe bilhete para este evento, recusar
      const existingFreeTicket = await prisma.ticket.findFirst({
        where: { eventId: event.id, userId, pricePaid: 0 },
        select: { id: true },
      });
      if (existingFreeTicket) {
        return NextResponse.json(
          {
            ok: false,
            error: "Já tens uma inscrição gratuita neste evento.",
            code: "FREE_ALREADY_CLAIMED",
            retryable: false,
            nextAction: "NONE",
          },
          { status: 409 },
        );
      }

      // Cooldown simples: bloquear se já fez free checkout neste evento nos últimos 10 minutos
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const recentFree = await prisma.paymentEvent.findFirst({
        where: {
          eventId: event.id,
          userId,
          amountCents: 0,
          purchaseId: { not: null },
          createdAt: { gte: tenMinutesAgo },
        },
        select: { purchaseId: true },
      });
      if (recentFree) {
        return NextResponse.json(
          {
            ok: false,
            error: "Já fizeste uma inscrição gratuita há poucos minutos. Aguarda antes de tentar novamente.",
            code: "FREE_RATE_LIMIT",
            retryable: true,
            nextAction: "NONE",
            purchaseId: recentFree.purchaseId,
          },
          { status: 429 },
        );
      }

      let createdTicketsCount = 0;
      await prisma.$transaction(async (tx) => {
        const saleSummary = await tx.saleSummary.create({
          data: {
            paymentIntentId: purchaseId,
            eventId: event.id,
            userId: ownerResolved.ownerUserId ?? userId,
            purchaseId,
            ownerUserId: ownerResolved.ownerUserId ?? null,
            ownerIdentityId: ownerResolved.ownerIdentityId ?? null,
            promoCodeId: promoCodeId ? Number(promoCodeId) : null,
            subtotalCents: pricing.subtotalCents,
            discountCents: discountCents,
            platformFeeCents: 0,
            stripeFeeCents: 0,
            totalCents: 0,
            netCents: 0,
            feeMode: pricing.feeMode,
            currency: currency.toUpperCase(),
          },
        });

        for (const line of lines) {
          const ticketType = ticketTypeMap.get(line.ticketTypeId);
          if (!ticketType) continue;

          // Stock check novamente por segurança
          if (ticketType.totalQuantity !== null && ticketType.totalQuantity !== undefined) {
            const remaining = ticketType.totalQuantity - ticketType.soldQuantity;
            if (remaining <= 0 || line.quantity > remaining) {
              throw new Error("Sem stock suficiente para um dos bilhetes.");
            }
          }

          const grossCents = line.unitPriceCents * line.quantity;
          const discountPerUnitCents = line.quantity > 0 ? Math.floor(grossCents / line.quantity) : 0;

          await tx.saleLine.create({
            data: {
              saleSummaryId: saleSummary.id,
              eventId: event.id,
              ticketTypeId: line.ticketTypeId,
              promoCodeId: promoCodeId ? Number(promoCodeId) : null,
              quantity: line.quantity,
              unitPriceCents: line.unitPriceCents,
              discountPerUnitCents,
              grossCents,
              netCents: 0,
              platformFeeCents: 0,
            },
          });

          for (let i = 0; i < line.quantity; i++) {
            const token = crypto.randomUUID();
            await tx.ticket.create({
              data: {
                userId: ownerResolved.ownerUserId ?? null,
                ownerUserId: ownerResolved.ownerUserId ?? null,
                ownerIdentityId: ownerResolved.ownerIdentityId ?? null,
                eventId: event.id,
                ticketTypeId: ticketType.id,
                status: "ACTIVE",
                purchasedAt: new Date(),
                qrSecret: token,
                pricePaid: 0,
                currency: (ticketType.currency || "EUR").toUpperCase(),
                platformFeeCents: 0,
                totalPaidCents: 0,
                stripePaymentIntentId: purchaseId,
              },
            });
            createdTicketsCount += 1;
          }

          await tx.ticketType.update({
            where: { id: ticketType.id },
            data: { soldQuantity: { increment: line.quantity } },
          });
        }

        await tx.paymentEvent.create({
          data: {
            stripePaymentIntentId: purchaseId,
            status: "OK",
            purchaseId,
            source: PaymentEventSource.API,
            dedupeKey: effectiveDedupeKey,
            attempt: 1,
            eventId: event.id,
            userId,
            amountCents: 0,
            platformFeeCents: 0,
            stripeFeeCents: 0,
            mode: event.is_test ? "TEST" : "LIVE",
            isTest: Boolean(event.is_test),
          },
        });
      });

      if (padelConfig) {
        const fullName = userData?.user?.user_metadata?.full_name || profile?.fullName || "Jogador Padel";
        const emailToSave = userData?.user?.email || profile?.email || null;
        const phoneToSave = userData?.user?.phone || contact || profile?.contactPhone || null;
        await upsertPadelPlayerProfile({
          organizerId: padelConfig.organizerId,
          fullName,
          email: emailToSave,
          phone: phoneToSave,
        });
      }

      // Notificação para o organizer (se existir) — respeita prefs
      if (eventOrganizerId) {
        try {
          const ownerMembers = await prisma.organizerMember.findMany({
            where: { organizerId: eventOrganizerId, role: { in: ["OWNER", "CO_OWNER", "ADMIN"] } },
            select: { userId: true },
          });
          const uniqOwners = Array.from(new Set(ownerMembers.map((m) => m.userId)));
          await Promise.all(
            uniqOwners.map((uid) =>
              (async () => {
                if (!(await shouldNotify(uid, NotificationType.EVENT_SALE))) return;
                await createNotification({
                  userId: uid,
                  type: NotificationType.EVENT_SALE,
                  title: "Nova reserva gratuita",
                  body: `Recebeste uma reserva para ${event.title}.`,
                  ctaUrl: `/organizador?tab=sales&eventId=${event.id}`,
                  ctaLabel: "Ver vendas",
                  payload: { eventId: event.id, title: event.title },
                });
              })(),
            ),
          );
        } catch (err) {
          console.warn("[notification][free_checkout] falhou", err);
        }
      }

      return NextResponse.json({
        ok: true,
        freeCheckout: true,
        purchaseId,
        paymentScenario,
        ticketsCreated: createdTicketsCount,
        amount: 0,
        currency: currency.toUpperCase(),
        discountCents,
        breakdown: {
          lines,
          subtotalCents: pricing.subtotalCents,
          feeMode: pricing.feeMode,
          platformFeeCents: pricing.platformFeeCents,
          totalCents: 0,
          currency: currency.toUpperCase(),
        },
      });
    }

    const metadata: Record<string, string> = {
      eventId: String(event.id),
      eventSlug: String(event.slug),
      purchaseId,
      items: JSON.stringify(normalizedItems),
      paymentScenario: scenarioAdjusted,
      baseAmountCents: String(pricing.subtotalCents - discountCents),
      discountCents: String(discountCents),
      platformFeeMode: pricing.feeMode,
      platformFeeBps: String(pricing.feeBpsApplied),
      platformFeeFixedCents: String(pricing.feeFixedApplied),
      platformFeeCents: String(pricing.platformFeeCents),
      contact: contact?.trim() ?? "",
      stripeAccountId: stripeAccountId ?? "orya",
      guestName: guestName ?? "",
      guestEmail: guestEmail ?? "",
      guestPhone: guestPhone ?? "",
      mode: guestName && guestEmail && !userId ? "GUEST" : "USER",
      promoCode: promoCodeId ? String(promoCodeId) : "",
      promoCodeRaw: promoCodeInput,
      totalQuantity: String(totalQuantity),
      breakdown: JSON.stringify({
        lines,
        subtotalCents: pricing.subtotalCents,
        feeMode: pricing.feeMode,
        platformFeeCents: pricing.platformFeeCents,
        totalCents: pricing.totalCents,
        currency: currency.toUpperCase(),
      }),
    };

    if (userId) {
      metadata.userId = userId;
    }
    if (effectiveDedupeKey) metadata.idempotencyKey = effectiveDedupeKey;
    if (ownerResolved.ownerUserId) metadata.ownerUserId = ownerResolved.ownerUserId;
    if (ownerResolved.ownerIdentityId) metadata.ownerIdentityId = ownerResolved.ownerIdentityId;
    if (ownerResolved.emailNormalized) metadata.emailNormalized = ownerResolved.emailNormalized;

    const allowedPaymentMethods = ["card", "link", "mb_way"] as const;

    const intentParams: Parameters<typeof stripe.paymentIntents.create>[0] = {
      amount: totalAmountInCents,
      currency,
      payment_method_types: [...allowedPaymentMethods],
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
      if (!isPlatformOrg) {
        intentParams.application_fee_amount = platformFeeCents;
      }
    }

    const paymentIntent = await stripe.paymentIntents.create(intentParams);

    if (padelConfig) {
      const fullName = userData?.user?.user_metadata?.full_name || guestName || "Jogador Padel";
      const emailToSave = userData?.user?.email || guestEmail || null;
      const phoneToSave = userData?.user?.phone || contact || guestPhone || null;
      await upsertPadelPlayerProfile({
        organizerId: padelConfig.organizerId,
        fullName,
        email: emailToSave,
        phone: phoneToSave,
      });
    }

    return NextResponse.json({
      ok: true,
      clientSecret: paymentIntent.client_secret,
      amount: totalAmountInCents,
      currency,
      discountCents,
      paymentIntentId: paymentIntent.id,
      purchaseId,
      paymentScenario: scenarioAdjusted,
      breakdown: {
        lines,
        subtotalCents: pricing.subtotalCents,
        feeMode: pricing.feeMode,
        platformFeeCents: pricing.platformFeeCents,
        totalCents: totalAmountInCents,
        currency: currency.toUpperCase(),
      },
    });
  } catch (err) {
    console.error("Erro PaymentIntent:", err);
    return NextResponse.json(
      { ok: false, error: "Erro ao criar PaymentIntent." },
      { status: 500 },
    );
  }
}
