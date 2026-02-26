import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { retrieveCharge } from "@/domain/finance/gateway/stripeGateway";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { confirmPendingBooking } from "@/lib/reservas/confirmBooking";
import { requestBookingRefundCase } from "@/lib/reservas/refundCase";
import { notifyOrganizationBookingChangeResponse } from "@/lib/reservas/bookingChangeNotifications";
import {
  BookingSplitShareAttemptFailureClass,
  BookingSplitShareAttemptStatus,
  CrmInteractionSource,
  CrmInteractionType,
  EntitlementStatus,
  EntitlementType,
  SourceType,
  type Prisma,
} from "@prisma/client";
import { ingestCrmInteraction } from "@/lib/crm/ingest";
import { logError, logInfo } from "@/lib/observability/logger";
import {
  BOOKING_CONFIRMATION_SNAPSHOT_VERSION,
  buildBookingConfirmationSnapshot,
  type BookingConfirmationPaymentMeta,
} from "@/lib/reservas/confirmationSnapshot";
import { emitSplitRuntimeAlert, settleBookingSplitRuntime } from "@/domain/bookings/splitGarantido";
import { normalizeEmail } from "@/lib/utils/email";
import { updateBooking } from "@/domain/bookings/commands";
import { ensureEmailIdentity, resolveIdentityForUser } from "@/lib/ownership/identity";
import { buildSubjectFingerprint } from "@/lib/holds/fingerprint";
import { isPlatformHoldContractEnabled } from "@/lib/holds/config";
import { releaseCheckoutHold, verifyCheckoutHoldOwnership } from "@/lib/holds/service";

function parseNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeOptionalUuid(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function emitSplitRuntimeMetric(metric: string, payload: Record<string, unknown>) {
  logInfo("split.runtime.metric", {
    metric,
    timestamp: new Date().toISOString(),
    ...payload,
  });
}

function parseId(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function extractPaymentMethodId(intent: Stripe.PaymentIntent) {
  if (!intent.payment_method) return null;
  if (typeof intent.payment_method === "string") return intent.payment_method;
  if (typeof intent.payment_method === "object" && typeof intent.payment_method.id === "string") {
    return intent.payment_method.id;
  }
  return null;
}

function extractCustomerId(intent: Stripe.PaymentIntent) {
  if (!intent.customer) return null;
  if (typeof intent.customer === "string") return intent.customer;
  if (typeof intent.customer === "object" && typeof intent.customer.id === "string") {
    return intent.customer.id;
  }
  return null;
}

const toInt = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
};

const extractPolicyIdFromSnapshot = (snapshot: unknown) => {
  if (!snapshot || typeof snapshot !== "object") return null;
  const policyId = toInt((snapshot as any)?.policySnapshot?.policyId);
  return policyId && policyId > 0 ? policyId : null;
};

const extractSnapshotCreatedAt = (snapshot: unknown, fallback: Date) => {
  if (!snapshot || typeof snapshot !== "object") return fallback;
  const raw = (snapshot as any)?.createdAt;
  if (typeof raw !== "string") return fallback;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

const DEFAULT_TIMEZONE = "Europe/Lisbon";

function buildOwnerKey(params: { ownerIdentityId?: string | null }) {
  if (!params.ownerIdentityId) {
    throw new Error("OWNER_IDENTITY_REQUIRED");
  }
  return `identity:${params.ownerIdentityId}`;
}

async function requestOrganizationBookingRefundCase(params: {
  bookingId: number;
  paymentIntentId: string;
  amountCents?: number | null;
  reasonCode: string;
  idempotencyKey?: string | null;
  auditFlow: string;
}) {
  return requestBookingRefundCase({
    bookingId: params.bookingId,
    paymentIntentId: params.paymentIntentId,
    reason: "ORG_CANCEL",
    amountCents: params.amountCents ?? null,
    reasonCode: params.reasonCode,
    idempotencyKey: params.idempotencyKey ?? null,
    auditPayload: {
      route: "operations/fulfillServiceBooking",
      flow: params.auditFlow,
      canonicalRefundCase: true,
    },
  });
}

async function resolveStripeFee(intent: Stripe.PaymentIntent) {
  let stripeFeeCents: number | null = null;
  let stripeChargeId: string | null = null;

  try {
    if (intent.latest_charge) {
      const chargeId =
        typeof intent.latest_charge === "string"
          ? intent.latest_charge
          : intent.latest_charge?.id;
      if (chargeId) {
        const charge = await retrieveCharge(chargeId, {
          expand: ["balance_transaction"],
        });
        stripeChargeId = charge.id ?? null;
        const balanceTx = charge.balance_transaction as Stripe.BalanceTransaction | null;
        if (balanceTx?.fee != null) stripeFeeCents = balanceTx.fee;
      }
    }
  } catch (err) {
    logError("fulfill_service_booking.balance_transaction_failed", err, { paymentIntentId: intent.id });
  }

  return { stripeFeeCents, stripeChargeId };
}

async function fulfillSplitParticipantIntent(intent: Stripe.PaymentIntent): Promise<boolean> {
  const meta = intent.metadata ?? {};
  const splitParticipantId = parseId(meta.bookingSplitParticipantId);
  if (!splitParticipantId) return false;

  const bookingId = parseId(meta.bookingId);
  const splitId = parseId(meta.bookingSplitId);
  const splitShareAttemptId = parseId(meta.bookingSplitShareAttemptId);
  const splitShareAttemptNo = parseId(meta.bookingSplitShareAttemptNo);
  const organizationId = parseId(meta.organizationId);
  const userId = typeof meta.userId === "string" ? meta.userId : null;
  const platformFeeCents = parseNumber(meta.platformFeeCents) ?? 0;
  const offsessionPaymentMethodId = extractPaymentMethodId(intent);
  const offsessionCustomerId = extractCustomerId(intent);

  const amountCents = intent.amount_received ?? intent.amount ?? 0;
  const { stripeFeeCents, stripeChargeId } = await resolveStripeFee(intent);
  const lateRefundPlan = await prisma.$transaction(async (tx) => {
    let localLateRefundPlan:
      | {
          splitId: number;
          bookingId: number;
          participantId: number;
          paymentIntentId: string;
          amountCents: number;
          organizationId: number;
        }
      | null = null;

    const participant = await tx.bookingSplitParticipant.findUnique({
      where: { id: splitParticipantId },
      include: {
        split: {
          include: {
            settlementSnapshot: { select: { id: true } },
            booking: {
                select: {
                  id: true,
                  status: true,
                  organizationId: true,
                  userId: true,
                  guestEmail: true,
                  serviceId: true,
                  startsAt: true,
                  snapshotTimezone: true,
                addressRef: { select: { formattedAddress: true } },
                service: {
                  select: {
                    title: true,
                    coverImageUrl: true,
                    addressRef: { select: { formattedAddress: true } },
                  },
                },
              },
            },
            organization: {
              select: {
                orgType: true,
                stripeAccountId: true,
              },
            },
          },
        },
      },
    });

    if (!participant || !participant.split || !participant.split.booking) {
      throw new Error("BOOKING_SPLIT_PARTICIPANT_NOT_FOUND");
    }
    if (splitId && participant.splitId !== splitId) {
      throw new Error("BOOKING_SPLIT_MISMATCH");
    }
    if (bookingId && participant.split.booking.id !== bookingId) {
      throw new Error("BOOKING_SPLIT_BOOKING_MISMATCH");
    }

    if (participant.split.captureBeforeAt && participant.split.captureBeforeAt.getTime() < Date.now()) {
      emitSplitRuntimeAlert("capture_attempt_after_captureBefore", {
        splitId: participant.splitId,
        bookingId: participant.split.booking.id,
        organizationId: participant.split.organizationId,
        paymentIntentId: intent.id,
        captureBeforeAt: participant.split.captureBeforeAt.toISOString(),
        captureBeforeSource: participant.split.captureBeforeSource,
      });
    }

    const splitCollectableStatus = ["OPEN", "SETTLING", "CHARGE_FAILED"].includes(participant.split.status);
    const splitClosedForCollection =
      !splitCollectableStatus ||
      participant.split.railState === "DEBT" ||
      Boolean(participant.split.settledAt) ||
      Boolean(participant.split.settlementSnapshot);
    const shareAttemptData = {
      status: BookingSplitShareAttemptStatus.SUCCEEDED,
      failureClass: null as BookingSplitShareAttemptFailureClass | null,
      paymentIntentId: intent.id,
    };
    if (splitShareAttemptId) {
      await tx.bookingSplitShareAttempt.updateMany({
        where: { id: splitShareAttemptId, participantId: participant.id },
        data: shareAttemptData,
      });
    } else if (splitShareAttemptNo) {
      await tx.bookingSplitShareAttempt.upsert({
        where: {
          participantId_attemptNo: {
            participantId: participant.id,
            attemptNo: splitShareAttemptNo,
          },
        },
        update: shareAttemptData,
        create: {
          participantId: participant.id,
          attemptNo: splitShareAttemptNo,
          status: BookingSplitShareAttemptStatus.SUCCEEDED,
          paymentIntentId: intent.id,
        },
      });
    } else if (participant.activeShareAttemptId) {
      await tx.bookingSplitShareAttempt.update({
        where: { id: participant.activeShareAttemptId },
        data: shareAttemptData,
      });
    }

    if (splitClosedForCollection) {
      await tx.bookingSplitParticipant.update({
        where: { id: participant.id },
        data: {
          paymentIntentId: intent.id,
          offsessionPaymentMethodId: offsessionPaymentMethodId ?? undefined,
          offsessionCustomerId: offsessionCustomerId ?? undefined,
          activeShareAttemptId: null,
        },
      });
    } else if (participant.status !== "PAID") {
      await tx.bookingSplitParticipant.update({
        where: { id: participant.id },
        data: {
          status: "PAID",
          paidAt: new Date(),
          paymentIntentId: intent.id,
          offsessionPaymentMethodId: offsessionPaymentMethodId ?? undefined,
          offsessionCustomerId: offsessionCustomerId ?? undefined,
          shareCents: amountCents,
          platformFeeCents,
          activeShareAttemptId: null,
        },
      });
    } else if (offsessionPaymentMethodId || offsessionCustomerId) {
      await tx.bookingSplitParticipant.update({
        where: { id: participant.id },
        data: {
          offsessionPaymentMethodId: offsessionPaymentMethodId ?? undefined,
          offsessionCustomerId: offsessionCustomerId ?? undefined,
          activeShareAttemptId: null,
        },
      });
    }

    if (splitClosedForCollection) {
      localLateRefundPlan = {
        splitId: participant.splitId,
        bookingId: participant.split.booking.id,
        participantId: participant.id,
        paymentIntentId: intent.id,
        amountCents,
        organizationId: participant.split.organizationId,
      };
      return localLateRefundPlan;
    }

    const remaining = await tx.bookingSplitParticipant.count({
      where: { splitId: participant.splitId, status: { not: "PAID" } },
    });
    if (remaining > 0) return localLateRefundPlan;

    const settlement = await settleBookingSplitRuntime({
      tx,
      splitId: participant.splitId,
      now: new Date(),
      correlationId: intent.id,
      allowBeforeDeadline: true,
    });
    if (settlement.state !== "SETTLED") return localLateRefundPlan;

    const booking = participant.split.booking;
    if (!booking || booking.status === "CONFIRMED") return localLateRefundPlan;
    if (["CANCELLED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG", "COMPLETED", "NO_SHOW", "DISPUTED"].includes(booking.status)) {
      return localLateRefundPlan;
    }

    const result = await confirmPendingBooking({
      tx,
      bookingId: booking.id,
      now: new Date(),
      ignoreExpiry: true,
      paymentMeta: null,
    });
    if (!result.ok) {
      throw new Error(result.code);
    }

    await ensureConfirmationSnapshot({
      tx,
      bookingId: booking.id,
      now: new Date(),
      policyIdHint: parseId(meta.policyId),
      paymentMeta: null,
    });

    const purchaseIdResolved = await resolveBookingPurchaseId({
      tx,
      intent,
      bookingId: booking.id,
    });
    await upsertBookingEntitlement({
      tx,
      booking,
      purchaseId: purchaseIdResolved,
      ownerUserId: normalizeOptionalUuid(booking.userId),
      guestEmail: booking.guestEmail ?? null,
    });

    await recordOrganizationAudit(tx, {
      organizationId: organizationId ?? booking.organizationId,
      actorUserId: normalizeOptionalUuid(userId) ?? normalizeOptionalUuid(booking.userId),
      action: "BOOKING_CREATED",
      metadata: {
        bookingId: booking.id,
        serviceId: booking.serviceId ?? null,
        policyId: parseId(meta.policyId) ?? null,
      },
    });

    return localLateRefundPlan;
  });

  if (lateRefundPlan) {
    try {
      await requestOrganizationBookingRefundCase({
        bookingId: lateRefundPlan.bookingId,
        paymentIntentId: lateRefundPlan.paymentIntentId,
        reasonCode: "LATE_SPLIT_PAYMENT_AFTER_SETTLE",
        amountCents: lateRefundPlan.amountCents,
        idempotencyKey: `refund_case:BOOKING_SPLIT_LATE:${lateRefundPlan.participantId}:${lateRefundPlan.paymentIntentId}`,
        auditFlow: "late_split_refund",
      });
      emitSplitRuntimeMetric("split_late_refund_count", {
        result: "success",
        splitId: lateRefundPlan.splitId,
        bookingId: lateRefundPlan.bookingId,
        organizationId: lateRefundPlan.organizationId,
        paymentIntentId: lateRefundPlan.paymentIntentId,
        correlationId: lateRefundPlan.paymentIntentId,
      });
    } catch (err) {
      emitSplitRuntimeMetric("split_late_refund_count", {
        result: "failed",
        splitId: lateRefundPlan.splitId,
        bookingId: lateRefundPlan.bookingId,
        organizationId: lateRefundPlan.organizationId,
        paymentIntentId: lateRefundPlan.paymentIntentId,
        correlationId: lateRefundPlan.paymentIntentId,
      });
      emitSplitRuntimeAlert("late_refund_failed", {
        bookingId: lateRefundPlan.bookingId,
        participantId: lateRefundPlan.participantId,
        organizationId: lateRefundPlan.organizationId,
        paymentIntentId: lateRefundPlan.paymentIntentId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  return true;
}

async function fulfillBookingChangeIntent(intent: Stripe.PaymentIntent): Promise<boolean> {
  const meta = intent.metadata ?? {};
  const scenario = typeof meta.paymentScenario === "string" ? meta.paymentScenario.toUpperCase() : "";
  const requestId = parseId(meta.bookingChangeRequestId);
  const bookingIdFromMeta = parseId(meta.bookingId);
  if (scenario !== "BOOKING_CHANGE" && !requestId) return false;

  const amountCents = intent.amount_received ?? intent.amount ?? 0;
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const request = await tx.bookingChangeRequest.findFirst({
      where: requestId
        ? { id: requestId }
        : bookingIdFromMeta
          ? { bookingId: bookingIdFromMeta, status: "PENDING" }
          : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        booking: {
          select: {
            id: true,
            organizationId: true,
            userId: true,
            guestEmail: true,
            status: true,
            startsAt: true,
            price: true,
            currency: true,
            professionalId: true,
            resourceId: true,
            courtId: true,
            confirmationSnapshot: true,
            confirmationSnapshotVersion: true,
            confirmationSnapshotCreatedAt: true,
            policyRef: { select: { policyId: true } },
            bookingPackage: {
              select: {
                packageId: true,
                label: true,
                durationMinutes: true,
                priceCents: true,
              },
            },
            addons: {
              select: {
                addonId: true,
                label: true,
                deltaMinutes: true,
                deltaPriceCents: true,
                quantity: true,
                sortOrder: true,
              },
            },
            service: {
              select: {
                id: true,
                policyId: true,
                unitPriceCents: true,
                currency: true,
                organization: {
                  select: {
                    feeMode: true,
                    platformFeeBps: true,
                    platformFeeFixedCents: true,
                    orgType: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!request || !request.booking) {
      return {
        status: "NOT_FOUND" as const,
        bookingId: bookingIdFromMeta ?? null,
        organizationId: null,
      };
    }

    const booking = request.booking;
    if (bookingIdFromMeta && booking.id !== bookingIdFromMeta) {
      return {
        status: "MISMATCH" as const,
        bookingId: booking.id,
        organizationId: booking.organizationId,
      };
    }

    if (request.status === "ACCEPTED") {
      return { status: "ALREADY" as const, bookingId: booking.id, organizationId: booking.organizationId };
    }

    if (request.status !== "PENDING") {
      return { status: "INACTIVE" as const, bookingId: booking.id, organizationId: booking.organizationId };
    }

    if (request.expiresAt.getTime() <= now.getTime()) {
      await tx.bookingChangeRequest.update({
        where: { id: request.id },
        data: {
          status: "EXPIRED",
          respondedAt: now,
          respondedByUserId:
            normalizeOptionalUuid(request.respondedByUserId) ?? normalizeOptionalUuid(booking.userId),
        },
      });
      return { status: "EXPIRED" as const, bookingId: booking.id, organizationId: booking.organizationId };
    }

    if (booking.status !== "CONFIRMED") {
      await tx.bookingChangeRequest.update({
        where: { id: request.id },
        data: {
          status: "CANCELLED",
          respondedAt: now,
          respondedByUserId:
            normalizeOptionalUuid(request.respondedByUserId) ?? normalizeOptionalUuid(booking.userId),
        },
      });
      return { status: "BOOKING_CLOSED" as const, bookingId: booking.id, organizationId: booking.organizationId };
    }

    const newPriceCents = Math.max(0, Math.round((booking.price ?? 0) + request.priceDeltaCents));
    const actorUserId =
      normalizeOptionalUuid(request.respondedByUserId) ?? normalizeOptionalUuid(booking.userId);
    const { booking: updated } = (await updateBooking({
      tx,
      bookingId: booking.id,
      organizationId: booking.organizationId,
      actorUserId,
      data: {
        startsAt: request.proposedStartsAt,
        price: newPriceCents,
        courtId: request.proposedCourtId ?? booking.courtId,
        professionalId: request.proposedProfessionalId ?? booking.professionalId,
        resourceId: request.proposedResourceId ?? booking.resourceId,
      },
      select: {
        id: true,
        organizationId: true,
        price: true,
        currency: true,
        startsAt: true,
        durationMinutes: true,
        serviceId: true,
        userId: true,
        professionalId: true,
        resourceId: true,
        courtId: true,
        confirmationSnapshot: true,
        confirmationSnapshotVersion: true,
        confirmationSnapshotCreatedAt: true,
        policyRef: { select: { policyId: true } },
        bookingPackage: {
          select: { packageId: true, label: true, durationMinutes: true, priceCents: true },
        },
        addons: {
          select: {
            addonId: true,
            label: true,
            deltaMinutes: true,
            deltaPriceCents: true,
            quantity: true,
            sortOrder: true,
          },
        },
        service: {
          select: {
            id: true,
            policyId: true,
            unitPriceCents: true,
            currency: true,
            organization: {
              select: {
                feeMode: true,
                platformFeeBps: true,
                platformFeeFixedCents: true,
                orgType: true,
              },
            },
          },
        },
      },
    })) as { booking: any; outboxEventId: string };

    if (request.priceDeltaCents !== 0 || !updated.confirmationSnapshot) {
      const snapshotResult = await buildBookingConfirmationSnapshot({
        tx,
        booking: updated as any,
        now,
        policyIdHint: updated.policyRef?.policyId ?? null,
        paymentMeta: null,
      });
      if (snapshotResult.ok) {
        const snapshotVersion =
          updated.confirmationSnapshotVersion ??
          Math.max(BOOKING_CONFIRMATION_SNAPSHOT_VERSION, snapshotResult.snapshot.version);
        const snapshotCreatedAt = snapshotResult.snapshot.createdAt
          ? new Date(snapshotResult.snapshot.createdAt)
          : now;
        await tx.booking.update({
          where: { id: updated.id },
          data: {
            confirmationSnapshot: snapshotResult.snapshot,
            confirmationSnapshotVersion: snapshotVersion,
            confirmationSnapshotCreatedAt: snapshotCreatedAt,
          },
        });
      }
    }

    await tx.bookingChangeRequest.update({
      where: { id: request.id },
      data: {
        status: "ACCEPTED",
        respondedAt: request.respondedAt ?? now,
        respondedByUserId: request.respondedByUserId ?? actorUserId,
      },
    });

    await recordOrganizationAudit(tx, {
      organizationId: booking.organizationId,
      actorUserId,
      action: "BOOKING_RESCHEDULE_ACCEPTED",
      metadata: {
        bookingId: booking.id,
        requestId: request.id,
        proposedStartsAt: request.proposedStartsAt.toISOString(),
        priceDeltaCents: request.priceDeltaCents,
      },
    });

    return {
      status: "APPLIED" as const,
      bookingId: booking.id,
      organizationId: booking.organizationId,
      requestId: request.id,
      proposedStartsAt: request.proposedStartsAt,
      priceDeltaCents: request.priceDeltaCents,
      actorUserId,
    };
  });

  if (!result) return true;
  if (result.status === "APPLIED") {
    if (result.organizationId && result.bookingId && result.requestId && result.proposedStartsAt) {
      await notifyOrganizationBookingChangeResponse({
        organizationId: result.organizationId,
        bookingId: result.bookingId,
        requestId: result.requestId,
        status: "ACCEPTED",
        proposedStartsAt: result.proposedStartsAt,
        priceDeltaCents: result.priceDeltaCents ?? 0,
        actorUserId: result.actorUserId ?? null,
      });
    }
    return true;
  }
  if (result.status === "ALREADY") return true;

  if (result.bookingId && intent.id) {
    try {
      await requestOrganizationBookingRefundCase({
        bookingId: result.bookingId,
        paymentIntentId: intent.id,
        reasonCode: `BOOKING_CHANGE_${result.status}`,
        amountCents: amountCents > 0 ? amountCents : undefined,
        idempotencyKey: `refund_case:BOOKING_CHANGE:${result.bookingId}:${intent.id}:${result.status}`,
        auditFlow: "booking_change_fallback",
      });
    } catch (err) {
      logError("fulfill_booking_change.refund_failed", err, { bookingId: result.bookingId, paymentIntentId: intent.id });
    }
  }

  return true;
}

async function resolveBookingPurchaseId(params: {
  tx: Prisma.TransactionClient;
  intent: Stripe.PaymentIntent;
  bookingId: number;
}) {
  const { tx, intent, bookingId } = params;
  const metaPurchaseId =
    typeof intent.metadata?.purchaseId === "string" ? intent.metadata.purchaseId.trim() : "";
  if (metaPurchaseId) return metaPurchaseId;

  const eventRow = await tx.paymentEvent.findFirst({
    where: { stripePaymentIntentId: intent.id },
    select: { purchaseId: true },
  });
  if (eventRow?.purchaseId) return eventRow.purchaseId;

  const payment = await tx.payment.findFirst({
    where: { sourceType: SourceType.BOOKING, sourceId: String(bookingId) },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (payment?.id) return payment.id;

  return `booking_${bookingId}_v1`;
}

async function upsertBookingEntitlement(params: {
  tx: Prisma.TransactionClient;
  booking: {
    id: number;
    startsAt: Date;
    snapshotTimezone?: string | null;
    addressRef?: { formattedAddress?: string | null } | null;
    service?: { title: string; coverImageUrl: string | null; addressRef?: { formattedAddress?: string | null } | null } | null;
  };
  purchaseId: string;
  ownerUserId?: string | null;
  ownerIdentityId?: string | null;
  guestEmail?: string | null;
}) {
  const { tx, booking, purchaseId, ownerUserId = null, ownerIdentityId = null, guestEmail = null } = params;
  if (!ownerUserId && !ownerIdentityId && !guestEmail) return;
  let resolvedIdentityId = ownerIdentityId;
  if (!resolvedIdentityId && ownerUserId) {
    const identity = await resolveIdentityForUser({ userId: ownerUserId, email: guestEmail, tx });
    resolvedIdentityId = identity.id;
  } else if (!resolvedIdentityId && guestEmail) {
    const identity = await ensureEmailIdentity({ email: guestEmail, tx });
    resolvedIdentityId = identity.id;
  }
  if (!resolvedIdentityId) {
    throw new Error("OWNER_IDENTITY_REQUIRED");
  }
  const entitlementOwnerUserId = resolvedIdentityId ? null : ownerUserId;
  const ownerKey = buildOwnerKey({ ownerIdentityId: resolvedIdentityId });
  const snapshotTitle = booking.service?.title ?? `Reserva ${booking.id}`;
  const snapshotCoverUrl = booking.service?.coverImageUrl ?? null;
  const snapshotVenueName =
    booking.addressRef?.formattedAddress ?? booking.service?.addressRef?.formattedAddress ?? null;
  const snapshotTimezone = booking.snapshotTimezone ?? DEFAULT_TIMEZONE;

  await tx.entitlement.upsert({
    where: {
      bookingId_lineItemIndex_ownerKey_type: {
        bookingId: booking.id,
        lineItemIndex: 0,
        ownerKey,
        type: EntitlementType.SERVICE_BOOKING,
      },
    },
    update: {
      status: EntitlementStatus.ACTIVE,
      ownerUserId: entitlementOwnerUserId,
      ownerIdentityId: resolvedIdentityId,
      purchaseId,
      snapshotTitle,
      snapshotCoverUrl,
      snapshotVenueName,
      snapshotStartAt: booking.startsAt,
      snapshotTimezone,
      policyVersionApplied: null,
    },
    create: {
      type: EntitlementType.SERVICE_BOOKING,
      status: EntitlementStatus.ACTIVE,
      ownerUserId: entitlementOwnerUserId,
      ownerIdentityId: resolvedIdentityId,
      ownerKey,
      purchaseId,
      bookingId: booking.id,
      lineItemIndex: 0,
      snapshotTitle,
      snapshotCoverUrl,
      snapshotVenueName,
      snapshotStartAt: booking.startsAt,
      snapshotTimezone,
      policyVersionApplied: null,
    },
  });
}

async function ensureConfirmationSnapshot(params: {
  tx: Prisma.TransactionClient;
  bookingId: number;
  now: Date;
  policyIdHint?: number | null;
  paymentMeta?: BookingConfirmationPaymentMeta | null;
}) {
  const { tx, bookingId, now, policyIdHint = null, paymentMeta = null } = params;
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      organizationId: true,
      price: true,
      currency: true,
      confirmationSnapshot: true,
      confirmationSnapshotVersion: true,
      confirmationSnapshotCreatedAt: true,
      addons: {
        select: {
          addonId: true,
          label: true,
          deltaMinutes: true,
          deltaPriceCents: true,
          quantity: true,
          sortOrder: true,
        },
      },
      bookingPackage: {
        select: {
          packageId: true,
          label: true,
          durationMinutes: true,
          priceCents: true,
        },
      },
      policyRef: { select: { id: true, policyId: true } },
      service: {
        select: {
          policyId: true,
          unitPriceCents: true,
          currency: true,
          organization: {
            select: {
              feeMode: true,
              platformFeeBps: true,
              platformFeeFixedCents: true,
              orgType: true,
            },
          },
        },
      },
    },
  });

  if (!booking || !booking.service) {
    throw new Error("PRICING_SNAPSHOT_MISSING");
  }

  let snapshot = booking.confirmationSnapshot ?? null;
  let resolvedPolicyId = extractPolicyIdFromSnapshot(snapshot) ?? booking.policyRef?.policyId ?? null;

  if (!snapshot) {
    const result = await buildBookingConfirmationSnapshot({
      tx,
      booking,
      now,
      policyIdHint,
      paymentMeta,
    });
    if (!result.ok) {
      throw new Error(result.code);
    }
    snapshot = result.snapshot;
    resolvedPolicyId = result.policyId;
  }

  if (!resolvedPolicyId) {
    throw new Error("POLICY_SNAPSHOT_MISSING");
  }

  const snapshotVersion =
    booking.confirmationSnapshotVersion ??
    toInt((snapshot as any)?.version) ??
    BOOKING_CONFIRMATION_SNAPSHOT_VERSION;
  const snapshotCreatedAt =
    booking.confirmationSnapshotCreatedAt ?? extractSnapshotCreatedAt(snapshot, now);
  const needsUpdate =
    !booking.confirmationSnapshot ||
    !booking.confirmationSnapshotVersion ||
    !booking.confirmationSnapshotCreatedAt;

  if (needsUpdate) {
    await tx.booking.update({
      where: { id: booking.id },
      data: {
        confirmationSnapshot: snapshot,
        confirmationSnapshotVersion: snapshotVersion,
        confirmationSnapshotCreatedAt: snapshotCreatedAt,
      },
    });
  }

  if (!booking.policyRef) {
    await tx.bookingPolicyRef.upsert({
      where: { bookingId: booking.id },
      update: {},
      create: { bookingId: booking.id, policyId: resolvedPolicyId },
    });
  }

  return { policyId: resolvedPolicyId };
}

export async function fulfillServiceBookingIntent(
  intent: Stripe.PaymentIntent,
): Promise<boolean> {
  const meta = intent.metadata ?? {};
  const handledSplit = await fulfillSplitParticipantIntent(intent);
  if (handledSplit) return true;
  const handledChange = await fulfillBookingChangeIntent(intent);
  if (handledChange) return true;
  const isServiceBooking =
    meta.serviceBooking === "1" ||
    meta.serviceBooking === "true" ||
    Boolean(meta.bookingId);
  if (!isServiceBooking) return false;

  const bookingId = parseId(meta.bookingId);
  const organizationId = parseId(meta.organizationId);
  const policyId = parseId(meta.policyId);
  const userId = typeof meta.userId === "string" ? meta.userId : null;
  const platformFeeCents = parseNumber(meta.platformFeeCents) ?? 0;
  const paymentMeta: BookingConfirmationPaymentMeta = {
    grossAmountCents: meta.grossAmountCents ?? null,
    cardPlatformFeeCents: meta.cardPlatformFeeCents ?? null,
  };
  const holdId = typeof meta.holdId === "string" ? meta.holdId.trim() : "";
  const holdClientSessionId =
    typeof meta.clientSessionId === "string" ? meta.clientSessionId.trim() : "";
  const holdSubjectFingerprintMeta =
    typeof meta.subjectFingerprint === "string"
      ? meta.subjectFingerprint.trim().toLowerCase()
      : "";
  const holdContractEnabled = isPlatformHoldContractEnabled();
  let holdSubjectFingerprintResolved: string | null = null;
  let holdOrgIdResolved: number | null = null;

  const paymentIntentId = intent.id;
  let stripeFeeCents: number | null = null;
  let stripeChargeId: string | null = null;
  try {
    if (intent.latest_charge) {
      const chargeId =
        typeof intent.latest_charge === "string"
          ? intent.latest_charge
          : intent.latest_charge?.id;
      if (chargeId) {
        const charge = await retrieveCharge(chargeId, {
          expand: ["balance_transaction"],
        });
        stripeChargeId = charge.id ?? null;
        const balanceTx = charge.balance_transaction as Stripe.BalanceTransaction | null;
        if (balanceTx?.fee != null) stripeFeeCents = balanceTx.fee;
      }
    }
  } catch (err) {
    logError("fulfill_service_booking.balance_transaction_failed", err, { paymentIntentId });
  }

  const amountCents = intent.amount_received ?? intent.amount ?? 0;

  let crmPayload:
    | {
        organizationId: number;
        userId?: string | null;
        bookingId: number;
        amountCents: number;
        currency: string;
        serviceId?: number | null;
        guestEmail?: string | null;
      }
    | null = null;

  try {
    const txnResult = await prisma.$transaction(async (tx) => {
      const now = new Date();
      let crmPayload:
        | {
            organizationId: number;
            userId?: string | null;
            bookingId: number;
            amountCents: number;
            currency: string;
            serviceId?: number | null;
            guestEmail?: string | null;
          }
        | null = null;
      if (bookingId) {
        const bookingForHold = await tx.booking.findUnique({
          where: { id: bookingId },
          select: {
            id: true,
            organizationId: true,
            serviceId: true,
            startsAt: true,
            durationMinutes: true,
            resourceId: true,
            professionalId: true,
          },
        });
        if (!bookingForHold) {
          throw new Error("SERVICE_BOOKING_NOT_FOUND");
        }
        if (holdContractEnabled) {
          holdOrgIdResolved = bookingForHold.organizationId;
          if (!holdId || !holdClientSessionId || !holdSubjectFingerprintMeta) {
            throw new Error("SLOT_TAKEN");
          }
          const expectedSubjectFingerprint = buildSubjectFingerprint({
            orgId: bookingForHold.organizationId,
            subjectType: "SERVICE",
            serviceOrEventId: bookingForHold.serviceId,
            startAtISO: bookingForHold.startsAt.toISOString(),
            durationMinutes: bookingForHold.durationMinutes,
            resourceIds: bookingForHold.resourceId ? [bookingForHold.resourceId] : [],
            professionalId: bookingForHold.professionalId ?? null,
          });
          holdSubjectFingerprintResolved = expectedSubjectFingerprint;
          if (expectedSubjectFingerprint !== holdSubjectFingerprintMeta) {
            throw new Error("SLOT_TAKEN");
          }
          const holdValidation = await verifyCheckoutHoldOwnership({
            holdId,
            orgId: bookingForHold.organizationId,
            subjectType: "SERVICE",
            subjectFingerprint: expectedSubjectFingerprint,
            clientSessionId: holdClientSessionId,
          });
          if (!holdValidation.ok) {
            throw new Error("SLOT_TAKEN");
          }
        }

        const result = await confirmPendingBooking({
          tx,
          bookingId,
          now,
          ignoreExpiry: true,
          paymentMeta,
          holdId: holdId || null,
        });

        if (!result.ok) {
          if (
            [
              "SLOT_TAKEN",
              "INVALID_START_GRID",
              "INVALID_DURATION_POLICY",
              "POLICY_SNAPSHOT_MISSING",
              "PRICING_SNAPSHOT_MISSING",
            ].includes(result.code)
          ) {
            await tx.booking.update({
              where: { id: bookingId },
              data: { status: "CANCELLED_BY_CLIENT" },
            });
          }
          throw new Error(result.code);
        }

        const booking = await tx.booking.findUnique({
          where: { id: bookingId },
          select: {
            id: true,
            serviceId: true,
            organizationId: true,
            userId: true,
            guestEmail: true,
            paymentIntentId: true,
            startsAt: true,
            snapshotTimezone: true,
            addressRef: { select: { formattedAddress: true } },
            service: {
              select: {
                title: true,
                coverImageUrl: true,
                addressRef: { select: { formattedAddress: true } },
              },
            },
          },
        });

        if (!booking) {
          throw new Error("SERVICE_BOOKING_NOT_FOUND");
        }

        if (!booking.paymentIntentId) {
          await tx.booking.update({
            where: { id: booking.id },
            data: { paymentIntentId: intent.id },
          });
        }

        await ensureConfirmationSnapshot({
          tx,
          bookingId: booking.id,
          now,
          policyIdHint: policyId,
          paymentMeta,
        });

        const purchaseIdResolved = await resolveBookingPurchaseId({
          tx,
          intent,
          bookingId: booking.id,
        });
        await upsertBookingEntitlement({
          tx,
          booking,
          purchaseId: purchaseIdResolved,
          ownerUserId: normalizeOptionalUuid(userId) ?? normalizeOptionalUuid(booking.userId),
          guestEmail: booking.guestEmail ?? null,
        });

        await recordOrganizationAudit(tx, {
          organizationId: organizationId ?? booking.organizationId,
          actorUserId: normalizeOptionalUuid(userId) ?? normalizeOptionalUuid(booking.userId),
          action: "BOOKING_CREATED",
          metadata: {
            bookingId: booking.id,
            serviceId: booking.serviceId,
            policyId: policyId ?? null,
          },
        });

        const resolvedUserId =
          normalizeOptionalUuid(userId) ?? normalizeOptionalUuid(booking.userId);
        crmPayload = {
          organizationId: booking.organizationId,
          userId: resolvedUserId ?? undefined,
          bookingId: booking.id,
          amountCents,
          currency: (intent.currency ?? "eur").toUpperCase(),
          serviceId: booking.serviceId ?? null,
          guestEmail: booking.guestEmail ?? null,
        };
        return { crmPayload };
      }
      throw new Error("SERVICE_BOOKING_LEGACY_AVAILABILITY_REMOVED");
    });
    crmPayload = txnResult?.crmPayload ?? null;
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNKNOWN";
    if (
      bookingId &&
      [
        "SLOT_TAKEN",
        "INVALID_CAPACITY",
        "INVALID_START_GRID",
        "INVALID_DURATION_POLICY",
        "SERVICE_INACTIVE",
        "POLICY_SNAPSHOT_MISSING",
        "PRICING_SNAPSHOT_MISSING",
      ].includes(code)
    ) {
      if (intent.id) {
        await requestOrganizationBookingRefundCase({
          bookingId,
          paymentIntentId: intent.id,
          reasonCode: `CONFIRM_${code}`,
          idempotencyKey: `refund_case:BOOKING_CONFIRM:${bookingId}:${intent.id}:${code}`,
          auditFlow: "confirm_failure_fallback",
        });
      }
      return true;
    }
    throw err;
  }

  if (
    holdContractEnabled &&
    holdOrgIdResolved &&
    holdId &&
    holdClientSessionId &&
    holdSubjectFingerprintResolved
  ) {
    const released = await releaseCheckoutHold({
      holdId,
      orgId: holdOrgIdResolved,
      subjectType: "SERVICE",
      subjectFingerprint: holdSubjectFingerprintResolved,
      clientSessionId: holdClientSessionId,
      consumed: true,
    });
    if (!released.ok) {
      logError("fulfill_service_booking.hold_release_failed", new Error(released.code), {
        bookingId,
        paymentIntentId,
        holdId,
      });
    }
  }

  if (crmPayload) {
    try {
      await ingestCrmInteraction({
        organizationId: crmPayload.organizationId,
        userId: crmPayload.userId ?? undefined,
        type: CrmInteractionType.BOOKING_CONFIRMED,
        sourceType: CrmInteractionSource.BOOKING,
        sourceId: String(crmPayload.bookingId),
        occurredAt: new Date(),
        amountCents: crmPayload.amountCents,
        currency: crmPayload.currency,
        contactEmail: crmPayload.guestEmail ?? undefined,
        metadata: {
          bookingId: crmPayload.bookingId,
          serviceId: crmPayload.serviceId ?? null,
        },
      });
    } catch (err) {
      logError("fulfill_service_booking.crm_interaction_failed", err, { bookingId: crmPayload.bookingId });
    }
  }

  return true;
}
