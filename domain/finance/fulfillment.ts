import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import {
  EntitlementStatus,
  EntitlementType,
  PaymentStatus,
  SourceType,
  TicketStatus,
  Prisma,
} from "@prisma/client";
import { requireLatestPolicyVersionForEvent } from "@/lib/checkin/accessPolicy";
import { formatEventLocationLabel } from "@/lib/location/eventLocation";

type DbClient = Prisma.TransactionClient | typeof prisma;

export type FulfillPaymentInput = {
  paymentId: string;
  causationId: string;
  correlationId?: string | null;
};

export type FulfillPaymentResult = {
  status: "SKIPPED" | "FULFILLED";
  paymentId: string;
};

export type ApplyPaymentStatusResult = {
  status: "UPDATED" | "NOOP";
  paymentId: string;
};

function buildOwnerKey(identityId?: string | null) {
  if (identityId) return `identity:${identityId}`;
  return "unknown";
}

function parseIntId(value: string | number | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

async function resolveEventForTicketTypes(
  ticketTypeIds: Array<string | number>,
  tx: DbClient,
) {
  const ids = ticketTypeIds.map((id) => parseIntId(id)).filter((id): id is number => id != null);
  if (ids.length === 0) {
    throw new Error("TICKET_TYPE_ID_INVALID");
  }
  const ticketTypes = await tx.ticketType.findMany({ where: { id: { in: ids } } });
  if (!ticketTypes.length) {
    throw new Error("TICKET_TYPE_NOT_FOUND");
  }
  const eventId = ticketTypes[0].eventId;
  const event = await tx.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      coverImageUrl: true,
      startsAt: true,
      organizationId: true,
      timezone: true,
      addressRef: { select: { formattedAddress: true } },
    },
  });
  if (!event) {
    throw new Error("EVENT_NOT_FOUND");
  }
  return { event, ticketTypes };
}

async function resolveUserIdFromIdentity(identityId: string | null, tx: DbClient): Promise<string | null> {
  if (!identityId) return null;
  const client = tx as any;
  if (client.emailIdentity && typeof client.emailIdentity.findUnique === "function") {
    const emailIdentity = await client.emailIdentity.findUnique({
      where: { id: identityId },
      select: { userId: true },
    });
    if (emailIdentity?.userId) return emailIdentity.userId;
  }
  if (client.userIdentity && typeof client.userIdentity.findUnique === "function") {
    const userIdentity = await client.userIdentity.findUnique({
      where: { id: identityId },
      select: { userId: true },
    });
    if (userIdentity?.userId) return userIdentity.userId;
  }
  return null;
}

async function ensurePurchaseSignal(params: { userId: string | null; eventId: number; organizationId?: number | null }, tx: DbClient) {
  if (!params.userId) return;
  const existing = await tx.userEventSignal.findFirst({
    where: { userId: params.userId, eventId: params.eventId, signalType: "PURCHASE" },
    select: { id: true },
  });
  if (existing) return;
  await tx.userEventSignal.create({
    data: {
      userId: params.userId,
      eventId: params.eventId,
      organizationId: params.organizationId ?? null,
      signalType: "PURCHASE",
    },
  });
}

function allocatePlatformFeePerUnit(params: {
  grossTotal: number;
  platformFeeTotal: number;
  lineTotal: number;
  qty: number;
}) {
  if (params.grossTotal <= 0 || params.qty <= 0) return 0;
  const lineShare = params.platformFeeTotal * (params.lineTotal / params.grossTotal);
  return Math.round(lineShare / params.qty);
}

