import {
  CrmInteractionSource,
  CrmInteractionType,
  OrganizationMemberRole,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { refundBookingPayment } from "@/lib/refunds/unifiedRefund";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { ingestCrmInteraction } from "@/lib/crm/ingest";
import {
  buildPadelExternalId,
  validatePadelInteractionMetadata,
} from "@/lib/crm/padelEventContract";
import { isPadelContext } from "@/lib/crm/isPadelContext";
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
  serviceKind?: string | null;
  organizationKind?: string | null;
  courtId?: number | null;
  resourceId?: number | null;
  professionalId?: number | null;
  timeslot?: string | null;
};

export type OrgBookingCancellationTxResult = {
  booking: { id: number; status: string };
  already: boolean;
  snapshotSynthesized: boolean;
  refundRequired: boolean;
  paymentIntentId: string | null;
  refundAmountCents: number | null;
  splitRefunds: SplitRefund[];
  snapshotTimezone: string;
  bookingUserId: string | null;
  organizationId: number;
  crmPayload: CancelCrmPayload | null;
};

export type OrgBookingCancellationPostActionsResult = {
  refundCaseId: string | null;
  refundStatus: "SUCCEEDED" | null;
  splitRefundCases: Array<{
    participantId: number;
    refundCaseId: string | null;
    refundStatus: "SUCCEEDED" | null;
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
      confirmationSnapshotVersion: true,
      confirmationSnapshotCreatedAt: true,
      snapshotTimezone: true,
      confirmationSnapshot: true,
      policyRef: {
        select: {
          policyId: true,
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
          kind: true,
          policyId: true,
          unitPriceCents: true,
          currency: true,
          organization: {
            select: {
              feeMode: true,
              platformFeeBps: true,
              platformFeeFixedCents: true,
              orgType: true,
              organizationKind: true,
            },
          },
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
      snapshotSynthesized: false,
      refundRequired: false,
      paymentIntentId: booking.paymentIntentId ?? null,
      refundAmountCents: null,
      splitRefunds: [],
      snapshotTimezone: booking.snapshotTimezone,
      bookingUserId: booking.userId,
      organizationId: booking.organizationId,
      crmPayload: null,
    };
  }

  const isPending = ["PENDING_CONFIRMATION", "PENDING"].includes(booking.status);
  let snapshot = parseBookingConfirmationSnapshot(booking.confirmationSnapshot);
  let snapshotSynthesized = false;
  if (!isPending && booking.status === "CONFIRMED" && !snapshot) {
    const hasFinancialSettlement =
      Boolean(booking.paymentIntentId) ||
      Boolean(
        booking.splitPayment?.participants?.some(
          (participant) =>
            participant.status === "PAID" && Boolean(participant.paymentIntentId),
        ),
      );

    if (hasFinancialSettlement) {
      throw new Error("BOOKING_CONFIRMATION_SNAPSHOT_REQUIRED");
    }

    const synthesized = await buildBookingConfirmationSnapshot({
      tx: params.tx,
      booking,
      now,
      policyIdHint: booking.policyRef?.policyId ?? null,
      paymentMeta: null,
    });
    if (!synthesized.ok) {
      throw new Error("BOOKING_CONFIRMATION_SNAPSHOT_REQUIRED");
    }

    snapshot = synthesized.snapshot;
    snapshotSynthesized = true;
    await params.tx.booking.update({
      where: { id: booking.id },
      data: {
        confirmationSnapshot: synthesized.snapshot,
        confirmationSnapshotVersion:
          typeof synthesized.snapshot.version === "number"
            ? synthesized.snapshot.version
            : BOOKING_CONFIRMATION_SNAPSHOT_VERSION,
        confirmationSnapshotCreatedAt: synthesized.snapshot.createdAt
          ? new Date(synthesized.snapshot.createdAt)
          : now,
      },
    });
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

  const split = booking.splitPayment ?? null;
  const splitRefunds: SplitRefund[] = split
    ? split.participants
        .filter((participant) => participant.status === "PAID" && Boolean(participant.paymentIntentId))
        .map((participant) => ({
          participantId: participant.id,
          paymentIntentId: participant.paymentIntentId as string,
        }))
    : [];

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
      snapshotTimezone: booking.snapshotTimezone,
    },
    ip: params.ip ?? null,
    userAgent: params.userAgent ?? null,
  });

  return {
    booking: { id: updated.id, status: updated.status },
    already: false,
    snapshotSynthesized,
    refundRequired,
    paymentIntentId: booking.paymentIntentId ?? null,
    refundAmountCents,
    splitRefunds,
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
          serviceKind: booking.service?.kind ?? null,
          organizationKind: booking.service?.organization?.organizationKind ?? null,
          courtId: booking.courtId ?? null,
          resourceId: booking.resourceId ?? null,
          professionalId: booking.professionalId ?? null,
          timeslot: booking.startsAt?.toISOString?.() ?? null,
        }
      : null,
  };
}

