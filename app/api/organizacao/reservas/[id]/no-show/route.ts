import { NextRequest } from "next/server";
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
import { respondError, respondOk } from "@/lib/http/envelope";
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  type NoShowTxnResult =
    | { error: Response }
    | {
        booking: { id: number; status: string };
        userId: string | null;
        paymentIntentId: string | null;
        refundAmountCents: number;
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

    const { ip, userAgent } = getRequestMeta(req);
    const now = new Date();

    const result = await prisma.$transaction<NoShowTxnResult>(async (tx) => {
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
        return { error: fail(404, "BOOKING_NOT_FOUND", "Reserva não encontrada.") };
      }
      if (
        membership.role === OrganizationMemberRole.STAFF &&
        (!booking.professional?.userId || booking.professional.userId !== profile.id)
      ) {
        return { error: fail(403, "FORBIDDEN", "Sem permissões.") };
      }
      if (
        ["CANCELLED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG", "COMPLETED", "DISPUTED", "NO_SHOW"].includes(
          booking.status,
        )
      ) {
        return { error: fail(409, "BOOKING_ALREADY_CLOSED", "Reserva já encerrada.") };
      }

      if (booking.startsAt > now) {
        return { error: fail(409, "BOOKING_NOT_STARTED", "Reserva ainda não ocorreu.") };
      }

      const snapshot = parseBookingConfirmationSnapshot(booking.confirmationSnapshot);
      if (!snapshot) {
        return {
          error: fail(
            409,
            "BOOKING_CONFIRMATION_SNAPSHOT_REQUIRED",
            "Reserva sem snapshot. Corre o backfill antes de marcar no-show.",
            false,
            { bookingId: booking.id },
          ),
        };
      }

      const refundComputation = computeNoShowRefundFromSnapshot(snapshot);
      if (!refundComputation) {
        return {
          error: fail(
            409,
            "BOOKING_CONFIRMATION_SNAPSHOT_INVALID",
            "Snapshot inválido. Corre o backfill antes de marcar no-show.",
            false,
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
        booking: { id: updated.id, status: updated.status },
        userId: booking.userId,
        paymentIntentId: booking.paymentIntentId,
        refundAmountCents: refundComputation.refundCents,
        snapshotTimezone: booking.snapshotTimezone,
      };
    });

    if ("error" in result) return result.error;

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
        return fail(
          502,
          "BOOKING_REFUND_FAILED",
          "No-show registado, mas o reembolso falhou.",
          true,
        );
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

    return respondOk(ctx, {
      booking: result.booking,
      snapshotTimezone: result.snapshotTimezone,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "UNAUTHENTICATED", "Não autenticado.");
    }
    console.error("POST /api/organizacao/reservas/[id]/no-show error:", err);
    return fail(500, "BOOKING_NO_SHOW_FAILED", "Erro ao atualizar reserva.", true);
  }
}
