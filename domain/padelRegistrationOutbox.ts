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
    select: { id: true, pairingId: true },
  });
  if (!registration?.pairingId) return { ok: false, code: "PAIRING_NOT_FOUND" } as const;
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
    include: {
      pairing: {
        include: {
          slots: { include: { ticket: true } },
        },
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
  const paidTickets = pairing.slots
    .filter((slot) => slot.paymentStatus === PadelPairingPaymentStatus.PAID && slot.ticket)
    .map((slot) => slot.ticket!)
    .filter(Boolean);

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.padelPairingSlot.updateMany({
      where: { pairingId },
      data: {
        slotStatus: PadelPairingSlotStatus.CANCELLED,
        paymentStatus: PadelPairingPaymentStatus.UNPAID,
        ticketId: null,
      },
    });

    const paidTicket = pairing.slots.find(
      (slot) => slot.paymentStatus === PadelPairingPaymentStatus.PAID && slot.ticket,
    )?.ticket;
    if (paidTicket) {
      await tx.ticket.update({
        where: { id: paidTicket.id },
        data: { pairingId: null },
      });
    }

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

  await Promise.all(
    paidTickets.map((ticket) => {
      const purchaseId = ticket.purchaseId ?? null;
      if (!purchaseId) return Promise.resolve(null);
      return enqueueOperation({
        operationType: "PROCESS_REFUND_SINGLE",
        dedupeKey: refundKey(purchaseId),
        correlations: {
          eventId,
          organizationId,
          pairingId,
          purchaseId,
          paymentIntentId: ticket.stripePaymentIntentId ?? null,
        },
        payload: {
          eventId,
          purchaseId,
          paymentIntentId: ticket.stripePaymentIntentId ?? null,
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