async function issueTicketOrderEntitlements(
  payment: { id: string; sourceId: string; customerIdentityId: string | null; pricingSnapshotJson: any },
  tx: DbClient,
) {
  const order = await tx.ticketOrder.findUnique({
    where: { id: payment.sourceId },
    select: {
      id: true,
      buyerIdentityId: true,
      currency: true,
      lines: {
        select: {
          id: true,
          qty: true,
          totalAmount: true,
          ticketTypeId: true,
        },
      },
    },
  });
  if (!order) throw new Error("TICKET_ORDER_NOT_FOUND");
  if (!order.lines.length) throw new Error("TICKET_ORDER_LINES_EMPTY");

  const { event } = await resolveEventForTicketTypes(
    order.lines.map((line) => line.ticketTypeId),
    tx,
  );

  const buyerIdentityId = payment.customerIdentityId ?? order.buyerIdentityId ?? null;
  const buyerUserId = await resolveUserIdFromIdentity(buyerIdentityId, tx);

  const policyVersionApplied = await requireLatestPolicyVersionForEvent(event.id, tx);
  const ownerKey = buildOwnerKey(payment.customerIdentityId ?? order.buyerIdentityId ?? null);
  const snapshot = payment.pricingSnapshotJson as { gross?: number; platformFee?: number; currency?: string } | null;
  const grossTotal = snapshot?.gross ?? 0;
  const platformFeeTotal = snapshot?.platformFee ?? 0;
  const currency = snapshot?.currency ?? order.currency ?? "EUR";
  const snapshotVenueName = formatEventLocationLabel({ addressRef: event.addressRef ?? null }, "Local a anunciar");

  for (const line of order.lines) {
    const ticketTypeId = parseIntId(line.ticketTypeId);
    if (!ticketTypeId) {
      throw new Error("TICKET_TYPE_ID_INVALID");
    }
    const unitTotal = Math.round(line.totalAmount / Math.max(1, line.qty));
    const unitPlatformFee = allocatePlatformFeePerUnit({
      grossTotal,
      platformFeeTotal,
      lineTotal: line.totalAmount,
      qty: line.qty,
    });

    for (let i = 0; i < line.qty; i += 1) {
      const ticket = await tx.ticket.upsert({
        where: {
          purchaseId_ticketTypeId_emissionIndex: {
            purchaseId: payment.id,
            ticketTypeId,
            emissionIndex: i,
          },
        },
        update: {
          status: TicketStatus.ACTIVE,
          ownerIdentityId: payment.customerIdentityId ?? order.buyerIdentityId ?? null,
        },
        create: {
          eventId: event.id,
          ticketTypeId,
          status: TicketStatus.ACTIVE,
          qrSecret: crypto.randomUUID(),
          pricePaid: unitTotal,
          currency,
          stripePaymentIntentId: null,
          platformFeeCents: unitPlatformFee,
          totalPaidCents: unitTotal,
          purchaseId: payment.id,
          emissionIndex: i,
          ownerIdentityId: payment.customerIdentityId ?? order.buyerIdentityId ?? null,
          ownerUserId: null,
        },
      });

      await tx.entitlement.upsert({
        where: {
          purchaseId_saleLineId_lineItemIndex_ownerKey_type: {
            purchaseId: payment.id,
            saleLineId: line.id,
            lineItemIndex: i,
            ownerKey,
            type: EntitlementType.EVENT_TICKET,
          },
        },
        update: {
          status: EntitlementStatus.ACTIVE,
          ownerIdentityId: payment.customerIdentityId ?? order.buyerIdentityId ?? null,
          eventId: event.id,
          policyVersionApplied,
          snapshotTitle: event.title,
          snapshotCoverUrl: event.coverImageUrl,
          snapshotVenueName,
          snapshotStartAt: event.startsAt,
          snapshotTimezone: event.timezone,
          ticketId: ticket.id,
        },
        create: {
          purchaseId: payment.id,
          saleLineId: line.id,
          lineItemIndex: i,
          ownerKey,
          ownerUserId: null,
          ownerIdentityId: payment.customerIdentityId ?? order.buyerIdentityId ?? null,
          eventId: event.id,
          type: EntitlementType.EVENT_TICKET,
          status: EntitlementStatus.ACTIVE,
          policyVersionApplied,
          snapshotTitle: event.title,
          snapshotCoverUrl: event.coverImageUrl,
          snapshotVenueName,
          snapshotStartAt: event.startsAt,
          snapshotTimezone: event.timezone,
          ticketId: ticket.id,
        },
      });
    }
  }

  await ensurePurchaseSignal({ userId: buyerUserId, eventId: event.id, organizationId: event.organizationId }, tx);
}

