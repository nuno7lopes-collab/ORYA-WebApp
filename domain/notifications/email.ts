import { prisma } from "@/lib/prisma";
import { enqueueOperation } from "@/lib/operations/enqueue";

type ImportantUpdateEmailParams = {
  dedupeKey: string;
  userId?: string | null;
  recipient?: string | null;
  eventTitle: string;
  message: string;
  ticketUrl?: string | null;
  purchaseId?: string | null;
  correlations?: {
    eventId?: number | null;
    organizationId?: number | null;
    pairingId?: number | null;
  };
};

export async function queueImportantUpdateEmail(params: ImportantUpdateEmailParams) {
  const recipient =
    typeof params.recipient === "string" && params.recipient.trim()
      ? params.recipient.trim()
      : params.userId
        ? await resolveEmailForUser(params.userId)
        : null;
  if (!recipient) return { ok: false, code: "EMAIL_NOT_FOUND" as const };

  const purchaseId = params.purchaseId ?? params.dedupeKey;
  await enqueueOperation({
    operationType: "SEND_EMAIL_OUTBOX",
    dedupeKey: params.dedupeKey,
    payload: {
      templateKey: "IMPORTANT_UPDATE",
      recipient,
      purchaseId,
      dedupeKey: params.dedupeKey,
      payload: {
        eventTitle: params.eventTitle,
        message: params.message,
        ticketUrl: params.ticketUrl ?? null,
      },
    },
    correlations: {
      purchaseId,
      eventId: params.correlations?.eventId ?? null,
      organizationId: params.correlations?.organizationId ?? null,
      pairingId: params.correlations?.pairingId ?? null,
    },
  });

  return { ok: true as const, recipient };
}

type BookingInviteEmailParams = {
  dedupeKey: string;
  recipient: string;
  bookingId: number;
  organizationId?: number | null;
  serviceTitle: string;
  organizationName: string;
  startsAt: Date | string;
  timeZone?: string | null;
  inviteUrl: string;
  inviterName?: string | null;
  guestName?: string | null;
  message?: string | null;
};

export async function queueBookingInviteEmail(params: BookingInviteEmailParams) {
  const recipient = params.recipient?.trim();
  if (!recipient) return { ok: false as const, code: "EMAIL_NOT_FOUND" as const };
  const purchaseId = `booking:${params.bookingId}`;
  const startsAt =
    params.startsAt instanceof Date
      ? params.startsAt.toISOString()
      : typeof params.startsAt === "string"
        ? params.startsAt
        : null;

  await enqueueOperation({
    operationType: "SEND_EMAIL_OUTBOX",
    dedupeKey: params.dedupeKey,
    payload: {
      templateKey: "BOOKING_INVITE",
      recipient,
      purchaseId,
      dedupeKey: params.dedupeKey,
      payload: {
        bookingId: params.bookingId,
        serviceTitle: params.serviceTitle,
        organizationName: params.organizationName,
        startsAt,
        timeZone: params.timeZone ?? null,
        inviteUrl: params.inviteUrl,
        inviterName: params.inviterName ?? null,
        guestName: params.guestName ?? null,
        message: params.message ?? null,
      },
    },
    correlations: {
      organizationId: params.organizationId ?? null,
    },
  });

  return { ok: true as const, recipient };
}

async function resolveEmailForUser(userId: string) {
  const identity = await prisma.emailIdentity.findFirst({
    where: { userId, emailVerifiedAt: { not: null } },
    select: { emailNormalized: true },
  });
  return identity?.emailNormalized ?? null;
}
