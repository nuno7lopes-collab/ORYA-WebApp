import { prisma } from "@/lib/prisma";
import { ensurePaymentIntent } from "@/domain/finance/paymentIntent";
import { computeFeePolicyVersion } from "@/domain/finance/checkout";
import {
  FeeMode,
  ProcessorFeesStatus,
  SourceType,
  PadelPairingPaymentStatus,
  PadelPairingStatus,
  PadelRegistrationStatus,
} from "@prisma/client";
import { getPlatformFees } from "@/lib/platformSettings";
import { autoChargeKey } from "@/lib/stripe/idempotency";
import { computeGraceUntil } from "@/domain/padelDeadlines";
import { transitionPadelRegistrationStatus } from "@/domain/padelRegistration";
import { queueOffsessionActionRequired } from "@/domain/notifications/splitPayments";
import { computePricing } from "@/lib/pricing";

export async function attemptPadelSecondChargeForPairing(params: { pairingId: number; now?: Date }) {
  const now = params.now ?? new Date();
  const pairing = await prisma.padelPairing.findUnique({
    where: { id: params.pairingId },
    include: { slots: true },
  });
  if (!pairing) return { ok: false, code: "PAIRING_NOT_FOUND" } as const;
  if (pairing.payment_mode !== "SPLIT") return { ok: true, code: "NOT_SPLIT" } as const;
  if (pairing.secondChargePaymentIntentId) return { ok: true, code: "ALREADY_CHARGED" } as const;

  const priorAttempts = await prisma.paymentEvent.count({
    where: {
      OR: [
        { purchaseId: { startsWith: `auto_charge:${pairing.id}:` } },
        { dedupeKey: { startsWith: `auto_charge:${pairing.id}:` } },
        { dedupeKey: { startsWith: `checkout:auto_charge:${pairing.id}:` } },
      ],
    },
  });
  if (priorAttempts >= 1) {
    await prisma.$transaction(async (tx) => {
      await tx.padelPairing.update({
        where: { id: pairing.id },
        data: {
          guaranteeStatus: "FAILED",
          pairingStatus: PadelPairingStatus.CANCELLED,
          graceUntilAt: null,
        },
      });
      await transitionPadelRegistrationStatus(tx, {
        pairingId: pairing.id,
        status: PadelRegistrationStatus.EXPIRED,
        reason: "SECOND_CHARGE_ATTEMPTS_EXCEEDED",
      });
    });
    return { ok: true, code: "ATTEMPTS_EXCEEDED" } as const;
  }

  const paymentMethodId = pairing.paymentMethodId;
  if (!paymentMethodId) {
    await prisma.$transaction(async (tx) => {
      await tx.padelPairing.update({
        where: { id: pairing.id },
        data: {
          guaranteeStatus: "FAILED",
          pairingStatus: PadelPairingStatus.CANCELLED,
        },
      });
      await transitionPadelRegistrationStatus(tx, {
        pairingId: pairing.id,
        status: PadelRegistrationStatus.EXPIRED,
        reason: "SECOND_CHARGE_UNAVAILABLE",
      });
    });
    return { ok: true, code: "NO_PAYMENT_METHOD" } as const;
  }

  const registration = await prisma.padelRegistration.findUnique({
    where: { pairingId: pairing.id },
    include: { lines: true },
  });
  if (!registration) {
    return { ok: false, code: "REGISTRATION_NOT_FOUND" } as const;
  }

  const unpaidLines = registration.lines.filter((line) => {
    if (!line.pairingSlotId) return true;
    const slot = pairing.slots.find((s) => s.id === line.pairingSlotId);
    if (!slot) return true;
    return slot.paymentStatus !== PadelPairingPaymentStatus.PAID;
  });

  if (!unpaidLines.length) {
    return { ok: true, code: "NO_UNPAID_LINES" } as const;
  }

  const subtotalCents = unpaidLines.reduce((sum, line) => sum + Math.max(0, line.totalAmount), 0);
  if (subtotalCents <= 0) {
    return { ok: true, code: "NO_CHARGE_REQUIRED" } as const;
  }

  const event = await prisma.event.findUnique({
    where: { id: pairing.eventId },
    select: {
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
    },
  });
  if (!event) return { ok: false, code: "EVENT_NOT_FOUND" } as const;

  const platformFees = await getPlatformFees();
  const pricing = computePricing(subtotalCents, 0, {
    organizationFeeMode: event.organization?.feeMode ?? null,
    organizationPlatformFeeBps: event.organization?.platformFeeBps ?? null,
    organizationPlatformFeeFixedCents: event.organization?.platformFeeFixedCents ?? null,
    platformDefaultFeeMode: FeeMode.INCLUDED,
    platformDefaultFeeBps: platformFees.feeBps,
    platformDefaultFeeFixedCents: platformFees.feeFixedCents,
    isPlatformOrg: event.organization?.orgType === "PLATFORM",
  });
  const feePolicyVersion = computeFeePolicyVersion({
    feeMode: pricing.feeMode,
    feeBps: pricing.feeBpsApplied,
    feeFixed: pricing.feeFixedApplied,
  });

  const attempt = 1;
  const purchaseId = autoChargeKey(pairing.id, attempt);
  const currency = (registration.currency ?? "EUR").toUpperCase();
  const ownerUserId = pairing.player1UserId ?? null;

  const snapshotLines = unpaidLines.map((line) => ({
    quantity: line.qty,
    unitPriceCents: line.unitAmount,
    totalAmountCents: line.totalAmount,
    currency,
    sourceLineId: String(line.id),
    label: line.label,
  }));

  const { paymentIntent: intent } = await ensurePaymentIntent({
    purchaseId,
    sourceType: SourceType.PADEL_REGISTRATION,
    sourceId: registration.id,
    amountCents: pricing.totalCents,
    currency,
    intentParams: {
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
    },
    metadata: {
      pairingId: String(pairing.id),
      eventId: String(pairing.eventId),
      paymentScenario: "GROUP_SPLIT_SECOND_CHARGE",
      sourceType: SourceType.PADEL_REGISTRATION,
      sourceId: registration.id,
      ...(ownerUserId ? { ownerUserId } : {}),
      slotIds: unpaidLines.map((line) => String(line.pairingSlotId ?? "")).join(","),
    },
    orgContext: {
      stripeAccountId: event.organization?.stripeAccountId ?? null,
      stripeChargesEnabled: event.organization?.stripeChargesEnabled ?? null,
      stripePayoutsEnabled: event.organization?.stripePayoutsEnabled ?? null,
      orgType: event.organization?.orgType ?? null,
    },
    requireStripe: true,
    buyerIdentityRef: registration.buyerIdentityId ?? null,
    resolvedSnapshot: {
      organizationId: registration.organizationId,
      buyerIdentityId: registration.buyerIdentityId ?? null,
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
      amountCents: pricing.totalCents,
      platformFeeCents: pricing.platformFeeCents,
    },
  });

  if (intent.status === "succeeded") {
    await prisma.padelPairing.update({
      where: { id: pairing.id },
      data: {
        guaranteeStatus: "SUCCEEDED",
        secondChargePaymentIntentId: intent.id,
        captainSecondChargedAt: now,
        partnerPaidAt: now,
        graceUntilAt: null,
      },
    });
    return { ok: true, code: "SUCCEEDED" } as const;
  }

  if (intent.status === "requires_action") {
    await prisma.padelPairing.update({
      where: { id: pairing.id },
      data: {
        guaranteeStatus: "REQUIRES_ACTION",
        secondChargePaymentIntentId: intent.id,
        graceUntilAt: computeGraceUntil(now),
      },
    });
    const targets = [pairing.player1UserId, pairing.player2UserId].filter(Boolean) as string[];
    if (targets.length) {
      await queueOffsessionActionRequired(pairing.id, targets).catch(() => null);
    }
    return { ok: true, code: "REQUIRES_ACTION" } as const;
  }

  await prisma.$transaction(async (tx) => {
    await tx.padelPairing.update({
      where: { id: pairing.id },
      data: {
        guaranteeStatus: "FAILED",
        pairingStatus: PadelPairingStatus.CANCELLED,
        graceUntilAt: null,
      },
    });
    await transitionPadelRegistrationStatus(tx, {
      pairingId: pairing.id,
      status: PadelRegistrationStatus.EXPIRED,
      reason: "SECOND_CHARGE_FAILED",
    });
    await tx.padelPairingHold.updateMany({
      where: { pairingId: pairing.id, status: "ACTIVE" },
      data: { status: "CANCELLED" },
    });
  });
  return { ok: true, code: "FAILED" } as const;
}
