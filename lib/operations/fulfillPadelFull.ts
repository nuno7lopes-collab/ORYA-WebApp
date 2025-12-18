import { prisma } from "@/lib/prisma";
import { PaymentEventSource, PadelPairingPaymentStatus, PadelPairingSlotStatus, PadelPaymentMode } from "@prisma/client";
import crypto from "crypto";

type IntentLike = {
  id: string;
  amount: number | null;
  livemode: boolean;
  currency: string;
  metadata: Record<string, any>;
};

export async function fulfillPadelFullIntent(intent: IntentLike): Promise<boolean> {
  const meta = intent.metadata ?? {};
  const pairingId = Number(meta.pairingId);
  const ticketTypeId = Number(meta.ticketTypeId);
  const eventId = Number(meta.eventId);
  const userId = typeof meta.userId === "string" ? meta.userId : null;
  const purchaseId =
    typeof meta.purchaseId === "string" && meta.purchaseId.trim() !== ""
      ? meta.purchaseId.trim()
      : null;

  if (!Number.isFinite(pairingId) || !Number.isFinite(ticketTypeId) || !Number.isFinite(eventId)) {
    return false;
  }

  const ticketType = await prisma.ticketType.findUnique({
    where: { id: ticketTypeId },
    select: { id: true, price: true, currency: true, soldQuantity: true, eventId: true },
  });
  if (!ticketType || ticketType.eventId !== eventId) {
    return false;
  }

  const qr1 = crypto.randomUUID();
  const qr2 = crypto.randomUUID();
  const rot1 = crypto.randomUUID();
  const rot2 = crypto.randomUUID();

  await prisma.$transaction(async (tx) => {
    const pairing = await tx.padelPairing.findUnique({
      where: { id: pairingId },
      include: { slots: true },
    });
    if (!pairing || pairing.paymentMode !== PadelPaymentMode.FULL) {
      throw new Error("PAIRING_NOT_FULL");
    }
    if (pairing.pairingStatus === "CANCELLED") {
      throw new Error("PAIRING_CANCELLED");
    }

    const captainSlot = pairing.slots.find((s) => s.slotRole === "CAPTAIN");
    const partnerSlot = pairing.slots.find((s) => s.slotRole === "PARTNER");
    if (!captainSlot || !partnerSlot) throw new Error("SLOTS_INVALID");

    const ticketCaptain = await tx.ticket.create({
      data: {
        eventId,
        ticketTypeId,
        pricePaid: ticketType.price,
        totalPaidCents: ticketType.price,
        currency: ticketType.currency || intent.currency.toUpperCase(),
        stripePaymentIntentId: intent.id,
        status: "ACTIVE",
        qrSecret: qr1,
        rotatingSeed: rot1,
        userId: userId ?? undefined,
        ownerUserId: userId ?? null,
        ownerIdentityId: null,
        pairingId,
        padelSplitShareCents: ticketType.price,
      },
    });

    const ticketPartner = await tx.ticket.create({
      data: {
        eventId,
        ticketTypeId,
        pricePaid: ticketType.price,
        totalPaidCents: ticketType.price,
        currency: ticketType.currency || intent.currency.toUpperCase(),
        stripePaymentIntentId: intent.id,
        status: "ACTIVE",
        qrSecret: qr2,
        rotatingSeed: rot2,
        pairingId,
        padelSplitShareCents: ticketType.price,
        ownerUserId: userId ?? null,
        ownerIdentityId: null,
      },
    });

    await tx.ticketType.update({
      where: { id: ticketTypeId },
      data: { soldQuantity: ticketType.soldQuantity + 2 },
    });

    await tx.padelPairing.update({
      where: { id: pairingId },
      data: {
        pairingStatus: "INCOMPLETE",
        slots: {
          update: [
            {
              where: { id: captainSlot.id },
              data: {
                ticketId: ticketCaptain.id,
                profileId: userId ?? captainSlot.profileId ?? undefined,
                paymentStatus: PadelPairingPaymentStatus.PAID,
                slotStatus: PadelPairingSlotStatus.FILLED,
              },
            },
            {
              where: { id: partnerSlot.id },
              data: {
                ticketId: ticketPartner.id,
                paymentStatus: PadelPairingPaymentStatus.PAID,
                slotStatus: PadelPairingSlotStatus.PENDING,
              },
            },
          ],
        },
      },
    });

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
        purchaseId: purchaseId ?? intent.id,
        source: PaymentEventSource.WEBHOOK,
        dedupeKey: purchaseId ?? intent.id,
        attempt: 1,
      },
    });
  });

  return true;
}
