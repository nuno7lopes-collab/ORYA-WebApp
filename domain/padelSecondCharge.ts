import { prisma } from "@/lib/prisma";
import { ensurePaymentIntent } from "@/domain/finance/paymentIntent";
import { computeFeePolicyVersion } from "@/domain/finance/checkout";
import { FeeMode, ProcessorFeesStatus, SourceType } from "@prisma/client";
import { getStripeBaseFees } from "@/lib/platformSettings";
import { autoChargeKey } from "@/lib/stripe/idempotency";
import { computeGraceUntil } from "@/domain/padelDeadlines";
import {
  PadelPairingPaymentStatus,
  PadelPairingSlotStatus,
  PadelPairingStatus,
  PadelRegistrationStatus,
} from "@prisma/client";
import { transitionPadelRegistrationStatus } from "@/domain/padelRegistration";

export async function attemptPadelSecondChargeForPairing(params: { pairingId: number; now?: Date }) {
  const now = params.now ?? new Date();
  const pairing = await prisma.padelPairing.findUnique({
    where: { id: params.pairingId },
    include: { slots: { include: { ticket: true } } },
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
  const paidSlot = pairing.slots.find((s) => s.paymentStatus === PadelPairingPaymentStatus.PAID && s.ticket);
  const paidTicket = paidSlot?.ticket;
  const amount =
    (paidTicket?.totalPaidCents ?? 0) > 0
      ? paidTicket!.totalPaidCents
      : paidTicket?.pricePaid ?? 0;
  if (!paymentMethodId || !amount || amount <= 0) {
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

  const stripeBaseFees = await getStripeBaseFees();
  const platformFeeCents = paidTicket?.platformFeeCents ?? 0;
  const stripeFeeEstimateCents =
    amount > 0
      ? Math.max(
          0,
          Math.round((amount * (stripeBaseFees.feeBps ?? 0)) / 10_000) +
            (stripeBaseFees.feeFixedCents ?? 0),
        )
      : 0;
  const payoutAmountCents = Math.max(0, amount - platformFeeCents - stripeFeeEstimateCents);

  const event = await prisma.event.findUnique({
    where: { id: pairing.eventId },
    select: {
      organization: {
        select: {
          stripeAccountId: true,
          stripeChargesEnabled: true,
          stripePayoutsEnabled: true,
        },
      },
    },
  });
  const recipientConnectAccountId = event?.organization?.stripeAccountId ?? "";

  const registration = await prisma.padelRegistration.findUnique({
    where: { pairingId: pairing.id },
    select: {
      id: true,
      buyerIdentityId: true,
      organizationId: true,
      currency: true,
    },
  });
  if (!registration) {
    return { ok: false, code: "REGISTRATION_NOT_FOUND" } as const;
  }

  const attempt = 1;
  const purchaseId = autoChargeKey(pairing.id, attempt);
  const currency = (paidTicket?.currency ?? registration.currency ?? "EUR").toUpperCase();
  const feeMode = FeeMode.INCLUDED;
  const feeBps = amount > 0 ? Math.round((platformFeeCents * 10_000) / amount) : 0;
  const feeFixed = 0;
  const feePolicyVersion = computeFeePolicyVersion({ feeMode, feeBps, feeFixed });
  const { paymentIntent: intent } = await ensurePaymentIntent({
    purchaseId,
    sourceType: SourceType.PADEL_REGISTRATION,
    sourceId: registration.id,
    amountCents: amount,
    currency,
    intentParams: {
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
    },
    metadata: {
      pairingId: String(pairing.id),
      eventId: String(pairing.eventId),
      scenario: "GROUP_SPLIT_SECOND_CHARGE",
      recipientConnectAccountId,
      payoutAmountCents: String(payoutAmountCents),
      grossAmountCents: String(amount),
      platformFeeCents: String(platformFeeCents),
      feeMode: "INCLUDED",
      sourceType: SourceType.PADEL_REGISTRATION,
      sourceId: registration.id,
      currency,
      stripeFeeEstimateCents: String(stripeFeeEstimateCents),
    },
    orgContext: {
      stripeAccountId: event?.organization?.stripeAccountId ?? null,
      stripeChargesEnabled: event?.organization?.stripeChargesEnabled ?? null,
      stripePayoutsEnabled: event?.organization?.stripePayoutsEnabled ?? null,
      orgType: null,
    },
    requireStripe: true,
    buyerIdentityRef: registration.buyerIdentityId ?? null,
    resolvedSnapshot: {
      organizationId: registration.organizationId,
      buyerIdentityId: registration.buyerIdentityId ?? null,
      snapshot: {
        currency,
        gross: amount,
        discounts: 0,
        taxes: 0,
        platformFee: platformFeeCents,
        total: amount,
        netToOrgPending: Math.max(0, amount - platformFeeCents),
        processorFeesStatus: ProcessorFeesStatus.PENDING,
        processorFeesActual: null,
        feeMode,
        feeBps,
        feeFixed,
        feePolicyVersion,
        promoPolicyVersion: null,
        sourceType: SourceType.PADEL_REGISTRATION,
        sourceId: registration.id,
        lineItems: [
          {
            quantity: 1,
            unitPriceCents: amount,
            totalAmountCents: amount,
            currency,
            sourceLineId: registration.id,
            label: `Padel pairing ${pairing.id}`,
          },
        ],
      },
    },
    paymentEvent: {
      eventId: pairing.eventId,
      amountCents: amount,
      platformFeeCents,
    },
  });

  if (intent.status === "succeeded") {
    await prisma.$transaction(async (tx) => {
      await tx.padelPairingSlot.updateMany({
        where: { pairingId: pairing.id, slotStatus: PadelPairingSlotStatus.PENDING },
        data: { paymentStatus: PadelPairingPaymentStatus.PAID },
      });
      const slots = await tx.padelPairingSlot.findMany({
        where: { pairingId: pairing.id },
        select: { slotStatus: true },
      });
      const allFilled = slots.length > 0 && slots.every((slot) => slot.slotStatus === PadelPairingSlotStatus.FILLED);
      await tx.padelPairing.update({
        where: { id: pairing.id },
        data: {
          pairingStatus: allFilled ? PadelPairingStatus.COMPLETE : PadelPairingStatus.INCOMPLETE,
          guaranteeStatus: "SUCCEEDED",
          secondChargePaymentIntentId: intent.id,
          captainSecondChargedAt: now,
          partnerPaidAt: now,
          graceUntilAt: null,
        },
      });
      await transitionPadelRegistrationStatus(tx, {
        pairingId: pairing.id,
        status: PadelRegistrationStatus.CONFIRMED,
        secondChargeConfirmed: true,
        reason: "SECOND_CHARGE_CONFIRMED",
      });
      await tx.padelPairingHold.updateMany({
        where: { pairingId: pairing.id, status: "ACTIVE" },
        data: { status: "CANCELLED" },
      });
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
