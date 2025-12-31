// app/api/payments/intent/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { stripe } from "@/lib/stripeClient";
import { getPlatformFees, getStripeBaseFees } from "@/lib/platformSettings";
import { shouldNotify, createNotification } from "@/lib/notifications";
import {
  EntitlementStatus,
  EntitlementType,
  NotificationType,
  PadelPairingLifecycleStatus,
  PadelPairingPaymentStatus,
  PadelPairingSlotStatus,
  PaymentEventSource,
} from "@prisma/client";
import type { FeeMode } from "@prisma/client";
import { paymentScenarioSchema, type PaymentScenario } from "@/lib/paymentScenario";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";
import { computePromoDiscountCents } from "@/lib/promoMath";
import { computePricing } from "@/lib/pricing";
import { computeCombinedFees } from "@/lib/fees";
import { normalizeEmail } from "@/lib/utils/email";
import {
  checkoutMetadataSchema,
  normalizeItemsForMetadata,
} from "@/lib/checkoutSchemas";
import { resolveOwner } from "@/lib/ownership/resolveOwner";
import { enqueueOperation } from "@/lib/operations/enqueue";
import { ensureEntriesForConfirmedPairing } from "@/domain/tournaments/ensureEntriesForConfirmedPairing";
import { checkPadelCategoryLimit } from "@/domain/padelCategoryLimit";
import { sanitizeUsername } from "@/lib/username";
import { checkoutKey, clampIdempotencyKey } from "@/lib/stripe/idempotency";
import { logFinanceError } from "@/lib/observability/finance";

const FREE_PLACEHOLDER_INTENT_ID = "FREE_CHECKOUT";

type CheckoutItem = {
  ticketId: string | number;
  quantity: number;
  unitPriceCents?: number | null;
};

