import { prisma } from "@/lib/prisma";
import { PaymentEventSource, PadelPairingLifecycleStatus, PadelPairingPaymentStatus, PadelPairingStatus } from "@prisma/client";
import { computeGraceUntil } from "@/domain/padelDeadlines";
import { queueOffsessionActionRequired, queueDeadlineExpired } from "@/domain/notifications/splitPayments";
import { ensureEntriesForConfirmedPairing } from "@/domain/tournaments/ensureEntriesForConfirmedPairing";

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
  if (!Number.isFinite(pairingId)) return false;
  const now = new Date();

  if (intent.status === "succeeded") {
    await prisma.$transaction(async (tx) => {
      await tx.padelPairingSlot.updateMany({
        where: { pairingId, slotStatus: { in: ["PENDING", "FILLED"] } },
        data: { paymentStatus: PadelPairingPaymentStatus.PAID },
      });
      const confirmed = await tx.padelPairing.update({
        where: { id: pairingId },
        data: {
          lifecycleStatus: PadelPairingLifecycleStatus.CONFIRMED_CAPTAIN_FULL,
          pairingStatus: PadelPairingStatus.COMPLETE,
          guaranteeStatus: "SUCCEEDED",
          secondChargePaymentIntentId: intent.id,
          captainSecondChargedAt: now,
          partnerPaidAt: now,
          graceUntilAt: null,
          partnerInviteToken: null,
          partnerLinkToken: null,
          partnerLinkExpiresAt: null,
        },
      });
      await ensureEntriesForConfirmedPairing(confirmed.id);
      await tx.padelPairingHold.updateMany({
        where: { pairingId, status: "ACTIVE" },
        data: { status: "CANCELLED" },
      });
      await tx.paymentEvent.upsert({
        where: { stripePaymentIntentId: intent.id },
        update: {
          status: "OK",
          updatedAt: now,
          amountCents: intent.amount,
          purchaseId: (meta as Record<string, unknown>)?.purchaseId as string | undefined ?? intent.id,
          stripeFeeCents: 0,
          source: PaymentEventSource.WEBHOOK,
          dedupeKey: (meta as Record<string, unknown>)?.purchaseId as string | undefined ?? intent.id,
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
          dedupeKey: (meta as Record<string, unknown>)?.purchaseId as string | undefined ?? intent.id,
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
      await tx.padelPairing.update({
        where: { id: pairingId },
        data: {
          guaranteeStatus: "FAILED",
          lifecycleStatus: PadelPairingLifecycleStatus.CANCELLED_INCOMPLETE,
          pairingStatus: PadelPairingStatus.CANCELLED,
          graceUntilAt: null,
        },
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
