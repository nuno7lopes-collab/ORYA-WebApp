import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
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
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
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

async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const bookingId = parseId(resolved.id);
  const ctx = getRequestContext(req);
  const errorWithCtx = (status: number, error: string, errorCode = error, details?: Record<string, unknown>) =>
    jsonWrap(
      {
        ok: false,
        error,
        errorCode,
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        ...(details ? { details } : {}),
      },
      { status },
    );
  if (!bookingId) {
    return errorWithCtx(400, "ID inválido.", "BOOKING_ID_INVALID");
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const profile = await prisma.profile.findUnique({ where: { id: user.id } });

    if (!profile) {
      return jsonWrap({ ok: false, error: "Perfil não encontrado." }, { status: 403 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return jsonWrap({ ok: false, error: "Sem permissões." }, { status: 403 });
    }
    const reservasAccess = await ensureReservasModuleAccess(organization, undefined, {
      requireVerifiedEmail: true,
    });
    if (!reservasAccess.ok) {
      return jsonWrap(reservasAccess, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    const reason = typeof payload?.reason === "string" ? payload.reason.trim().slice(0, 200) : null;
    const { ip, userAgent } = getRequestMeta(req);
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
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
        return { ok: false as const, error: errorWithCtx(404, "Reserva não encontrada.", "BOOKING_NOT_FOUND") };
      }
      if (
        membership.role === OrganizationMemberRole.STAFF &&
        (!booking.professional?.userId || booking.professional.userId !== profile.id)
      ) {
        return { ok: false as const, error: errorWithCtx(403, "Sem permissões.", "FORBIDDEN") };
      }
      if (["CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG", "CANCELLED"].includes(booking.status)) {
        return {
          ok: true as const,
          booking: { id: booking.id, status: booking.status },
          already: true,
          refundRequired: false,
          paymentIntentId: booking.paymentIntentId ?? null,
          refundAmountCents: null,
          snapshotTimezone: booking.snapshotTimezone,
          bookingUserId: booking.userId,
        };
      }

      const bookingUserId = booking.userId;
      const isPending = ["PENDING_CONFIRMATION", "PENDING"].includes(booking.status);
      const snapshot = parseBookingConfirmationSnapshot(booking.confirmationSnapshot);
      if (!isPending && booking.status === "CONFIRMED" && !snapshot) {
        return {
          ok: false as const,
          error: errorWithCtx(
            409,
            "Reserva confirmada sem snapshot. Corre o backfill antes de cancelar.",
            "BOOKING_CONFIRMATION_SNAPSHOT_REQUIRED",
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
      if (canCancel === false) {
        return {
          ok: false as const,
          error: errorWithCtx(
            400,
            "O prazo de cancelamento já passou.",
            "BOOKING_CANCELLATION_WINDOW_EXPIRED",
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
      const updatedSummary = { id: updated.id, status: updated.status };
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

      return {
        ok: true as const,
        booking: updatedSummary,
        already: false,
        refundRequired,
        paymentIntentId: booking.paymentIntentId ?? null,
        refundAmountCents,
        snapshotTimezone: booking.snapshotTimezone,
        bookingUserId,
      };
    });

    if (!result.ok) return result.error;

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
        return errorWithCtx(502, "Reserva cancelada, mas o reembolso falhou.", "BOOKING_REFUND_FAILED");
      }
    }

    if (!result.already && result.bookingUserId) {
      try {
        await ingestCrmInteraction({
          organizationId: organization.id,
          userId: result.bookingUserId,
          type: CrmInteractionType.BOOKING_CANCELLED,
          sourceType: CrmInteractionSource.BOOKING,
          sourceId: String(result.booking.id),
          occurredAt: new Date(),
          metadata: {
            bookingId: result.booking.id,
            canceledBy: "ORG",
          },
        });
      } catch (err) {
        console.warn("[organizacao/cancel] Falha ao criar interação CRM", err);
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
            organizationId: organization.id,
          });
        }
      } catch (notifyErr) {
        console.warn("[organizacao/cancel] Falha ao enviar notificação", notifyErr);
      }
    }

    return jsonWrap({
      ok: true,
      booking: { id: result.booking.id, status: result.booking.status },
      alreadyCancelled: result.already,
      snapshotTimezone: result.snapshotTimezone,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return errorWithCtx(401, "Não autenticado.", "UNAUTHENTICATED");
    }
    console.error("POST /api/organizacao/reservas/[id]/cancel error:", err);
    return errorWithCtx(500, "Erro ao cancelar reserva.", "BOOKING_CANCEL_FAILED");
  }
}
export const POST = withApiEnvelope(_POST);
