import { prisma } from "@/lib/prisma";
import {
  EntitlementStatus,
  EntitlementType,
  PadelPairingLifecycleStatus,
  PadelPairingPaymentStatus,
  PadelPairingSlotStatus,
  PadelPaymentMode,
  PaymentEventSource,
} from "@prisma/client";
import crypto from "crypto";
import { ensureEntriesForConfirmedPairing } from "@/domain/tournaments/ensureEntriesForConfirmedPairing";

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
  const ownerUserId = typeof meta.ownerUserId === "string" ? meta.ownerUserId : null;
  const ownerIdentityId = typeof meta.ownerIdentityId === "string" ? meta.ownerIdentityId : null;
  const ownerEmailNormalized = typeof meta.emailNormalized === "string" ? meta.emailNormalized : null;
  const userId = ownerUserId;
  const purchaseId =
    typeof meta.purchaseId === "string" && meta.purchaseId.trim() !== ""
      ? meta.purchaseId.trim()
      : null;

  if (!Number.isFinite(pairingId) || !Number.isFinite(ticketTypeId) || !Number.isFinite(eventId)) {
    return false;
  }

  const ticketType = await prisma.ticketType.findUnique({
    where: { id: ticketTypeId },
    select: { id: true, price: true, currency: true, soldQuantity: true, totalQuantity: true, eventId: true },
  });
  if (!ticketType || ticketType.eventId !== eventId) {
    return false;
  }
  if (ticketType.totalQuantity !== null && ticketType.totalQuantity !== undefined) {
    const remaining = ticketType.totalQuantity - ticketType.soldQuantity;
    if (remaining < 2) {
      throw new Error("INSUFFICIENT_STOCK");
    }
  }
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      coverImageUrl: true,
      locationName: true,
      startsAt: true,
      timezone: true,
    },
  });
  if (!event) return false;

  const existingTicket = await prisma.ticket.findFirst({
    where: { stripePaymentIntentId: intent.id },
    select: { id: true },
  });
  if (existingTicket) return true;

  const qr1 = crypto.randomUUID();
  const qr2 = crypto.randomUUID();
  const rot1 = crypto.randomUUID();
  const rot2 = crypto.randomUUID();

  let shouldEnsureEntries = false;
  await prisma.$transaction(async (tx) => {
    const pairing = await tx.padelPairing.findUnique({
      where: { id: pairingId },
      include: { slots: true },
    });
    if (!pairing || pairing.payment_mode !== PadelPaymentMode.FULL) {
      throw new Error("PAIRING_NOT_FULL");
    }
    if (pairing.pairingStatus === "CANCELLED") {
      throw new Error("PAIRING_CANCELLED");
    }

    const captainSlot = pairing.slots.find((s) => s.slot_role === "CAPTAIN");
    const partnerSlot = pairing.slots.find((s) => s.slot_role === "PARTNER");
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
        ownerUserId: ownerUserId ?? null,
        ownerIdentityId: ownerIdentityId ?? null,
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
        ownerUserId: ownerUserId ?? null,
        ownerIdentityId: ownerIdentityId ?? null,
      },
    });

    await tx.ticketType.update({
      where: { id: ticketTypeId },
      data: { soldQuantity: ticketType.soldQuantity + 2 },
    });

    // SaleSummary / SaleLine + Entitlements (2 lugares)
    const saleSummary =
      (purchaseId
        ? await tx.saleSummary.findUnique({ where: { purchaseId } })
        : null) ||
      (await tx.saleSummary.findUnique({ where: { paymentIntentId: intent.id } }));

    const summaryData = {
      eventId,
      userId: userId ?? null,
      ownerUserId: ownerUserId ?? null,
      ownerIdentityId: ownerIdentityId ?? null,
      purchaseId: purchaseId ?? intent.id,
      subtotalCents: ticketType.price * 2,
      discountCents: 0,
      platformFeeCents: 0,
      stripeFeeCents: 0,
      totalCents: intent.amount ?? ticketType.price * 2,
      netCents: intent.amount ?? ticketType.price * 2,
      feeMode: null as any,
      currency: (ticketType.currency || intent.currency || "EUR").toUpperCase(),
      status: "PAID" as const,
    };

    const sale = saleSummary
      ? await tx.saleSummary.update({
          where: { id: saleSummary.id },
          data: { ...summaryData, paymentIntentId: intent.id },
        })
      : await tx.saleSummary.create({
          data: { ...summaryData, paymentIntentId: intent.id },
        });

    await tx.saleLine.deleteMany({ where: { saleSummaryId: sale.id } });
    const saleLine = await tx.saleLine.create({
      data: {
        saleSummaryId: sale.id,
        eventId,
        ticketTypeId: ticketType.id,
        promoCodeId: null,
        quantity: 2,
        unitPriceCents: ticketType.price,
        discountPerUnitCents: 0,
        grossCents: intent.amount ?? ticketType.price * 2,
        netCents: intent.amount ?? ticketType.price * 2,
        platformFeeCents: 0,
      },
    });

    const ownerKey = ownerUserId
      ? `user:${ownerUserId}`
      : ownerIdentityId
        ? `identity:${ownerIdentityId}`
        : ownerEmailNormalized
          ? `email:${ownerEmailNormalized}`
          : "unknown";
    const entitlementBase = {
      purchaseId: sale.purchaseId,
      saleLineId: saleLine.id,
      ownerKey,
      ownerUserId: ownerUserId ?? null,
      ownerIdentityId: ownerIdentityId ?? null,
      type: EntitlementType.PADEL_ENTRY,
      status: EntitlementStatus.ACTIVE,
      eventId,
      snapshotTitle: event.title,
      snapshotCoverUrl: event.coverImageUrl,
      snapshotVenueName: event.locationName,
      snapshotStartAt: event.startsAt,
      snapshotTimezone: event.timezone,
    };

    await tx.entitlement.upsert({
      where: {
        purchaseId_saleLineId_lineItemIndex_ownerKey_type: {
          purchaseId: sale.purchaseId,
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
          purchaseId: sale.purchaseId,
          saleLineId: saleLine.id,
          lineItemIndex: 1,
          ownerKey,
          type: EntitlementType.PADEL_ENTRY,
        },
      },
      update: entitlementBase,
      create: { ...entitlementBase, lineItemIndex: 1 },
    });

    await tx.ticket.updateMany({
      where: { id: { in: [ticketCaptain.id, ticketPartner.id] } },
      data: { saleSummaryId: sale.id },
    });

    const partnerFilled = Boolean(partnerSlot.profileId || partnerSlot.playerProfileId);
    const partnerSlotStatus = partnerFilled ? PadelPairingSlotStatus.FILLED : PadelPairingSlotStatus.PENDING;
    const pairingStatus = partnerSlotStatus === PadelPairingSlotStatus.FILLED ? "COMPLETE" : "INCOMPLETE";

    await tx.padelPairing.update({
      where: { id: pairingId },
      data: {
        pairingStatus,
        lifecycleStatus: PadelPairingLifecycleStatus.CONFIRMED_CAPTAIN_FULL,
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
                slotStatus: partnerSlotStatus,
              },
            },
          ],
        },
      },
    });

    shouldEnsureEntries = pairingStatus === "COMPLETE";

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

  if (shouldEnsureEntries) {
    await ensureEntriesForConfirmedPairing(pairingId);
  }

  return true;
}
