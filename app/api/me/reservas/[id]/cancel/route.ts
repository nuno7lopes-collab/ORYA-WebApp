import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { decideCancellation } from "@/lib/bookingCancellation";
import { refundBookingPayment } from "@/lib/reservas/bookingRefund";
import { cancelBooking } from "@/domain/bookings/commands";

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
  if (!bookingId) {
    return NextResponse.json({ ok: false, error: "ID inválido." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const payload = await req.json().catch(() => ({}));
    const reason = typeof payload?.reason === "string" ? payload.reason.trim().slice(0, 200) : null;
    const { ip, userAgent } = getRequestMeta(req);
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          service: {
            select: {
              id: true,
              organizationId: true,
              policyId: true,
              policy: {
                select: {
                  id: true,
                  cancellationWindowMinutes: true,
                },
              },
            },
          },
          policyRef: {
            select: {
              policy: {
                select: {
                  id: true,
                  cancellationWindowMinutes: true,
                },
              },
            },
          },
        },
      });

      if (!booking) {
        return { error: NextResponse.json({ ok: false, error: "Reserva não encontrada." }, { status: 404 }) };
      }

      if (booking.userId !== user.id) {
        return { error: NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 }) };
      }

      if (["CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG", "CANCELLED"].includes(booking.status)) {
        return { booking, already: true };
      }

      const isPending = ["PENDING_CONFIRMATION", "PENDING"].includes(booking.status);
      const fallbackPolicy =
        booking.service?.policyId &&
        (await tx.organizationPolicy.findFirst({
          where: { id: booking.service.policyId, organizationId: booking.organizationId },
          select: { id: true, cancellationWindowMinutes: true },
        }));
      const policy =
        booking.policyRef?.policy ??
        booking.service?.policy ??
        fallbackPolicy ??
        (await tx.organizationPolicy.findFirst({
          where: { organizationId: booking.organizationId, policyType: "MODERATE" },
          select: { id: true, cancellationWindowMinutes: true },
        })) ??
        (await tx.organizationPolicy.findFirst({
          where: { organizationId: booking.organizationId },
          orderBy: { createdAt: "asc" },
          select: { id: true, cancellationWindowMinutes: true },
        }));

      const decision = decideCancellation(
        booking.startsAt,
        policy?.cancellationWindowMinutes ?? null,
        now,
      );
      const canCancel = isPending || (booking.status === "CONFIRMED" && decision.allowed);

      if (!canCancel) {
        return { error: NextResponse.json({ ok: false, error: "O prazo de cancelamento já passou." }, { status: 400 }) };
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
        (isPending || (booking.status === "CONFIRMED" && decision.allowed));

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
        },
        ip,
        userAgent,
      });

      return { booking: updated, already: false, refundRequired, paymentIntentId: booking.paymentIntentId };
    });

    if ("error" in result) return result.error;

    if (result.refundRequired && result.paymentIntentId) {
      try {
        await refundBookingPayment({
          bookingId: result.booking.id,
          paymentIntentId: result.paymentIntentId,
          reason: "CLIENT_CANCEL",
        });
      } catch (refundErr) {
        console.error("[reservas/cancel] refund failed", refundErr);
        return NextResponse.json({ ok: false, error: "Reserva cancelada, mas o reembolso falhou." }, { status: 502 });
      }
    }

    return NextResponse.json({
      ok: true,
      booking: {
        id: result.booking.id,
        status: result.booking.status,
      },
      alreadyCancelled: result.already,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("POST /api/me/reservas/[id]/cancel error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao cancelar reserva." }, { status: 500 });
  }
}
