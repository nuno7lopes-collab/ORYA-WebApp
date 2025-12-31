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
import { queuePartnerPaid } from "@/domain/notifications/splitPayments";
import { checkoutKey } from "@/lib/stripe/idempotency";

type IntentLike = {
  id: string;
  amount: number | null;
  livemode: boolean;
  currency: string;
  metadata: Record<string, any>;
  payment_method?: string | { id?: string } | null;
};

function extractPaymentMethodId(intent: IntentLike) {
  if (!intent.payment_method) return null;
  if (typeof intent.payment_method === "string") return intent.payment_method;
  if (typeof intent.payment_method === "object" && typeof intent.payment_method.id === "string") {
    return intent.payment_method.id;
  }
  return null;
}

export async function fulfillPadelSplitIntent(intent: IntentLike, stripeFeeForIntentValue: number | null): Promise<boolean> {
  const meta = intent.metadata ?? {};
  const pairingId = Number(meta.pairingId);
  const slotId = Number(meta.slotId);
  let ticketTypeId = Number(meta.ticketTypeId);
  const eventId = Number(meta.eventId);
  const ownerUserId = typeof meta.ownerUserId === "string" ? meta.ownerUserId : null;
  const ownerIdentityId = typeof meta.ownerIdentityId === "string" ? meta.ownerIdentityId : null;
  const ownerEmailNormalized = typeof meta.emailNormalized === "string" ? meta.emailNormalized : null;
  const userId = ownerUserId;
  const purchaseId =
    typeof meta.purchaseId === "string" && meta.purchaseId.trim() !== ""
      ? meta.purchaseId.trim()
      : null;
  const idempotencyKey = typeof meta.idempotencyKey === "string" ? meta.idempotencyKey.trim() : "";
  const paymentDedupeKey = idempotencyKey || (purchaseId ? checkoutKey(purchaseId) : intent.id);

  if (!Number.isFinite(ticketTypeId)) {
    const rawItems =
      typeof meta.items === "string"
        ? meta.items
        : typeof meta.itemsJson === "string"
          ? meta.itemsJson
          : null;
    if (rawItems) {
      try {
        const parsed = JSON.parse(rawItems);
        const first = Array.isArray(parsed) ? parsed[0] : null;
        const fromItems =
          first && typeof first === "object"
            ? Number((first as { ticketTypeId?: number; ticketId?: number }).ticketTypeId ?? (first as { ticketId?: number }).ticketId)
            : NaN;
        if (Number.isFinite(fromItems)) ticketTypeId = fromItems;
      } catch {}
    } else if (Array.isArray(meta.items)) {
      const first = meta.items[0] as { ticketTypeId?: number; ticketId?: number } | undefined;
      const fromItems = first ? Number(first.ticketTypeId ?? first.ticketId) : NaN;
      if (Number.isFinite(fromItems)) ticketTypeId = fromItems;
    }
    if (!Number.isFinite(ticketTypeId)) {
      if (typeof meta.ticketId === "string" || typeof meta.ticketId === "number") {
        const fromTicketId = Number(meta.ticketId);
        if (Number.isFinite(fromTicketId)) ticketTypeId = fromTicketId;
      }
    }
  }

  if (!Number.isFinite(pairingId) || !Number.isFinite(slotId) || !Number.isFinite(ticketTypeId) || !Number.isFinite(eventId)) {
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
    if (remaining < 1) {
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

  const paymentMethodId = extractPaymentMethodId(intent);

  await prisma.$transaction(async (tx) => {
    const pairing = await tx.padelPairing.findUnique({
      where: { id: pairingId },
      include: { slots: true },
    });
    if (!pairing || pairing.payment_mode !== PadelPaymentMode.SPLIT) {
      throw new Error("PAIRING_NOT_SPLIT");
    }
    if (pairing.pairingStatus === "CANCELLED") {
      throw new Error("PAIRING_CANCELLED");
    }
    const slot = pairing.slots.find((s) => s.id === slotId);
    if (!slot) throw new Error("SLOT_NOT_FOUND");
    const slotPaid = slot.paymentStatus === PadelPairingPaymentStatus.PAID;
    let ticketId = slot.ticketId ?? null;
    if (slotPaid && !ticketId) {
      const existingTicket = await tx.ticket.findFirst({
        where: { stripePaymentIntentId: intent.id },
        select: { id: true },
      });
      ticketId = existingTicket?.id ?? null;
    }

    let createdTicket = false;
    if (!ticketId) {
      const qrSecret = crypto.randomUUID();
      const rotatingSeed = crypto.randomUUID();
      const ticket = await tx.ticket.create({
        data: {
          eventId,
          ticketTypeId,
          pricePaid: ticketType.price,
          totalPaidCents: intent.amount ?? ticketType.price,
          currency: ticketType.currency || intent.currency.toUpperCase(),
          stripePaymentIntentId: intent.id,
          status: "ACTIVE",
          qrSecret,
          rotatingSeed,
          userId: userId ?? undefined,
          ownerUserId: ownerUserId ?? null,
          ownerIdentityId: ownerIdentityId ?? null,
          pairingId: pairingId ?? undefined,
          padelSplitShareCents: ticketType.price,
        },
      });
      ticketId = ticket.id;
      createdTicket = true;
    }

    if (createdTicket) {
      await tx.ticketType.update({
        where: { id: ticketTypeId },
        data: { soldQuantity: ticketType.soldQuantity + 1 },
      });
    }

    // SaleSummary / SaleLine + Entitlement (para carteira)
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
      subtotalCents: ticketType.price,
      discountCents: 0,
      platformFeeCents: 0,
      stripeFeeCents: stripeFeeForIntentValue ?? 0,
      totalCents: intent.amount ?? ticketType.price,
      netCents: intent.amount ?? ticketType.price,
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
        quantity: 1,
        unitPriceCents: ticketType.price,
        discountPerUnitCents: 0,
        grossCents: intent.amount ?? ticketType.price,
        netCents: intent.amount ?? ticketType.price,
        platformFeeCents: 0,
      },
    });

    if (ticketId) {
      await tx.ticket.update({
        where: { id: ticketId },
        data: { saleSummaryId: sale.id },
      });
    }

    const ownerKey = ownerUserId
      ? `user:${ownerUserId}`
      : ownerIdentityId
        ? `identity:${ownerIdentityId}`
        : ownerEmailNormalized
          ? `email:${ownerEmailNormalized}`
          : "unknown";
    const entitlementPurchaseId = sale.purchaseId ?? sale.paymentIntentId ?? intent.id;
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
        ownerUserId: ownerUserId ?? null,
        ownerIdentityId: ownerIdentityId ?? null,
        eventId,
        snapshotTitle: event.title,
        snapshotCoverUrl: event.coverImageUrl,
        snapshotVenueName: event.locationName,
        snapshotStartAt: event.startsAt,
        snapshotTimezone: event.timezone,
      },
      create: {
        purchaseId: entitlementPurchaseId,
        saleLineId: saleLine.id,
        lineItemIndex: 0,
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
      },
    });

    let updated = await tx.padelPairing.update({
      where: { id: pairingId },
      data: {
        slots: {
          update: {
            where: { id: slotId },
            data: {
              ticketId: ticketId ?? undefined,
              profileId: userId ?? undefined,
              paymentStatus: PadelPairingPaymentStatus.PAID,
              slotStatus: userId ? PadelPairingSlotStatus.FILLED : slot.slotStatus,
            },
          },
        },
        ...(slot.slot_role === "CAPTAIN" && paymentMethodId
          ? { paymentMethodId }
          : {}),
      },
      include: { slots: true },
    });

    const allPaid = updated.slots.every((s) => s.paymentStatus === PadelPairingPaymentStatus.PAID);
    const nextLifecycle = allPaid
      ? PadelPairingLifecycleStatus.CONFIRMED_BOTH_PAID
      : PadelPairingLifecycleStatus.PENDING_PARTNER_PAYMENT;
    if (updated.lifecycleStatus !== nextLifecycle) {
      updated = await tx.padelPairing.update({
        where: { id: pairingId },
        data: { lifecycleStatus: nextLifecycle },
        include: { slots: true },
      });
    }

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
        dedupeKey: paymentDedupeKey,
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
        dedupeKey: paymentDedupeKey,
        attempt: 1,
      },
    });
  });

  return true;
}