type PublicBreakdown = {
  lines: {
    ticketTypeId: number;
    name: string;
    quantity: number;
    unitPriceCents: number;
    currency: string;
    lineTotalCents: number;
  }[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  currency: string;
};

type Guest = {
  name?: string;
  email?: string;
  phone?: string | null;
};

function isValidEmail(email: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

function buildPublicBreakdown({
  lines,
  subtotalCents,
  discountCents,
  totalCents,
  currency,
}: PublicBreakdown): PublicBreakdown {
  return { lines, subtotalCents, discountCents, totalCents, currency };
}

type Body = {
  slug?: string;
  items?: CheckoutItem[];
  contact?: string;
  guest?: Guest;
  promoCode?: string | null;
  paymentScenario?: string | null;
  purchaseId?: string | null;
  idempotencyKey?: string | null;
  intentFingerprint?: string | null;
  pairingId?: number | null;
  slotId?: number | null;
  resaleId?: string | null;
  ticketId?: string | number | null;
  ticketTypeId?: number | null;
  eventId?: number | null;
  total?: number | null;
};

type IntentStatus =
  | "PENDING"
  | "PROCESSING"
  | "REQUIRES_ACTION"
  | "PAID"
  | "FAILED";

type NextAction = "NONE" | "PAY_NOW" | "CONFIRM_GUARANTEE" | "CONTACT_SUPPORT" | "LOGIN" | "CONNECT_STRIPE";

function intentError(
  code: string,
  message: string,
  opts?: {
    httpStatus?: number;
    status?: IntentStatus;
    nextAction?: NextAction;
    retryable?: boolean;
    extra?: Record<string, unknown>;
  },
) {
  return NextResponse.json(
    {
      ok: false,
      code,
      error: message,
      status: opts?.status ?? "FAILED",
      nextAction: opts?.nextAction ?? "NONE",
      retryable: opts?.retryable ?? false,
      ...(opts?.extra ?? {}),
    },
    { status: opts?.httpStatus ?? 400 },
  );
}

function normalizePhone(phone: string | null | undefined, defaultCountry: CountryCode = "PT") {
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
    const existing = emailClean
      ? await prisma.padelPlayerProfile.findFirst({
          where: { organizerId, email: emailClean },
          select: { id: true },
        })
      : null;

    if (existing?.id) {
      await prisma.padelPlayerProfile.update({
        where: { id: existing.id },
        data: {
          fullName,
          phone: phoneClean ?? undefined,
          gender: gender ?? undefined,
          level: level ?? undefined,
        },
      });
      return;
    }

    await prisma.padelPlayerProfile.create({
      data: {
        organizerId,
        fullName,
        email: emailClean || undefined,
        phone: phoneClean ?? undefined,
        gender: gender ?? undefined,
        level: level ?? undefined,
      },
    });
  } catch (err) {
    console.warn("[padel] upsertPadelPlayerProfile falhou (ignorado)", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null;

    if (!body || !body.slug || !Array.isArray(body.items) || body.items.length === 0) {
      return intentError("INVALID_INPUT", "Dados inválidos.", { httpStatus: 400, status: "FAILED", nextAction: "NONE", retryable: false });
    }

    const { slug, items, contact, guest, promoCode: rawPromo, paymentScenario: rawScenario, idempotencyKey: bodyIdemKey } = body;
    const inviteToken =
      typeof (body as { inviteToken?: unknown })?.inviteToken === "string"
        ? (body as { inviteToken?: string }).inviteToken!.trim()
        : null;
    const promoCodeInput = typeof rawPromo === "string" ? rawPromo.trim() : "";
    const idempotencyKeyHeader = req.headers.get("Idempotency-Key");
    const idempotencyKey = (bodyIdemKey || idempotencyKeyHeader || "").trim() || null;

    // purchaseId/intento fingerprint opcionais vindos do frontend (para retries/idempotência estável)
    const purchaseIdFromBody =
      typeof (body as { purchaseId?: unknown })?.purchaseId === "string"
        ? (body as { purchaseId?: string }).purchaseId!.trim()
        : "";

    const intentFingerprintFromBody =
      typeof (body as { intentFingerprint?: unknown })?.intentFingerprint === "string"
        ? (body as { intentFingerprint?: string }).intentFingerprint!.trim()
        : "";

    // Nota: o purchaseId final será decidido mais abaixo (de forma determinística quando possível)
    // depois de conhecermos descontos/pricing.

    // Validar que o evento existe (fetch raw para evitar issues com enum "ADDED")
    // Autenticação do utilizador
    const supabase = await createSupabaseServer();
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id ?? null;

    // Regra PADEL: pagar só a tua parte (capitão / split) exige conta
    const parsedScenarioEarly = paymentScenarioSchema.safeParse(
      typeof rawScenario === "string" ? rawScenario.toUpperCase() : rawScenario,
    );
    const requestedScenarioEarly: PaymentScenario | null = parsedScenarioEarly.success
      ? parsedScenarioEarly.data
      : null;

    if (requestedScenarioEarly === "GROUP_SPLIT" && !userId) {
      return intentError("AUTH_REQUIRED_FOR_GROUP_SPLIT", "Este modo de pagamento requer sessão iniciada.", {
        httpStatus: 401,
        status: "FAILED",
        nextAction: "LOGIN",
        retryable: false,
      });
    }

    const guestEmailRaw = guest?.email?.trim() ?? "";
    const guestName = guest?.name?.trim() ?? "";
    const guestPhoneRaw = guest?.phone?.trim() ?? "";
    const guestPhone = guestPhoneRaw ? normalizePhone(guestPhoneRaw) : "";
    const guestEmail = guestEmailRaw && isValidEmail(guestEmailRaw) ? guestEmailRaw : "";

    if (!userId) {
      if (!guestEmail || !guestName) {
        return intentError("AUTH_OR_GUEST_REQUIRED", "Precisas de iniciar sessão ou preencher nome e email para convidado.", { httpStatus: 400 });
      }
      if (!isValidEmail(guestEmailRaw)) {
        return intentError("INVALID_GUEST_EMAIL", "Email inválido para checkout como convidado.", { httpStatus: 400 });
      }
      if (guestPhoneRaw && !guestPhone) {
        return intentError("INVALID_GUEST_PHONE", "Telemóvel inválido. Usa formato PT: 9XXXXXXXX ou +3519XXXXXXXX.", { httpStatus: 400 });
      }
    }

    const ownerResolved = await resolveOwner({ sessionUserId: userId, guestEmail });
    const ownerForMetadata =
      ownerResolved.ownerUserId || ownerResolved.ownerIdentityId || ownerResolved.emailNormalized
        ? {
            ownerUserId: ownerResolved.ownerUserId ?? undefined,
            ownerIdentityId: ownerResolved.ownerIdentityId ?? undefined,
            emailNormalized: ownerResolved.emailNormalized ?? undefined,
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
        is_free: boolean;
        is_test: boolean;
        ends_at: Date | null;
        cover_image_url: string | null;
        location_name: string | null;
        starts_at: Date;
        timezone: string;
        fee_mode: string | null;
        fee_mode_override: string | null;
        organizer_id: number | null;
        invite_only: boolean | null;
        public_access_mode: string | null;
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
        e.is_free,
        e.is_test,
        e.ends_at,
        e.cover_image_url,
        e.location_name,
        e.starts_at,
        e.timezone,
        e.fee_mode,
        e.fee_mode_override,
        e.organizer_id,
        e.invite_only,
        e.public_access_mode,
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
      return intentError("EVENT_NOT_FOUND", "Evento não encontrado.", { httpStatus: 404 });
    }
    const profile = userId
      ? await prisma.profile.findUnique({ where: { id: userId } })
      : null;
    const isAdmin = Array.isArray(profile?.roles) ? profile.roles.includes("admin") : false;
    if (event.is_test && !isAdmin) {
      return intentError("EVENT_NOT_AVAILABLE", "Evento não disponível.", { httpStatus: 404 });
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
      return intentError("EVENT_CLOSED", "Evento indisponível para compra.", { httpStatus: 400 });
    }

    if (event.ends_at && event.ends_at < new Date()) {
      return intentError("EVENT_ENDED", "Vendas encerradas: evento já terminou.", { httpStatus: 400 });
    }

    const publicAccessMode = event.public_access_mode ?? (event.invite_only ? "INVITE" : "OPEN");
    const inviteOnly = publicAccessMode === "INVITE";
    if (inviteOnly && !isAdmin) {
      if (!userId) {
        return intentError("INVITE_REQUIRED", "Este evento é apenas por convite.", {
          httpStatus: 403,
          status: "FAILED",
          nextAction: "LOGIN",
          retryable: false,
          extra: { inviteOnly: true },
        });
      }

      const identifiers: string[] = [];
      const userEmail = normalizeEmail(userData?.user?.email ?? null);
      const username = profile?.username ? sanitizeUsername(profile.username) : null;

      if (userEmail) identifiers.push(userEmail);
      if (username) identifiers.push(username);

      if (identifiers.length === 0) {
        return intentError("INVITE_REQUIRED", "Este evento é apenas por convite.", {
          httpStatus: 403,
          status: "FAILED",
          nextAction: "NONE",
          retryable: false,
          extra: { inviteOnly: true },
        });
      }

      const inviteMatch = await prisma.eventInvite.findFirst({
        where: { eventId: event.id, targetIdentifier: { in: identifiers }, scope: "PUBLIC" },
        select: { id: true },
      });

      if (!inviteMatch) {
        return intentError("INVITE_REQUIRED", "Este evento é apenas por convite.", {
          httpStatus: 403,
          status: "FAILED",
          nextAction: "NONE",
          retryable: false,
          extra: { inviteOnly: true },
        });
      }
    }

    const padelConfig = await prisma.padelTournamentConfig.findUnique({
      where: { eventId: event.id },
      select: { organizerId: true },
    });

    const isResaleRequest =
      requestedScenarioEarly === "RESALE" ||
      (typeof body?.resaleId === "string" && body.resaleId.trim().length > 0);

    let resaleContext: {
      resaleId: string;
      ticketId: string;
      ticketTypeId: number;
      sellerUserId: string | null;
      priceCents: number;
    } | null = null;

    if (isResaleRequest) {
      const resaleId = typeof body?.resaleId === "string" ? body.resaleId.trim() : "";
      if (!resaleId) {
        return intentError("INVALID_RESALE_ID", "Revenda inválida.", { httpStatus: 400 });
      }
      if (!userId) {
        return intentError(
          "AUTH_REQUIRED_FOR_RESALE",
          "Precisas de sessão iniciada para comprar revendas.",
          { httpStatus: 401, status: "FAILED", nextAction: "LOGIN", retryable: false },
        );
      }

      const resale = await prisma.ticketResale.findUnique({
        where: { id: resaleId },
        include: {
          ticket: {
            select: { id: true, ticketTypeId: true, status: true, userId: true, eventId: true },
          },
        },
      });

      if (!resale || !resale.ticket) {
        return intentError("RESALE_NOT_FOUND", "Revenda não encontrada.", { httpStatus: 404 });
      }
      if (resale.status !== "LISTED") {
        return intentError("RESALE_NOT_AVAILABLE", "Revenda indisponível.", { httpStatus: 400 });
      }
      if (resale.ticket.status !== "ACTIVE") {
        return intentError("TICKET_NOT_ACTIVE", "Bilhete indisponível para revenda.", { httpStatus: 400 });
      }
      if (resale.ticket.eventId !== event.id) {
        return intentError("RESALE_EVENT_MISMATCH", "Revenda não corresponde a este evento.", { httpStatus: 400 });
      }
      if (resale.sellerUserId && resale.sellerUserId === userId) {
        return intentError("CANNOT_BUY_OWN_RESALE", "Não podes comprar a tua própria revenda.", {
          httpStatus: 400,
          status: "FAILED",
          retryable: false,
        });
      }

      const resalePriceCents =
        typeof (resale as any).priceCents === "number"
          ? (resale as any).priceCents
          : typeof (resale as any).price === "number"
            ? (resale as any).price
            : null;

      if (!Number.isFinite(resalePriceCents) || Number(resalePriceCents) <= 0) {
        return intentError("INVALID_RESALE_PRICE", "Preço de revenda inválido.", { httpStatus: 400 });
      }

      resaleContext = {
        resaleId,
        ticketId: resale.ticket.id,
        ticketTypeId: resale.ticket.ticketTypeId,
        sellerUserId: resale.sellerUserId ?? null,
        priceCents: Number(resalePriceCents),
      };

      if (items.length !== 1) {
        return intentError("RESALE_SINGLE_ITEM_ONLY", "Revenda suporta apenas um bilhete por compra.", {
          httpStatus: 400,
          status: "FAILED",
        });
      }
    }

    const ticketTypeIds = Array.from(
      new Set(
        items
          .map((i) => Number(i.ticketId))
          .filter((v) => Number.isFinite(v) && v > 0),
      ),
    );

    if (ticketTypeIds.length === 0) {
      return intentError("INVALID_TICKETS", "IDs de bilhete inválidos.", { httpStatus: 400 });
    }

    const ticketTypes = await prisma.ticketType.findMany({
      where: {
        id: { in: ticketTypeIds },
        eventId: event.id,
        status: "ON_SALE",
      },
      select: {
        id: true,
        name: true,
        price: true,
        currency: true,
        totalQuantity: true,
        soldQuantity: true,
        padelEventCategoryLinkId: true,
        padelEventCategoryLink: {
          select: {
            id: true,
            padelCategoryId: true,
          },
        },
      },
    });

    if (ticketTypes.length !== ticketTypeIds.length) {
      return intentError("TICKET_NOT_FOUND", "Um dos bilhetes não foi encontrado ou não pertence a este evento.", { httpStatus: 400 });
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
        return intentError("INVALID_TICKET_ID", "ID de bilhete inválido.", { httpStatus: 400 });
      }

      const ticketType = ticketTypeMap.get(ticketTypeId);
      if (!ticketType) {
        return intentError("TICKET_NOT_FOUND", "Um dos bilhetes não foi encontrado ou não pertence a este evento.", { httpStatus: 400 });
      }

      const qty = Number(item.quantity ?? 0);
      if (!Number.isInteger(qty) || qty < 1) {
        return intentError("INVALID_QUANTITY", "Quantidade inválida.", { httpStatus: 400 });
      }

      if (resaleContext) {
        if (ticketTypeId !== resaleContext.ticketTypeId) {
          return intentError("RESALE_TICKET_MISMATCH", "Revenda não corresponde ao bilhete selecionado.", {
            httpStatus: 400,
            status: "FAILED",
          });
        }
        if (qty !== 1) {
          return intentError("RESALE_QUANTITY_INVALID", "Revenda apenas permite 1 bilhete por compra.", {
            httpStatus: 400,
            status: "FAILED",
          });
        }
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
          return intentError("INSUFFICIENT_STOCK", "Stock insuficiente para um dos bilhetes.", {
            httpStatus: 409,
            status: "FAILED",
            retryable: false,
            nextAction: "NONE",
          });
        }
      }

      const priceCents = resaleContext && ticketTypeId === resaleContext.ticketTypeId
        ? resaleContext.priceCents
        : Number(ticketType.price);
      if (!Number.isFinite(priceCents) || priceCents <= 0) {
        return intentError("INVALID_PRICE_SERVER", "Preço inválido no servidor.", { httpStatus: 500 });
      }

      const ticketCurrency = (ticketType.currency || "EUR").toLowerCase();
      if (!currency) {
        currency = ticketCurrency;
      } else if (currency !== ticketCurrency) {
        return intentError("CURRENCY_MISMATCH", "Não é possível misturar moedas diferentes no mesmo checkout.", { httpStatus: 400 });
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
      return intentError("CURRENCY_UNDETERMINED", "Moeda não determinada para o checkout.", { httpStatus: 400 });
    }
    if (currency.toUpperCase() !== "EUR") {
      return intentError("CURRENCY_NOT_SUPPORTED", "Moeda não suportada no v1. Apenas EUR.", {
        httpStatus: 400,
        status: "FAILED",
        nextAction: "NONE",
        retryable: false,
      });
    }

    const clientExpectedTotalCents =
      body && typeof (body as Record<string, unknown>).total === "number"
        ? Math.round(Math.max(0, (body as Record<string, number>).total) * 100)
        : null;

    // Montante base do carrinho (antes de descontos)
    const preDiscountAmountCents = Math.max(0, amountInCents);

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
      if (minCartCents !== null && minCartCents !== undefined && preDiscountAmountCents < minCartCents) {
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
        amountInCents: preDiscountAmountCents,
      });
      promoCodeId = promo.id;
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
        return intentError(msg || "PROMO_INVALID", map[msg] ?? "Código promocional inválido.", {
          httpStatus: 400,
          status: "FAILED",
          nextAction: "NONE",
          retryable: msg === "PROMO_UNAVAILABLE",
        });
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
        // determinístico: evita escolher promos diferentes em chamadas repetidas
        orderBy: [{ id: "asc" }],
      });

      let best: { promoId: number; discount: number } | null = null;

      for (const promo of autoPromos) {
        discountCents = 0;
        promoCodeId = null;
        try {
          await validatePromo({ id: promo.id });
          const d = discountCents;
          // determinístico: em empate, escolhe o menor id
          if (!best || d > best.discount || (d === best.discount && promo.id < best.promoId)) {
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

    // Clamp final discount (não deixa passar do total)
    discountCents = Math.max(0, Math.min(discountCents, preDiscountAmountCents));
    const amountAfterDiscountCents = preDiscountAmountCents - discountCents;

    const { feeBps: defaultFeeBps, feeFixedCents: defaultFeeFixed } = await getPlatformFees();
    const stripeBaseFees = await getStripeBaseFees();

    // Org da plataforma? (org_type = PLATFORM → não cobra application fee, usa conta da plataforma)
    const isPlatformOrg = (event.org_type || "").toString().toUpperCase() === "PLATFORM";

    const pricing = computePricing(preDiscountAmountCents, discountCents, {
      eventFeeModeOverride: "INCLUDED" as FeeMode,
      eventFeeMode: (event.fee_mode as FeeMode | null) ?? undefined,
      organizerFeeMode: (event.org_fee_mode as FeeMode | null) ?? undefined,
      platformDefaultFeeMode: "INCLUDED" as FeeMode,
      eventPlatformFeeBpsOverride: event.platform_fee_bps_override,
      eventPlatformFeeFixedCentsOverride: event.platform_fee_fixed_cents_override,
      organizerPlatformFeeBps: event.org_platform_fee_bps,
      organizerPlatformFeeFixedCents: event.org_platform_fee_fixed_cents,
      platformDefaultFeeBps: defaultFeeBps,
      platformDefaultFeeFixedCents: defaultFeeFixed,
      isPlatformOrg,
    });
    const combinedFees = computeCombinedFees({
      amountCents: preDiscountAmountCents,
      discountCents,
      feeMode: pricing.feeMode,
      platformFeeBps: pricing.feeBpsApplied,
      platformFeeFixedCents: pricing.feeFixedApplied,
      stripeFeeBps: stripeBaseFees.feeBps,
      stripeFeeFixedCents: stripeBaseFees.feeFixedCents,
    });

    const platformFeeCents = pricing.platformFeeCents; // ORYA (application_fee)
    const platformFeeCombinedCents = combinedFees.combinedFeeCents; // ORYA + Stripe (mostrado ao cliente)
    const stripeFeeEstimateCents = combinedFees.stripeFeeCentsEstimate;

    // Stripe account rules
    let stripeAccountId = event.org_stripe_account_id ?? null;
    const payoutModeRaw = (event.payout_mode || "ORGANIZER").toString().toUpperCase();
    const organizerStripeReady = Boolean(event.org_stripe_charges_enabled && event.org_stripe_payouts_enabled);

    // Plataforma ORYA: usa conta da plataforma, não exige Connect
    const requiresOrganizerStripe = !isPlatformOrg && payoutModeRaw !== "PLATFORM";

    if (!requiresOrganizerStripe) {
      stripeAccountId = null;
    } else {
      // Organizadores externos: exigem Connect pronto
      if (!stripeAccountId || !organizerStripeReady) {
        return intentError("ORGANIZER_STRIPE_NOT_CONNECTED", "Pagamentos estão desativados porque o organizador ainda não ligou a Stripe.", {
          httpStatus: 409,
          status: "FAILED",
          nextAction: "CONNECT_STRIPE",
          retryable: false,
        });
      }
    }

    const isPartnerEvent = Boolean(stripeAccountId);

    const totalAmountInCents = combinedFees.totalCents;

    // Validação do total do cliente (tolerante): alguns FE enviam subtotal, outros enviam total.
    if (clientExpectedTotalCents !== null) {
      const matchesAnyExpected =
        clientExpectedTotalCents === preDiscountAmountCents ||
        clientExpectedTotalCents === amountAfterDiscountCents ||
        clientExpectedTotalCents === totalAmountInCents;

      if (!matchesAnyExpected) {
        return intentError("PRICE_CHANGED", "Os preços foram atualizados. Revê a seleção e tenta novamente.", {
          httpStatus: 409,
          status: "FAILED",
          retryable: true,
          nextAction: "NONE",
          extra: {
            expected: {
              subtotalCents: preDiscountAmountCents,
              afterDiscountCents: amountAfterDiscountCents,
              totalCents: totalAmountInCents,
              currency: currency.toUpperCase(),
            },
          },
        });
      }
    }

    if (totalAmountInCents < 0 || platformFeeCombinedCents > Math.max(totalAmountInCents, 0)) {
      return intentError("INVALID_TOTAL", "Montante total inválido para este checkout.", { httpStatus: 400 });
    }

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
    const bodyPairingId = typeof body?.pairingId === "number" ? body.pairingId : null;
    const bodySlotId = typeof body?.slotId === "number" ? body.slotId : null;
    const bodyTicketTypeId = typeof body?.ticketTypeId === "number" ? body.ticketTypeId : null;

    const paymentScenario: PaymentScenario =
      totalAmountInCents === 0
        ? requestedScenario === "GROUP_FULL" || requestedScenario === "GROUP_SPLIT"
          ? requestedScenario
          : "FREE_CHECKOUT"
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

    let groupPairing:
      | {
          id: number;
          eventId: number;
          lifecycleStatus: string;
          payment_mode: string;
          pairingJoinMode: string;
          partnerInviteToken: string | null;
          partnerLinkExpiresAt: Date | null;
          slots: Array<{
            id: number;
            profileId: string | null;
            ticketId: string | null;
            paymentStatus: string;
            invitedContact: string | null;
          }>;
        }
      | null = null;

    // Padel group scenarios exigem pairingId válido
    if (scenarioAdjusted === "GROUP_FULL" || scenarioAdjusted === "GROUP_SPLIT") {
      if (!bodyPairingId) {
        return intentError("PAIRING_REQUIRED", "Precisas de uma dupla ativa para continuar.", {
          httpStatus: 400,
          status: "FAILED",
          retryable: false,
        });
      }
      if (!bodySlotId) {
        return intentError("PAIRING_SLOT_REQUIRED", "Slot da dupla em falta.", {
          httpStatus: 400,
          status: "FAILED",
          retryable: false,
        });
      }
      const pairing = await prisma.padelPairing.findUnique({
        where: { id: bodyPairingId },
        select: {
          id: true,
          eventId: true,
          categoryId: true,
          lifecycleStatus: true,
          payment_mode: true,
          pairingJoinMode: true,
          partnerInviteToken: true,
          partnerLinkExpiresAt: true,
          slots: {
            select: {
              id: true,
              profileId: true,
              ticketId: true,
              paymentStatus: true,
              invitedContact: true,
            },
          },
        },
      });
      if (!pairing || pairing.eventId !== event.id || pairing.lifecycleStatus === "CANCELLED_INCOMPLETE") {
        return intentError("PAIRING_INVALID", "A dupla não é válida para este evento.", {
          httpStatus: 400,
          status: "FAILED",
          retryable: false,
        });
      }
      const slot = pairing.slots.find((s) => s.id === bodySlotId);
      if (!slot) {
        return intentError("PAIRING_SLOT_INVALID", "Slot da dupla não encontrado.", {
          httpStatus: 400,
          status: "FAILED",
          retryable: false,
        });
      }
      groupPairing = pairing;
      if (scenarioAdjusted === "GROUP_SPLIT" && pairing.payment_mode !== "SPLIT") {
        return intentError("PAIRING_MODE_MISMATCH", "A dupla não está em modo split.", {
          httpStatus: 400,
          status: "FAILED",
          retryable: false,
        });
      }
      if (scenarioAdjusted === "GROUP_FULL" && pairing.payment_mode !== "FULL") {
        return intentError("PAIRING_MODE_MISMATCH", "A dupla não está em modo full.", {
          httpStatus: 400,
          status: "FAILED",
          retryable: false,
        });
      }
      if (userId) {
        const matchesUser = pairing.slots.some((s) => s.profileId === userId);
        if (!matchesUser) {
          const pendingSlot = pairing.slots.find((s) => s.id === bodySlotId) ?? null;
          const isUnclaimed = pendingSlot && !pendingSlot.profileId;
          let allowUnclaimed = false;
          if (isUnclaimed) {
            const now = new Date();
            if (pairing.pairingJoinMode === "LOOKING_FOR_PARTNER") {
              allowUnclaimed = true;
            } else if (
              inviteToken &&
              pairing.partnerInviteToken &&
              inviteToken === pairing.partnerInviteToken &&
              (!pairing.partnerLinkExpiresAt || pairing.partnerLinkExpiresAt > now)
            ) {
              allowUnclaimed = true;
            } else if (pendingSlot?.invitedContact) {
              const invitedRaw = pendingSlot.invitedContact.trim().toLowerCase();
              const invited =
                invitedRaw.startsWith("@") ? invitedRaw.slice(1) : invitedRaw;
              const username = profile?.username?.trim().toLowerCase() ?? "";
              const email =
                userData?.user?.email?.trim().toLowerCase() ?? "";
              const normalizedInvitedPhone = normalizePhone(invited) ?? invited.replace(/[^\d]/g, "");
              const normalizedUserPhone =
                normalizePhone(userData?.user?.phone ?? profile?.contactPhone ?? null) ??
                (userData?.user?.phone ?? profile?.contactPhone ?? "").replace(/[^\d]/g, "");
              if (
                (invited.includes("@") && email && invited === email) ||
                (!invited.includes("@") && username && invited === username) ||
                (normalizedInvitedPhone && normalizedUserPhone && normalizedInvitedPhone === normalizedUserPhone)
              ) {
                allowUnclaimed = true;
              }
            }
          }
          if (!allowUnclaimed) {
            return intentError("PAIRING_NOT_OWNED", "Esta dupla pertence a outro utilizador.", {
              httpStatus: 403,
              status: "FAILED",
              retryable: false,
            });
          }
        }
      }

      const categoryLinkIds = new Set<number>();
      let resolvedCategoryId: number | null = pairing.categoryId ?? null;
      for (const item of normalizedItems) {
        const ticketType = ticketTypeMap.get(item.ticketTypeId);
        const linkId = ticketType?.padelEventCategoryLinkId ?? null;
        const linkCategoryId = ticketType?.padelEventCategoryLink?.padelCategoryId ?? null;
        if (!linkId || !linkCategoryId) {
          return intentError("PADEL_CATEGORY_LINK_REQUIRED", "Bilhete Padel sem categoria do evento.", {
            httpStatus: 400,
            status: "FAILED",
            retryable: false,
          });
        }
        categoryLinkIds.add(linkId);
        if (!resolvedCategoryId) resolvedCategoryId = linkCategoryId;
        if (resolvedCategoryId && linkCategoryId && resolvedCategoryId !== linkCategoryId) {
          return intentError("PADEL_CATEGORY_MIXED", "Não podes misturar categorias Padel no mesmo checkout.", {
            httpStatus: 400,
            status: "FAILED",
            retryable: false,
          });
        }
      }

      if (categoryLinkIds.size > 1) {
        return intentError("PADEL_CATEGORY_MIXED", "Não podes misturar categorias Padel no mesmo checkout.", {
          httpStatus: 400,
          status: "FAILED",
          retryable: false,
        });
      }

      if (resolvedCategoryId && pairing.categoryId && pairing.categoryId !== resolvedCategoryId) {
        return intentError("PADEL_CATEGORY_MISMATCH", "Categoria do bilhete não corresponde à dupla.", {
          httpStatus: 400,
          status: "FAILED",
          retryable: false,
        });
      }

      if (userId && resolvedCategoryId) {
        const limitCheck = await prisma.$transaction((tx) =>
          checkPadelCategoryLimit({
            tx,
            eventId: event.id,
            userId,
            categoryId: resolvedCategoryId,
            excludePairingId: pairing.id,
          }),
        );
        if (!limitCheck.ok) {
          return intentError(
            limitCheck.code,
            limitCheck.code === "ALREADY_IN_CATEGORY"
              ? "Já tens uma dupla confirmada nesta categoria."
              : "Limite máximo de 2 categorias por jogador.",
            {
              httpStatus: 409,
              status: "FAILED",
              retryable: false,
            },
          );
        }
      }

      if (scenarioAdjusted === "GROUP_SPLIT") {
        const paidSlots = pairing.slots.filter((s) => Boolean(s.ticketId));
        const requiredSlots = paidSlots.length === 0 ? 2 : 1;
        const firstItem = normalizedItems[0];
        const ticketType = firstItem ? ticketTypeMap.get(firstItem.ticketTypeId) : null;
        if (ticketType && ticketType.totalQuantity !== null && ticketType.totalQuantity !== undefined) {
          const reserved = reservedByType[ticketType.id] ?? 0;
          const remaining = ticketType.totalQuantity - ticketType.soldQuantity - reserved;
          if (remaining < requiredSlots) {
            return intentError("INSUFFICIENT_STOCK", "Sem vagas suficientes para completar a dupla.", {
              httpStatus: 409,
              status: "FAILED",
              retryable: false,
              nextAction: "NONE",
            });
          }
        }
      }
    }

    // Revendas desativadas (só admins internos podem usar via outros canais)
    if (scenarioAdjusted === "RESALE") {
      return intentError("RESALE_DISABLED", "A revenda está temporariamente indisponível.", {
        httpStatus: 403,
        status: "FAILED",
        nextAction: "NONE",
      });
    }

    // Checkouts gratuitos exigem sessão + username definido
    if (scenarioAdjusted === "FREE_CHECKOUT") {
      if (!userId) {
        return intentError("AUTH_REQUIRED", "Inicia sessão para concluir este checkout gratuito.", {
          httpStatus: 401,
          status: "FAILED",
          nextAction: "LOGIN",
        });
      }
      const profile = await prisma.profile.findUnique({
        where: { id: userId },
        select: { username: true },
      });
      if (!profile?.username) {
        return intentError("USERNAME_REQUIRED", "Define um username para concluir este checkout gratuito.", {
          httpStatus: 403,
          status: "FAILED",
          nextAction: "LOGIN",
        });
      }
    }

    // Padel pricing guard: qty coerente com scenario (anti preço “por dupla”)
    if (scenarioAdjusted === "GROUP_FULL") {
      const invalid = normalizedItems.some((i) => i.quantity !== 2);
      if (invalid) {
        return intentError("INVALID_PRICING_MODEL", "Modelo de preço inválido para GROUP_FULL (espera qty=2 por item).", {
          httpStatus: 400,
          status: "FAILED",
          retryable: false,
        });
      }
    }
    if (scenarioAdjusted === "GROUP_SPLIT") {
      const invalid = normalizedItems.some((i) => i.quantity !== 1);
      if (invalid) {
        return intentError("INVALID_PRICING_MODEL", "Modelo de preço inválido para GROUP_SPLIT (espera qty=1 por item).", {
          httpStatus: 400,
          status: "FAILED",
          retryable: false,
        });
      }
    }

    // purchaseId determinístico quando o frontend não enviar: evita duplicar PaymentIntents em retries
    const identityKey = userId
      ? `u:${userId}`
      : guestEmail
        ? `g:${guestEmail.toLowerCase()}`
        : "anon";

    const FINGERPRINT_VERSION = "v3"; // bump to evitar colisões com modelo antigo de fees

    const intentFingerprint = crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          version: FINGERPRINT_VERSION,
          eventId: event.id,
          slug: event.slug,
          items: normalizedItems,
          scenario: scenarioAdjusted,
          identity: identityKey,
          promoCodeId,
          promoCodeRaw: promoCodeInput ? promoCodeInput.toLowerCase() : null,
          discountCents,
          totalCents: totalAmountInCents,
          currency: currency.toLowerCase(),
          platformFeeCents: platformFeeCents,
          platformFeeCombinedCents,
          stripeFeeEstimateCents,
        }),
      )
      .digest("hex")
      .slice(0, 32);

    const computedPurchaseId = `pur_${intentFingerprint}`;

    // Se o frontend enviou fingerprint/purchaseId, podem estar desatualizados.
    // Em vez de bloquear (409 + loop no FE), registamos e seguimos sempre com a SSOT do servidor.
    if (intentFingerprintFromBody && intentFingerprintFromBody !== intentFingerprint) {
      console.warn("[payments/intent] client intentFingerprint desatualizado", {
        provided: intentFingerprintFromBody,
        expected: intentFingerprint,
        purchaseId: computedPurchaseId,
      });
    }

    if (purchaseIdFromBody && purchaseIdFromBody !== computedPurchaseId) {
      console.warn("[payments/intent] client purchaseId desatualizado", {
        provided: purchaseIdFromBody,
        expected: computedPurchaseId,
        intentFingerprint,
      });
    }

    const purchaseId = computedPurchaseId;

    // Dedupe determinístico por carrinho: evita loops 409 quando o FE reutiliza uma idempotencyKey inválida.
    // Mantemos a key enviada pelo FE para diferenciar intents e evitar reaproveitar PI terminal.
    const clientIdempotencyKey = idempotencyKey;
    const checkoutIdempotencyKey = checkoutKey(purchaseId);
    const effectiveDedupeKey = checkoutIdempotencyKey;

    // Idempotência API: se houver payment_event com dedupeKey=checkoutKey e PI não terminal, devolve. Terminal → ignora e cria novo.
    if (checkoutIdempotencyKey) {
      const existing = await prisma.paymentEvent.findFirst({
        where: { dedupeKey: checkoutIdempotencyKey },
        select: {
          stripePaymentIntentId: true,
          purchaseId: true,
          amountCents: true,
        },
      });

      if (existing?.stripePaymentIntentId?.startsWith("pi_")) {
        try {
          const pi = await stripe.paymentIntents.retrieve(existing.stripePaymentIntentId);
          const terminal = pi.status && ["succeeded", "canceled", "requires_capture"].includes(pi.status);
          if (!terminal) {
            // Safety: payload mismatch ainda bloqueia
            if (typeof pi.amount === "number" && pi.amount !== Math.max(0, totalAmountInCents)) {
              return intentError("IDEMPOTENCY_KEY_PAYLOAD_MISMATCH", "Chave de idempotência reutilizada com um carrinho diferente.", {
                httpStatus: 409,
                retryable: false,
              });
            }
            return NextResponse.json(
              {
                ok: true,
                reused: true,
                clientSecret: pi.client_secret,
                amount: typeof pi.amount === "number" ? pi.amount : totalAmountInCents,
                currency: currency.toUpperCase(),
                discountCents,
                paymentIntentId: existing.stripePaymentIntentId,
                purchaseId: existing.purchaseId ?? undefined,
                paymentScenario: scenarioAdjusted,
                breakdown: buildPublicBreakdown({
                  lines,
                  subtotalCents: pricing.subtotalCents,
                  discountCents,
                  totalCents: totalAmountInCents,
                  currency: currency.toUpperCase(),
                }),
                intentFingerprint,
                idempotencyKey: clientIdempotencyKey ?? effectiveDedupeKey,
              },
              { status: 200 },
            );
          }
          // terminal → segue para criar PI novo
        } catch (e) {
          console.warn("[payments/intent] idempotency retrieve PI falhou", e);
        }
      }
    }

    const metadataValidation = checkoutMetadataSchema.safeParse({
      paymentScenario: scenarioAdjusted,
      purchaseId,
      items: normalizedItems,
      eventId: event.id,
      eventSlug: event.slug,
      owner: ownerForMetadata,
      pairingId: typeof body?.pairingId === "number" ? body?.pairingId : undefined,
      slotId: bodySlotId ?? undefined,
      ticketTypeId: bodyTicketTypeId ?? undefined,
    });

    if (!metadataValidation.success) {
      console.warn("[payments/intent] Metadata inválida", metadataValidation.error.format());
      return intentError("INVALID_METADATA", "Metadata inválida para checkout.", {
        httpStatus: 400,
        status: "FAILED",
        retryable: false,
      });
    }

    // --------------------------
    // CHECKOUT GRATUITO (0 €)
    // --------------------------
    if (totalAmountInCents === 0) {
      if (scenarioAdjusted === "GROUP_SPLIT" || scenarioAdjusted === "GROUP_FULL") {
        if (!userId) {
          return intentError("AUTH_REQUIRED", "Inicia sessão para concluir a inscrição Padel.", {
            httpStatus: 401,
            status: "FAILED",
            nextAction: "LOGIN",
          });
        }
        if (!profile?.username) {
          return intentError("USERNAME_REQUIRED", "Define um username para concluir a inscrição Padel.", {
            httpStatus: 403,
            status: "FAILED",
            nextAction: "LOGIN",
          });
        }

        const pairing = groupPairing
          ? await prisma.padelPairing.findUnique({
              where: { id: groupPairing.id },
              include: { slots: true },
            })
          : null;
        const slot = pairing?.slots.find((s) => s.id === bodySlotId) ?? null;

        if (!pairing || !slot) {
          return intentError("PAIRING_INVALID", "A dupla não é válida para este evento.", {
            httpStatus: 400,
            status: "FAILED",
          });
        }

        const firstItem = normalizedItems[0];
        const ticketType = firstItem ? ticketTypeMap.get(firstItem.ticketTypeId) : null;
        if (!ticketType) {
          return intentError("TICKET_NOT_FOUND", "Bilhete inválido para inscrição Padel.", {
            httpStatus: 400,
            status: "FAILED",
          });
        }

        const existingFreeTicket = await prisma.ticket.findFirst({
          where: { stripePaymentIntentId: purchaseId },
          select: { id: true },
        });
        if (existingFreeTicket) {
          return NextResponse.json({
            ok: true,
            code: "OK",
            status: "OK",
            nextAction: "NONE",
            retryable: false,
            freeCheckout: true,
            isFreeCheckout: true,
            purchaseId,
            paymentIntentId: FREE_PLACEHOLDER_INTENT_ID,
            paymentScenario: scenarioAdjusted,
            amount: 0,
            currency: (ticketType.currency || "EUR").toUpperCase(),
            discountCents,
            breakdown: buildPublicBreakdown({
              lines,
              subtotalCents: pricing.subtotalCents,
              discountCents,
              totalCents: 0,
              currency: (ticketType.currency || "EUR").toUpperCase(),
            }),
            intentFingerprint,
            idempotencyKey: clientIdempotencyKey ?? effectiveDedupeKey,
          });
        }

        let shouldEnsureEntries = false;
        await prisma.$transaction(async (tx) => {
          if (scenarioAdjusted === "GROUP_SPLIT" && pairing.payment_mode !== "SPLIT") {
            throw new Error("PAIRING_NOT_SPLIT");
          }
          if (scenarioAdjusted === "GROUP_FULL" && pairing.payment_mode !== "FULL") {
            throw new Error("PAIRING_NOT_FULL");
          }
          if (pairing.pairingStatus === "CANCELLED") {
            throw new Error("PAIRING_CANCELLED");
          }

          if (scenarioAdjusted === "GROUP_SPLIT") {
            if (slot.paymentStatus === PadelPairingPaymentStatus.PAID && slot.ticketId) {
              return;
            }

            const qrSecret = crypto.randomUUID();
            const rotatingSeed = crypto.randomUUID();
            const ticket = await tx.ticket.create({
              data: {
                eventId: event.id,
                ticketTypeId: ticketType.id,
                pricePaid: ticketType.price,
                totalPaidCents: 0,
                currency: (ticketType.currency || "EUR").toUpperCase(),
                stripePaymentIntentId: purchaseId,
                status: "ACTIVE",
                qrSecret,
                rotatingSeed,
                userId,
                ownerUserId: userId,
                ownerIdentityId: null,
                pairingId: pairing.id,
                padelSplitShareCents: ticketType.price,
              },
            });

            await tx.ticketType.update({
              where: { id: ticketType.id },
              data: { soldQuantity: ticketType.soldQuantity + 1 },
            });

            const saleSummary = await tx.saleSummary.upsert({
              where: { paymentIntentId: purchaseId },
              update: {
                eventId: event.id,
                userId,
                ownerUserId: userId,
                ownerIdentityId: null,
                purchaseId,
                subtotalCents: ticketType.price,
                discountCents: 0,
                platformFeeCents: 0,
                stripeFeeCents: 0,
                totalCents: 0,
                netCents: 0,
                feeMode: pricing.feeMode,
                currency: (ticketType.currency || "EUR").toUpperCase(),
                status: "PAID",
              },
              create: {
                paymentIntentId: purchaseId,
                eventId: event.id,
                userId,
                ownerUserId: userId,
                ownerIdentityId: null,
                purchaseId,
                subtotalCents: ticketType.price,
                discountCents: 0,
                platformFeeCents: 0,
                stripeFeeCents: 0,
                totalCents: 0,
                netCents: 0,
                feeMode: pricing.feeMode,
                currency: (ticketType.currency || "EUR").toUpperCase(),
                status: "PAID",
              },
            });

            await tx.saleLine.deleteMany({ where: { saleSummaryId: saleSummary.id } });
            const saleLine = await tx.saleLine.create({
              data: {
                saleSummaryId: saleSummary.id,
                eventId: event.id,
                ticketTypeId: ticketType.id,
                promoCodeId: promoCodeId ? Number(promoCodeId) : null,
                quantity: 1,
                unitPriceCents: ticketType.price,
                discountPerUnitCents: 0,
                grossCents: 0,
                netCents: 0,
                platformFeeCents: 0,
              },
            });

            await tx.ticket.update({
              where: { id: ticket.id },
              data: { saleSummaryId: saleSummary.id },
            });

            const ownerKey = `user:${userId}`;
            const entitlementPurchaseId = saleSummary.purchaseId ?? saleSummary.paymentIntentId;
            await tx.entitlement.upsert({
              where: {
                purchaseId_saleLineId_lineItemIndex_ownerKey_type: {
                  purchaseId: entitlementPurchaseId,
                  saleLineId: saleLine.id,
                  lineItemIndex: 0,
                  ownerKey,
                  type: EntitlementType.PADEL_ENTRY,
                },
              },
              update: {
                status: EntitlementStatus.ACTIVE,
                ownerUserId: userId,
                ownerIdentityId: null,
                eventId: event.id,
                snapshotTitle: event.title,
                snapshotCoverUrl: event.cover_image_url,
                snapshotVenueName: event.location_name,
                snapshotStartAt: event.starts_at,
                snapshotTimezone: event.timezone,
              },
              create: {
                purchaseId: entitlementPurchaseId,
                saleLineId: saleLine.id,
                lineItemIndex: 0,
                ownerKey,
                ownerUserId: userId,
                ownerIdentityId: null,
                type: EntitlementType.PADEL_ENTRY,
                status: EntitlementStatus.ACTIVE,
                eventId: event.id,
                snapshotTitle: event.title,
                snapshotCoverUrl: event.cover_image_url,
                snapshotVenueName: event.location_name,
                snapshotStartAt: event.starts_at,
                snapshotTimezone: event.timezone,
              },
            });

            let updated = await tx.padelPairing.update({
              where: { id: pairing.id },
              data: {
                slots: {
                  update: {
                    where: { id: slot.id },
                    data: {
                      ticketId: ticket.id,
                      profileId: userId,
                      paymentStatus: PadelPairingPaymentStatus.PAID,
                      slotStatus: PadelPairingSlotStatus.FILLED,
                    },
                  },
                },
              },
              include: { slots: true },
            });

            const allPaid = updated.slots.every((s) => s.paymentStatus === PadelPairingPaymentStatus.PAID);
            const nextLifecycle = allPaid
              ? PadelPairingLifecycleStatus.CONFIRMED_BOTH_PAID
              : PadelPairingLifecycleStatus.PENDING_PARTNER_PAYMENT;
            if (updated.lifecycleStatus !== nextLifecycle) {
              updated = await tx.padelPairing.update({
                where: { id: pairing.id },
                data: { lifecycleStatus: nextLifecycle },
                include: { slots: true },
              });
            }

            const stillPending = updated.slots.some(
              (s) => s.slotStatus === PadelPairingSlotStatus.PENDING || s.paymentStatus === PadelPairingPaymentStatus.UNPAID,
            );
            if (!stillPending && updated.pairingStatus !== "COMPLETE") {
              await tx.padelPairing.update({
                where: { id: pairing.id },
                data: { pairingStatus: "COMPLETE" },
                select: { id: true },
              });
              shouldEnsureEntries = true;
            }
          } else {
            const captainSlot = pairing.slots.find((s) => s.slot_role === "CAPTAIN");
            const partnerSlot = pairing.slots.find((s) => s.slot_role === "PARTNER");
            if (!captainSlot || !partnerSlot) {
              throw new Error("SLOTS_INVALID");
            }

            const qr1 = crypto.randomUUID();
            const qr2 = crypto.randomUUID();
            const rot1 = crypto.randomUUID();
            const rot2 = crypto.randomUUID();

            const ticketCaptain = await tx.ticket.create({
              data: {
                eventId: event.id,
                ticketTypeId: ticketType.id,
                pricePaid: ticketType.price,
                totalPaidCents: 0,
                currency: (ticketType.currency || "EUR").toUpperCase(),
                stripePaymentIntentId: purchaseId,
                status: "ACTIVE",
                qrSecret: qr1,
                rotatingSeed: rot1,
                userId,
                ownerUserId: userId,
                ownerIdentityId: null,
                pairingId: pairing.id,
                padelSplitShareCents: ticketType.price,
              },
            });

            const ticketPartner = await tx.ticket.create({
              data: {
                eventId: event.id,
                ticketTypeId: ticketType.id,
                pricePaid: ticketType.price,
                totalPaidCents: 0,
                currency: (ticketType.currency || "EUR").toUpperCase(),
                stripePaymentIntentId: purchaseId,
                status: "ACTIVE",
                qrSecret: qr2,
                rotatingSeed: rot2,
                pairingId: pairing.id,
                padelSplitShareCents: ticketType.price,
                ownerUserId: userId,
                ownerIdentityId: null,
              },
            });

            await tx.ticketType.update({
              where: { id: ticketType.id },
              data: { soldQuantity: ticketType.soldQuantity + 2 },
            });

            const saleSummary = await tx.saleSummary.upsert({
              where: { paymentIntentId: purchaseId },
              update: {
                eventId: event.id,
                userId,
                ownerUserId: userId,
                ownerIdentityId: null,
                purchaseId,
                subtotalCents: ticketType.price * 2,
                discountCents: 0,
                platformFeeCents: 0,
                stripeFeeCents: 0,
                totalCents: 0,
                netCents: 0,
                feeMode: pricing.feeMode,
                currency: (ticketType.currency || "EUR").toUpperCase(),
                status: "PAID",
              },
              create: {
                paymentIntentId: purchaseId,
                eventId: event.id,
                userId,
                ownerUserId: userId,
                ownerIdentityId: null,
                purchaseId,
                subtotalCents: ticketType.price * 2,
                discountCents: 0,
                platformFeeCents: 0,
                stripeFeeCents: 0,
                totalCents: 0,
                netCents: 0,
                feeMode: pricing.feeMode,
                currency: (ticketType.currency || "EUR").toUpperCase(),
                status: "PAID",
              },
            });

            await tx.saleLine.deleteMany({ where: { saleSummaryId: saleSummary.id } });
            const saleLine = await tx.saleLine.create({
              data: {
                saleSummaryId: saleSummary.id,
                eventId: event.id,
                ticketTypeId: ticketType.id,
                promoCodeId: promoCodeId ? Number(promoCodeId) : null,
                quantity: 2,
                unitPriceCents: ticketType.price,
                discountPerUnitCents: 0,
                grossCents: 0,
                netCents: 0,
                platformFeeCents: 0,
              },
            });

            await tx.ticket.updateMany({
              where: { id: { in: [ticketCaptain.id, ticketPartner.id] } },
              data: { saleSummaryId: saleSummary.id },
            });

            const ownerKey = `user:${userId}`;
            const entitlementPurchaseId = saleSummary.purchaseId ?? saleSummary.paymentIntentId;
            const entitlementBase = {
              purchaseId: entitlementPurchaseId,
              saleLineId: saleLine.id,
              ownerKey,
              ownerUserId: userId,
              ownerIdentityId: null,
              type: EntitlementType.PADEL_ENTRY,
              status: EntitlementStatus.ACTIVE,
              eventId: event.id,
              snapshotTitle: event.title,
              snapshotCoverUrl: event.cover_image_url,
              snapshotVenueName: event.location_name,
              snapshotStartAt: event.starts_at,
              snapshotTimezone: event.timezone,
            };

            await tx.entitlement.upsert({
              where: {
                purchaseId_saleLineId_lineItemIndex_ownerKey_type: {
                  purchaseId: entitlementPurchaseId,
                  saleLineId: saleLine.id,
                  lineItemIndex: 0,
                  ownerKey,
                  type: EntitlementType.PADEL_ENTRY,
                },
              },
              update: entitlementBase,
              create: { ...entitlementBase, lineItemIndex: 0 },
            });
            await tx.entitlement.upsert({
              where: {
                purchaseId_saleLineId_lineItemIndex_ownerKey_type: {
                  purchaseId: entitlementPurchaseId,
                  saleLineId: saleLine.id,
                  lineItemIndex: 1,
                  ownerKey,
                  type: EntitlementType.PADEL_ENTRY,
                },
              },
              update: entitlementBase,
              create: { ...entitlementBase, lineItemIndex: 1 },
            });

            const partnerFilled = Boolean(partnerSlot.profileId || partnerSlot.playerProfileId);
            const partnerSlotStatus = partnerFilled ? PadelPairingSlotStatus.FILLED : PadelPairingSlotStatus.PENDING;
            const pairingStatus = partnerSlotStatus === PadelPairingSlotStatus.FILLED ? "COMPLETE" : "INCOMPLETE";

            await tx.padelPairing.update({
              where: { id: pairing.id },
              data: {
                pairingStatus,
                lifecycleStatus: PadelPairingLifecycleStatus.CONFIRMED_CAPTAIN_FULL,
                slots: {
                  update: [
                    {
                      where: { id: captainSlot.id },
                      data: {
                        ticketId: ticketCaptain.id,
                        profileId: userId,
                        paymentStatus: PadelPairingPaymentStatus.PAID,
                        slotStatus: PadelPairingSlotStatus.FILLED,
                      },
                    },
                    {
                      where: { id: partnerSlot.id },
                      data: {
                        ticketId: ticketPartner.id,
                        paymentStatus: PadelPairingPaymentStatus.PAID,
                        slotStatus: partnerSlotStatus,
                      },
                    },
                  ],
                },
              },
            });

            shouldEnsureEntries = partnerFilled;
          }

          await tx.paymentEvent.upsert({
            where: { stripePaymentIntentId: purchaseId },
            update: {
              status: "OK",
              errorMessage: null,
              purchaseId,
              source: PaymentEventSource.API,
              dedupeKey: effectiveDedupeKey,
              attempt: { increment: 1 },
              eventId: event.id,
              userId,
              amountCents: 0,
              platformFeeCents: 0,
              stripeFeeCents: 0,
              updatedAt: new Date(),
            },
            create: {
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

        if (shouldEnsureEntries) {
          await ensureEntriesForConfirmedPairing(pairing.id);
        }

        if (padelConfig) {
          const fullName = userData?.user?.user_metadata?.full_name || profile?.fullName || "Jogador Padel";
          const emailToSave = userData?.user?.email || null;
          const phoneToSave = userData?.user?.phone || contact || profile?.contactPhone || null;
          await upsertPadelPlayerProfile({
            organizerId: padelConfig.organizerId,
            fullName,
            email: emailToSave,
            phone: phoneToSave,
          });
        }

        return NextResponse.json({
          ok: true,
          code: "OK",
          status: "OK",
          nextAction: "NONE",
          retryable: false,
          freeCheckout: true,
          isFreeCheckout: true,
          purchaseId,
          paymentIntentId: FREE_PLACEHOLDER_INTENT_ID,
          paymentScenario: scenarioAdjusted,
          amount: 0,
          currency: (ticketType.currency || "EUR").toUpperCase(),
          discountCents,
          breakdown: buildPublicBreakdown({
            lines,
            subtotalCents: pricing.subtotalCents,
            discountCents,
            totalCents: 0,
            currency: (ticketType.currency || "EUR").toUpperCase(),
          }),
          intentFingerprint,
          idempotencyKey: clientIdempotencyKey ?? effectiveDedupeKey,
        });
      }

      if (!userId || !profile?.username?.trim()) {
        return intentError("USERNAME_REQUIRED_FOR_FREE", "Falta terminar o perfil (username) para concluir eventos gratuitos.", {
          httpStatus: 403,
          status: "FAILED",
          nextAction: "LOGIN",
          retryable: false,
        });
      }

      // Idempotência anti-double click e 1 por user: se já existe bilhete para este evento, recusar
      const existingFreeTicket = await prisma.ticket.findFirst({
        where: { eventId: event.id, userId, pricePaid: 0 },
        select: { id: true },
      });
      if (existingFreeTicket) {
        return intentError("FREE_ALREADY_CLAIMED", "Já tens uma inscrição gratuita neste evento.", {
          httpStatus: 409,
          status: "FAILED",
          nextAction: "NONE",
          retryable: false,
        });
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
        return intentError("FREE_RATE_LIMIT", "Já fizeste uma inscrição gratuita há poucos minutos. Aguarda antes de tentar novamente.", {
          httpStatus: 429,
          status: "FAILED",
          nextAction: "NONE",
          retryable: true,
          extra: { purchaseId: recentFree.purchaseId },
        });
      }

      const createdTicketsCount = 0;
      const freePayload = {
        eventId: event.id,
        purchaseId,
        userId: ownerResolved.ownerUserId ?? userId,
        ownerIdentityId: ownerResolved.ownerIdentityId ?? null,
        promoCodeId: promoCodeId ? Number(promoCodeId) : null,
        subtotalCents: pricing.subtotalCents,
        discountCents,
        platformFeeCents: 0,
        feeMode: pricing.feeMode,
        currency: currency.toUpperCase(),
        lines: lines.map((l) => ({
          ticketTypeId: l.ticketTypeId,
          quantity: l.quantity,
          unitPriceCents: l.unitPriceCents,
        })),
      };

      await prisma.paymentEvent.create({
        data: {
          stripePaymentIntentId: purchaseId,
          status: "PROCESSING",
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
      await enqueueOperation({
        operationType: "UPSERT_LEDGER_FROM_PI_FREE",
        dedupeKey: purchaseId,
        correlations: { purchaseId, eventId: event.id },
        payload: freePayload,
      });

      if (padelConfig) {
        const fullName = userData?.user?.user_metadata?.full_name || profile?.fullName || "Jogador Padel";
        const emailToSave = userData?.user?.email || null;
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
                  ctaUrl: `/organizador?tab=analyze&section=vendas&eventId=${event.id}`,
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
        code: "OK",
        status: "PROCESSING",
        nextAction: "NONE",
        retryable: true,
        freeCheckout: true,
        isFreeCheckout: true,
        purchaseId,
        paymentIntentId: FREE_PLACEHOLDER_INTENT_ID,
        paymentScenario,
        ticketsCreated: createdTicketsCount,
        amount: 0,
        currency: currency.toUpperCase(),
        discountCents,
        breakdown: buildPublicBreakdown({
          lines,
          subtotalCents: pricing.subtotalCents,
          discountCents,
          totalCents: 0,
          currency: currency.toUpperCase(),
        }),
        intentFingerprint,
        idempotencyKey: clientIdempotencyKey ?? effectiveDedupeKey,
      });
    }

    const metadata: Record<string, string> = {
      eventId: String(event.id),
      eventSlug: String(event.slug),
      purchaseId,
      intentFingerprint,
      items: JSON.stringify(normalizedItems),
      paymentScenario: scenarioAdjusted,
      baseAmountCents: String(preDiscountAmountCents),
      discountCents: String(discountCents),
      platformFeeMode: pricing.feeMode,
      platformFeeBps: String(pricing.feeBpsApplied),
      platformFeeFixedCents: String(pricing.feeFixedApplied),
      platformFeeCents: String(pricing.platformFeeCents),
      platformFeeCombinedCents: String(platformFeeCombinedCents),
      stripeFeeEstimateCents: String(stripeFeeEstimateCents),
      contact: contact?.trim() ?? "",
      stripeAccountId: stripeAccountId ?? "orya",
      promoCode: promoCodeId ? String(promoCodeId) : "",
      promoCodeRaw: promoCodeInput,
      totalQuantity: String(totalQuantity),
      breakdown: JSON.stringify({
        lines,
        subtotalCents: pricing.subtotalCents,
        feeMode: pricing.feeMode,
        platformFeeCents: pricing.platformFeeCents,
        platformFeeCombinedCents,
        stripeFeeEstimateCents,
        totalCents: totalAmountInCents,
        currency: currency.toUpperCase(),
      }),
    };

    // Metadata idempotencyKey deve ser estável (purchaseId) para não disparar idempotency_error na Stripe.
    metadata.idempotencyKey = effectiveDedupeKey;
    if (clientIdempotencyKey) {
      metadata.clientIdempotencyKey = clientIdempotencyKey;
    }
    if (ownerResolved.ownerUserId) metadata.ownerUserId = ownerResolved.ownerUserId;
    if (ownerResolved.ownerIdentityId) metadata.ownerIdentityId = ownerResolved.ownerIdentityId;
    if (ownerResolved.emailNormalized) metadata.emailNormalized = ownerResolved.emailNormalized;
    if (typeof body?.pairingId === "number") metadata.pairingId = String(body.pairingId);
    if (typeof body?.slotId === "number") metadata.slotId = String(body.slotId);
    if (typeof body?.resaleId === "string") metadata.resaleId = body.resaleId;
    if (typeof body?.ticketId === "string" || typeof body?.ticketId === "number") metadata.ticketId = String(body.ticketId);
    if (paymentScenario === "RESALE" && userId) metadata.buyerUserId = userId;

    const allowedPaymentMethods = ["card", "link", "mb_way"] as const;

    const intentParams: Parameters<typeof stripe.paymentIntents.create>[0] = {
      amount: Math.max(0, totalAmountInCents),
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

    // Stripe idempotency: se o cliente enviar idempotencyKey, usamos-na para diferenciar intents e evitar reaproveitar PI terminal
    const stripeIdempotencyKey =
      clientIdempotencyKey && clientIdempotencyKey.trim().length > 0
        ? clampIdempotencyKey(`${checkoutIdempotencyKey}:${clientIdempotencyKey}`)
        : checkoutIdempotencyKey;

    const createPi = async (idemKey?: string) =>
      stripe.paymentIntents.create(intentParams, idemKey ? { idempotencyKey: idemKey } : undefined);

    const isTerminal = (status?: string | null) =>
      !!status && ["succeeded", "canceled", "requires_capture"].includes(status);

    let paymentIntent;
    let attemptKey = stripeIdempotencyKey;
    let attempts = 0;
    while (attempts < 3) {
      try {
        paymentIntent = await createPi(attemptKey);
        if (isTerminal(paymentIntent?.status)) {
          // PI reaproveitado (provavelmente via idempotency) em estado terminal — gerar chave nova
          attempts += 1;
          attemptKey = `${stripeIdempotencyKey}:retry:${attempts}:${Date.now()}`;
          paymentIntent = null as any;
          continue;
        }
        break;
      } catch (e: unknown) {
        const anyErr = e as { type?: string; code?: string; message?: string };
        const isIdem =
          anyErr?.type === "StripeIdempotencyError" ||
          anyErr?.code === "idempotency_error" ||
          (typeof anyErr?.message === "string" && anyErr.message.toLowerCase().includes("idempot"));

        if (isIdem) {
          attempts += 1;
          attemptKey = `${stripeIdempotencyKey}:idem:${attempts}:${Date.now()}`;
          console.warn("[payments/intent] Stripe idempotency mismatch, a recalcular com nova key", {
            purchaseId,
            intentFingerprint,
            attemptKey,
          });
          continue;
        }
        throw e;
      }
    }

    // Se apesar das retentativas ainda recebemos um PI terminal, devolvemos 409 para o FE refazer tudo com novas keys.
    if (!paymentIntent || isTerminal(paymentIntent?.status)) {
      return intentError(
        "PAYMENT_INTENT_TERMINAL",
        "Sessão de pagamento expirada. Vamos criar um novo intento.",
        { httpStatus: 409, status: "FAILED", retryable: true, nextAction: "PAY_NOW" },
      );
    }

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

    if (!paymentIntent.client_secret) {
      return NextResponse.json(
        {
          ok: false,
          error: "Não foi possível preparar o pagamento (client_secret em falta).",
          code: "MISSING_CLIENT_SECRET",
          retryable: true,
        },
        { status: 500 },
      );
    }
    return NextResponse.json({
      ok: true,
      code: "OK",
      status: "REQUIRES_ACTION",
      nextAction: "PAY_NOW",
      retryable: true,
      clientSecret: paymentIntent.client_secret,
      amount: totalAmountInCents,
      currency: currency.toUpperCase(),
      discountCents,
      paymentIntentId: paymentIntent.id,
      purchaseId,
      paymentScenario: scenarioAdjusted,
      breakdown: buildPublicBreakdown({
        lines,
        subtotalCents: pricing.subtotalCents,
        discountCents,
        totalCents: totalAmountInCents,
        currency: currency.toUpperCase(),
      }),
      intentFingerprint,
      idempotencyKey: clientIdempotencyKey ?? effectiveDedupeKey,
    });
  } catch (err) {
    logFinanceError("checkout", err, { route: "/api/payments/intent" });
    return NextResponse.json(
      { ok: false, error: "Erro ao criar PaymentIntent." },
      { status: 500 },
    );
  }
}
