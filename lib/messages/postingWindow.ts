import { prisma } from "@/lib/prisma";
import { ChatConversationContextType } from "@prisma/client";

type PostingWindowParams = {
  contextType: string | null | undefined;
  contextId: string | null | undefined;
  organizationId: number | null | undefined;
};

type PostingWindowResult =
  | { canPost: true }
  | {
      canPost: false;
      reason: PostingWindowErrorReason;
    };

export type PostingWindowErrorReason =
  | "INVALID_CONTEXT"
  | "INVALID_BOOKING"
  | "BOOKING_NOT_FOUND"
  | "BOOKING_INACTIVE"
  | "BOOKING_INVALID"
  | "INVALID_EVENT"
  | "EVENT_NOT_FOUND"
  | "EVENT_NOT_OPEN"
  | "READ_ONLY";

const POST_CLOSE_WINDOW_MS = 24 * 60 * 60 * 1000;

function computeWindowEnd(startsAt: Date, durationMinutes: number) {
  return new Date(startsAt.getTime() + durationMinutes * 60 * 1000);
}

export async function resolvePostingWindow(params: PostingWindowParams): Promise<PostingWindowResult> {
  const contextType = params.contextType ?? null;
  const contextId = params.contextId ?? null;
  const organizationId = params.organizationId ?? null;

  if (!contextType) {
    return { canPost: false, reason: "INVALID_CONTEXT" };
  }

  if (contextType === ChatConversationContextType.BOOKING) {
    const bookingId = Number(contextId ?? "");
    if (!Number.isFinite(bookingId)) return { canPost: false, reason: "INVALID_BOOKING" };

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { organizationId: true, status: true, startsAt: true, durationMinutes: true },
    });
    if (!booking || booking.organizationId !== organizationId) {
      return { canPost: false, reason: "BOOKING_NOT_FOUND" };
    }
    if (!["CONFIRMED", "COMPLETED"].includes(booking.status)) {
      return { canPost: false, reason: "BOOKING_INACTIVE" };
    }
    if (!booking.startsAt || !Number.isFinite(booking.durationMinutes)) {
      return { canPost: false, reason: "BOOKING_INVALID" };
    }

    const bookingEndAt = computeWindowEnd(booking.startsAt, booking.durationMinutes);
    const closeAt = new Date(bookingEndAt.getTime() + POST_CLOSE_WINDOW_MS);
    if (Date.now() > closeAt.getTime()) {
      return { canPost: false, reason: "READ_ONLY" };
    }

    return { canPost: true };
  }

  if (contextType === ChatConversationContextType.EVENT) {
    const eventId = Number(contextId ?? "");
    if (!Number.isFinite(eventId)) return { canPost: false, reason: "INVALID_EVENT" };

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { startsAt: true, endsAt: true, isDeleted: true },
    });
    if (!event || event.isDeleted || !event.startsAt || !event.endsAt) {
      return { canPost: false, reason: "EVENT_NOT_FOUND" };
    }

    const now = Date.now();
    if (now < event.startsAt.getTime()) {
      return { canPost: false, reason: "EVENT_NOT_OPEN" };
    }

    const closeAt = new Date(event.endsAt.getTime() + POST_CLOSE_WINDOW_MS);
    if (now > closeAt.getTime()) {
      return { canPost: false, reason: "READ_ONLY" };
    }

    return { canPost: true };
  }

  return { canPost: true };
}

export function resolvePostingWindowStatus(reason: PostingWindowErrorReason) {
  if (reason === "BOOKING_NOT_FOUND" || reason === "EVENT_NOT_FOUND") return 404;
  if (
    reason === "INVALID_CONTEXT" ||
    reason === "INVALID_BOOKING" ||
    reason === "BOOKING_INVALID" ||
    reason === "INVALID_EVENT"
  ) {
    return 400;
  }
  return 403;
}
