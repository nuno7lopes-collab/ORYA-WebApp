import { prisma } from "@/lib/prisma";
import {
  PadelPairingGuaranteeStatus,
  PadelPairingPaymentStatus,
  PadelPairingSlotStatus,
  PadelPairingStatus,
  type Prisma,
} from "@prisma/client";
import { attemptPadelSecondChargeForPairing } from "@/domain/padelSecondCharge";
import { enqueueOperation } from "@/lib/operations/enqueue";
import { refundKey } from "@/lib/stripe/idempotency";
import { queuePairingConfirmed, queueDeadlineExpired } from "@/domain/notifications/splitPayments";

type PadelRegistrationOutboxPayload = {
  registrationId?: string;
  reason?: string | null;
};

export async function handlePadelRegistrationOutboxEvent(params: {
  eventType: string;
  payload: PadelRegistrationOutboxPayload;
}) {
  switch (params.eventType) {
    case "PADREG_STATUS_CHANGED":
      return syncPairingLifecycleFromRegistration(params.payload);
    case "PADREG_SPLIT_SECOND_CHARGE_DUE":
      return handleSecondChargeDue(params.payload);
    case "PADREG_EXPIRED":
      return handleRegistrationExpired(params.payload);
    default:
      return { ok: true, code: "IGNORED" } as const;
  }
}

async function syncPairingLifecycleFromRegistration(payload: PadelRegistrationOutboxPayload) {
  if (!payload.registrationId) throw new Error("PADREG_OUTBOX_MISSING_REGISTRATION");
  const registration = await prisma.padelRegistration.findUnique({
    where: { id: payload.registrationId },
    select: { id: true, pairingId: true, status: true },
  });
  if (!registration?.pairingId) return { ok: false, code: "PAIRING_NOT_FOUND" } as const;
  if (registration.status === "CONFIRMED") {
    const pairing = await prisma.padelPairing.findUnique({
      where: { id: registration.pairingId },
      select: {
        id: true,
        player1UserId: true,
        player2UserId: true,
        slots: { select: { profileId: true, invitedUserId: true } },
      },
    });
    if (pairing) {
      const userIds = new Set<string>();
      if (pairing.player1UserId) userIds.add(pairing.player1UserId);
      if (pairing.player2UserId) userIds.add(pairing.player2UserId);
      pairing.slots.forEach((slot) => {
        if (slot.profileId) userIds.add(slot.profileId);
        if (slot.invitedUserId) userIds.add(slot.invitedUserId);
      });
      if (userIds.size > 0) {
        await queuePairingConfirmed(pairing.id, Array.from(userIds));
      }
    }
  }
  return { ok: true, code: "SYNCED_NOOP" } as const;
}

async function handleSecondChargeDue(payload: PadelRegistrationOutboxPayload) {
  if (!payload.registrationId) throw new Error("PADREG_OUTBOX_MISSING_REGISTRATION");
  const registration = await prisma.padelRegistration.findUnique({
    where: { id: payload.registrationId },
    select: { pairingId: true },
  });
  if (!registration?.pairingId) return { ok: false, code: "PAIRING_NOT_FOUND" } as const;
  return attemptPadelSecondChargeForPairing({ pairingId: registration.pairingId });
}

