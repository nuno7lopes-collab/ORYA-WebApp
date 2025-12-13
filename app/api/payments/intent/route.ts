// app/api/payments/intent/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { stripe } from "@/lib/stripeClient";
import { getPlatformFees } from "@/lib/platformSettings";
import { shouldNotify, createNotification } from "@/lib/notifications";
import { NotificationType } from "@prisma/client";
import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { computePromoDiscountCents } from "@/lib/promoMath";
import { computePricing } from "@/lib/pricing";

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

      discountCents = computePromoDiscountCents({
        promo: {
          type: promo.type as "PERCENTAGE" | "FIXED",
          value: promo.value,
          minQuantity: promo.minQuantity,
          minTotalCents: promo.minTotalCents,
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

    // Org da plataforma? (org_type = PLATFORM → não cobra application fee)
    const isPlatformOrg = (event.org_type || "").toString().toUpperCase() === "PLATFORM";

    const pricing = computePricing(amountInCents + discountCents, discountCents, {
      eventFeeModeOverride: event.fee_mode_override as any,
      eventFeeMode: event.fee_mode as any,
      organizerFeeMode: event.org_fee_mode as any,
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

    let stripeAccountId = event.org_stripe_account_id ?? null;
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
      // Bloqueia checkout se o organizer quis receber diretamente mas não tem Stripe pronto
      return NextResponse.json(
        {
          ok: false,
          error: "Este evento não pode aceitar pagamentos enquanto a conta Stripe do organizador não estiver ligada.",
          code: "ORGANIZER_STRIPE_REQUIRED",
        },
        { status: 409 },
      );
    }
    // Se payoutMode for PLATFORM por falta de Stripe, seguimos com a conta da plataforma
    if (payoutMode === "PLATFORM") {
      stripeAccountId = null;
    }

    const isPartnerEvent = payoutMode === "ORGANIZER" && Boolean(stripeAccountId);

    const platformFeeCents = pricing.platformFeeCents;
    const totalAmountInCents = pricing.totalCents;

    if (totalAmountInCents < 0 || platformFeeCents > Math.max(totalAmountInCents, 0)) {
      return NextResponse.json(
        { ok: false, error: "Montante total inválido para este checkout." },
        { status: 400 },
      );
    }

    // --------------------------
    // CHECKOUT GRATUITO (0 €)
    // --------------------------
    if (totalAmountInCents === 0) {
      let createdTicketsCount = 0;
      await prisma.$transaction(async (tx) => {
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

          for (let i = 0; i < line.quantity; i++) {
            const token = crypto.randomUUID();
            const ticket = await tx.ticket.create({
              data: {
                userId,
                eventId: event.id,
                ticketTypeId: ticketType.id,
                status: "ACTIVE",
                purchasedAt: new Date(),
                qrSecret: token,
                pricePaid: 0,
                currency: (ticketType.currency || "EUR").toUpperCase(),
                platformFeeCents: 0,
                totalPaidCents: 0,
                stripePaymentIntentId: null,
              },
            });

            if (!userId && guestEmail) {
              await tx.guestTicketLink.upsert({
                where: { ticketId: ticket.id },
                update: {
                  guestEmail,
                  guestName: guestName || "Convidado",
                  guestPhone: guestPhone || null,
                },
                create: {
                  ticketId: ticket.id,
                  guestEmail,
                  guestName: guestName || "Convidado",
                  guestPhone: guestPhone || null,
                },
              });
            }
            createdTicketsCount += 1;
          }

          await tx.ticketType.update({
            where: { id: ticketType.id },
            data: { soldQuantity: { increment: line.quantity } },
          });
        }
      });

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

      // Notificação para o organizer (se existir) — respeita prefs
      if (event.organizerId) {
        try {
          const ownerMembers = await prisma.organizerMember.findMany({
            where: { organizerId: event.organizerId, role: { in: ["OWNER", "CO_OWNER", "ADMIN"] } },
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

    const metadata = {
      eventId: String(event.id),
      eventSlug: String(event.slug),
      userId: userId ? String(userId) : "",
      items: JSON.stringify(items),
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
