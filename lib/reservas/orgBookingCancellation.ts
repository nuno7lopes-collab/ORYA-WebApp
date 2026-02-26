import {
  CrmInteractionSource,
  CrmInteractionType,
  OrganizationMemberRole,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { requestBookingRefundCase } from "@/lib/reservas/refundCase";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { ingestCrmInteraction } from "@/lib/crm/ingest";
import { createNotification, shouldNotify } from "@/lib/notifications";
import { cancelBooking } from "@/domain/bookings/commands";
import {
  BOOKING_CONFIRMATION_SNAPSHOT_VERSION,
  buildBookingConfirmationSnapshot,
  computeCancellationRefundFromSnapshot,
  parseBookingConfirmationSnapshot,
} from "@/lib/reservas/confirmationSnapshot";

type Tx = Prisma.TransactionClient;

type SplitRefund = {
  participantId: number;
  paymentIntentId: string;
};

type CancelCrmPayload = {
  organizationId: number;
  userId?: string | null;
  bookingId: number;
  guestEmail?: string | null;
  serviceId?: number | null;
  courtId?: number | null;
  resourceId?: number | null;
  professionalId?: number | null;
};

export type OrgBookingCancellationTxResult = {
  booking: { id: number; status: string };
  already: boolean;
  refundRequired: boolean;
  paymentIntentId: string | null;
  refundAmountCents: number | null;
  splitRefunds: SplitRefund[];
  snapshotSynthesized: boolean;
  snapshotTimezone: string;
  bookingUserId: string | null;
  organizationId: number;
  crmPayload: CancelCrmPayload | null;
};

export type OrgBookingCancellationPostActionsResult = {
  refundCaseId: string | null;
  refundStatus: string | null;
  splitRefundCases: Array<{
    participantId: number;
    refundCaseId: string | null;
    status: string;
  }>;
};

export async function cancelBookingByOrganizationInTx(params: {
  tx: Tx;
  organizationId: number;
  bookingId: number;
  actorUserId: string;
  actorRole: OrganizationMemberRole | string;
  reason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  auditSource?: "ORG" | "AVAILABILITY_CHANGESET";
}): Promise<OrgBookingCancellationTxResult> {
  const now = new Date();
  const booking = await params.tx.booking.findFirst({
    where: { id: params.bookingId, organizationId: params.organizationId },
    select: {
      id: true,
      userId: true,
      guestEmail: true,
      status: true,
      startsAt: true,
      price: true,
      currency: true,
      paymentIntentId: true,
      organizationId: true,
      serviceId: true,
      createdAt: true,
      updatedAt: true,
      snapshotTimezone: true,
      confirmationSnapshot: true,
      policyRef: { select: { policyId: true } },
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
      courtId: true,
      resourceId: true,
      professionalId: true,
      splitPayment: {
        select: {
          id: true,
          status: true,
          participants: {
            select: {
              id: true,
              status: true,
              paymentIntentId: true,
            },
          },
        },
      },
    },
  });

  if (!booking) {
    throw new Error("BOOKING_NOT_FOUND");
  }

  if (["CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG", "CANCELLED"].includes(booking.status)) {
    return {
      booking: { id: booking.id, status: booking.status },
      already: true,
      refundRequired: false,
      paymentIntentId: booking.paymentIntentId ?? null,
      refundAmountCents: null,
      splitRefunds: [],
      snapshotSynthesized: false,
      snapshotTimezone: booking.snapshotTimezone,
      bookingUserId: booking.userId,
      organizationId: booking.organizationId,
      crmPayload: null,
    };
  }

  const isPending = ["PENDING_CONFIRMATION", "PENDING"].includes(booking.status);
  const split = booking.splitPayment ?? null;
  const splitRefunds: SplitRefund[] = split
    ? split.participants
        .filter((participant) => participant.status === "PAID" && Boolean(participant.paymentIntentId))
        .map((participant) => ({
          participantId: participant.id,
          paymentIntentId: participant.paymentIntentId as string,
        }))
    : [];

  let snapshot = parseBookingConfirmationSnapshot(booking.confirmationSnapshot);
  let snapshotSynthesized = false;
  if (!isPending && booking.status === "CONFIRMED" && !snapshot) {
    const hasFinancialSettlement = Boolean(booking.paymentIntentId) || splitRefunds.length > 0;
    if (hasFinancialSettlement) {
      throw new Error("BOOKING_CONFIRMATION_SNAPSHOT_REQUIRED");
    }

    const snapshotResult = await buildBookingConfirmationSnapshot({
      tx: params.tx,
      booking,
      now,
      policyIdHint: booking.policyRef?.policyId ?? null,
      paymentMeta: null,
    });
    if (!snapshotResult.ok) {
      throw new Error("BOOKING_CONFIRMATION_SNAPSHOT_REQUIRED");
    }

    const snapshotVersion =
      typeof snapshotResult.snapshot.version === "number"
        ? Math.max(BOOKING_CONFIRMATION_SNAPSHOT_VERSION, snapshotResult.snapshot.version)
        : BOOKING_CONFIRMATION_SNAPSHOT_VERSION;
    const parsedCreatedAt = snapshotResult.snapshot.createdAt
      ? new Date(snapshotResult.snapshot.createdAt)
      : now;
    const snapshotCreatedAt = Number.isNaN(parsedCreatedAt.getTime()) ? now : parsedCreatedAt;

    await params.tx.booking.update({
      where: { id: booking.id },
      data: {
        confirmationSnapshot: snapshotResult.snapshot as Prisma.InputJsonValue,
        confirmationSnapshotVersion: snapshotVersion,
        confirmationSnapshotCreatedAt: snapshotCreatedAt,
      },
    });

    snapshot = snapshotResult.snapshot;
    snapshotSynthesized = true;
  }

  const startsAtMs = booking.startsAt?.getTime?.() ?? Number.NaN;
  const canCancel = isPending || (booking.status === "CONFIRMED" && Number.isFinite(startsAtMs) && startsAtMs > now.getTime());
  if (!canCancel) {
    throw new Error("BOOKING_CANCELLATION_NOT_ALLOWED");
  }

  const { booking: updated } = await cancelBooking({
    tx: params.tx,
    bookingId: booking.id,
    organizationId: booking.organizationId,
    actorUserId: params.actorUserId,
    data: { status: "CANCELLED_BY_ORG" },
  });

  if (split) {
    await params.tx.bookingSplit.update({
      where: { id: split.id },
      data: { status: "CANCELLED" },
    });
    await params.tx.bookingSplitParticipant.updateMany({
      where: { splitId: split.id, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
  }

  const refundRequired =
    splitRefunds.length === 0 &&
    Boolean(booking.paymentIntentId) &&
    (isPending || booking.status === "CONFIRMED");
  const refundComputation = snapshot
    ? computeCancellationRefundFromSnapshot(snapshot, { actor: "ORG" })
    : null;
  const refundAmountCents = refundComputation?.refundCents ?? null;

  await recordOrganizationAudit(params.tx, {
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    action: "BOOKING_CANCELLED",
    metadata: {
      bookingId: booking.id,
      serviceId: booking.serviceId,
      source: params.auditSource ?? "ORG",
      actorRole: params.actorRole,
      reason: params.reason ?? null,
      refundRequired,
      deadline: null,
      refundAmountCents,
      splitRefundsCount: splitRefunds.length,
      snapshotVersion: snapshot?.version ?? null,
      snapshotSynthesized,
      snapshotTimezone: booking.snapshotTimezone,
    },
    ip: params.ip ?? null,
    userAgent: params.userAgent ?? null,
  });

  return {
    booking: { id: updated.id, status: updated.status },
    already: false,
    refundRequired,
    paymentIntentId: booking.paymentIntentId ?? null,
    refundAmountCents,
    splitRefunds,
    snapshotSynthesized,
    snapshotTimezone: booking.snapshotTimezone,
    bookingUserId: booking.userId,
    organizationId: booking.organizationId,
    crmPayload: booking.userId || booking.guestEmail
      ? {
          organizationId: params.organizationId,
          userId: booking.userId ?? undefined,
          bookingId: booking.id,
          guestEmail: booking.guestEmail ?? null,
          serviceId: booking.serviceId ?? null,
          courtId: booking.courtId ?? null,
          resourceId: booking.resourceId ?? null,
          professionalId: booking.professionalId ?? null,
        }
      : null,
  };
}

export async function runOrganizationBookingCancellationPostActions(params: {
  prisma: PrismaClient;
  result: OrgBookingCancellationTxResult;
}): Promise<OrgBookingCancellationPostActionsResult> {
  const { result } = params;
  let refundCaseId: string | null = null;
  let refundStatus: string | null = null;
  const splitRefundCases: Array<{
    participantId: number;
    refundCaseId: string | null;
    status: string;
  }> = [];

  if (result.refundRequired && result.paymentIntentId) {
    try {
      const refundCase = await requestBookingRefundCase({
        bookingId: result.booking.id,
        paymentIntentId: result.paymentIntentId,
        reason: "ORG_CANCEL",
        amountCents: result.refundAmountCents,
        requestedBy: result.bookingUserId ?? null,
        auditPayload: { route: "org/reservas/cancel" },
      });
      refundCaseId = refundCase?.id ?? null;
      refundStatus = refundCase?.status ?? null;
    } catch (refundErr) {
      console.error("[org-booking-cancel] refund case failed", refundErr);
      refundStatus = "MANUAL_REVIEW";
    }
  }

  if (result.splitRefunds.length > 0) {
    const refundedParticipantIds: number[] = [];
    for (const refund of result.splitRefunds) {
      try {
        const splitRefundCase = await requestBookingRefundCase({
          bookingId: result.booking.id,
          paymentIntentId: refund.paymentIntentId,
          reason: "ORG_CANCEL",
          amountCents: null,
          requestedBy: result.bookingUserId ?? null,
          idempotencyKey: `refund_case:BOOKING:${result.booking.id}:SPLIT:${refund.participantId}`,
          auditPayload: {
            route: "org/reservas/cancel",
            split: true,
            participantId: refund.participantId,
          },
        });
        refundedParticipantIds.push(refund.participantId);
        splitRefundCases.push({
          participantId: refund.participantId,
          refundCaseId: splitRefundCase?.id ?? null,
          status: splitRefundCase?.status ?? "QUEUED",
        });
      } catch (refundErr) {
        console.error("[org-booking-cancel] split refund case failed", refundErr);
        splitRefundCases.push({
          participantId: refund.participantId,
          refundCaseId: null,
          status: "MANUAL_REVIEW",
        });
      }
    }

    if (refundedParticipantIds.length > 0) {
      await params.prisma.bookingSplitParticipant.updateMany({
        where: { id: { in: refundedParticipantIds } },
        data: { status: "CANCELLED" },
      });
    }

    if (!refundStatus && splitRefundCases.length > 0) {
      refundStatus = splitRefundCases.some((item) => item.status === "MANUAL_REVIEW")
        ? "MANUAL_REVIEW"
        : "QUEUED";
    }
  }

  const crmPayload = result.crmPayload ?? null;
  if (!result.already && crmPayload) {
    try {
      await ingestCrmInteraction({
        organizationId: crmPayload.organizationId,
        userId: crmPayload.userId ?? undefined,
        type: CrmInteractionType.BOOKING_CANCELLED,
        sourceType: CrmInteractionSource.BOOKING,
        sourceId: String(crmPayload.bookingId),
        occurredAt: new Date(),
        contactEmail: crmPayload.guestEmail ?? undefined,
        metadata: {
          bookingId: crmPayload.bookingId,
          serviceId: crmPayload.serviceId ?? null,
          courtId: crmPayload.courtId ?? null,
          resourceId: crmPayload.resourceId ?? null,
          professionalId: crmPayload.professionalId ?? null,
          canceledBy: "ORG",
        },
      });
    } catch (err) {
      console.warn("[org-booking-cancel] Falha ao criar interação CRM", err);
    }
  }

  if (!result.already && result.bookingUserId) {
    try {
      const shouldSend = await shouldNotify(result.bookingUserId, "SYSTEM_ANNOUNCE");
      if (shouldSend) {
        await createNotification({
          userId: result.bookingUserId,
          type: "SYSTEM_ANNOUNCE",
          title: "Reserva cancelada",
          body: "A tua reserva foi cancelada pela organização.",
          ctaUrl: "/me/reservas",
          ctaLabel: "Ver reservas",
          organizationId: result.organizationId,
        });
      }
    } catch (notifyErr) {
      console.warn("[org-booking-cancel] Falha ao enviar notificação", notifyErr);
    }
  }

  return {
    refundCaseId,
    refundStatus,
    splitRefundCases,
  };
}
