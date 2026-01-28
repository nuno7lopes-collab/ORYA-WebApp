import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { decideCancellation } from "@/lib/bookingCancellation";
import { refundBookingPayment } from "@/lib/reservas/bookingRefund";
import { cancelBooking } from "@/domain/bookings/commands";
import { getRequestContext } from "@/lib/http/requestContext";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  computeCancellationRefundFromSnapshot,
  getSnapshotCancellationWindowMinutes,
  parseBookingConfirmationSnapshot,
} from "@/lib/reservas/confirmationSnapshot";

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
    | { ok: false; error: Response }
    | {
        ok: true;
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
    const payload = await req.json().catch(() => ({}));
    const reason = typeof payload?.reason === "string" ? payload.reason.trim().slice(0, 200) : null;
    const { ip, userAgent } = getRequestMeta(req);
    const now = new Date();

    const result = await prisma.$transaction<CancelTxnResult>(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
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
        },
      });

      if (!booking) {
        return { ok: false, error: errorWithCtx(404, "Reserva não encontrada.", "BOOKING_NOT_FOUND") };
      }

      if (booking.userId !== user.id) {
        return { ok: false, error: errorWithCtx(403, "Sem permissões.", "FORBIDDEN") };
      }

      if (["CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG", "CANCELLED"].includes(booking.status)) {
        return {
          ok: true,
          booking: { id: booking.id, status: booking.status },
          already: true,
          refundRequired: false,
          paymentIntentId: booking.paymentIntentId,
          refundAmountCents: null,
          snapshotTimezone: booking.snapshotTimezone,
        };
      }

      const isPending = ["PENDING_CONFIRMATION", "PENDING"].includes(booking.status);
      const snapshot = parseBookingConfirmationSnapshot(booking.confirmationSnapshot);
      if (!isPending && booking.status === "CONFIRMED" && !snapshot) {
        return {
          ok: false,
          error: errorWithCtx(
            409,
            "Reserva confirmada sem snapshot. Corre o backfill antes de cancelar.",
            "BOOKING_CONFIRMATION_SNAPSHOT_REQUIRED",
            { bookingId: booking.id },
          ),
        };
      }

      const cancellationWindowMinutes = snapshot
        ? getSnapshotCancellationWindowMinutes(snapshot)
        : null;

      const decision = decideCancellation(
        booking.startsAt,
        isPending ? null : cancellationWindowMinutes,
        now,
      );
      const canCancel = isPending || (booking.status === "CONFIRMED" && decision.allowed);

      if (!canCancel) {
        return {
          ok: false,
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
        actorUserId: user.id,
        data: { status: "CANCELLED_BY_CLIENT" },
      });
      const updatedSummary = { id: updated.id, status: updated.status };

      const refundRequired =
        !!booking.paymentIntentId &&
        (isPending || (booking.status === "CONFIRMED" && decision.allowed));
      const refundComputation = snapshot ? computeCancellationRefundFromSnapshot(snapshot) : null;
      const refundAmountCents = refundComputation?.refundCents ?? null;

      await recordOrganizationAudit(tx, {
        organizationId: booking.organizationId,
        actorUserId: user.id,
        action: "BOOKING_CANCELLED",
        metadata: {
          bookingId: booking.id,
          serviceId: booking.serviceId,
          availabilityId: booking.availabilityId,
          source: "USER",
          reason,
          deadline: decision.deadline?.toISOString() ?? null,
          refundRequired,
          refundAmountCents,
          snapshotVersion: snapshot?.version ?? null,
          snapshotTimezone: booking.snapshotTimezone,
        },
        ip,
        userAgent,
      });

      return {
        ok: true,
        booking: updatedSummary,
        already: false,
        refundRequired,
        paymentIntentId: booking.paymentIntentId,
        refundAmountCents,
        snapshotTimezone: booking.snapshotTimezone,
      };
    });

    if (!result.ok) return result.error;

    if (result.refundRequired && result.paymentIntentId) {
      try {
        await refundBookingPayment({
          bookingId: result.booking.id,
          paymentIntentId: result.paymentIntentId,
          reason: "CLIENT_CANCEL",
          amountCents: result.refundAmountCents,
        });
      } catch (refundErr) {
        console.error("[reservas/cancel] refund failed", refundErr);
        return errorWithCtx(502, "Reserva cancelada, mas o reembolso falhou.", "BOOKING_REFUND_FAILED");
      }
    }

    return jsonWrap({
      ok: true,
      booking: {
        id: result.booking.id,
        status: result.booking.status,
      },
      alreadyCancelled: result.already,
      snapshotTimezone: result.snapshotTimezone,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return errorWithCtx(401, "Não autenticado.", "UNAUTHENTICATED");
    }
    console.error("POST /api/me/reservas/[id]/cancel error:", err);
    return errorWithCtx(500, "Erro ao cancelar reserva.", "BOOKING_CANCEL_FAILED");
  }
}
export const POST = withApiEnvelope(_POST);
