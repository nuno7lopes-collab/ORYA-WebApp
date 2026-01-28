import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { createNotification, shouldNotify } from "@/lib/notifications";
import { OrganizationMemberRole } from "@prisma/client";
import { markNoShowBooking } from "@/domain/bookings/commands";
import { getRequestContext } from "@/lib/http/requestContext";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  computeNoShowRefundFromSnapshot,
  parseBookingConfirmationSnapshot,
} from "@/lib/reservas/confirmationSnapshot";
import { refundBookingPayment } from "@/lib/reservas/bookingRefund";

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
      if (
        ["CANCELLED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG", "COMPLETED", "DISPUTED", "NO_SHOW"].includes(
          booking.status,
        )
      ) {
        return { ok: false as const, error: errorWithCtx(409, "Reserva já encerrada.", "BOOKING_ALREADY_CLOSED") };
      }

      if (booking.startsAt > now) {
        return { ok: false as const, error: errorWithCtx(409, "Reserva ainda não ocorreu.", "BOOKING_NOT_STARTED") };
      }

      const snapshot = parseBookingConfirmationSnapshot(booking.confirmationSnapshot);
      if (!snapshot) {
        return {
          ok: false as const,
          error: errorWithCtx(
            409,
            "Reserva sem snapshot. Corre o backfill antes de marcar no-show.",
            "BOOKING_CONFIRMATION_SNAPSHOT_REQUIRED",
            { bookingId: booking.id },
          ),
        };
      }

      const refundComputation = computeNoShowRefundFromSnapshot(snapshot);
      if (!refundComputation) {
        return {
          ok: false as const,
          error: errorWithCtx(
            409,
            "Snapshot inválido. Corre o backfill antes de marcar no-show.",
            "BOOKING_CONFIRMATION_SNAPSHOT_INVALID",
            { bookingId: booking.id },
          ),
        };
      }

      const { booking: updated } = await markNoShowBooking({
        bookingId: booking.id,
        organizationId: booking.organizationId,
        actorUserId: profile.id,
        data: { status: "NO_SHOW" },
        select: { id: true, status: true },
        tx,
      });
      const updatedSummary = { id: updated.id, status: updated.status };

      await recordOrganizationAudit(tx, {
        organizationId: organization.id,
        actorUserId: profile.id,
        action: "BOOKING_NO_SHOW",
        metadata: {
          bookingId: booking.id,
          serviceId: booking.serviceId,
          actorRole: membership.role,
          snapshotVersion: snapshot.version,
          snapshotTimezone: booking.snapshotTimezone,
          penaltyCents: refundComputation.penaltyCents,
          refundAmountCents: refundComputation.refundCents,
          refundRule: refundComputation.rule,
        },
        ip,
        userAgent,
      });

      return {
        ok: true as const,
        booking: updatedSummary,
        userId: booking.userId,
        paymentIntentId: booking.paymentIntentId,
        refundAmountCents: refundComputation.refundCents,
        snapshotTimezone: booking.snapshotTimezone,
      };
    });

    if (!result.ok) return result.error;

    if (result.paymentIntentId && result.refundAmountCents > 0) {
      try {
        await refundBookingPayment({
          bookingId: result.booking.id,
          paymentIntentId: result.paymentIntentId,
          reason: "NO_SHOW_REFUND",
          amountCents: result.refundAmountCents,
        });
      } catch (refundErr) {
        console.error("[organizacao/no-show] refund failed", refundErr);
        return errorWithCtx(502, "No-show registado, mas o reembolso falhou.", "BOOKING_REFUND_FAILED");
      }
    }

    if (result.userId) {
      const shouldSend = await shouldNotify(result.userId, "SYSTEM_ANNOUNCE");
      if (shouldSend) {
        await createNotification({
          userId: result.userId,
          type: "SYSTEM_ANNOUNCE",
          title: "Reserva marcada como no-show",
          body: "A tua reserva foi marcada como não compareceu.",
          ctaUrl: "/me/reservas",
          ctaLabel: "Ver reservas",
          organizationId: organization.id,
        });
      }
    }

    return jsonWrap({
      ok: true,
      booking: result.booking,
      snapshotTimezone: result.snapshotTimezone,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return errorWithCtx(401, "Não autenticado.", "UNAUTHENTICATED");
    }
    console.error("POST /api/organizacao/reservas/[id]/no-show error:", err);
    return errorWithCtx(500, "Erro ao atualizar reserva.", "BOOKING_NO_SHOW_FAILED");
  }
}
export const POST = withApiEnvelope(_POST);
