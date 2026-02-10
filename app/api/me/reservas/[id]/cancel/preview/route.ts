import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { decideCancellation } from "@/lib/bookingCancellation";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import {
  computeCancellationRefundFromSnapshot,
  getSnapshotAllowCancellation,
  getSnapshotCancellationWindowMinutes,
  parseBookingConfirmationSnapshot,
} from "@/lib/reservas/confirmationSnapshot";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { normalizeEmail } from "@/lib/utils/email";

function parseId(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = getRequestContext(req);
  const fail = (status: number, errorCode: string, message: string, details?: Record<string, unknown>) =>
    respondError(
      ctx,
      { errorCode, message, retryable: status >= 500, ...(details ? { details } : {}) },
      { status },
    );

  const resolved = await params;
  const bookingId = parseId(resolved.id);
  if (!bookingId) {
    return fail(400, "BOOKING_ID_INVALID", "ID inválido.");
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        userId: true,
        guestEmail: true,
        status: true,
        startsAt: true,
        paymentIntentId: true,
        snapshotTimezone: true,
        confirmationSnapshot: true,
      },
    });

    if (!booking) {
      return fail(404, "BOOKING_NOT_FOUND", "Reserva não encontrada.");
    }
    const normalizedEmail = normalizeEmail(user.email ?? "");
    const isOwner =
      booking.userId === user.id ||
      (!booking.userId && booking.guestEmail && normalizedEmail && booking.guestEmail === normalizedEmail);
    if (!isOwner) {
      return fail(403, "FORBIDDEN", "Sem permissões.");
    }

    const { status } = booking;
    const isPending = status === "PENDING_CONFIRMATION" || status === "PENDING";
    const snapshot = parseBookingConfirmationSnapshot(booking.confirmationSnapshot);
    if (!isPending && status === "CONFIRMED" && !snapshot) {
      return fail(
        409,
        "BOOKING_CONFIRMATION_SNAPSHOT_REQUIRED",
        "Reserva confirmada sem snapshot. Corre o backfill antes de cancelar.",
        { bookingId: booking.id },
      );
    }

    const now = new Date();
    const cancellationWindowMinutes = snapshot ? getSnapshotCancellationWindowMinutes(snapshot) : null;
    const allowCancellation = snapshot ? getSnapshotAllowCancellation(snapshot) : true;
    const decision = decideCancellation(booking.startsAt, isPending ? null : cancellationWindowMinutes, now);
    const allowed = isPending || (status === "CONFIRMED" && allowCancellation && decision.allowed);

    if (!allowed) {
      return respondOk(ctx, {
        allowed: false,
        reason: decision.reason ?? "POLICY_BLOCKED",
        deadline: decision.deadline?.toISOString() ?? null,
        refund: null,
        snapshotTimezone: booking.snapshotTimezone,
      });
    }

    const paymentEvent =
      booking.paymentIntentId
        ? await prisma.paymentEvent.findFirst({
            where: { stripePaymentIntentId: booking.paymentIntentId },
            select: { purchaseId: true },
          })
        : null;
    const payment =
      paymentEvent?.purchaseId
        ? await prisma.payment.findUnique({
            where: { id: paymentEvent.purchaseId },
            select: { processorFeesActual: true },
          })
        : null;
    const refund = snapshot
      ? computeCancellationRefundFromSnapshot(snapshot, {
          actor: "CLIENT",
          stripeFeeCentsActual: payment?.processorFeesActual ?? null,
        })
      : null;

    return respondOk(ctx, {
      allowed: true,
      reason: null,
      deadline: decision.deadline?.toISOString() ?? null,
      refund,
      snapshotTimezone: booking.snapshotTimezone,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "UNAUTHENTICATED", "Não autenticado.");
    }
    console.error("POST /api/me/reservas/[id]/cancel/preview error:", err);
    return fail(500, "BOOKING_CANCEL_PREVIEW_FAILED", "Erro ao preparar cancelamento.");
  }
}

export const POST = withApiEnvelope(_POST);
