import type { NotificationType, Prisma } from "@prisma/client";
import { enqueueNotification } from "@/domain/notifications/outbox";
import { getNotificationPrefs, shouldNotify } from "@/domain/notifications/prefs";
import type { CreateNotificationInput } from "@/domain/notifications/types";

export type { CreateNotificationInput };

function buildDedupe(parts: Array<string | number | null | undefined>) {
  return ["notification", ...parts.map((p) => (p === null || p === undefined ? "null" : String(p)))].join(":");
}

export async function createNotification(input: CreateNotificationInput) {
  const {
    userId,
    type,
    title,
    body,
    payload,
    ctaUrl = null,
    ctaLabel = null,
    priority = "NORMAL",
    senderVisibility = "PUBLIC",
    fromUserId = null,
    organizationId = null,
    eventId = null,
    ticketId = null,
    inviteId = null,
  } = input;

  const dedupeKey = buildDedupe([type, userId, organizationId, eventId, ticketId, inviteId, fromUserId]);
  const payloadJson: Prisma.InputJsonValue = {
    title: title ?? null,
    body: body ?? null,
    ctaUrl: ctaUrl ?? null,
    ctaLabel: ctaLabel ?? null,
    priority,
    senderVisibility,
    fromUserId,
    organizationId,
    eventId,
    ticketId,
    inviteId,
    payload: payload ?? null,
  } as Prisma.InputJsonValue;

  return enqueueNotification({
    dedupeKey,
    userId,
    notificationType: type,
    payload: payloadJson,
  });
}

export { shouldNotify, getNotificationPrefs };
