// app/api/payments/intent/route.ts
// Canonical Payment Intent endpoint (V9 checkout gateway).
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { createSupabaseServer } from "@/lib/supabaseServer";
import type Stripe from "stripe";
import { createPaymentIntent, retrievePaymentIntent } from "@/domain/finance/gateway/stripeGateway";
import { computeFeePolicyVersion, createCheckout } from "@/domain/finance/checkout";
import { ensurePaymentIntent } from "@/domain/finance/paymentIntent";
import { getPlatformFees } from "@/lib/platformSettings";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { logError, logInfo, logWarn } from "@/lib/observability/logger";
import { ingestCrmInteraction } from "@/lib/crm/ingest";
import {
  ConsentStatus,
  ConsentType,
  CrmInteractionSource,
  CrmInteractionType,
  EntitlementStatus,
  EntitlementType,
  EventPricingMode,
  PadelPairingSlotRole,
  PadelPaymentMode,
  PadelPairingPaymentStatus,
  PadelPairingSlotStatus,
  PadelRegistrationStatus,
  ProcessorFeesStatus,
  Prisma,
  SourceType,
} from "@prisma/client";
import { FeeMode } from "@prisma/client";
import { paymentScenarioSchema, type PaymentScenario } from "@/lib/paymentScenario";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";
import { computePromoDiscountCents } from "@/lib/promoMath";
import { computePricing } from "@/lib/pricing";
import { computeCombinedFees } from "@/lib/fees";
import { normalizeEmail } from "@/lib/utils/email";
import { hasActiveEntitlementForEvent } from "@/lib/entitlements/accessChecks";
import { getLatestPolicyForEvent } from "@/lib/checkin/accessPolicy";
import { evaluateEventAccess } from "@/domain/access/evaluateAccess";
import { deriveIsFreeEvent } from "@/domain/events/derivedIsFree";
import { INACTIVE_REGISTRATION_STATUSES, mapRegistrationToPairingLifecycle, upsertPadelRegistrationForPairing } from "@/domain/padelRegistration";
import {
  checkoutMetadataSchema,
  normalizeItemsForMetadata,
} from "@/lib/checkoutSchemas";
import { resolveOwner } from "@/lib/ownership/resolveOwner";
import { appendEventLog } from "@/domain/eventLog/append";
import { makeOutboxDedupeKey } from "@/domain/outbox/dedupe";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { checkPadelCategoryLimit } from "@/domain/padelCategoryLimit";
import { sanitizeUsername } from "@/lib/username";
import { checkoutKey, clampIdempotencyKey } from "@/lib/stripe/idempotency";
import { logFinanceError } from "@/lib/observability/finance";
import { formatPaidSalesGateMessage, getPaidSalesGate } from "@/lib/organizationPayments";

const FREE_PLACEHOLDER_INTENT_ID = "FREE_CHECKOUT";
const ORYA_CARD_FEE_BPS = 100;
const INTENT_BUILD_FINGERPRINT = "INTENT_PATCH_v2";

const pairingSlotSelect = {
  id: true,
  slot_role: true,
  slotStatus: true,
  paymentStatus: true,
  profileId: true,
  invitedContact: true,
  invitedUserId: true,
} satisfies Prisma.PadelPairingSlotSelect;

const pairingEventSelect = {
  id: true,
  slug: true,
  title: true,
  status: true,
  isDeleted: true,
  startsAt: true,
  timezone: true,
  coverImageUrl: true,
  organizationId: true,
  organization: {
    select: {
      feeMode: true,
      platformFeeBps: true,
      platformFeeFixedCents: true,
      orgType: true,
      stripeAccountId: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
    },
  },
} satisfies Prisma.EventSelect;

const pairingForIntentSelect = {
  id: true,
  organizationId: true,
  eventId: true,
  categoryId: true,
  createdByUserId: true,
  pairingStatus: true,
  payment_mode: true,
  pairingJoinMode: true,
  partnerInviteToken: true,
  partnerLinkExpiresAt: true,
  deadlineAt: true,
  graceUntilAt: true,
  registration: { select: { id: true, status: true, buyerIdentityId: true } },
  event: { select: pairingEventSelect },
  slots: { select: pairingSlotSelect },
} satisfies Prisma.PadelPairingSelect;

const padelRegistrationLineSelect = {
  id: true,
  pairingSlotId: true,
  label: true,
  qty: true,
  unitAmount: true,
  totalAmount: true,
} satisfies Prisma.PadelRegistrationLineSelect;

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
  platformFeeCents?: number;
  cardPlatformFeeCents?: number;
  cardPlatformFeeBps?: number;
  totalCents: number;
  currency: string;
  paymentMethod?: "mbway" | "card";
};

type Guest = {
  name?: string;
  email?: string;
  phone?: string | null;
  consent?: boolean | null;
};

