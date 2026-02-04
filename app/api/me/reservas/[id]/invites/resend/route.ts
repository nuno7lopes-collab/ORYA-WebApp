import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { queueBookingInviteEmail } from "@/domain/notifications/email";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { isBookingConfirmed } from "@/lib/reservas/bookingState";

function parseId(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => respondError(ctx, { errorCode, message, retryable }, { status });

  const resolved = await params;
  const bookingId = parseId(resolved.id);
  if (!bookingId) {
    return fail(400, "Reserva inválida.");
  }

  try {
    const payload = await req.json().catch(() => ({}));
    const inviteId = parseId(String(payload?.inviteId ?? ""));
    if (!inviteId) {
      return fail(422, "Convite inválido.");
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        status: true,
        startsAt: true,
        snapshotTimezone: true,
        service: { select: { title: true } },
        organization: { select: { publicName: true, businessName: true } },
      },
    });
    if (!booking) {
      return fail(404, "Reserva não encontrada.");
    }
    if (booking.userId !== user.id) {
      return fail(403, "Sem permissões.");
    }
    if (!isBookingConfirmed(booking)) {
      const split = await prisma.bookingSplit.findUnique({
        where: { bookingId },
        select: { status: true },
      });
      if (!split || split.status !== "OPEN") {
        return fail(409, "Só podes reenviar convites em reservas confirmadas.");
      }
    }

    const invite = await prisma.bookingInvite.findFirst({
      where: { id: inviteId, bookingId },
      select: {
        id: true,
        token: true,
        status: true,
        targetName: true,
        targetContact: true,
        message: true,
      },
    });
    if (!invite) {
      return fail(404, "Convite não encontrado.");
    }
    if (invite.status !== "PENDING") {
      return fail(409, "Só podes reenviar convites pendentes.");
    }
    if (!invite.targetContact || !invite.targetContact.includes("@")) {
      return fail(422, "Este convite não tem email associado.");
    }

    const inviterProfile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { fullName: true, username: true },
    });

    const baseUrl = getAppBaseUrl().replace(/\/+$/, "");
    const serviceTitle = booking.service?.title || "Serviço";
    const organizationName =
      booking.organization?.publicName || booking.organization?.businessName || "Organização";
    const inviterName = inviterProfile?.fullName || inviterProfile?.username || null;

    await queueBookingInviteEmail({
      dedupeKey: `booking_invite_resend:${invite.id}:${Date.now()}`,
      recipient: invite.targetContact,
      bookingId: booking.id,
      organizationId: booking.organizationId,
      serviceTitle,
      organizationName,
      startsAt: booking.startsAt,
      timeZone: booking.snapshotTimezone,
      inviteUrl: `${baseUrl}/convites/${invite.token}`,
      inviterName,
      guestName: invite.targetName ?? null,
      message: invite.message ?? null,
    });

    await prisma.bookingInvite.update({
      where: { id: invite.id },
      data: { updatedAt: new Date() },
    });

    await recordOrganizationAudit(prisma, {
      organizationId: booking.organizationId,
      actorUserId: user.id,
      action: "BOOKING_INVITE_RESENT",
      metadata: { bookingId, inviteId: invite.id },
    });

    return respondOk(ctx, { status: "resent" }, { status: 200 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("POST /api/me/reservas/[id]/invites/resend error:", err);
    return fail(500, "Erro ao reenviar convite.");
  }
}

export const POST = withApiEnvelope(_POST);
