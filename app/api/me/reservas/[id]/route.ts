import { NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { retrievePaymentIntent } from "@/domain/finance/gateway/stripeGateway";
import { fulfillServiceBookingIntent } from "@/lib/operations/fulfillServiceBooking";
import { confirmPendingBooking } from "@/lib/reservas/confirmBooking";

function parseId(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const PENDING_BOOKING_STATUSES = new Set(["PENDING", "PENDING_CONFIRMATION"]);
const BOOKING_SELECT = {
  id: true,
  status: true,
  startsAt: true,
  pendingExpiresAt: true,
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

    // Fallback de consistência: em dev/test pode haver sucesso no PaymentSheet sem webhook
    // local ativo. Se o PI já estiver succeeded, tentamos concluir a reserva aqui.
    if (
      booking.paymentIntentId &&
      PENDING_BOOKING_STATUSES.has(booking.status)
    ) {
      try {
        const intent = await retrievePaymentIntent(booking.paymentIntentId, {
          expand: ["latest_charge"],
        });
        if (intent.status === "succeeded") {
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

          let refreshed = await prisma.booking.findFirst({
            where: { id: bookingId, userId: user.id },
            select: BOOKING_SELECT,
          });

          if (refreshed && PENDING_BOOKING_STATUSES.has(refreshed.status)) {
            const fallbackBookingId = refreshed.id;
            try {
              await prisma.$transaction(async (tx) => {
                const result = await confirmPendingBooking({
                  tx,
                  bookingId: fallbackBookingId,
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
            refreshed = await prisma.booking.findFirst({
              where: { id: bookingId, userId: user.id },
              select: BOOKING_SELECT,
            });
          }

          if (refreshed) booking = refreshed;
        }
      } catch (reconcileErr) {
        console.warn(
          "GET /api/me/reservas/[id] reconcile failed:",
          reconcileErr,
        );
      }
    }

    return jsonWrap({ ok: true, booking });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("GET /api/me/reservas/[id] error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar reserva." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
