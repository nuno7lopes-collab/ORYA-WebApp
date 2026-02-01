import { prisma } from "@/lib/prisma";
import {
  CrmInteractionSource,
  CrmInteractionType,
  EntitlementStatus,
  EntitlementType,
  PadelPairingPaymentStatus,
  PadelPairingSlotStatus,
  PadelPaymentMode,
  PadelRegistrationStatus,
  PaymentEventSource,
} from "@prisma/client";
import crypto from "crypto";
import { ensureEntriesForConfirmedPairing } from "@/domain/tournaments/ensureEntriesForConfirmedPairing";
import { checkoutKey } from "@/lib/stripe/idempotency";
import { logError } from "@/lib/observability/logger";
import { ingestCrmInteraction } from "@/lib/crm/ingest";
import { requireLatestPolicyVersionForEvent } from "@/lib/checkin/accessPolicy";
import { upsertPadelRegistrationForPairing } from "@/domain/padelRegistration";
import { paymentEventRepo, saleLineRepo, saleSummaryRepo } from "@/domain/finance/readModelConsumer";

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
  const idempotencyKey = typeof meta.idempotencyKey === "string" ? meta.idempotencyKey.trim() : "";
  const paymentDedupeKey = idempotencyKey || (purchaseId ? checkoutKey(purchaseId) : intent.id);

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
      organizationId: true,
    },
  });
  if (!event) return false;
  if (event.organizationId == null) {
    throw new Error("EVENT_ORG_REQUIRED");
  }
  const organizationId = event.organizationId;

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
        purchaseId: purchaseId ?? intent.id,
        status: "ACTIVE",
        qrSecret: qr1,
        rotatingSeed: rot1,
        userId: userId ?? undefined,
        ownerUserId: ownerUserId ?? null,
        ownerIdentityId: ownerIdentityId ?? null,
        pairingId,
        padelSplitShareCents: ticketType.price,
        emissionIndex: 0,
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
        purchaseId: purchaseId ?? intent.id,
        status: "ACTIVE",
        qrSecret: qr2,
        rotatingSeed: rot2,
        pairingId,
        padelSplitShareCents: ticketType.price,
        ownerUserId: ownerUserId ?? null,
        ownerIdentityId: ownerIdentityId ?? null,
        emissionIndex: 1,
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
      ? await saleSummaryRepo(tx).update({
          where: { id: saleSummary.id },
          data: { ...summaryData, paymentIntentId: intent.id },
        })
      : await saleSummaryRepo(tx).create({
          data: { ...summaryData, paymentIntentId: intent.id },
        });

    await saleLineRepo(tx).deleteMany({ where: { saleSummaryId: sale.id } });
    const saleLine = await saleLineRepo(tx).create({
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

    const policyVersionApplied = await requireLatestPolicyVersionForEvent(eventId, tx);
    const ownerKey = ownerUserId
      ? `user:${ownerUserId}`
      : ownerIdentityId
        ? `identity:${ownerIdentityId}`
        : ownerEmailNormalized
          ? `email:${ownerEmailNormalized}`
          : "unknown";
    const entitlementPurchaseId = sale.purchaseId ?? sale.paymentIntentId ?? intent.id;
    const entitlementBase = {
      purchaseId: entitlementPurchaseId,
      saleLineId: saleLine.id,
      ownerKey,
      ownerUserId: ownerUserId ?? null,
      ownerIdentityId: ownerIdentityId ?? null,
      type: EntitlementType.PADEL_ENTRY,
      status: EntitlementStatus.ACTIVE,
      eventId,
      policyVersionApplied,
      snapshotTitle: event.title,
      snapshotCoverUrl: event.coverImageUrl,
      snapshotVenueName: event.locationName,
      snapshotStartAt: event.startsAt,
      snapshotTimezone: event.timezone,
    };

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
      update: { ...entitlementBase, ticketId: ticketCaptain.id },
      create: { ...entitlementBase, lineItemIndex: 0, ticketId: ticketCaptain.id },
    });

    await tx.entitlement.upsert({
      where: {
        purchaseId_saleLineId_lineItemIndex_ownerKey_type: {
          purchaseId: entitlementPurchaseId,
          saleLineId: saleLine.id,
          lineItemIndex: 1,
          ownerKey,
          type: EntitlementType.PADEL_ENTRY,
        },
      },
      update: { ...entitlementBase, ticketId: ticketPartner.id },
      create: { ...entitlementBase, lineItemIndex: 1, ticketId: ticketPartner.id },
    });

    await tx.ticket.updateMany({
      where: { id: { in: [ticketCaptain.id, ticketPartner.id] } },
      data: { saleSummaryId: sale.id },
    });

    const partnerFilled = Boolean(partnerSlot.profileId || partnerSlot.playerProfileId);
    const partnerSlotStatus = partnerFilled ? PadelPairingSlotStatus.FILLED : PadelPairingSlotStatus.PENDING;
    const pairingStatus = partnerSlotStatus === PadelPairingSlotStatus.FILLED ? "COMPLETE" : "INCOMPLETE";

    const registrationStatus = PadelRegistrationStatus.CONFIRMED;
    await tx.padelPairing.update({
      where: { id: pairingId },
      data: {
        pairingStatus,
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

    await upsertPadelRegistrationForPairing(tx, {
      pairingId,
      organizationId,
      eventId,
      status: registrationStatus,
      paymentMode: PadelPaymentMode.FULL,
      isFullyPaid: true,
      reason: "CAPTAIN_FULL_PAYMENT",
    });

    shouldEnsureEntries = pairingStatus === "COMPLETE";

    const paymentEventKey = purchaseId ?? intent.id;
    await paymentEventRepo(tx).upsert({
      where: { purchaseId: paymentEventKey },
      update: {
        status: "OK",
        amountCents: intent.amount,
        eventId,
        userId: userId ?? undefined,
        updatedAt: new Date(),
        errorMessage: null,
        mode: intent.livemode ? "LIVE" : "TEST",
        isTest: !intent.livemode,
        purchaseId: paymentEventKey,
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
        purchaseId: paymentEventKey,
        source: PaymentEventSource.WEBHOOK,
        dedupeKey: paymentDedupeKey,
        attempt: 1,
      },
    });
  });

  if (shouldEnsureEntries) {
    await ensureEntriesForConfirmedPairing(pairingId);
  }

  if (organizationId && userId) {
    try {
      await ingestCrmInteraction({
        organizationId,
        userId,
        type: CrmInteractionType.PADEL_MATCH_PAYMENT,
        sourceType: CrmInteractionSource.TICKET,
        sourceId: purchaseId ?? intent.id,
        occurredAt: new Date(),
        amountCents: intent.amount ?? ticketType.price * 2,
        currency: ticketType.currency || intent.currency.toUpperCase(),
        metadata: {
          eventId,
          pairingId,
          ticketTypeId,
        },
      });
    } catch (err) {
      logError("fulfill_padel_full.crm_interaction_failed", err, { pairingId });
    }
  }

  return true;
}