function isValidEmail(email: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

function buildPublicBreakdown({
  lines,
  subtotalCents,
  discountCents,
  platformFeeCents,
  cardPlatformFeeCents,
  cardPlatformFeeBps,
  totalCents,
  currency,
  paymentMethod,
}: PublicBreakdown): PublicBreakdown {
  return {
    lines,
    subtotalCents,
    discountCents,
    platformFeeCents,
    cardPlatformFeeCents,
    cardPlatformFeeBps,
    totalCents,
    currency,
    paymentMethod,
  };
}

const FREE_CHECKOUT_OUTBOX_TYPE = "payment.free_checkout.requested";

async function recordFreeCheckoutOutbox(params: {
  organizationId: number;
  eventId: number;
  purchaseId: string;
  actorUserId?: string | null;
  idempotencyKey: string;
  payload: Prisma.InputJsonObject;
}) {
  const { organizationId, eventId, purchaseId, actorUserId, idempotencyKey, payload } = params;
  const eventLogId = crypto.randomUUID();
  return prisma.$transaction(async (tx) => {
    const log = await appendEventLog(
      {
        eventId: eventLogId,
        organizationId,
        eventType: FREE_CHECKOUT_OUTBOX_TYPE,
        idempotencyKey,
        actorUserId: actorUserId ?? null,
        sourceType: SourceType.EVENT,
        sourceId: String(eventId),
        correlationId: purchaseId,
        payload: {
          eventId,
          purchaseId,
          scenario: payload.scenario ?? null,
        },
      },
      tx,
    );
    if (!log) return { ok: true, deduped: true };
    await recordOutboxEvent(
      {
        eventId: eventLogId,
        eventType: FREE_CHECKOUT_OUTBOX_TYPE,
        dedupeKey: makeOutboxDedupeKey(FREE_CHECKOUT_OUTBOX_TYPE, idempotencyKey),
        payload,
        causationId: idempotencyKey,
        correlationId: purchaseId,
      },
      tx,
    );
    return { ok: true, deduped: false };
  });
}

function normalizePaymentMethod(raw: unknown): "mbway" | "card" {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (value === "card") return "card";
  if (value === "mb_way" || value === "mbway") return "mbway";
  return "mbway";
}

async function handlePadelRegistrationIntent(req: NextRequest, body: Body) {
  const supabase = await createSupabaseServer();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id ?? null;
  if (!userId) {
    return intentError("AUTH_REQUIRED", "Inicia sessão para concluir o pagamento.", {
      httpStatus: 401,
      status: "FAILED",
      nextAction: "LOGIN",
    });
  }

  const pairingId =
    typeof body.pairingId === "number"
      ? body.pairingId
      : typeof body.pairingId === "string"
        ? Number(body.pairingId)
        : null;
  if (!pairingId || !Number.isFinite(pairingId)) {
    return intentError("PAIRING_REQUIRED", "Precisas de uma dupla ativa para continuar.", {
      httpStatus: 400,
      status: "FAILED",
      retryable: false,
    });
  }

  const slotIdInput =
    typeof body.slotId === "number"
      ? body.slotId
      : typeof body.slotId === "string"
        ? Number(body.slotId)
        : null;
  const inviteToken =
    typeof (body as { inviteToken?: unknown })?.inviteToken === "string"
      ? (body as { inviteToken?: string }).inviteToken!.trim()
      : null;

  const scenarioParsed = paymentScenarioSchema.safeParse(
    typeof body.paymentScenario === "string" ? body.paymentScenario.toUpperCase() : body.paymentScenario,
  );
  const requestedScenario = scenarioParsed.success ? scenarioParsed.data : null;

  const paymentMethod = normalizePaymentMethod(body.paymentMethod);
  const idempotencyKeyHeader = req.headers.get("Idempotency-Key");
  const clientIdempotencyKey =
    (typeof body.idempotencyKey === "string" ? body.idempotencyKey : idempotencyKeyHeader || "").trim() || null;
  const purchaseIdFromBody =
    typeof body.purchaseId === "string" && body.purchaseId.trim() !== "" ? body.purchaseId.trim() : "";

  const pairing = await prisma.padelPairing.findUnique({
    where: { id: pairingId },
    select: pairingForIntentSelect,
  });
  if (!pairing?.event || pairing.event.isDeleted) {
    return intentError("EVENT_NOT_FOUND", "Evento não encontrado.", { httpStatus: 404 });
  }
  if (pairing.pairingStatus === "CANCELLED") {
    return intentError("PAIRING_CANCELLED", "A dupla foi cancelada.", { httpStatus: 409, status: "FAILED" });
  }
  if (pairing.registration && INACTIVE_REGISTRATION_STATUSES.includes(pairing.registration.status)) {
    return intentError("PAIRING_INVALID", "A dupla já não está ativa.", { httpStatus: 409, status: "FAILED" });
  }

  const scenario =
    requestedScenario ??
    (pairing.payment_mode === PadelPaymentMode.FULL ? "GROUP_FULL" : "GROUP_SPLIT");
  if (scenario === "GROUP_FULL" && pairing.payment_mode !== PadelPaymentMode.FULL) {
    return intentError("PAIRING_MODE_MISMATCH", "A dupla não está em modo full.", { httpStatus: 400 });
  }
  if (scenario === "GROUP_SPLIT" && pairing.payment_mode !== PadelPaymentMode.SPLIT) {
    return intentError("PAIRING_MODE_MISMATCH", "A dupla não está em modo split.", { httpStatus: 400 });
  }

  const pendingSlot =
    pairing.slots.find((slot) => slot.slotStatus === PadelPairingSlotStatus.PENDING) ?? null;
  const captainSlot = pairing.slots.find((slot) => slot.slot_role === PadelPairingSlotRole.CAPTAIN) ?? null;
  const partnerSlot = pairing.slots.find((slot) => slot.slot_role === PadelPairingSlotRole.PARTNER) ?? null;
  const explicitSlot = slotIdInput ? pairing.slots.find((slot) => slot.id === slotIdInput) ?? null : null;
  let targetSlot =
    explicitSlot ??
    (scenario === "GROUP_SPLIT"
      ? pendingSlot ??
        (partnerSlot && partnerSlot.paymentStatus !== PadelPairingPaymentStatus.PAID ? partnerSlot : null) ??
        (captainSlot && captainSlot.paymentStatus !== PadelPairingPaymentStatus.PAID ? captainSlot : null)
      : captainSlot ?? pairing.slots[0] ?? null);
  if (!targetSlot) {
    return intentError("PAIRING_SLOT_REQUIRED", "Slot da dupla em falta.", { httpStatus: 400 });
  }

  if (
    scenario === "GROUP_SPLIT" &&
    targetSlot.slot_role === PadelPairingSlotRole.PARTNER &&
    targetSlot.slotStatus !== PadelPairingSlotStatus.FILLED
  ) {
    const isCaptain = captainSlot?.profileId === userId || pairing.createdByUserId === userId;
    if (isCaptain && captainSlot && captainSlot.paymentStatus !== PadelPairingPaymentStatus.PAID) {
      targetSlot = captainSlot;
    }
  }

  if (scenario === "GROUP_SPLIT" && targetSlot.paymentStatus === PadelPairingPaymentStatus.PAID) {
    return intentError("PAIRING_SLOT_PAID", "Este lugar já foi pago.", { httpStatus: 409 });
  }

  if (scenario === "GROUP_SPLIT" && pairing.deadlineAt && pairing.deadlineAt.getTime() < Date.now()) {
    return intentError("PAIRING_EXPIRED", "A dupla expirou.", { httpStatus: 410 });
  }

  if (
    scenario === "GROUP_SPLIT" &&
    targetSlot.slot_role === PadelPairingSlotRole.PARTNER &&
    targetSlot.slotStatus !== PadelPairingSlotStatus.FILLED
  ) {
    return intentError("PARTNER_ACCEPT_REQUIRED", "O parceiro precisa aceitar antes de pagar.", {
      httpStatus: 409,
      status: "FAILED",
      nextAction: "ACCEPT",
    });
  }

  if (scenario === "GROUP_SPLIT" && pairing.graceUntilAt && pairing.graceUntilAt.getTime() < Date.now()) {
    return intentError("PAIRING_EXPIRED", "A dupla expirou.", { httpStatus: 410 });
  }

  const matchesUser = pairing.slots.some((slot) => slot.profileId === userId);
  if (!matchesUser) {
    const isUnclaimed = !targetSlot.profileId;
    let allowUnclaimed = false;
    if (isUnclaimed) {
      if (pairing.pairingJoinMode === "LOOKING_FOR_PARTNER") {
        allowUnclaimed = true;
      } else if (
        inviteToken &&
        pairing.partnerInviteToken &&
        inviteToken === pairing.partnerInviteToken &&
        (!pairing.partnerLinkExpiresAt || pairing.partnerLinkExpiresAt > new Date())
      ) {
        allowUnclaimed = true;
      } else if (targetSlot.invitedContact) {
        const invitedRaw = targetSlot.invitedContact.trim().toLowerCase();
        const invited = invitedRaw.startsWith("@") ? invitedRaw.slice(1) : invitedRaw;
        const username = userData?.user?.user_metadata?.username?.trim().toLowerCase() ?? "";
        const email = userData?.user?.email?.trim().toLowerCase() ?? "";
        if ((invited.includes("@") && email && invited === email) || (!invited.includes("@") && username && invited === username)) {
          allowUnclaimed = true;
        }
      }
    }
    if (!allowUnclaimed) {
      return intentError("PAIRING_NOT_OWNED", "Esta dupla pertence a outro utilizador.", {
        httpStatus: 403,
        status: "FAILED",
      });
    }
  }

  const categoryLinkId =
    typeof body.padelCategoryLinkId === "number"
      ? body.padelCategoryLinkId
      : typeof body.ticketTypeId === "number"
        ? body.ticketTypeId
        : null;

  let categoryLink = categoryLinkId
    ? await prisma.padelEventCategoryLink.findUnique({
        where: { id: categoryLinkId },
        select: {
          id: true,
          eventId: true,
          padelCategoryId: true,
          pricePerPlayerCents: true,
          currency: true,
          isEnabled: true,
        },
      })
    : null;
  if (!categoryLink && pairing.categoryId) {
    categoryLink = await prisma.padelEventCategoryLink.findUnique({
      where: {
        eventId_padelCategoryId: {
          eventId: pairing.eventId,
          padelCategoryId: pairing.categoryId,
        },
      },
      select: {
        id: true,
        eventId: true,
        padelCategoryId: true,
        pricePerPlayerCents: true,
        currency: true,
        isEnabled: true,
      },
    });
  }
  if (!categoryLink || categoryLink.eventId !== pairing.eventId) {
    return intentError("PADEL_CATEGORY_LINK_REQUIRED", "Categoria da dupla em falta.", {
      httpStatus: 400,
      status: "FAILED",
    });
  }
  if (categoryLink.isEnabled === false) {
    return intentError("CATEGORY_DISABLED", "Categoria indisponível.", {
      httpStatus: 409,
      status: "FAILED",
    });
  }
  if (pairing.categoryId && categoryLink.padelCategoryId !== pairing.categoryId) {
    return intentError("PADEL_CATEGORY_MISMATCH", "Categoria da dupla não corresponde.", {
      httpStatus: 409,
      status: "FAILED",
    });
  }

  const currency = (categoryLink.currency ?? "EUR").toUpperCase();
  if (currency !== "EUR") {
    return intentError("CURRENCY_NOT_SUPPORTED", "Moeda não suportada.", { httpStatus: 400 });
  }

  const ownerResolved = await resolveOwner({ sessionUserId: userId, guestEmail: null });
  const buyerIdentityId = ownerResolved.ownerIdentityId ?? null;

  const registrationId = await prisma.$transaction(async (tx) => {
    let registration = await tx.padelRegistration.findUnique({
      where: { pairingId: pairing.id },
      select: { id: true, buyerIdentityId: true, currency: true },
    });
    if (!registration) {
      registration = await tx.padelRegistration.create({
        data: {
          pairingId: pairing.id,
          organizationId: pairing.organizationId,
          eventId: pairing.eventId,
          buyerIdentityId,
          currency,
        },
        select: { id: true, buyerIdentityId: true, currency: true },
      });
    } else {
      const updates: Prisma.PadelRegistrationUpdateInput = {};
      if (buyerIdentityId && !registration.buyerIdentityId) {
        updates.buyerIdentityId = buyerIdentityId;
      }
      if (currency && registration.currency !== currency) {
        updates.currency = currency;
      }
      if (Object.keys(updates).length > 0) {
        registration = await tx.padelRegistration.update({
          where: { id: registration.id },
          data: updates,
          select: { id: true, buyerIdentityId: true, currency: true },
        });
      }
    }

    const existingLines = await tx.padelRegistrationLine.findMany({
      where: { padelRegistrationId: registration.id },
      select: { id: true, pairingSlotId: true, unitAmount: true, totalAmount: true, label: true },
    });
    const bySlotId = new Map(
      existingLines
        .filter((line) => typeof line.pairingSlotId === "number")
        .map((line) => [line.pairingSlotId as number, line]),
    );

    for (const slot of pairing.slots) {
      const label = slot.slot_role === PadelPairingSlotRole.CAPTAIN ? "Inscrição capitão" : "Inscrição parceiro";
      const unitAmount = Math.max(0, Math.floor(categoryLink.pricePerPlayerCents ?? 0));
      const totalAmount = unitAmount;
      const existing = slot.id ? bySlotId.get(slot.id) : null;
      if (existing) {
        if (existing.unitAmount !== unitAmount || existing.totalAmount !== totalAmount || existing.label !== label) {
          await tx.padelRegistrationLine.update({
            where: { id: existing.id },
            data: {
              label,
              unitAmount,
              totalAmount,
              qty: 1,
            },
          });
        }
      } else if (slot.id) {
        await tx.padelRegistrationLine.create({
          data: {
            padelRegistrationId: registration.id,
            pairingSlotId: slot.id,
            label,
            qty: 1,
            unitAmount,
            totalAmount,
          },
        });
      }
    }

    return registration.id;
  });

  const registration = await prisma.padelRegistration.findUnique({
    where: { id: registrationId },
    select: {
      id: true,
      lines: {
        select: padelRegistrationLineSelect,
      },
    },
  });
  if (!registration || !registration.lines.length) {
    return intentError("PADEL_REGISTRATION_LINES_EMPTY", "Inscrição inválida.", {
      httpStatus: 400,
      status: "FAILED",
    });
  }

  const payableLines =
    scenario === "GROUP_FULL"
      ? registration.lines
      : registration.lines.filter((line) => line.pairingSlotId === targetSlot.id);
  if (!payableLines.length) {
    return intentError("PADEL_REGISTRATION_LINES_EMPTY", "Sem linhas para pagamento.", {
      httpStatus: 400,
      status: "FAILED",
    });
  }

  const subtotalCents = payableLines.reduce((sum, line) => sum + Math.max(0, line.totalAmount), 0);
  const platformFees = await getPlatformFees();
  const pricing = computePricing(subtotalCents, 0, {
    organizationFeeMode: pairing.event.organization?.feeMode ?? null,
    organizationPlatformFeeBps: pairing.event.organization?.platformFeeBps ?? null,
    organizationPlatformFeeFixedCents: pairing.event.organization?.platformFeeFixedCents ?? null,
    platformDefaultFeeMode: FeeMode.INCLUDED,
    platformDefaultFeeBps: platformFees.feeBps,
    platformDefaultFeeFixedCents: platformFees.feeFixedCents,
    isPlatformOrg: pairing.event.organization?.orgType === "PLATFORM",
  });
  const feePolicyVersion = computeFeePolicyVersion({
    feeMode: pricing.feeMode,
    feeBps: pricing.feeBpsApplied,
    feeFixed: pricing.feeFixedApplied,
  });

  const purchaseId =
    purchaseIdFromBody ||
    `padel:${pairing.id}:${scenario === "GROUP_FULL" ? "full" : `slot:${targetSlot.id}`}`;
  const checkoutIdempotencyKey = checkoutKey(purchaseId);

  const snapshotLines = payableLines.map((line) => ({
    quantity: line.qty,
    unitPriceCents: line.unitAmount,
    totalAmountCents: line.totalAmount,
    currency,
    sourceLineId: String(line.id),
    label: line.label,
  }));

  await createCheckout({
    orgId: pairing.organizationId,
    sourceType: SourceType.PADEL_REGISTRATION,
    sourceId: registration.id,
    idempotencyKey: checkoutIdempotencyKey,
    paymentId: purchaseId,
    customerIdentityId: buyerIdentityId,
    resolvedSnapshot: {
      orgId: pairing.organizationId,
      customerIdentityId: buyerIdentityId ?? null,
      eventId: pairing.eventId,
      snapshot: {
        currency,
        gross: pricing.totalCents,
        discounts: 0,
        taxes: 0,
        platformFee: pricing.platformFeeCents,
        total: pricing.totalCents,
        netToOrgPending: Math.max(0, pricing.totalCents - pricing.platformFeeCents),
        processorFeesStatus: ProcessorFeesStatus.PENDING,
        processorFeesActual: null,
        feeMode: pricing.feeMode,
        feeBps: pricing.feeBpsApplied,
        feeFixed: pricing.feeFixedApplied,
        feePolicyVersion,
        promoPolicyVersion: null,
        sourceType: SourceType.PADEL_REGISTRATION,
        sourceId: registration.id,
        lineItems: snapshotLines,
      },
    },
    skipAccessChecks: true,
  });

  if (pricing.totalCents <= 0) {
    await recordFreeCheckoutOutbox({
      organizationId: pairing.organizationId,
      eventId: pairing.eventId,
      purchaseId,
      actorUserId: userId,
      idempotencyKey: clientIdempotencyKey ?? checkoutIdempotencyKey,
      payload: {
        scenario,
        pairingId: pairing.id,
        slotId: targetSlot.id,
        registrationId: registration.id,
        lineIds: payableLines.map((line) => line.id),
        sourceType: SourceType.PADEL_REGISTRATION,
        sourceId: registration.id,
        ownerUserId: ownerResolved.ownerUserId ?? null,
        ownerIdentityId: buyerIdentityId ?? null,
        emailNormalized: ownerResolved.emailNormalized ?? null,
      } as Prisma.InputJsonObject,
    });

    return jsonWrap({
      ok: true,
      code: "OK",
      status: "OK",
      nextAction: "NONE",
      retryable: false,
      freeCheckout: true,
      isGratisCheckout: true,
      purchaseId,
      paymentIntentId: FREE_PLACEHOLDER_INTENT_ID,
      paymentScenario: scenario,
      amount: 0,
      currency,
      discountCents: 0,
      breakdown: buildPublicBreakdown({
        lines: snapshotLines.map((line) => ({
          ticketTypeId: categoryLink.id,
          name: line.label ?? "Inscrição",
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          currency,
          lineTotalCents: line.totalAmountCents ?? line.unitPriceCents * line.quantity,
        })),
        subtotalCents,
        discountCents: 0,
        platformFeeCents: pricing.platformFeeCents,
        cardPlatformFeeCents: 0,
        cardPlatformFeeBps: ORYA_CARD_FEE_BPS,
        totalCents: 0,
        currency,
        paymentMethod,
      }),
      idempotencyKey: clientIdempotencyKey ?? checkoutIdempotencyKey,
    });
  }

  const { paymentIntent } = await ensurePaymentIntent({
    purchaseId,
    orgId: pairing.organizationId,
    sourceType: SourceType.PADEL_REGISTRATION,
    sourceId: registration.id,
    amountCents: pricing.totalCents,
    currency,
    intentParams: {
      payment_method_types: paymentMethod === "card" ? ["card"] : ["mb_way"],
    },
    metadata: {
      pairingId: String(pairing.id),
      slotId: String(targetSlot.id),
      eventId: String(pairing.eventId),
      paymentScenario: scenario,
      categoryLinkId: String(categoryLink.id),
      paymentMethod,
      ...(ownerResolved.ownerUserId ? { ownerUserId: ownerResolved.ownerUserId } : {}),
      ...(buyerIdentityId ? { ownerIdentityId: buyerIdentityId } : {}),
      ...(ownerResolved.emailNormalized ? { emailNormalized: ownerResolved.emailNormalized } : {}),
    },
    orgContext: {
      stripeAccountId: pairing.event.organization?.stripeAccountId ?? null,
      stripeChargesEnabled: pairing.event.organization?.stripeChargesEnabled ?? null,
      stripePayoutsEnabled: pairing.event.organization?.stripePayoutsEnabled ?? null,
      orgType: pairing.event.organization?.orgType ?? null,
    },
    requireStripe: true,
    clientIdempotencyKey: clientIdempotencyKey ?? undefined,
    customerIdentityId: buyerIdentityId ?? null,
    resolvedSnapshot: {
      orgId: pairing.organizationId,
      customerIdentityId: buyerIdentityId ?? null,
      eventId: pairing.eventId,
      snapshot: {
        currency,
        gross: pricing.totalCents,
        discounts: 0,
        taxes: 0,
        platformFee: pricing.platformFeeCents,
        total: pricing.totalCents,
        netToOrgPending: Math.max(0, pricing.totalCents - pricing.platformFeeCents),
        processorFeesStatus: ProcessorFeesStatus.PENDING,
        processorFeesActual: null,
        feeMode: pricing.feeMode,
        feeBps: pricing.feeBpsApplied,
        feeFixed: pricing.feeFixedApplied,
        feePolicyVersion,
        promoPolicyVersion: null,
        sourceType: SourceType.PADEL_REGISTRATION,
        sourceId: registration.id,
        lineItems: snapshotLines,
      },
    },
    paymentEvent: {
      eventId: pairing.eventId,
      userId,
      amountCents: pricing.totalCents,
      platformFeeCents: pricing.platformFeeCents,
    },
  });

  if (!paymentIntent.client_secret) {
    return intentError("MISSING_CLIENT_SECRET", "Não foi possível preparar o pagamento.", {
      httpStatus: 500,
      status: "FAILED",
      retryable: true,
    });
  }

  return jsonWrap({
    ok: true,
    code: "OK",
    status: "REQUIRES_ACTION",
    nextAction: "PAY_NOW",
    retryable: true,
    clientSecret: paymentIntent.client_secret,
    amount: pricing.totalCents,
    currency,
    discountCents: 0,
    paymentIntentId: paymentIntent.id,
    purchaseId,
    paymentScenario: scenario,
    breakdown: buildPublicBreakdown({
      lines: snapshotLines.map((line) => ({
        ticketTypeId: categoryLink.id,
        name: line.label ?? "Inscrição",
        quantity: line.quantity,
        unitPriceCents: line.unitPriceCents,
        currency,
        lineTotalCents: line.totalAmountCents ?? line.unitPriceCents * line.quantity,
      })),
      subtotalCents,
      discountCents: 0,
      platformFeeCents: pricing.platformFeeCents,
      cardPlatformFeeCents: 0,
      cardPlatformFeeBps: ORYA_CARD_FEE_BPS,
      totalCents: pricing.totalCents,
      currency,
      paymentMethod,
    }),
    idempotencyKey: clientIdempotencyKey ?? checkoutIdempotencyKey,
  });
}

type Body = {
  slug?: string;
  items?: CheckoutItem[];
  contact?: string;
  guest?: Guest;
  promoCode?: string | null;
  paymentScenario?: string | null;
  paymentMethod?: string | null;
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
  sourceType?: string | null;
  padelCategoryLinkId?: number | null;
};

type IntentStatus =
  | "PENDING"
  | "PROCESSING"
  | "REQUIRES_ACTION"
  | "PAID"
  | "FAILED";

type NextAction = "NONE" | "PAY_NOW" | "CONFIRM_GUARANTEE" | "CONTACT_SUPPORT" | "LOGIN" | "CONNECT_STRIPE" | "ACCEPT";

export const PAYMENT_INTENT_TERMINAL_ERROR_OPTS = {
  httpStatus: 409,
  status: "FAILED" as IntentStatus,
  retryable: true,
  nextAction: "PAY_NOW" as NextAction,
} as const;

export const NON_RETRYABLE_CONFLICT_ERROR_OPTS = {
  httpStatus: 409,
  status: "FAILED" as IntentStatus,
  retryable: false,
  nextAction: "NONE" as NextAction,
} as const;

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
  const res = jsonWrap(
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
  if (process.env.NODE_ENV === "development" && (opts?.httpStatus ?? 400) === 410) {
    res.headers.set("X-Orya-Intent-Handler", "app/api/payments/intent/route.ts");
    res.headers.set("X-Orya-Intent-Fingerprint", INTENT_BUILD_FINGERPRINT);
  }
  return res;
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

async function hasExistingFreeEntryForUser(params: { eventId: number; userId: string }) {
  return hasActiveEntitlementForEvent({
    eventId: params.eventId,
    userId: params.userId,
    type: EntitlementType.EVENT_TICKET,
  });
}

async function _POST(req: NextRequest) {
  if (process.env.NODE_ENV === "development") {
    logInfo("payments.intent.build_fingerprint", { fingerprint: INTENT_BUILD_FINGERPRINT });
  }
  try {
    const body = (await req.json().catch(() => null)) as Body | null;

    const sourceTypeRaw = typeof body?.sourceType === "string" ? body?.sourceType?.toUpperCase() : "";
    if (body && sourceTypeRaw === SourceType.PADEL_REGISTRATION) {
      return await handlePadelRegistrationIntent(req, body);
    }

    if (!body || !body.slug || !Array.isArray(body.items) || body.items.length === 0) {
      return intentError("INVALID_INPUT", "Dados inválidos.", { httpStatus: 400, status: "FAILED", nextAction: "NONE", retryable: false });
    }
    const {
      slug,
      items,
      contact,
      guest,
      promoCode: rawPromo,
      paymentScenario: rawScenario,
      idempotencyKey: bodyIdemKey,
    } = body;
    const paymentMethodRaw =
      typeof body?.paymentMethod === "string" ? body.paymentMethod.trim().toLowerCase() : null;
    const paymentMethod: "mbway" | "card" =
      paymentMethodRaw === "card"
        ? "card"
        : paymentMethodRaw === "mb_way" || paymentMethodRaw === "mbway"
          ? "mbway"
          : "mbway";
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
    const guestConsent = guest?.consent === true;
    const guestPhone = guestPhoneRaw ? normalizePhone(guestPhoneRaw) : "";
    const guestEmail = guestEmailRaw && isValidEmail(guestEmailRaw) ? guestEmailRaw : "";

    if (!userId) {
      if (!guestEmail || !guestName) {
        return intentError("AUTH_OR_GUEST_REQUIRED", "Precisas de iniciar sessão ou preencher nome e email para convidado.", { httpStatus: 400 });
      }
      if (!guestConsent) {
        return intentError(
          "CONSENT_REQUIRED",
          "Tens de aceitar a política de privacidade para continuar como convidado.",
          { httpStatus: 400 },
        );
      }
      if (!isValidEmail(guestEmailRaw)) {
        return intentError("INVALID_GUEST_EMAIL", "Email inválido para checkout como convidado.", { httpStatus: 400 });
      }
      if (guestPhoneRaw && !guestPhone) {
        return intentError("INVALID_GUEST_PHONE", "Telemóvel inválido. Usa formato PT: 9XXXXXXXX ou +3519XXXXXXXX.", { httpStatus: 400 });
      }
    }

    let ownerResolved = await resolveOwner({ sessionUserId: userId, guestEmail });
    type OwnerMetadata = { ownerUserId?: string | null; ownerIdentityId?: string | null; emailNormalized?: string | null };
    let ownerForMetadata: OwnerMetadata | undefined =
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
        template_type: string | null;
        is_deleted: boolean;
        pricing_mode: string | null;
        ends_at: Date | null;
        cover_image_url: string | null;
        starts_at: Date;
        timezone: string;
        fee_mode: string | null;
        organization_id: number | null;
        org_type: string | null;
        org_stripe_account_id: string | null;
        org_stripe_charges_enabled: boolean | null;
        org_stripe_payouts_enabled: boolean | null;
        org_official_email: string | null;
        org_official_email_verified_at: Date | null;
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
        e.template_type,
        e.is_deleted,
        e.pricing_mode,
        e.ends_at,
        e.cover_image_url,
        e.starts_at,
        e.timezone,
        e.fee_mode,
        e.organization_id,
        o.org_type AS org_type,
        o.stripe_account_id AS org_stripe_account_id,
        o.stripe_charges_enabled AS org_stripe_charges_enabled,
        o.stripe_payouts_enabled AS org_stripe_payouts_enabled,
        o.official_email AS org_official_email,
        o.official_email_verified_at AS org_official_email_verified_at,
        o.fee_mode AS org_fee_mode,
        o.platform_fee_bps AS org_platform_fee_bps,
        o.platform_fee_fixed_cents AS org_platform_fee_fixed_cents,
        e.payout_mode
      FROM app_v3.events e
      LEFT JOIN app_v3.organizations o ON o.id = e.organization_id
      WHERE e.slug = ${slug}
      LIMIT 1;
    `;

    const event = eventRows[0];
    const eventOrganizationId = event?.organization_id ?? null;

    if (!event) {
      return intentError("EVENT_NOT_FOUND", "Evento não encontrado.", { httpStatus: 404 });
    }

    if (!userId && guestEmail && guestConsent && eventOrganizationId) {
      const consentNow = new Date();
      const consents = [
        {
          type: ConsentType.CONTACT_EMAIL,
          status: ConsentStatus.GRANTED,
          source: "CHECKOUT_GUEST",
          grantedAt: consentNow,
        },
        ...(guestPhone
          ? [
              {
                type: ConsentType.CONTACT_SMS,
                status: ConsentStatus.GRANTED,
                source: "CHECKOUT_GUEST",
                grantedAt: consentNow,
              },
            ]
          : []),
      ];

      try {
        await ingestCrmInteraction({
          organizationId: eventOrganizationId,
          userId: null,
          type: CrmInteractionType.FORM_SUBMITTED,
          sourceType: CrmInteractionSource.FORM,
          sourceId: String(event.id),
          externalId: `guest-consent:${event.id}:${guestEmail.toLowerCase()}`,
          occurredAt: consentNow,
          contactEmail: guestEmail,
          contactPhone: guestPhone || null,
          displayName: guestName || null,
          contactType: "GUEST",
          legalBasis: "CONSENT",
          consents,
        });
      } catch (err) {
        logWarn("payments.intent.guest_consent_crm_failed", { eventId: event.id, error: err });
      }
    }
    if (eventOrganizationId == null) {
      return intentError("EVENT_ORG_NOT_FOUND", "Organização do evento não encontrada.", {
        httpStatus: 404,
      });
    }
    const accessIntent = inviteToken ? "INVITE_TOKEN" : "VIEW";
    const accessDecision = await evaluateEventAccess({
      eventId: event.id,
      userId,
      intent: accessIntent,
    });
    if (!accessDecision.allowed) {
      return intentError(
        accessDecision.reasonCode || "ACCESS_DENIED",
        "Acesso bloqueado pela política do evento.",
        { httpStatus: 403, status: "FAILED", retryable: false },
      );
    }
    const profile = userId
      ? await prisma.profile.findUnique({ where: { id: userId } })
      : null;
    const isAdmin = Array.isArray(profile?.roles) ? profile.roles.includes("admin") : false;
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

    if (event.is_deleted || event.status !== "PUBLISHED" || event.type !== "ORGANIZATION_EVENT") {
      return intentError("EVENT_CLOSED", "Evento indisponível para compra.", { httpStatus: 400 });
    }

    if (event.ends_at && event.ends_at < new Date()) {
      return intentError("EVENT_ENDED", "Vendas encerradas: evento já terminou.", { httpStatus: 400 });
    }

    const accessPolicy = await getLatestPolicyForEvent(event.id);
    const inviteRestricted = accessPolicy?.mode === "INVITE_ONLY";

    const padelConfig = await prisma.padelTournamentConfig.findUnique({
      where: { eventId: event.id },
      select: { organizationId: true },
    });
    const isPadelTemplate =
      typeof event.template_type === "string" && event.template_type.toUpperCase() === "PADEL";
    if (padelConfig || isPadelTemplate) {
      return intentError("PADEL_TICKETS_DISABLED", "Inscrições Padel são feitas no fluxo dedicado.", {
        httpStatus: 409,
        status: "FAILED",
        retryable: false,
      });
    }

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
        select: {
          id: true,
          status: true,
          sellerUserId: true,
          price: true,
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

      const resalePriceCents = typeof resale.price === "number" ? resale.price : null;

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

    const ticketPrices = ticketTypes.map((t) => Number(t.price ?? 0)).filter((n) => Number.isFinite(n));
    const pricingMode =
      typeof event.pricing_mode === "string" &&
      (Object.values(EventPricingMode) as string[]).includes(event.pricing_mode)
        ? (event.pricing_mode as EventPricingMode)
        : undefined;
    const isFreeOnlyEvent = deriveIsFreeEvent({
      pricingMode,
      ticketPrices,
    });
    const hasExistingFreeEntry =
      isFreeOnlyEvent && userId ? await hasExistingFreeEntryForUser({ eventId: event.id, userId }) : false;

    const requiresInviteToken = inviteRestricted;

    if (requiresInviteToken && !isAdmin) {
      if (!userId) {
        return intentError("INVITE_REQUIRED", "Este bilhete é apenas por convite.", {
          httpStatus: 403,
          status: "FAILED",
          nextAction: "LOGIN",
          retryable: false,
          extra: { inviteRestricted: true },
        });
      }

      const identifiers: string[] = [];
      const userEmail = normalizeEmail(userData?.user?.email ?? null);
      const username = profile?.username ? sanitizeUsername(profile.username) : null;
      const identityMatch = accessPolicy?.inviteIdentityMatch ?? "BOTH";

      if ((identityMatch === "EMAIL" || identityMatch === "BOTH") && userEmail) {
        identifiers.push(userEmail);
      }
      if ((identityMatch === "USERNAME" || identityMatch === "BOTH") && username) {
        identifiers.push(username);
      }

      if (identifiers.length === 0) {
        return intentError("INVITE_REQUIRED", "Este bilhete é apenas por convite.", {
          httpStatus: 403,
          status: "FAILED",
          nextAction: "NONE",
          retryable: false,
          extra: { inviteRestricted: true },
        });
      }

      const inviteMatch = await prisma.eventInvite.findFirst({
        where: { eventId: event.id, targetIdentifier: { in: identifiers }, scope: "PUBLIC" },
        select: { id: true },
      });

      if (!inviteMatch) {
        return intentError("INVITE_REQUIRED", "Este bilhete é apenas por convite.", {
          httpStatus: 403,
          status: "FAILED",
          nextAction: "NONE",
          retryable: false,
          extra: { inviteRestricted: true },
        });
      }
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
      if (!Number.isFinite(priceCents) || priceCents < 0) {
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

    const allLinesFree = lines.length > 0 && lines.every((line) => line.unitPriceCents === 0);

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

      // Scope ao evento já garantido no filtro eventId; não há organizationId na tabela nova.
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

      // Contagem de redemptions anteriores
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
        logInfo("payments.intent.promo_applied", {
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

    // Clamp final discount (não deixa exceder o total)
    discountCents = Math.max(0, Math.min(discountCents, preDiscountAmountCents));
    const amountAfterDiscountCents = preDiscountAmountCents - discountCents;

    const { feeBps: defaultFeeBps, feeFixedCents: defaultFeeFixed } = await getPlatformFees();

    // Org da plataforma? (org_type = PLATFORM → não cobra application fee, usa conta da plataforma)
    const isPlatformOrg = (event.org_type || "").toString().toUpperCase() === "PLATFORM";

    const pricing = computePricing(preDiscountAmountCents, discountCents, {
      eventFeeMode: (event.fee_mode as FeeMode | null) ?? undefined,
      organizationFeeMode: (event.org_fee_mode as FeeMode | null) ?? undefined,
      platformDefaultFeeMode: "INCLUDED" as FeeMode,
      organizationPlatformFeeBps: event.org_platform_fee_bps,
      organizationPlatformFeeFixedCents: event.org_platform_fee_fixed_cents,
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
      stripeFeeBps: 0,
      stripeFeeFixedCents: 0,
    });

    const platformFeeCents = pricing.platformFeeCents; // ORYA base (application_fee)
    const cardPlatformFeeCents =
      paymentMethod === "card"
        ? Math.max(0, Math.round((amountAfterDiscountCents * ORYA_CARD_FEE_BPS) / 10_000))
        : 0;
    const platformFeeTotalCents = platformFeeCents + cardPlatformFeeCents;

    // Stripe account rules
    const stripeAccountId = event.org_stripe_account_id ?? null;
    const stripeChargesEnabled = event.org_stripe_charges_enabled ?? false;
    const stripePayoutsEnabled = event.org_stripe_payouts_enabled ?? false;
    const payoutModeRaw = (event.payout_mode || "ORGANIZATION").toString().toUpperCase();

    // Plataforma ORYA: usa conta da plataforma, não exige Connect
    const requiresOrganizationStripe = !isPlatformOrg && payoutModeRaw !== "PLATFORM";

    if (preDiscountAmountCents > 0) {
      const gate = getPaidSalesGate({
        officialEmail: event.org_official_email ?? null,
        officialEmailVerifiedAt: event.org_official_email_verified_at ?? null,
        stripeAccountId,
        stripeChargesEnabled: event.org_stripe_charges_enabled ?? false,
        stripePayoutsEnabled: event.org_stripe_payouts_enabled ?? false,
        requireStripe: requiresOrganizationStripe,
      });
      if (!gate.ok) {
        const code = gate.missingEmail
          ? "ORGANIZATION_PAYMENTS_NOT_READY"
          : "ORGANIZATION_STRIPE_NOT_CONNECTED";
        return intentError(
          code,
          formatPaidSalesGateMessage(gate, "Pagamentos desativados para este evento. Para ativar,"),
          {
            httpStatus: 409,
            status: "FAILED",
            nextAction: gate.missingStripe ? "CONNECT_STRIPE" : "NONE",
            retryable: false,
            extra: { missingEmail: gate.missingEmail, missingStripe: gate.missingStripe },
          },
        );
      }
    }
    const recipientConnectAccountId = requiresOrganizationStripe ? stripeAccountId : null;

    const totalAmountInCents = combinedFees.totalCents + cardPlatformFeeCents;
    const platformFeeCombinedCents = platformFeeTotalCents;
    const payoutAmountCents = Math.max(0, totalAmountInCents - platformFeeTotalCents);

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

    if (scenarioAdjusted === "FREE_CHECKOUT" && allLinesFree && totalQuantity > 1) {
      return intentError("FREE_MAX_ONE_PER_USER", "A inscrição gratuita permite apenas 1 entrada por utilizador.", {
        httpStatus: 400,
        status: "FAILED",
        nextAction: "NONE",
        retryable: false,
      });
    }

    let groupPairing:
      | {
          id: number;
          eventId: number;
          player1UserId: string | null;
          lifecycleStatus: string;
          registrationStatus?: PadelRegistrationStatus | null;
          payment_mode: string;
          pairingJoinMode: string;
          partnerInviteToken: string | null;
          partnerLinkExpiresAt: Date | null;
          slots: Array<{
            id: number;
            profileId: string | null;
            slotStatus: string;
            paymentStatus: string;
            invitedContact: string | null;
            invitedUserId: string | null;
            slot_role: string;
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
          payment_mode: true,
          pairingJoinMode: true,
          partnerInviteToken: true,
          partnerLinkExpiresAt: true,
          player1UserId: true,
          player2UserId: true,
          registration: { select: { status: true } },
          slots: {
            select: {
              id: true,
              profileId: true,
              slotStatus: true,
              paymentStatus: true,
              invitedContact: true,
              invitedUserId: true,
              slot_role: true,
            },
          },
        },
      });
      if (
        !pairing ||
        pairing.eventId !== event.id ||
        (pairing.registration && INACTIVE_REGISTRATION_STATUSES.includes(pairing.registration.status))
      ) {
        return intentError("PAIRING_INVALID", "A dupla não é válida para este evento.", {
          httpStatus: 400,
          status: "FAILED",
          retryable: false,
        });
      }
      const lifecycleStatus = mapRegistrationToPairingLifecycle(
        pairing.registration?.status ?? PadelRegistrationStatus.PENDING_PARTNER,
        pairing.payment_mode,
      );
      const slot = pairing.slots.find((s) => s.id === bodySlotId);
      if (!slot) {
        return intentError("PAIRING_SLOT_INVALID", "Slot da dupla não encontrado.", {
          httpStatus: 400,
          status: "FAILED",
          retryable: false,
        });
      }
      if (slot.paymentStatus === PadelPairingPaymentStatus.PAID) {
        return intentError("PAIRING_SLOT_PAID", "Este lugar já foi pago.", {
          httpStatus: 409,
          status: "FAILED",
          retryable: false,
        });
      }
      groupPairing = {
        ...pairing,
        lifecycleStatus,
        registrationStatus: pairing.registration?.status ?? null,
      };
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
        const paidSlots = pairing.slots.filter((s) => s.paymentStatus === PadelPairingPaymentStatus.PAID);
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
      if (hasExistingFreeEntry) {
        return intentError("FREE_ALREADY_CLAIMED", "Já tens uma inscrição gratuita neste evento.", {
          ...NON_RETRYABLE_CONFLICT_ERROR_OPTS,
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
        }),
      )
      .digest("hex")
      .slice(0, 32);

    const computedPurchaseId = `pur_${intentFingerprint}`;

    // Se o frontend enviou fingerprint/purchaseId, podem estar desatualizados.
    // Em vez de bloquear (409 + loop no FE), registamos e seguimos sempre com a SSOT do servidor.
    if (intentFingerprintFromBody && intentFingerprintFromBody !== intentFingerprint) {
      logWarn("payments.intent.client_fingerprint_stale", {
        provided: intentFingerprintFromBody,
        expected: intentFingerprint,
        purchaseId: computedPurchaseId,
      });
    }

    if (purchaseIdFromBody && purchaseIdFromBody !== computedPurchaseId) {
      logWarn("payments.intent.client_purchase_id_stale", {
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

    const feePolicyVersion = computeFeePolicyVersion({
      feeMode: pricing.feeMode,
      feeBps: pricing.feeBpsApplied,
      feeFixed: pricing.feeFixedApplied,
    });

    await createCheckout({
      orgId: eventOrganizationId,
      sourceType: SourceType.TICKET_ORDER,
      sourceId: String(event.id),
      idempotencyKey: checkoutIdempotencyKey,
      paymentId: purchaseId,
      customerIdentityId: ownerResolved.ownerIdentityId ?? null,
      inviteToken,
      resolvedSnapshot: {
        orgId: eventOrganizationId,
        customerIdentityId: ownerResolved.ownerIdentityId ?? null,
        eventId: event.id,
        ticketTypeIds: lines.map((line) => line.ticketTypeId),
        snapshot: {
          currency: currency.toUpperCase(),
          gross: totalAmountInCents,
          discounts: pricing.discountCents,
          taxes: 0,
          platformFee: platformFeeTotalCents,
          total: totalAmountInCents,
          netToOrgPending: Math.max(0, totalAmountInCents - platformFeeTotalCents),
          processorFeesStatus: ProcessorFeesStatus.PENDING,
          processorFeesActual: null,
          feeMode: pricing.feeMode,
          feeBps: pricing.feeBpsApplied,
          feeFixed: pricing.feeFixedApplied,
          feePolicyVersion,
          promoPolicyVersion: null,
          sourceType: SourceType.TICKET_ORDER,
          sourceId: String(event.id),
          lineItems: lines.map((line) => ({
            quantity: line.quantity,
            unitPriceCents: line.unitPriceCents,
            totalAmountCents: line.lineTotalCents,
            currency: line.currency,
            ticketTypeId: line.ticketTypeId,
            sourceLineId: String(line.ticketTypeId),
          })),
        },
      },
      skipAccessChecks: true,
    });

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
          const pi = await retrievePaymentIntent(existing.stripePaymentIntentId);
          const terminal = pi.status && ["succeeded", "canceled", "requires_capture"].includes(pi.status);
          if (!terminal) {
            // Safety: payload mismatch ainda bloqueia
            if (typeof pi.amount === "number" && pi.amount !== Math.max(0, totalAmountInCents)) {
              return intentError("IDEMPOTENCY_KEY_PAYLOAD_MISMATCH", "Chave de idempotência reutilizada com um carrinho diferente.", {
                httpStatus: 409,
                retryable: false,
              });
            }
            return jsonWrap(
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
                  platformFeeCents: pricing.platformFeeCents,
                  cardPlatformFeeCents,
                  cardPlatformFeeBps: ORYA_CARD_FEE_BPS,
                  totalCents: totalAmountInCents,
                  currency: currency.toUpperCase(),
                  paymentMethod,
                }),
                intentFingerprint,
                idempotencyKey: clientIdempotencyKey ?? effectiveDedupeKey,
              },
              { status: 200 },
            );
          }
          // terminal → segue para criar PI novo
        } catch (e) {
          logError("payments.intent.idempotency_retrieve_failed", e);
        }
      }
    }

    if (scenarioAdjusted === "GROUP_SPLIT" && userId && groupPairing && bodySlotId) {
      const targetSlot = groupPairing.slots.find((slot) => slot.id === bodySlotId) ?? null;
      if (
        targetSlot?.slot_role === "PARTNER" &&
        targetSlot.invitedUserId &&
        groupPairing.player1UserId === userId &&
        targetSlot.invitedUserId !== userId
      ) {
        ownerResolved = { ownerUserId: targetSlot.invitedUserId, ownerIdentityId: null, emailNormalized: null };
        ownerForMetadata = { ownerUserId: targetSlot.invitedUserId };
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
      logWarn("payments.intent.invalid_metadata", {
        errors: metadataValidation.error.format(),
      });
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
      if (!eventOrganizationId) {
        return intentError("ORG_MISSING", "Evento sem organização.", {
          httpStatus: 400,
          status: "FAILED",
          nextAction: "NONE",
          retryable: false,
        });
      }

      const baseOutboxPayload = {
        purchaseId,
        eventId: event.id,
        scenario: scenarioAdjusted,
        userId: userId ?? null,
        ownerUserId: ownerResolved.ownerUserId ?? null,
        ownerIdentityId: ownerResolved.ownerIdentityId ?? null,
        promoCodeId: promoCodeId ? Number(promoCodeId) : null,
        currency: currency.toUpperCase(),
        feeMode: pricing.feeMode,
        subtotalCents: pricing.subtotalCents,
        discountCents,
        platformFeeCents: pricing.platformFeeCents,
        lines: lines.map((l) => ({
          ticketTypeId: l.ticketTypeId,
          quantity: l.quantity,
          unitPriceCents: l.unitPriceCents,
        })),
        dedupeKey: effectiveDedupeKey,
      };

      const padelProfile = padelConfig
        ? {
            organizationId: padelConfig.organizationId,
            fullName: userData?.user?.user_metadata?.full_name || profile?.fullName || "Jogador Padel",
            email: userData?.user?.email || null,
            phone: userData?.user?.phone || contact || profile?.contactPhone || null,
          }
        : null;

      const notifyPayload = eventOrganizationId
        ? { organizationId: eventOrganizationId, eventId: event.id, eventTitle: event.title }
        : null;

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
              select: {
                id: true,
                slots: {
                  select: pairingSlotSelect,
                },
              },
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
          return jsonWrap({
            ok: true,
            code: "OK",
            status: "OK",
            nextAction: "NONE",
            retryable: false,
            freeCheckout: true,
            isGratisCheckout: true,
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
              platformFeeCents: pricing.platformFeeCents,
              cardPlatformFeeCents: 0,
              cardPlatformFeeBps: ORYA_CARD_FEE_BPS,
              totalCents: 0,
              currency: (ticketType.currency || "EUR").toUpperCase(),
              paymentMethod,
            }),
            intentFingerprint,
            idempotencyKey: clientIdempotencyKey ?? effectiveDedupeKey,
          });
        }

        const outboxPayload = {
          ...baseOutboxPayload,
          scenario: scenarioAdjusted,
          pairingId: pairing.id,
          slotId: slot.id,
          ticketTypeId: ticketType.id,
          ...(padelProfile ? { padelProfile } : {}),
          ...(notifyPayload ? { notify: notifyPayload } : {}),
        };

        await recordFreeCheckoutOutbox({
          organizationId: eventOrganizationId,
          eventId: event.id,
          purchaseId,
          actorUserId: userId ?? null,
          idempotencyKey: clientIdempotencyKey ?? effectiveDedupeKey,
          payload: outboxPayload as Prisma.InputJsonObject,
        });

        return jsonWrap({
          ok: true,
          code: "OK",
          status: "OK",
          nextAction: "NONE",
          retryable: false,
          freeCheckout: true,
          isGratisCheckout: true,
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
            platformFeeCents: pricing.platformFeeCents,
            cardPlatformFeeCents: 0,
            cardPlatformFeeBps: ORYA_CARD_FEE_BPS,
            totalCents: 0,
            currency: (ticketType.currency || "EUR").toUpperCase(),
            paymentMethod,
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

      if (isFreeOnlyEvent && hasExistingFreeEntry) {
        return intentError("FREE_ALREADY_CLAIMED", "Já tens uma inscrição gratuita neste evento.", {
          ...NON_RETRYABLE_CONFLICT_ERROR_OPTS,
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

      const outboxPayload = {
        ...baseOutboxPayload,
        scenario: scenarioAdjusted,
        ...(padelProfile ? { padelProfile } : {}),
        ...(notifyPayload ? { notify: notifyPayload } : {}),
      };

      await recordFreeCheckoutOutbox({
        organizationId: eventOrganizationId,
        eventId: event.id,
        purchaseId,
        actorUserId: userId ?? null,
        idempotencyKey: clientIdempotencyKey ?? effectiveDedupeKey,
        payload: outboxPayload as Prisma.InputJsonObject,
      });

      const createdTicketsCount = 0;
      return jsonWrap({
        ok: true,
        code: "OK",
        status: "PROCESSING",
        nextAction: "NONE",
        retryable: true,
        freeCheckout: true,
        isGratisCheckout: true,
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
          platformFeeCents: pricing.platformFeeCents,
          cardPlatformFeeCents: 0,
          cardPlatformFeeBps: ORYA_CARD_FEE_BPS,
          totalCents: 0,
          currency: currency.toUpperCase(),
          paymentMethod,
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
      cardPlatformFeeCents: String(cardPlatformFeeCents),
      cardPlatformFeeBps: String(ORYA_CARD_FEE_BPS),
      platformFeeCombinedCents: String(platformFeeCombinedCents),
      grossAmountCents: String(totalAmountInCents),
      payoutAmountCents: String(payoutAmountCents),
      recipientConnectAccountId: recipientConnectAccountId ?? "",
      sourceType: SourceType.TICKET_ORDER,
      sourceId: String(event.id),
      currency: currency.toUpperCase(),
      feeMode: pricing.feeMode,
      paymentMethod,
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
        cardPlatformFeeCents,
        cardPlatformFeeBps: ORYA_CARD_FEE_BPS,
        paymentMethod,
        platformFeeCombinedCents,
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

    const allowedPaymentMethods =
      paymentMethod === "card" ? (["card"] as const) : (["mb_way"] as const);

    const intentParams: Stripe.PaymentIntentCreateParams = {
      amount: Math.max(0, totalAmountInCents),
      currency,
      payment_method_types: [...allowedPaymentMethods],
      metadata,
    };

    if (!userId && guestEmail) {
      intentParams.receipt_email = guestEmail;
    }

    // Stripe idempotency: se o cliente enviar idempotencyKey, usamos-na para diferenciar intents e evitar reaproveitar PI terminal
    const stripeIdempotencyKey =
      clientIdempotencyKey && clientIdempotencyKey.trim().length > 0
        ? clampIdempotencyKey(`${checkoutIdempotencyKey}:${clientIdempotencyKey}`)
        : checkoutIdempotencyKey;

    const createPi = async (idemKey?: string) =>
      createPaymentIntent(intentParams, {
        idempotencyKey: idemKey,
        requireStripe: requiresOrganizationStripe,
        org: {
          stripeAccountId,
          stripeChargesEnabled,
          stripePayoutsEnabled,
          orgType: event.org_type ?? null,
        },
      });

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
          logWarn("payments.intent.pi_terminal_retry", {
            purchaseId,
            intentFingerprint,
            paymentIntentId: paymentIntent?.id ?? null,
            paymentIntentStatus: paymentIntent?.status ?? null,
            attempt: attempts + 1,
          });
          attempts += 1;
          attemptKey = `${stripeIdempotencyKey}:retry:${attempts}`;
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
          attemptKey = `${stripeIdempotencyKey}:idem:${attempts}`;
          logWarn("payments.intent.stripe_idempotency_mismatch", {
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
      logWarn("payments.intent.pi_terminal_exhausted", {
        purchaseId,
        intentFingerprint,
        paymentIntentId: paymentIntent?.id ?? null,
        paymentIntentStatus: paymentIntent?.status ?? null,
        attempts,
      });
      return intentError(
        "PAYMENT_INTENT_TERMINAL",
        "Sessão de pagamento expirada. Vamos criar um novo intento.",
        { ...PAYMENT_INTENT_TERMINAL_ERROR_OPTS },
      );
    }

    if (!paymentIntent.client_secret) {
      return jsonWrap(
        {
          ok: false,
          error: "Não foi possível preparar o pagamento (client_secret em falta).",
          code: "MISSING_CLIENT_SECRET",
          retryable: true,
        },
        { status: 500 },
      );
    }
    return jsonWrap({
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
        platformFeeCents: pricing.platformFeeCents,
        cardPlatformFeeCents,
        cardPlatformFeeBps: ORYA_CARD_FEE_BPS,
        totalCents: totalAmountInCents,
        currency: currency.toUpperCase(),
        paymentMethod,
      }),
      intentFingerprint,
      idempotencyKey: clientIdempotencyKey ?? effectiveDedupeKey,
    });
  } catch (err) {
    logFinanceError("checkout", err, { route: "/api/payments/intent" });
    return jsonWrap(
      { ok: false, error: "Erro ao criar PaymentIntent." },
      { status: 500 },
    );
  }
}
export const POST = withApiEnvelope(_POST);