async function issuePadelRegistrationEntitlements(
  payment: { id: string; sourceId: string; customerIdentityId: string | null; pricingSnapshotJson: any },
  tx: DbClient,
) {
  const registration = await tx.padelRegistration.findUnique({
    where: { id: payment.sourceId },
    select: {
      id: true,
      eventId: true,
      pairingId: true,
      buyerIdentityId: true,
      lines: {
        select: {
          id: true,
          qty: true,
          pairingSlotId: true,
        },
      },
    },
  });
  if (!registration) throw new Error("PADEL_REGISTRATION_NOT_FOUND");

  const eventId = parseIntId(registration.eventId);
  if (!eventId) throw new Error("EVENT_ID_INVALID");
  const event = await tx.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      coverImageUrl: true,
      startsAt: true,
      organizationId: true,
      timezone: true,
      addressRef: { select: { formattedAddress: true } },
    },
  });
  if (!event) throw new Error("EVENT_NOT_FOUND");

  const saleSummary = await tx.saleSummary.findFirst({
    where: { purchaseId: payment.id },
    select: { id: true },
  });
  if (!saleSummary) {
    throw new Error("SALE_SUMMARY_NOT_FOUND");
  }

  const saleLines = await tx.saleLine.findMany({
    where: { saleSummaryId: saleSummary.id, padelRegistrationLineId: { not: null } },
    select: {
      id: true,
      padelRegistrationLine: {
        select: {
          id: true,
          qty: true,
          pairingSlotId: true,
        },
      },
    },
  });
  if (!saleLines.length) {
    throw new Error("PADEL_REGISTRATION_LINES_EMPTY");
  }

  const pairing = registration.pairingId
    ? await tx.padelPairing.findUnique({
        where: { id: registration.pairingId },
        select: {
          id: true,
          slots: {
            select: {
              id: true,
              profileId: true,
              invitedUserId: true,
              invitedContact: true,
            },
          },
        },
      })
    : null;
  const slotMap = new Map((pairing?.slots ?? []).map((slot) => [slot.id, slot]));

  const policyVersionApplied = await requireLatestPolicyVersionForEvent(event.id, tx);
  const snapshotVenueName = formatEventLocationLabel({ addressRef: event.addressRef ?? null }, "Local a anunciar");
  const buyerIdentityId = payment.customerIdentityId ?? registration.buyerIdentityId ?? null;
  const buyerUserId = await resolveUserIdFromIdentity(buyerIdentityId, tx);

  const normalizeEmail = (value: string | null | undefined) => {
    const email = typeof value === "string" ? value.trim().toLowerCase() : "";
    return email && email.includes("@") ? email : null;
  };

  const buildPadelOwnerKey = (params: {
    ownerUserId?: string | null;
    ownerIdentityId?: string | null;
    email?: string | null;
  }) => {
    if (params.ownerUserId) return `user:${params.ownerUserId}`;
    if (params.ownerIdentityId) return `identity:${params.ownerIdentityId}`;
    if (params.email) return `email:${params.email}`;
    return "unknown";
  };

  for (const saleLine of saleLines) {
    const line = saleLine.padelRegistrationLine;
    if (!line) continue;
    const slot = line.pairingSlotId ? slotMap.get(line.pairingSlotId) : null;
    const entitlementOwnerUserId = slot?.profileId ?? slot?.invitedUserId ?? null;
    const entitlementEmail = normalizeEmail(slot?.invitedContact ?? null);
    const ownerKey = buildPadelOwnerKey({
      ownerUserId: entitlementOwnerUserId,
      ownerIdentityId: payment.customerIdentityId ?? registration.buyerIdentityId ?? null,
      email: entitlementEmail,
    });

    for (let i = 0; i < line.qty; i += 1) {
      await tx.entitlement.upsert({
        where: {
          purchaseId_saleLineId_lineItemIndex_ownerKey_type: {
            purchaseId: payment.id,
            saleLineId: saleLine.id,
            lineItemIndex: i,
            ownerKey,
            type: EntitlementType.PADEL_ENTRY,
          },
        },
        update: {
          status: EntitlementStatus.ACTIVE,
          ownerUserId: entitlementOwnerUserId ?? null,
          ownerIdentityId: payment.customerIdentityId ?? registration.buyerIdentityId ?? null,
          eventId: event.id,
          policyVersionApplied,
          snapshotTitle: event.title,
          snapshotCoverUrl: event.coverImageUrl,
          snapshotVenueName,
          snapshotStartAt: event.startsAt,
          snapshotTimezone: event.timezone,
        },
        create: {
          purchaseId: payment.id,
          saleLineId: saleLine.id,
          lineItemIndex: i,
          ownerKey,
          ownerUserId: entitlementOwnerUserId ?? null,
          ownerIdentityId: payment.customerIdentityId ?? registration.buyerIdentityId ?? null,
          eventId: event.id,
          type: EntitlementType.PADEL_ENTRY,
          status: EntitlementStatus.ACTIVE,
          policyVersionApplied,
          snapshotTitle: event.title,
          snapshotCoverUrl: event.coverImageUrl,
          snapshotVenueName,
          snapshotStartAt: event.startsAt,
          snapshotTimezone: event.timezone,
        },
      });
    }
  }

  await ensurePurchaseSignal({ userId: buyerUserId, eventId: event.id, organizationId: event.organizationId }, tx);
}

