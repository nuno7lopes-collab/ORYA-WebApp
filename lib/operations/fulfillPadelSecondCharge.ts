import { prisma } from "@/lib/prisma";
import {
  PaymentEventSource,
  PadelPairingPaymentStatus,
  PadelPairingStatus,
  PadelPaymentMode,
  PadelRegistrationStatus,
} from "@prisma/client";
import { computeGraceUntil } from "@/domain/padelDeadlines";
import { queueOffsessionActionRequired, queueDeadlineExpired } from "@/domain/notifications/splitPayments";
import { ensureEntriesForConfirmedPairing } from "@/domain/tournaments/ensureEntriesForConfirmedPairing";
import { upsertPadelRegistrationForPairing } from "@/domain/padelRegistration";
import { paymentEventRepo } from "@/domain/finance/readModelConsumer";

type IntentLike = {
  id: string;
  status: string;
  amount: number | null;
  livemode: boolean;
  metadata: Record<string, any>;
};

export async function fulfillPadelSecondCharge(intent: IntentLike): Promise<boolean> {
  const meta = intent.metadata ?? {};
  const ownerUserId = typeof meta.ownerUserId === "string" ? meta.ownerUserId : null;
  const pairingId = Number(meta.pairingId);
  const idempotencyKey = typeof meta.idempotencyKey === "string" ? meta.idempotencyKey.trim() : "";
  const paymentDedupeKey = idempotencyKey || intent.id;
  if (!Number.isFinite(pairingId)) return false;
  const now = new Date();

  if (intent.status === "succeeded") {
    await prisma.$transaction(async (tx) => {
      await tx.padelPairingSlot.updateMany({
        where: { pairingId, slotStatus: { in: ["PENDING", "FILLED"] } },
        data: { paymentStatus: PadelPairingPaymentStatus.PAID },
      });
      const slots = await tx.padelPairingSlot.findMany({
        where: { pairingId },
        select: { slotStatus: true },
      });
      const allFilled = slots.length > 0 && slots.every((slot) => slot.slotStatus === "FILLED");
      const pairingStatus = allFilled ? PadelPairingStatus.COMPLETE : PadelPairingStatus.INCOMPLETE;
      const registrationStatus = PadelRegistrationStatus.CONFIRMED;
      const confirmed = await tx.padelPairing.update({
        where: { id: pairingId },
        data: {
          pairingStatus,
          guaranteeStatus: "SUCCEEDED",
          secondChargePaymentIntentId: intent.id,
          captainSecondChargedAt: now,
          partnerPaidAt: now,
          graceUntilAt: null,
        },
      });
      await upsertPadelRegistrationForPairing(tx, {
        pairingId,
        organizationId: confirmed.organizationId,
        eventId: confirmed.eventId,
        status: registrationStatus,
        paymentMode: confirmed.payment_mode,
        secondChargeConfirmed: true,
        reason: "SECOND_CHARGE_CONFIRMED",
      });
      if (allFilled) {
        await ensureEntriesForConfirmedPairing(confirmed.id);
      }
      await tx.padelPairingHold.updateMany({
        where: { pairingId, status: "ACTIVE" },
        data: { status: "CANCELLED" },
      });
      await paymentEventRepo(tx).upsert({
        where: { stripePaymentIntentId: intent.id },
        update: {
          status: "OK",
          updatedAt: now,
          amountCents: intent.amount,
          purchaseId: (meta as Record<string, unknown>)?.purchaseId as string | undefined ?? intent.id,
          stripeFeeCents: 0,
          source: PaymentEventSource.WEBHOOK,
          dedupeKey: paymentDedupeKey,
          attempt: { increment: 1 },
        },
        create: {
          stripePaymentIntentId: intent.id,
          status: "OK",
          amountCents: intent.amount,
          eventId: Number(meta.eventId) || undefined,
          userId: ownerUserId ?? undefined,
          purchaseId: (meta as Record<string, unknown>)?.purchaseId as string | undefined ?? intent.id,
          source: PaymentEventSource.WEBHOOK,
          dedupeKey: paymentDedupeKey,
          attempt: 1,
          stripeFeeCents: 0,
          mode: intent.livemode ? "LIVE" : "TEST",
          isTest: !intent.livemode,
        },
      });
    });
    return true;
  }

  if (intent.status === "requires_action") {
    await prisma.padelPairing.update({
      where: { id: pairingId },
      data: {
        guaranteeStatus: "REQUIRES_ACTION",
        graceUntilAt: computeGraceUntil(now),
        secondChargePaymentIntentId: intent.id,
      },
    });
    const pairing = await prisma.padelPairing.findUnique({ where: { id: pairingId }, select: { player1UserId: true, player2UserId: true } });
    const targets = [pairing?.player1UserId, pairing?.player2UserId].filter(Boolean) as string[];
    if (targets.length) {
      await queueOffsessionActionRequired(pairingId, targets);
    }
    return true;
  }

  if (intent.status === "requires_payment_method" || intent.status === "canceled") {
    await prisma.$transaction(async (tx) => {
      const pairing = await tx.padelPairing.update({
        where: { id: pairingId },
        data: {
          guaranteeStatus: "FAILED",
          pairingStatus: PadelPairingStatus.CANCELLED,
          graceUntilAt: null,
        },
      });
      await upsertPadelRegistrationForPairing(tx, {
        pairingId,
        organizationId: pairing.organizationId,
        eventId: pairing.eventId,
        status: PadelRegistrationStatus.EXPIRED,
        reason: "SECOND_CHARGE_FAILED",
      });
      await tx.padelPairingHold.updateMany({
        where: { pairingId, status: "ACTIVE" },
        data: { status: "CANCELLED" },
      });
    });
    const pairing = await prisma.padelPairing.findUnique({ where: { id: pairingId }, select: { player1UserId: true, player2UserId: true } });
    const targets = [pairing?.player1UserId, pairing?.player2UserId].filter(Boolean) as string[];
    if (targets.length) {
      await queueDeadlineExpired(pairingId, targets);
    }
    return true;
  }

  return false;
}
