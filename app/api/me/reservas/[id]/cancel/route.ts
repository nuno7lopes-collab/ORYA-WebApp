import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { decideCancellation } from "@/lib/bookingCancellation";
import { refundBookingPayment } from "@/lib/reservas/bookingRefund";
import { cancelBooking } from "@/domain/bookings/commands";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import {
  computeCancellationRefundFromSnapshot,
  getSnapshotCancellationWindowMinutes,
  getSnapshotAllowCancellation,
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
        return { error: fail(404, "BOOKING_NOT_FOUND", "Reserva não encontrada.") };
      }

      if (booking.userId !== user.id) {
        return { error: fail(403, "FORBIDDEN", "Sem permissões.") };
      }

      if (["CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG", "CANCELLED"].includes(booking.status)) {
        return {
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
          error: fail(
            409,
            "BOOKING_CONFIRMATION_SNAPSHOT_REQUIRED",
            "Reserva confirmada sem snapshot. Corre o backfill antes de cancelar.",
            false,
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
      const allowCancellation = snapshot ? getSnapshotAllowCancellation(snapshot) : true;
      const canCancel =
        isPending || (booking.status === "CONFIRMED" && allowCancellation && decision.allowed);

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
        actorUserId: user.id,
        data: { status: "CANCELLED_BY_CLIENT" },
      });

      const refundRequired =
        !!booking.paymentIntentId &&
        (isPending || (booking.status === "CONFIRMED" && allowCancellation && decision.allowed));
      const txAny = tx as any;
      const stripeFeeRow =
        booking.paymentIntentId && txAny?.transaction?.findFirst
          ? await txAny.transaction.findFirst({
              where: { stripePaymentIntentId: booking.paymentIntentId },
              select: { stripeFeeCents: true },
            })
          : null;
      const refundComputation = snapshot
        ? computeCancellationRefundFromSnapshot(snapshot, {
            actor: "CLIENT",
            stripeFeeCentsActual: stripeFeeRow?.stripeFeeCents ?? null,
          })
        : null;
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
        booking: { id: updated.id, status: updated.status },
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
          reason: "CLIENT_CANCEL",
          amountCents: result.refundAmountCents,
        });
      } catch (refundErr) {
        console.error("[reservas/cancel] refund failed", refundErr);
        return fail(
          502,
          "BOOKING_REFUND_FAILED",
          "Reserva cancelada, mas o reembolso falhou.",
          true,
        );
      }
    }

    return respondOk(ctx, {
      booking: {
        id: result.booking.id,
        status: result.booking.status,
      },
      alreadyCancelled: result.already,
      snapshotTimezone: result.snapshotTimezone,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "UNAUTHENTICATED", "Não autenticado.");
    }
    console.error("POST /api/me/reservas/[id]/cancel error:", err);
    return fail(500, "BOOKING_CANCEL_FAILED", "Erro ao cancelar reserva.", true);
  }
}
