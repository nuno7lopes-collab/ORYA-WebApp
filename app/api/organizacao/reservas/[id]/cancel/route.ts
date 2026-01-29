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
import { decideCancellation } from "@/lib/bookingCancellation";
import { ingestCrmInteraction } from "@/lib/crm/ingest";
import { createNotification, shouldNotify } from "@/lib/notifications";
import { cancelBooking } from "@/domain/bookings/commands";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import {
  computeCancellationRefundFromSnapshot,
  getSnapshotCancellationWindowMinutes,
  parseBookingConfirmationSnapshot,
} from "@/lib/reservas/confirmationSnapshot";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
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

export async function POST(
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
        snapshotTimezone: string;
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
      return fail(
        403,
        reservasAccess.error ?? "FORBIDDEN",
        reservasAccess.message ?? "Sem permissões.",
      );
    }

    const payload = await req.json().catch(() => ({}));
    const reason = typeof payload?.reason === "string" ? payload.reason.trim().slice(0, 200) : null;
    const { ip, userAgent } = getRequestMeta(req);
    const now = new Date();

    let crmPayload: { organizationId: number; userId: string; bookingId: number } | null = null;
    let bookingUserId: string | null = null;
    const result = await prisma.$transaction<CancelTxnResult>(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, organizationId: organization.id },
        select: {
          id: true,
          userId: true,
          status: true,
          startsAt: true,
          paymentIntentId: true,
          organizationId: true,
          serviceId: true,
          availabilityId: true,
          snapshotTimezone: true,
          confirmationSnapshot: true,
          professional: { select: { userId: true } },
        },
      });

      if (!booking) {
        return { error: fail(404, "BOOKING_NOT_FOUND", "Reserva não encontrada.") };
      }
      if (
        membership.role === OrganizationMemberRole.STAFF &&
        (!booking.professional?.userId || booking.professional.userId !== profile.id)
      ) {
        return { error: fail(403, "FORBIDDEN", "Sem permissões.") };
      }
      if (["CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG", "CANCELLED"].includes(booking.status)) {
        return {
          booking: { id: booking.id, status: booking.status },
          already: true,
          refundRequired: false,
          paymentIntentId: booking.paymentIntentId ?? null,
          refundAmountCents: null,
          snapshotTimezone: booking.snapshotTimezone,
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

      const decision = decideCancellation(
        booking.startsAt,
        isPending ? null : getSnapshotCancellationWindowMinutes(snapshot),
        now,
      );
      const canCancel = isPending || (booking.status === "CONFIRMED" && decision.allowed);
      if (!canCancel) {
        return {
          error: fail(
            400,
            "BOOKING_CANCELLATION_WINDOW_EXPIRED",
            "O prazo de cancelamento já passou.",
            false,
            { deadline: decision.deadline?.toISOString() ?? null },
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
      const refundRequired =
        !!booking.paymentIntentId &&
        (isPending || (booking.status === "CONFIRMED" && decision.allowed));
      const refundComputation = snapshot ? computeCancellationRefundFromSnapshot(snapshot) : null;
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
          deadline: decision.deadline?.toISOString() ?? null,
          refundAmountCents,
          snapshotVersion: snapshot?.version ?? null,
          snapshotTimezone: booking.snapshotTimezone,
        },
        ip,
        userAgent,
      });

      crmPayload = {
        organizationId: organization.id,
        userId: booking.userId,
        bookingId: booking.id,
      };

      return {
        booking: { id: updated.id, status: updated.status },
        already: false,
        refundRequired,
        paymentIntentId: booking.paymentIntentId ?? null,
        refundAmountCents,
        snapshotTimezone: booking.snapshotTimezone,
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

    if (!result.already && crmPayload) {
      try {
        await ingestCrmInteraction({
          organizationId: crmPayload.organizationId,
          userId: crmPayload.userId,
          type: CrmInteractionType.BOOKING_CANCELLED,
          sourceType: CrmInteractionSource.BOOKING,
          sourceId: String(crmPayload.bookingId),
          occurredAt: new Date(),
          metadata: {
            bookingId: crmPayload.bookingId,
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
    console.error("POST /api/organizacao/reservas/[id]/cancel error:", err);
    return fail(500, "BOOKING_CANCEL_FAILED", "Erro ao cancelar reserva.", true);
  }
}
