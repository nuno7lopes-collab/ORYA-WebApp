import { prisma } from "@/lib/prisma";
import { PaymentEventSource, PadelPairingPaymentStatus, PadelPairingSlotStatus, PadelPaymentMode } from "@prisma/client";
import crypto from "crypto";
import { ensureEntriesForConfirmedPairing } from "@/domain/tournaments/ensureEntriesForConfirmedPairing";
import { queuePartnerPaid } from "@/domain/notifications/splitPayments";

type IntentLike = {
  id: string;
  amount: number | null;
  livemode: boolean;
  currency: string;
  metadata: Record<string, any>;
};

export async function fulfillPadelSplitIntent(intent: IntentLike, stripeFeeForIntentValue: number | null): Promise<boolean> {
  const meta = intent.metadata ?? {};
  const pairingId = Number(meta.pairingId);
  const slotId = Number(meta.slotId);
  const ticketTypeId = Number(meta.ticketTypeId);
  const eventId = Number(meta.eventId);
  const userId = typeof meta.userId === "string" ? meta.userId : null;
  const purchaseId =
    typeof meta.purchaseId === "string" && meta.purchaseId.trim() !== ""
      ? meta.purchaseId.trim()
      : null;

  if (!Number.isFinite(pairingId) || !Number.isFinite(slotId) || !Number.isFinite(ticketTypeId) || !Number.isFinite(eventId)) {
    return false;
  }

  const ticketType = await prisma.ticketType.findUnique({
    where: { id: ticketTypeId },
    select: { id: true, price: true, currency: true, soldQuantity: true, eventId: true },
  });
  if (!ticketType || ticketType.eventId !== eventId) {
    return false;
  }

  const qrSecret = crypto.randomUUID();
  const rotatingSeed = crypto.randomUUID();
  await prisma.$transaction(async (tx) => {
    const pairing = await tx.padelPairing.findUnique({
      where: { id: pairingId },
      include: { slots: true },
    });
    if (!pairing || pairing.paymentMode !== PadelPaymentMode.SPLIT) {
      throw new Error("PAIRING_NOT_SPLIT");
    }
    if (pairing.pairingStatus === "CANCELLED") {
      throw new Error("PAIRING_CANCELLED");
    }
    const slot = pairing.slots.find((s) => s.id === slotId);
    if (!slot) throw new Error("SLOT_NOT_FOUND");
    if (slot.paymentStatus === PadelPairingPaymentStatus.PAID) {
      // já processado
      return;
    }

    const ticket = await tx.ticket.create({
      data: {
        eventId,
        ticketTypeId,
        pricePaid: ticketType.price,
        totalPaidCents: intent.amount,
        currency: ticketType.currency || intent.currency.toUpperCase(),
        stripePaymentIntentId: intent.id,
        status: "ACTIVE",
        qrSecret,
        rotatingSeed,
        userId: userId ?? undefined,
        ownerUserId: userId ?? null,
        ownerIdentityId: null,
        pairingId,
        padelSplitShareCents: ticketType.price,
      },
    });

    await tx.ticketType.update({
      where: { id: ticketTypeId },
      data: { soldQuantity: ticketType.soldQuantity + 1 },
    });

    const updated = await tx.padelPairing.update({
      where: { id: pairingId },
      data: {
        slots: {
          update: {
            where: { id: slotId },
            data: {
              ticketId: ticket.id,
              profileId: userId ?? undefined,
              paymentStatus: PadelPairingPaymentStatus.PAID,
              slotStatus: userId ? PadelPairingSlotStatus.FILLED : slot.slotStatus,
            },
          },
        },
      },
      include: { slots: true },
    });

    const stillPending = updated.slots.some((s) => s.slotStatus === "PENDING" || s.paymentStatus === "UNPAID");
    if (!stillPending && updated.pairingStatus !== "COMPLETE") {
      const confirmed = await tx.padelPairing.update({
        where: { id: pairingId },
        data: { pairingStatus: "COMPLETE" },
        select: { id: true, player1UserId: true, player2UserId: true },
      });
      await ensureEntriesForConfirmedPairing(confirmed.id);
      const captainUserId = confirmed.player1UserId ?? userId ?? undefined;
      if (captainUserId) {
        await queuePartnerPaid(pairingId, captainUserId, userId ?? undefined);
      }
    }

    await tx.paymentEvent.upsert({
      where: { stripePaymentIntentId: intent.id },
      update: {
        status: "OK",
        amountCents: intent.amount,
        eventId,
        userId: userId ?? undefined,
        updatedAt: new Date(),
        errorMessage: null,
        mode: intent.livemode ? "LIVE" : "TEST",
        isTest: !intent.livemode,
        stripeFeeCents: stripeFeeForIntentValue ?? 0,
        purchaseId: purchaseId ?? intent.id,
        source: PaymentEventSource.WEBHOOK,
        dedupeKey: purchaseId ?? intent.id,
        attempt: { increment: 1 },
      },
      create: {
        stripePaymentIntentId: intent.id,
        status: "OK",
        amountCents: intent.amount,
        eventId,
        userId: userId ?? undefined,
        mode: intent.livemode ? "LIVE" : "TEST",
        isTest: !intent.livemode,
        stripeFeeCents: stripeFeeForIntentValue ?? 0,
        purchaseId: purchaseId ?? intent.id,
        source: PaymentEventSource.WEBHOOK,
        dedupeKey: purchaseId ?? intent.id,
        attempt: 1,
      },
    });
  });

  return true;
}
