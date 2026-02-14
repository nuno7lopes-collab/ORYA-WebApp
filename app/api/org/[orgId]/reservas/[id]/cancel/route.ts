import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { CrmInteractionSource, CrmInteractionType, OrganizationMemberRole } from "@prisma/client";
import { refundBookingPayment } from "@/lib/reservas/bookingRefund";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { ingestCrmInteraction } from "@/lib/crm/ingest";
import { createNotification, shouldNotify } from "@/lib/notifications";
import { cancelBooking } from "@/domain/bookings/commands";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  computeCancellationRefundFromSnapshot,
  parseBookingConfirmationSnapshot,
} from "@/lib/reservas/confirmationSnapshot";
import { intersectIds, resolveReservasScopesForMember, resolveTrainerProfessionalIds } from "@/lib/reservas/memberScopes";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
  OrganizationMemberRole.TRAINER,
];

function parseId(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getRequestMeta(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  return { ip, userAgent };
}

async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  type CancelTxnResult =
    | { error: Response }
    | {
        booking: { id: number; status: string };
        already: boolean;
        refundRequired: boolean;
        paymentIntentId: string | null;
        refundAmountCents: number | null;
        splitRefunds: Array<{
          participantId: number;
          paymentIntentId: string;
        }>;
        snapshotTimezone: string;
        crmPayload:
          | {
              organizationId: number;
              userId?: string | null;
              bookingId: number;
              guestEmail?: string | null;
              serviceId?: number | null;
              availabilityId?: number | null;
              courtId?: number | null;
              resourceId?: number | null;
              professionalId?: number | null;
            }
          | null;
      };

  const resolved = await params;
  const bookingId = parseId(resolved.id);
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    errorCode: string,
    message: string,
    retryable = false,
    details?: Record<string, unknown>,
  ) =>
    respondError(
      ctx,
      { errorCode, message, retryable, ...(details ? { details } : {}) },
      { status },
    );

  if (!bookingId) {
    return fail(400, "BOOKING_ID_INVALID", "ID inválido.");
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const profile = await prisma.profile.findUnique({ where: { id: user.id } });

    if (!profile) {
      return fail(403, "FORBIDDEN", "Perfil não encontrado.");
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return fail(403, "FORBIDDEN", "Sem permissões.");
    }
    const reservasAccess = await ensureReservasModuleAccess(organization, undefined, {
      requireVerifiedEmail: true,
    });
    if (!reservasAccess.ok) {
      const reservasMessage =
        "message" in reservasAccess && typeof reservasAccess.message === "string"
          ? reservasAccess.message
          : reservasAccess.error ?? "Sem permissões.";
      return fail(
        403,
        reservasAccess.error ?? "FORBIDDEN",
        reservasMessage,
      );
    }

    const payload = await req.json().catch(() => ({}));
    const reason = typeof payload?.reason === "string" ? payload.reason.trim().slice(0, 200) : null;
    const { ip, userAgent } = getRequestMeta(req);
    const now = new Date();

    let bookingUserId: string | null = null;
    const result = await prisma.$transaction<CancelTxnResult>(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, organizationId: organization.id },
        select: {
          id: true,
          userId: true,
          guestEmail: true,
          status: true,
          startsAt: true,
          paymentIntentId: true,
          organizationId: true,
          serviceId: true,
          availabilityId: true,
          snapshotTimezone: true,
          confirmationSnapshot: true,
          courtId: true,
          resourceId: true,
          professionalId: true,
          professional: { select: { userId: true } },
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
        return { error: fail(404, "BOOKING_NOT_FOUND", "Reserva não encontrada.") };
      }
      if (membership.role === OrganizationMemberRole.STAFF || membership.role === OrganizationMemberRole.TRAINER) {
        const scopes = await resolveReservasScopesForMember({
          organizationId: organization.id,
          userId: profile.id,
        });
        if (!scopes.hasAny) {
          return { error: fail(403, "FORBIDDEN", "Sem permissões.") };
        }
        if (membership.role === OrganizationMemberRole.TRAINER) {
          const trainerProfessionalIds = await resolveTrainerProfessionalIds({
            organizationId: organization.id,
            userId: profile.id,
          });
          const allowedProfessionals = scopes.professionalIds.length
            ? intersectIds(trainerProfessionalIds, scopes.professionalIds)
            : trainerProfessionalIds;
          if (!allowedProfessionals.length || !booking.professionalId || !allowedProfessionals.includes(booking.professionalId)) {
            return { error: fail(403, "FORBIDDEN", "Sem permissões.") };
          }
          if (scopes.courtIds.length && booking.courtId && !scopes.courtIds.includes(booking.courtId)) {
            return { error: fail(403, "FORBIDDEN", "Sem permissões.") };
          }
          if (scopes.resourceIds.length && booking.resourceId && !scopes.resourceIds.includes(booking.resourceId)) {
            return { error: fail(403, "FORBIDDEN", "Sem permissões.") };
          }
        } else {
          const allowed = [
            booking.courtId && scopes.courtIds.includes(booking.courtId),
            booking.resourceId && scopes.resourceIds.includes(booking.resourceId),
            booking.professionalId && scopes.professionalIds.includes(booking.professionalId),
          ].some(Boolean);
          if (!allowed) {
            return { error: fail(403, "FORBIDDEN", "Sem permissões.") };
          }
        }
      }
      if (["CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG", "CANCELLED"].includes(booking.status)) {
        return {
          booking: { id: booking.id, status: booking.status },
          already: true,
          refundRequired: false,
          paymentIntentId: booking.paymentIntentId ?? null,
          refundAmountCents: null,
          splitRefunds: [],
          snapshotTimezone: booking.snapshotTimezone,
          crmPayload: null,
        };
      }

      bookingUserId = booking.userId;
      const isPending = ["PENDING_CONFIRMATION", "PENDING"].includes(booking.status);
      const snapshot = parseBookingConfirmationSnapshot(booking.confirmationSnapshot);
      if (!isPending && booking.status === "CONFIRMED" && !snapshot) {
        return {
          error: fail(
            409,
            "BOOKING_CONFIRMATION_SNAPSHOT_REQUIRED",
            "Reserva confirmada sem snapshot. Corre o backfill antes de cancelar.",
            false,
            { bookingId: booking.id },
          ),
        };
      }

      // Organization cancellation is allowed regardless of the customer's cancellation window,
      // but we still block after the booking start time to avoid undefined operational states.
      const startsAtMs = booking.startsAt?.getTime?.() ?? NaN;
      const canCancel = isPending || (booking.status === "CONFIRMED" && Number.isFinite(startsAtMs) && startsAtMs > now.getTime());
      if (!canCancel) {
        return {
          error: fail(
            400,
            "BOOKING_CANCELLATION_NOT_ALLOWED",
            "Já não é possível cancelar esta reserva.",
            false,
          ),
        };
      }

      const { booking: updated } = await cancelBooking({
        tx,
        bookingId: booking.id,
        organizationId: booking.organizationId,
        actorUserId: profile.id,
        data: { status: "CANCELLED_BY_ORG" },
      });
      const split = booking.splitPayment ?? null;
      const splitRefunds = split
        ? split.participants
            .filter(
              (participant) => participant.status === "PAID" && Boolean(participant.paymentIntentId),
            )
            .map((participant) => ({
              participantId: participant.id,
              paymentIntentId: participant.paymentIntentId as string,
            }))
        : [];

      if (split) {
        await tx.bookingSplit.update({
          where: { id: split.id },
          data: { status: "CANCELLED" },
        });
        await tx.bookingSplitParticipant.updateMany({
          where: { splitId: split.id, status: "PENDING" },
          data: { status: "CANCELLED" },
        });
      }

      const refundRequired =
        splitRefunds.length === 0 &&
        !!booking.paymentIntentId &&
        (isPending || booking.status === "CONFIRMED");
      const refundComputation = snapshot
        ? computeCancellationRefundFromSnapshot(snapshot, { actor: "ORG" })
        : null;
      const refundAmountCents = refundComputation?.refundCents ?? null;

      await recordOrganizationAudit(tx, {
        organizationId: organization.id,
        actorUserId: profile.id,
        action: "BOOKING_CANCELLED",
        metadata: {
          bookingId: booking.id,
          serviceId: booking.serviceId,
          availabilityId: booking.availabilityId,
          source: "ORG",
          actorRole: membership.role,
          reason,
          refundRequired,
          deadline: null,
          refundAmountCents,
          splitRefundsCount: splitRefunds.length,
          snapshotVersion: snapshot?.version ?? null,
          snapshotTimezone: booking.snapshotTimezone,
        },
        ip,
        userAgent,
      });

      return {
        booking: { id: updated.id, status: updated.status },
        already: false,
        refundRequired,
        paymentIntentId: booking.paymentIntentId ?? null,
        refundAmountCents,
        splitRefunds,
        snapshotTimezone: booking.snapshotTimezone,
        crmPayload: booking.userId || booking.guestEmail
          ? {
              organizationId: organization.id,
              userId: booking.userId ?? undefined,
              bookingId: booking.id,
              guestEmail: booking.guestEmail ?? null,
              serviceId: booking.serviceId ?? null,
              availabilityId: booking.availabilityId ?? null,
              courtId: booking.courtId ?? null,
              resourceId: booking.resourceId ?? null,
              professionalId: booking.professionalId ?? null,
            }
          : null,
      };
    });

    if ("error" in result) return result.error;

    if (result.refundRequired && result.paymentIntentId) {
      try {
        await refundBookingPayment({
          bookingId: result.booking.id,
          paymentIntentId: result.paymentIntentId,
          reason: "ORG_CANCEL",
          amountCents: result.refundAmountCents,
        });
      } catch (refundErr) {
        console.error("[organizacao/cancel] refund failed", refundErr);
        return fail(
          502,
          "BOOKING_REFUND_FAILED",
          "Reserva cancelada, mas o reembolso falhou.",
          true,
        );
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
        } catch (refundErr) {
          console.error("[organizacao/cancel] split refund failed", refundErr);
          return fail(
            502,
            "BOOKING_REFUND_FAILED",
            "Reserva cancelada, mas o reembolso falhou.",
            true,
          );
        }
      }

      if (refundedParticipantIds.length > 0) {
        await prisma.bookingSplitParticipant.updateMany({
          where: { id: { in: refundedParticipantIds } },
          data: { status: "CANCELLED" },
        });
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
            availabilityId: crmPayload.availabilityId ?? null,
            courtId: crmPayload.courtId ?? null,
            resourceId: crmPayload.resourceId ?? null,
            professionalId: crmPayload.professionalId ?? null,
            canceledBy: "ORG",
          },
        });
      } catch (err) {
        console.warn("[organizacao/cancel] Falha ao criar interação CRM", err);
      }
    }

    if (!result.already && bookingUserId) {
      try {
        const shouldSend = await shouldNotify(bookingUserId, "SYSTEM_ANNOUNCE");
        if (shouldSend) {
          await createNotification({
            userId: bookingUserId,
            type: "SYSTEM_ANNOUNCE",
            title: "Reserva cancelada",
            body: "A tua reserva foi cancelada pela organização.",
            ctaUrl: "/me/reservas",
            ctaLabel: "Ver reservas",
            organizationId: organization.id,
          });
        }
      } catch (notifyErr) {
        console.warn("[organizacao/cancel] Falha ao enviar notificação", notifyErr);
      }
    }

    return respondOk(ctx, {
      booking: { id: result.booking.id, status: result.booking.status },
      alreadyCancelled: result.already,
      snapshotTimezone: result.snapshotTimezone,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "UNAUTHENTICATED", "Não autenticado.");
    }
    console.error("POST /api/org/[orgId]/reservas/[id]/cancel error:", err);
    return fail(500, "BOOKING_CANCEL_FAILED", "Erro ao cancelar reserva.", true);
  }
}

export const POST = withApiEnvelope(_POST);
