import { NextRequest, NextResponse } from "next/server";
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
  const resolved = await params;
  const bookingId = parseId(resolved.id);
  const ctx = getRequestContext(req);
  const errorWithCtx = (status: number, error: string, errorCode = error, details?: Record<string, unknown>) =>
    NextResponse.json(
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
      return NextResponse.json({ ok: false, error: "Perfil não encontrado." }, { status: 403 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }
    const reservasAccess = await ensureReservasModuleAccess(organization, undefined, {
      requireVerifiedEmail: true,
    });
    if (!reservasAccess.ok) {
      return NextResponse.json(reservasAccess, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    const reason = typeof payload?.reason === "string" ? payload.reason.trim().slice(0, 200) : null;
    const { ip, userAgent } = getRequestMeta(req);
    const now = new Date();

    let crmPayload: { organizationId: number; userId: string; bookingId: number } | null = null;
    let bookingUserId: string | null = null;
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
        return { error: errorWithCtx(404, "Reserva não encontrada.", "BOOKING_NOT_FOUND") };
      }
      if (
        membership.role === OrganizationMemberRole.STAFF &&
        (!booking.professional?.userId || booking.professional.userId !== profile.id)
      ) {
        return { error: errorWithCtx(403, "Sem permissões.", "FORBIDDEN") };
      }
      if (["CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG", "CANCELLED"].includes(booking.status)) {
        return { booking, already: true };
      }

      bookingUserId = booking.userId;
      const isPending = ["PENDING_CONFIRMATION", "PENDING"].includes(booking.status);
      const snapshot = parseBookingConfirmationSnapshot(booking.confirmationSnapshot);
      if (!isPending && booking.status === "CONFIRMED" && !snapshot) {
        return {
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
      if (!canCancel) {
        return {
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
        booking: updated,
        already: false,
        refundRequired,
        paymentIntentId: booking.paymentIntentId,
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
        return errorWithCtx(502, "Reserva cancelada, mas o reembolso falhou.", "BOOKING_REFUND_FAILED");
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

    return NextResponse.json({
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
