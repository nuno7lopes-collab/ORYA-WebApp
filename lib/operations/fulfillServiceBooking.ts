import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { retrieveCharge } from "@/domain/finance/gateway/stripeGateway";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { confirmPendingBooking } from "@/lib/reservas/confirmBooking";
import { refundBookingPayment } from "@/lib/reservas/bookingRefund";
import { notifyOrganizationBookingChangeResponse } from "@/lib/reservas/bookingChangeNotifications";
import { CrmInteractionSource, CrmInteractionType, EntitlementStatus, EntitlementType, SourceType, type Prisma } from "@prisma/client";
import { ingestCrmInteraction } from "@/lib/crm/ingest";
import { logError } from "@/lib/observability/logger";
import {
  BOOKING_CONFIRMATION_SNAPSHOT_VERSION,
  buildBookingConfirmationSnapshot,
  type BookingConfirmationPaymentMeta,
} from "@/lib/reservas/confirmationSnapshot";
import { normalizeEmail } from "@/lib/utils/email";
import { updateBooking } from "@/domain/bookings/commands";
import { ensureEmailIdentity, resolveIdentityForUser } from "@/lib/ownership/identity";

function parseNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseId(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
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

function buildOwnerKey(params: { ownerUserId?: string | null; ownerIdentityId?: string | null; guestEmail?: string | null }) {
  if (params.ownerIdentityId) return `identity:${params.ownerIdentityId}`;
  if (params.ownerUserId) return `user:${params.ownerUserId}`;
  const guest = normalizeEmail(params.guestEmail);
  if (guest) return `email:${guest}`;
  return "unknown";
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
  const organizationId = parseId(meta.organizationId);
  const userId = typeof meta.userId === "string" ? meta.userId : null;
  const platformFeeCents = parseNumber(meta.platformFeeCents) ?? 0;

  const amountCents = intent.amount_received ?? intent.amount ?? 0;
  const { stripeFeeCents, stripeChargeId } = await resolveStripeFee(intent);

  await prisma.$transaction(async (tx) => {
    const participant = await tx.bookingSplitParticipant.findUnique({
      where: { id: splitParticipantId },
      include: {
        split: {
          include: {
            booking: {
                select: {
                  id: true,
                  status: true,
                  organizationId: true,
                  userId: true,
                  guestEmail: true,
                  serviceId: true,
                  availabilityId: true,
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

    if (participant.status !== "PAID") {
      await tx.bookingSplitParticipant.update({
        where: { id: participant.id },
        data: {
          status: "PAID",
          paidAt: new Date(),
          paymentIntentId: intent.id,
          shareCents: amountCents,
          platformFeeCents,
        },
      });
    }

    const remaining = await tx.bookingSplitParticipant.count({
      where: { splitId: participant.splitId, status: { not: "PAID" } },
    });
    if (remaining > 0) return;

    await tx.bookingSplit.update({
      where: { id: participant.splitId },
      data: { status: "COMPLETED" },
    });

    const booking = participant.split.booking;
    if (!booking || booking.status === "CONFIRMED") return;
    if (["CANCELLED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG", "COMPLETED", "NO_SHOW", "DISPUTED"].includes(booking.status)) {
      return;
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
      ownerUserId: booking.userId,
      guestEmail: booking.guestEmail ?? null,
    });

    await recordOrganizationAudit(tx, {
      organizationId: organizationId ?? booking.organizationId,
      actorUserId: userId ?? booking.userId,
      action: "BOOKING_CREATED",
      metadata: {
        bookingId: booking.id,
        serviceId: booking.serviceId ?? null,
        availabilityId: booking.availabilityId ?? null,
        policyId: parseId(meta.policyId) ?? null,
      },
    });
  });

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
        data: { status: "EXPIRED", respondedAt: now, respondedByUserId: request.respondedByUserId ?? booking.userId },
      });
      return { status: "EXPIRED" as const, bookingId: booking.id, organizationId: booking.organizationId };
    }

    if (booking.status !== "CONFIRMED") {
      await tx.bookingChangeRequest.update({
        where: { id: request.id },
        data: { status: "CANCELLED", respondedAt: now, respondedByUserId: request.respondedByUserId ?? booking.userId },
      });
      return { status: "BOOKING_CLOSED" as const, bookingId: booking.id, organizationId: booking.organizationId };
    }

    const newPriceCents = Math.max(0, Math.round((booking.price ?? 0) + request.priceDeltaCents));
    const actorUserId = request.respondedByUserId ?? booking.userId ?? null;
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
      await refundBookingPayment({
        bookingId: result.bookingId,
        paymentIntentId: intent.id,
        reason: `BOOKING_CHANGE_${result.status}`,
        amountCents: amountCents > 0 ? amountCents : undefined,
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
  const entitlementOwnerUserId = resolvedIdentityId ? null : ownerUserId;
  const ownerKey = buildOwnerKey({ ownerUserId: entitlementOwnerUserId, ownerIdentityId: resolvedIdentityId, guestEmail });
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
    await tx.bookingPolicyRef.create({
      data: { bookingId: booking.id, policyId: resolvedPolicyId },
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
    Boolean(meta.bookingId) ||
    Boolean(meta.serviceId);
  if (!isServiceBooking) return false;

  const bookingId = parseId(meta.bookingId);
  const serviceId = parseId(meta.serviceId);
  const availabilityId = parseId(meta.availabilityId);
  const organizationId = parseId(meta.organizationId);
  const policyId = parseId(meta.policyId);
  const userId = typeof meta.userId === "string" ? meta.userId : null;
  const platformFeeCents = parseNumber(meta.platformFeeCents) ?? 0;
  const paymentMeta: BookingConfirmationPaymentMeta = {
    grossAmountCents: meta.grossAmountCents ?? null,
    cardPlatformFeeCents: meta.cardPlatformFeeCents ?? null,
  };

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
        availabilityId?: number | null;
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
            availabilityId?: number | null;
            guestEmail?: string | null;
          }
        | null = null;
      if (bookingId) {
        const result = await confirmPendingBooking({
          tx,
          bookingId,
          now,
          ignoreExpiry: true,
          paymentMeta,
        });

        if (!result.ok) {
          if (["SLOT_TAKEN", "POLICY_SNAPSHOT_MISSING", "PRICING_SNAPSHOT_MISSING"].includes(result.code)) {
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
            availabilityId: true,
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
          ownerUserId: userId ?? booking.userId,
          guestEmail: booking.guestEmail ?? null,
        });

        await recordOrganizationAudit(tx, {
          organizationId: organizationId ?? booking.organizationId,
          actorUserId: userId ?? booking.userId,
          action: "BOOKING_CREATED",
          metadata: {
            bookingId: booking.id,
            serviceId: booking.serviceId,
            availabilityId: booking.availabilityId,
            policyId: policyId ?? null,
          },
        });

        const resolvedUserId = userId ?? booking.userId;
        crmPayload = {
          organizationId: booking.organizationId,
          userId: resolvedUserId ?? undefined,
          bookingId: booking.id,
          amountCents,
          currency: (intent.currency ?? "eur").toUpperCase(),
          serviceId: booking.serviceId ?? null,
          availabilityId: booking.availabilityId ?? null,
          guestEmail: booking.guestEmail ?? null,
        };
        return { crmPayload };
      }

      let booking = bookingId
        ? await tx.booking.findUnique({
            where: { id: bookingId },
            select: {
              id: true,
              organizationId: true,
              userId: true,
              guestEmail: true,
              serviceId: true,
              availabilityId: true,
              startsAt: true,
              status: true,
              paymentIntentId: true,
              addressRef: { select: { formattedAddress: true } },
              snapshotTimezone: true,
              availability: {
                select: { id: true, capacity: true, status: true },
              },
              policyRef: { select: { policyId: true } },
              service: { select: { title: true, coverImageUrl: true, addressRef: { select: { formattedAddress: true } } } },
            },
          })
        : null;

      const availabilityWithService = availabilityId
        ? await tx.availability.findUnique({
            where: { id: availabilityId },
            select: {
              id: true,
              serviceId: true,
              status: true,
              capacity: true,
              startsAt: true,
              durationMinutes: true,
              service: {
                select: {
                  unitPriceCents: true,
                  currency: true,
                },
              },
            },
          })
        : null;

      const availability = booking?.availability ?? availabilityWithService;

      if (!booking && availabilityWithService && serviceId && organizationId && userId) {
        if (availabilityWithService.serviceId !== serviceId) {
          throw new Error("SERVICE_BOOKING_MISMATCH");
        }
        if (availabilityWithService.status === "CANCELLED") {
          throw new Error("SERVICE_BOOKING_CANCELLED");
        }

        const activeCount = await tx.booking.count({
          where: {
            availabilityId: availabilityWithService.id,
            status: { notIn: ["CANCELLED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG"] },
          },
        });
        if (activeCount >= availabilityWithService.capacity) {
          throw new Error("SERVICE_BOOKING_FULL");
        }

        booking = await tx.booking.create({
          data: {
            serviceId,
            organizationId,
            userId,
            availabilityId: availabilityWithService.id,
            startsAt: availabilityWithService.startsAt,
            durationMinutes: availabilityWithService.durationMinutes,
            price: availabilityWithService.service.unitPriceCents,
            currency: availabilityWithService.service.currency,
            status: "CONFIRMED",
            paymentIntentId: intent.id,
          },
          include: {
            availability: true,
            policyRef: { select: { policyId: true } },
            service: { select: { title: true, coverImageUrl: true, addressRef: { select: { formattedAddress: true } } } },
            addressRef: { select: { formattedAddress: true } },
          },
        });
      }

      if (!booking || !availability) {
        throw new Error("SERVICE_BOOKING_NOT_FOUND");
      }

      const isCancelled = ["CANCELLED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG"].includes(booking.status);
      const confirmedNow = !isCancelled && booking.status !== "CONFIRMED";
      if (confirmedNow) {
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: "CONFIRMED", paymentIntentId: intent.id },
        });
      } else if (!booking.paymentIntentId) {
        await tx.booking.update({
          where: { id: booking.id },
          data: { paymentIntentId: intent.id },
        });
      }

      if (!booking.policyRef) {
        const policy =
          (policyId
            ? await tx.organizationPolicy.findFirst({
                where: { id: policyId, organizationId: organizationId ?? booking.organizationId },
                select: { id: true },
              })
            : null) ??
          (await tx.organizationPolicy.findFirst({
            where: { organizationId: organizationId ?? booking.organizationId, policyType: "MODERATE" },
            select: { id: true },
          })) ??
          (await tx.organizationPolicy.findFirst({
            where: { organizationId: organizationId ?? booking.organizationId },
            orderBy: { createdAt: "asc" },
            select: { id: true },
          }));

        if (policy) {
          await tx.bookingPolicyRef.create({
            data: { bookingId: booking.id, policyId: policy.id },
          });
        }
      }

      if (!isCancelled) {
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
          ownerUserId: userId ?? booking.userId,
          guestEmail: booking.guestEmail ?? null,
        });
      }
      const resolvedUserId = userId ?? booking.userId;
      if (!isCancelled && resolvedUserId) {
        crmPayload = {
          organizationId: booking.organizationId,
          userId: resolvedUserId,
          bookingId: booking.id,
          amountCents,
          currency: (intent.currency ?? "eur").toUpperCase(),
        };
      }

      if (confirmedNow && resolvedUserId) {
        await tx.userActivity.create({
          data: {
            userId: resolvedUserId,
            type: "BOOKING_CREATED",
            visibility: "PRIVATE",
            metadata: {
              bookingId: booking.id,
              serviceId: booking.serviceId,
              availabilityId: booking.availabilityId,
              organizationId: organizationId ?? booking.organizationId,
            },
          },
        });

        await recordOrganizationAudit(tx, {
          organizationId: organizationId ?? booking.organizationId,
          actorUserId: userId ?? booking.userId,
          action: "BOOKING_CREATED",
          metadata: {
            bookingId: booking.id,
            serviceId: booking.serviceId,
            availabilityId: booking.availabilityId,
            policyId: policyId ?? null,
          },
        });
      } else if (isCancelled) {
        await recordOrganizationAudit(tx, {
          organizationId: organizationId ?? booking.organizationId,
          actorUserId: userId ?? booking.userId,
          action: "BOOKING_PAYMENT_AFTER_CANCEL",
          metadata: {
            bookingId: booking.id,
            serviceId: booking.serviceId,
            availabilityId: booking.availabilityId,
            paymentIntentId: intent.id,
          },
        });
      }

      const activeCount = await tx.booking.count({
        where: {
          availabilityId: availability.id,
          status: { notIn: ["CANCELLED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG"] },
        },
      });
      if (activeCount >= availability.capacity && availability.status !== "FULL") {
        await tx.availability.update({
          where: { id: availability.id },
          data: { status: "FULL" },
        });
      }

      return { crmPayload };
    });
    crmPayload = txnResult?.crmPayload ?? null;
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNKNOWN";
    if (
      bookingId &&
      [
        "SLOT_TAKEN",
        "INVALID_CAPACITY",
        "SERVICE_INACTIVE",
        "POLICY_SNAPSHOT_MISSING",
        "PRICING_SNAPSHOT_MISSING",
      ].includes(code)
    ) {
      if (intent.id) {
        await refundBookingPayment({
          bookingId,
          paymentIntentId: intent.id,
          reason: `CONFIRM_${code}`,
        });
      }
      return true;
    }
    throw err;
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
          availabilityId: crmPayload.availabilityId ?? null,
        },
      });
    } catch (err) {
      logError("fulfill_service_booking.crm_interaction_failed", err, { bookingId: crmPayload.bookingId });
    }
  }

  return true;
}
