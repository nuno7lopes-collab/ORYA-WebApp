import { NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { retrievePaymentIntent } from "@/domain/finance/gateway/stripeGateway";
import { fulfillServiceBookingIntent } from "@/lib/operations/fulfillServiceBooking";
import { confirmPendingBooking } from "@/lib/reservas/confirmBooking";
import { attachBookingPaymentIntentIfMissing } from "@/domain/bookings/commands";
import { PaymentStatus, SourceType } from "@prisma/client";
import {
  PENDING_BOOKING_STATUSES,
  resolvePendingBookingState,
} from "@/lib/reservas/pendingBookingState";

function parseId(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isPendingState(status: string | null | undefined) {
  return typeof status === "string" && PENDING_BOOKING_STATUSES.includes(status as any);
}

function resolveEffectiveState(status: string, pendingState: "NONE" | "ACTIVE" | "EXPIRED" | "PAST_START") {
  if (pendingState === "EXPIRED" || pendingState === "PAST_START") return "CANCELLED_BY_CLIENT";
  return status;
}

const BOOKING_SELECT = {
  id: true,
  organizationId: true,
  status: true,
  startsAt: true,
  durationMinutes: true,
  professionalId: true,
  resourceId: true,
  pendingExpiresAt: true,
  createdAt: true,
  paymentIntentId: true,
} as const;

async function _GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const bookingId = parseId(resolved.id);
  if (!bookingId) {
    return jsonWrap({ ok: false, error: "ID inválido." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    let booking = await prisma.booking.findFirst({
      where: { id: bookingId, userId: user.id },
      select: BOOKING_SELECT,
    });

    if (!booking) {
      return jsonWrap({ ok: false, error: "Reserva não encontrada." }, { status: 404 });
    }
    const bookingRecordId = booking.id;

    // Fallback de consistência: em dev/test pode haver sucesso no PaymentSheet sem webhook
    // local ativo. Se o PI (ou ledger) já estiver em estado pago, tentamos concluir a reserva aqui.
    const currentStatus = booking["status"];
    if (isPendingState(currentStatus)) {
      try {
        const latestBookingPayment = await prisma.payment.findFirst({
          where: {
            sourceType: SourceType.BOOKING,
            sourceId: String(booking.id),
          },
          orderBy: { updatedAt: "desc" },
          select: { id: true, status: true },
        });
        const paidInLedger =
          latestBookingPayment?.status === PaymentStatus.SUCCEEDED;
        let candidatePaymentIntentId = booking.paymentIntentId ?? null;
        if (!candidatePaymentIntentId) {
          const eventOr: Array<{ purchaseId: string | { startsWith: string } }> = [
            { purchaseId: { startsWith: `booking_${booking.id}_v` } },
          ];
          if (latestBookingPayment?.id) {
            eventOr.unshift({ purchaseId: latestBookingPayment.id });
          }
          const latestEvent = await prisma.paymentEvent.findFirst({
            where: {
              OR: eventOr,
              stripePaymentIntentId: { not: null },
            },
            orderBy: { updatedAt: "desc" },
            select: { stripePaymentIntentId: true },
          });
          candidatePaymentIntentId = latestEvent?.stripePaymentIntentId ?? null;
        }

        let paymentIntentSucceeded = false;
        if (candidatePaymentIntentId) {
          const intent = await retrievePaymentIntent(candidatePaymentIntentId, {
            expand: ["latest_charge"],
          });
          paymentIntentSucceeded = intent.status === "succeeded";
          if (paymentIntentSucceeded) {
            if (!booking.paymentIntentId) {
              await attachBookingPaymentIntentIfMissing({
                bookingId: booking.id,
                paymentIntentId: intent.id,
              });
            }
            try {
              await fulfillServiceBookingIntent(intent);
            } catch (fulfillErr) {
              // Mantém a rota resiliente: se o fulfillment completo falhar,
              // tentamos uma confirmação mínima e idempotente da reserva.
              console.warn(
                "GET /api/me/reservas/[id] fulfill failed, trying fallback confirm:",
                fulfillErr,
              );
            }
          }
        }

        if (paidInLedger || paymentIntentSucceeded) {
          try {
            await prisma.$transaction(async (tx) => {
              const result = await confirmPendingBooking({
                tx,
                bookingId: bookingRecordId,
                now: new Date(),
                ignoreExpiry: true,
                paymentMeta: null,
              });
              if (!result.ok && result.code !== "INVALID_STATUS") {
                throw new Error(`BOOKING_CONFIRM_FALLBACK_FAILED:${result.code}`);
              }
            });
          } catch (fallbackErr) {
            console.warn(
              "GET /api/me/reservas/[id] fallback confirm failed:",
              fallbackErr,
            );
          }

          const refreshed = await prisma.booking.findFirst({
            where: { id: bookingId, userId: user.id },
            select: BOOKING_SELECT,
          });
          if (refreshed) booking = refreshed;
        }
      } catch (reconcileErr) {
        console.warn(
          "GET /api/me/reservas/[id] reconcile failed:",
          reconcileErr,
        );
      }
    }

    const pendingState = resolvePendingBookingState({
      status: booking["status"],
      startsAt: booking.startsAt,
      pendingExpiresAt: booking.pendingExpiresAt,
      createdAt: booking.createdAt,
      now: new Date(),
    });
    const isStalePending = pendingState === "EXPIRED" || pendingState === "PAST_START";
    const effectiveStatus = resolveEffectiveState(booking["status"], pendingState);
    if (isStalePending && isPendingState(booking["status"])) {
      await prisma.booking.updateMany({
        where: {
          id: booking.id,
          status: { in: [...PENDING_BOOKING_STATUSES] as any },
        },
        data: { status: "CANCELLED_BY_CLIENT" },
      });
      await prisma.academyEnrollment.updateMany({
        where: {
          bookingId: booking.id,
          organizationId: booking.organizationId,
          status: { in: ["PENDING", "CONFIRMED"] },
        },
        data: {
          status: "CANCELLED",
          holdExpiresAt: null,
        },
      });
    }

    return jsonWrap({
      ok: true,
      booking: {
        ...booking,
        status: isStalePending ? effectiveStatus : booking["status"],
        effectiveStatus,
        pendingState,
      },
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("GET /api/me/reservas/[id] error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar reserva." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