export async function fulfillPaymentIfSucceeded(
  input: FulfillPaymentInput,
): Promise<FulfillPaymentResult> {
  const payment = await prisma.payment.findUnique({
    where: { id: input.paymentId },
    select: {
      id: true,
      status: true,
      sourceType: true,
      sourceId: true,
      customerIdentityId: true,
      pricingSnapshotJson: true,
    },
  });
  if (!payment) throw new Error("PAYMENT_NOT_FOUND");
  if (payment.status !== PaymentStatus.SUCCEEDED) {
    return { status: "SKIPPED", paymentId: payment.id };
  }

  await prisma.$transaction(async (tx) => {
    if (payment.sourceType === SourceType.TICKET_ORDER) {
      await issueTicketOrderEntitlements(payment, tx);
      return;
    }
    if (payment.sourceType === SourceType.PADEL_REGISTRATION) {
      await issuePadelRegistrationEntitlements(payment, tx);
      return;
    }
    throw new Error("SOURCE_TYPE_NOT_SUPPORTED");
  });

  return { status: "FULFILLED", paymentId: payment.id };
}

export async function applyPaymentStatusToEntitlements(
  input: { paymentId: string; status: PaymentStatus; tx?: Prisma.TransactionClient },
): Promise<ApplyPaymentStatusResult> {
  const client = input.tx ?? prisma;
  const statusMap: Record<PaymentStatus, EntitlementStatus | null> = {
    CREATED: null,
    REQUIRES_ACTION: null,
    PROCESSING: null,
    SUCCEEDED: EntitlementStatus.ACTIVE,
    FAILED: null,
    CANCELLED: null,
    PARTIAL_REFUND: EntitlementStatus.REVOKED,
    REFUNDED: EntitlementStatus.REVOKED,
    DISPUTED: EntitlementStatus.SUSPENDED,
    CHARGEBACK_WON: EntitlementStatus.ACTIVE,
    CHARGEBACK_LOST: EntitlementStatus.REVOKED,
  };
  const ticketStatusMap: Record<PaymentStatus, TicketStatus | null> = {
    CREATED: null,
    REQUIRES_ACTION: null,
    PROCESSING: null,
    SUCCEEDED: null,
    FAILED: null,
    CANCELLED: null,
    PARTIAL_REFUND: null,
    REFUNDED: TicketStatus.REFUNDED,
    DISPUTED: TicketStatus.DISPUTED,
    CHARGEBACK_WON: TicketStatus.ACTIVE,
    CHARGEBACK_LOST: TicketStatus.CANCELLED,
  };

  const targetStatus = statusMap[input.status] ?? null;
  const targetTicketStatus = ticketStatusMap[input.status] ?? null;
  if (!targetStatus && !targetTicketStatus) {
    return { status: "NOOP", paymentId: input.paymentId };
  }

  const entitlementResult = targetStatus
    ? await client.entitlement.updateMany({
        where: { purchaseId: input.paymentId },
        data: { status: targetStatus },
      })
    : { count: 0 };

  if (targetTicketStatus) {
    await client.ticket.updateMany({
      where: { purchaseId: input.paymentId },
      data: { status: targetTicketStatus },
    });
  }

  return { status: entitlementResult.count ? "UPDATED" : "NOOP", paymentId: input.paymentId };
}