async function handleRegistrationExpired(payload: PadelRegistrationOutboxPayload) {
  if (!payload.registrationId) throw new Error("PADREG_OUTBOX_MISSING_REGISTRATION");
  const registration = await prisma.padelRegistration.findUnique({
    where: { id: payload.registrationId },
    select: {
      id: true,
      eventId: true,
      organizationId: true,
      pairing: {
        select: { id: true },
      },
    },
  });
  if (!registration?.pairing) return { ok: false, code: "PAIRING_NOT_FOUND" } as const;

  const pairing = registration.pairing;
  const reason = typeof payload.reason === "string" ? payload.reason : null;
  const guaranteeStatus = resolveGuaranteeStatusForExpiry(reason);
  const pairingId = pairing.id;
  const eventId = registration.eventId;
  const organizationId = registration.organizationId;

  const payments = await prisma.payment.findMany({
    where: {
      sourceType: "PADEL_REGISTRATION",
      sourceId: registration.id,
      status: { in: ["SUCCEEDED", "PARTIAL_REFUND"] },
    },
    select: { id: true },
  });
  const paymentIntentByPurchaseId = new Map<string, string>();
  if (payments.length > 0) {
    const paymentEvents = await prisma.paymentEvent.findMany({
      where: {
        purchaseId: { in: payments.map((payment) => payment.id) },
        stripePaymentIntentId: { not: null },
      },
      select: { purchaseId: true, stripePaymentIntentId: true },
    });
    for (const event of paymentEvents) {
      if (event.purchaseId && event.stripePaymentIntentId) {
        paymentIntentByPurchaseId.set(event.purchaseId, event.stripePaymentIntentId);
      }
    }
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.padelPairingSlot.updateMany({
      where: { pairingId },
      data: {
        slotStatus: PadelPairingSlotStatus.CANCELLED,
        paymentStatus: PadelPairingPaymentStatus.UNPAID,
        ticketId: null,
      },
    });

    await tx.padelPairing.update({
      where: { id: pairingId },
      data: {
        pairingStatus: PadelPairingStatus.CANCELLED,
        partnerInviteToken: null,
        partnerInviteUsedAt: null,
        partnerLinkToken: null,
        partnerLinkExpiresAt: null,
        lockedUntil: null,
        graceUntilAt: null,
        ...(guaranteeStatus ? { guaranteeStatus } : {}),
      },
    });

    await tx.padelPairingHold.updateMany({
      where: { pairingId, status: "ACTIVE" },
      data: { status: "CANCELLED" },
    });
  });

  const pairingUsers = await prisma.padelPairing.findUnique({
    where: { id: pairingId },
    select: {
      id: true,
      player1UserId: true,
      player2UserId: true,
      slots: { select: { profileId: true, invitedUserId: true } },
    },
  });
  if (pairingUsers) {
    const userIds = new Set<string>();
    if (pairingUsers.player1UserId) userIds.add(pairingUsers.player1UserId);
    if (pairingUsers.player2UserId) userIds.add(pairingUsers.player2UserId);
    pairingUsers.slots.forEach((slot) => {
      if (slot.profileId) userIds.add(slot.profileId);
      if (slot.invitedUserId) userIds.add(slot.invitedUserId);
    });
    if (userIds.size > 0) {
      await queueDeadlineExpired(pairingId, Array.from(userIds));
    }
  }

  await Promise.all(
    payments.map((payment) => {
      const purchaseId = payment.id;
      const paymentIntentId = paymentIntentByPurchaseId.get(purchaseId) ?? null;
      return enqueueOperation({
        operationType: "PROCESS_REFUND_SINGLE",
        dedupeKey: refundKey(purchaseId),
        correlations: {
          eventId,
          organizationId,
          pairingId,
          purchaseId,
          paymentIntentId,
        },
        payload: {
          eventId,
          purchaseId,
          paymentIntentId,
          reason: "CANCELLED",
          refundedBy: "system",
          auditPayload: {
            pairingId,
            registrationId: registration.id,
            reason,
            source: "PADREG_EXPIRED",
          },
        },
      });
    }),
  );

  return { ok: true, code: "EXPIRED" } as const;
}

function resolveGuaranteeStatusForExpiry(reason: string | null): PadelPairingGuaranteeStatus | null {
  if (!reason) return null;
  if (reason.startsWith("SECOND_CHARGE")) return PadelPairingGuaranteeStatus.FAILED;
  if (reason === "GRACE_EXPIRED") return PadelPairingGuaranteeStatus.EXPIRED;
  return null;
}
