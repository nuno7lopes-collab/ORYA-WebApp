import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { BookingInviteStatus } from "@prisma/client";
import { queueImportantUpdateEmail } from "@/domain/notifications/email";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { getBookingState, isBookingConfirmed } from "@/lib/reservas/bookingState";

function errorCodeForStatus(status: number) {
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}

function parseResponse(value: unknown): BookingInviteStatus | null {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (["ACCEPT", "ACCEPTED", "YES", "SIM"].includes(normalized)) return BookingInviteStatus.ACCEPTED;
  if (["DECLINE", "DECLINED", "NO", "NAO", "NÃO"].includes(normalized)) return BookingInviteStatus.DECLINED;
  return null;
}

async function _GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => respondError(ctx, { errorCode, message, retryable }, { status });

  const resolved = await params;
  const token = resolved.token?.trim();
  if (!token) {
    return fail(404, "Convite inválido.");
  }

  try {
    const invite = await prisma.bookingInvite.findUnique({
      where: { token },
      select: {
        id: true,
        token: true,
        targetName: true,
        targetContact: true,
        message: true,
        status: true,
        respondedAt: true,
        createdAt: true,
        booking: {
          select: {
            id: true,
            startsAt: true,
            durationMinutes: true,
            status: true,
            addressRef: { select: { formattedAddress: true } },
            snapshotTimezone: true,
            service: { select: { id: true, title: true, addressRef: { select: { formattedAddress: true } } } },
            organization: {
              select: {
                id: true,
                publicName: true,
                businessName: true,
                username: true,
                brandingAvatarUrl: true,
                addressRef: { select: { formattedAddress: true } },
              },
            },
            splitPayment: {
              select: {
                id: true,
                status: true,
                pricingMode: true,
                currency: true,
                totalCents: true,
                shareCents: true,
                deadlineAt: true,
                participants: {
                  select: {
                    id: true,
                    inviteId: true,
                    status: true,
                    baseShareCents: true,
                    shareCents: true,
                    platformFeeCents: true,
                    paidAt: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!invite || !invite.booking) {
      return fail(404, "Convite não encontrado.");
    }

    const split = invite.booking.splitPayment;
    const participant =
      split?.participants?.find((item) => item.inviteId === invite.id) ?? null;

    return respondOk(ctx, {
      invite: {
        id: invite.id,
        token: invite.token,
        targetName: invite.targetName,
        targetContact: invite.targetContact,
        message: invite.message,
        status: invite.status,
        respondedAt: invite.respondedAt,
      },
      booking: {
        id: invite.booking.id,
        startsAt: invite.booking.startsAt,
        durationMinutes: invite.booking.durationMinutes,
        status: getBookingState(invite.booking),
        locationFormattedAddress:
          invite.booking.addressRef?.formattedAddress ??
          invite.booking.service?.addressRef?.formattedAddress ??
          invite.booking.organization?.addressRef?.formattedAddress ??
          null,
        snapshotTimezone: invite.booking.snapshotTimezone,
      },
      service: invite.booking.service,
      organization: invite.booking.organization,
      split: split
        ? {
            id: split.id,
            status: split.status,
            pricingMode: split.pricingMode,
            currency: split.currency,
            totalCents: split.totalCents,
            shareCents: split.shareCents,
            deadlineAt: split.deadlineAt,
            participant,
          }
        : null,
    });
  } catch (err) {
    console.error("GET /api/convites/[token] error:", err);
    return fail(500, "Erro ao carregar convite.");
  }
}

async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => respondError(ctx, { errorCode, message, retryable }, { status });

  const resolved = await params;
  const token = resolved.token?.trim();
  if (!token) {
    return fail(404, "Convite inválido.");
  }

  try {
    const payload = await req.json().catch(() => ({}));
    const response = parseResponse(payload?.response ?? payload?.status);
    if (!response) {
      return fail(400, "Resposta inválida.");
    }

    const invite = await prisma.bookingInvite.findUnique({
      where: { token },
      select: {
        id: true,
        status: true,
        bookingId: true,
        targetName: true,
        targetContact: true,
        booking: {
          select: {
            id: true,
            status: true,
            startsAt: true,
            snapshotTimezone: true,
            service: { select: { title: true } },
            organization: {
              select: {
                id: true,
                publicName: true,
                businessName: true,
                officialEmail: true,
                officialEmailVerifiedAt: true,
              },
            },
            splitPayment: {
              select: {
                status: true,
                deadlineAt: true,
              },
            },
          },
        },
      },
    });

    if (!invite || !invite.booking) {
      return fail(404, "Convite não encontrado.");
    }
    if (!isBookingConfirmed(invite.booking)) {
      const split = invite.booking.splitPayment;
      if (!split || split.status !== "OPEN") {
        return fail(409, "Esta reserva já não está confirmada.");
      }
      if (split.deadlineAt && split.deadlineAt < new Date()) {
        return fail(409, "O prazo para responder expirou.");
      }
    }

    if (invite.status === response) {
      return respondOk(ctx, { status: invite.status });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedInvite = await tx.bookingInvite.update({
        where: { id: invite.id },
        data: {
          status: response,
          respondedAt: new Date(),
        },
        select: {
          id: true,
          status: true,
          respondedAt: true,
        },
      });

      if (response === BookingInviteStatus.ACCEPTED) {
        await tx.bookingParticipant.upsert({
          where: { inviteId: invite.id },
          update: {
            status: "CONFIRMED",
            name: invite.targetName ?? null,
            contact: invite.targetContact ?? null,
          },
          create: {
            bookingId: invite.bookingId,
            inviteId: invite.id,
            name: invite.targetName ?? null,
            contact: invite.targetContact ?? null,
            status: "CONFIRMED",
          },
        });
        await tx.bookingSplitParticipant.updateMany({
          where: { inviteId: invite.id, status: { not: "PAID" } },
          data: { status: "PENDING" },
        });
      } else if (response === BookingInviteStatus.DECLINED) {
        await tx.bookingParticipant.deleteMany({ where: { inviteId: invite.id } });
        await tx.bookingSplitParticipant.updateMany({
          where: { inviteId: invite.id, status: { not: "PAID" } },
          data: { status: "CANCELLED" },
        });
      }

      return updatedInvite;
    });

    const organization = invite.booking.organization;
    const officialEmail =
      organization?.officialEmailVerifiedAt && organization.officialEmail
        ? organization.officialEmail
        : null;
    if (officialEmail) {
      const orgName = organization.publicName || organization.businessName || "Organização";
      const serviceTitle = invite.booking.service?.title || "Serviço";
      const guestLabel = invite.targetName || invite.targetContact || "Convidado";
      const responseLabel = response === BookingInviteStatus.ACCEPTED ? "aceitou" : "recusou";
      const message = `${guestLabel} ${responseLabel} o convite para ${serviceTitle}.`;
      const ticketUrl = `${getAppBaseUrl().replace(/\/+$/, "")}/organizacao/reservas`;
      await queueImportantUpdateEmail({
        dedupeKey: `booking_invite_response:${invite.id}:${response}`,
        recipient: officialEmail,
        eventTitle: orgName,
        message,
        ticketUrl,
        correlations: {
          organizationId: organization.id,
        },
      });
    }

    return respondOk(ctx, { status: updated.status, respondedAt: updated.respondedAt });
  } catch (err) {
    console.error("POST /api/convites/[token] error:", err);
    return fail(500, "Erro ao responder convite.");
  }
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