export async function runOrganizationBookingCancellationPostActions(params: {
  prisma: PrismaClient;
  result: OrgBookingCancellationTxResult;
}): Promise<OrgBookingCancellationPostActionsResult> {
  const { result } = params;
  const output: OrgBookingCancellationPostActionsResult = {
    refundCaseId: null,
    refundStatus: null,
    splitRefundCases: [],
  };

  if (result.refundRequired && result.paymentIntentId) {
    try {
      await refundBookingPayment({
        bookingId: result.booking.id,
        paymentIntentId: result.paymentIntentId,
        reason: "ORG_CANCEL",
        amountCents: result.refundAmountCents,
      });
      output.refundStatus = "SUCCEEDED";
    } catch (refundErr) {
      console.error("[org-booking-cancel] refund failed", refundErr);
      throw new Error("BOOKING_REFUND_FAILED");
    }
  }

  if (result.splitRefunds.length > 0) {
    const refundedParticipantIds: number[] = [];
    for (const refund of result.splitRefunds) {
      try {
        await refundBookingPayment({
          bookingId: result.booking.id,
          paymentIntentId: refund.paymentIntentId,
          reason: "ORG_CANCEL",
          amountCents: null,
          idempotencyKey: `refund:BOOKING:${result.booking.id}:SPLIT:${refund.participantId}`,
        });
        refundedParticipantIds.push(refund.participantId);
        output.splitRefundCases.push({
          participantId: refund.participantId,
          refundCaseId: null,
          refundStatus: "SUCCEEDED",
        });
      } catch (refundErr) {
        console.error("[org-booking-cancel] split refund failed", refundErr);
        throw new Error("BOOKING_REFUND_FAILED");
      }
    }

    if (refundedParticipantIds.length > 0) {
      await params.prisma.bookingSplitParticipant.updateMany({
        where: { id: { in: refundedParticipantIds } },
        data: { status: "CANCELLED" },
      });
    }
  }

  const crmPayload = result.crmPayload ?? null;
  if (!result.already && crmPayload) {
    try {
      const isPadelBooking = isPadelContext({
        organizationKind: crmPayload.organizationKind ?? null,
        serviceKind: crmPayload.serviceKind ?? null,
      });
      const padelInteractionType = CrmInteractionType.PADEL_BOOKING_CANCELLED;
      const interactionType = isPadelBooking
        ? padelInteractionType
        : CrmInteractionType.BOOKING_CANCELLED;
      const metadata = {
        bookingId: crmPayload.bookingId,
        serviceId: crmPayload.serviceId ?? null,
        courtId: crmPayload.courtId ?? null,
        resourceId: crmPayload.resourceId ?? null,
        professionalId: crmPayload.professionalId ?? null,
        clubId: crmPayload.organizationId,
        timeslot: crmPayload.timeslot ?? null,
        canceledBy: "ORG",
      };
      if (isPadelBooking) {
        const validation = validatePadelInteractionMetadata(padelInteractionType, metadata);
        if (!validation.ok) {
          console.warn("[org-booking-cancel] metadata padel inválida", validation.missing);
        }
      }
      await ingestCrmInteraction({
        organizationId: crmPayload.organizationId,
        userId: crmPayload.userId ?? undefined,
        type: interactionType,
        sourceType: CrmInteractionSource.BOOKING,
        sourceId: String(crmPayload.bookingId),
        ...(isPadelBooking
          ? {
              externalId: buildPadelExternalId(
                padelInteractionType,
                CrmInteractionSource.BOOKING,
                crmPayload.bookingId,
                crmPayload.userId ?? crmPayload.guestEmail ?? null,
              ),
            }
          : {}),
        occurredAt: new Date(),
        contactEmail: crmPayload.guestEmail ?? undefined,
        metadata,
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

  return output;
}
