import { prisma } from "@/lib/prisma";
import { createPaymentIntent } from "@/domain/finance/gateway/stripeGateway";
import { SourceType } from "@prisma/client";
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
    where: { dedupeKey: { startsWith: `auto_charge:${pairing.id}:` } },
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

  const attempt = 1;
  const idempotencyKey = autoChargeKey(pairing.id, attempt);
  const intent = await createPaymentIntent(
    {
      amount,
      currency: (paidTicket?.currency ?? "EUR").toUpperCase(),
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      metadata: {
        pairingId: pairing.id,
        eventId: pairing.eventId,
        scenario: "GROUP_SPLIT_SECOND_CHARGE",
        idempotencyKey,
        recipientConnectAccountId,
        payoutAmountCents: String(payoutAmountCents),
        grossAmountCents: String(amount),
        platformFeeCents: String(platformFeeCents),
        feeMode: "INCLUDED",
        sourceType: SourceType.PADEL_REGISTRATION,
        sourceId: String(pairing.id),
        currency: (paidTicket?.currency ?? "EUR").toUpperCase(),
        stripeFeeEstimateCents: String(stripeFeeEstimateCents),
      },
    },
    {
      idempotencyKey,
      requireStripe: true,
      org: {
        stripeAccountId: event?.organization?.stripeAccountId ?? null,
        stripeChargesEnabled: event?.organization?.stripeChargesEnabled ?? null,
        stripePayoutsEnabled: event?.organization?.stripePayoutsEnabled ?? null,
        orgType: null,
      },
    },
  );

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
