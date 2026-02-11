import type { NotificationType, Prisma } from "@prisma/client";
import { enqueueNotification } from "@/domain/notifications/outbox";
import { getNotificationPrefs, shouldNotify } from "@/domain/notifications/prefs";
import type { CreateNotificationInput } from "@/domain/notifications/types";
import { safeCtaUrl, validateNotificationInput } from "@/domain/notifications/registry";

export type { CreateNotificationInput };

function buildDedupe(parts: Array<string | number | null | undefined>) {
  return ["notification", ...parts.map((p) => (p === null || p === undefined ? "null" : String(p)))].join(":");
}

export async function createNotification(input: CreateNotificationInput) {
  const {
    userId,
    type,
    dedupeKey: dedupeKeyOverride = null,
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

  const dedupeKey =
    typeof dedupeKeyOverride === "string" && dedupeKeyOverride.trim().length > 0
      ? dedupeKeyOverride.trim()
      : buildDedupe([type, userId, organizationId, eventId, ticketId, inviteId, fromUserId]);
  const sanitizedCta = safeCtaUrl(ctaUrl);
  const payloadJson: Prisma.InputJsonValue = {
    title: title ?? null,
    body: body ?? null,
    ctaUrl: sanitizedCta ?? null,
    ctaLabel: sanitizedCta ? ctaLabel ?? null : null,
    priority,
    senderVisibility,
    fromUserId,
    organizationId,
    eventId,
    ticketId,
    inviteId,
    payload: payload ?? null,
  } as Prisma.InputJsonValue;

  const missing = validateNotificationInput({
    type,
    fromUserId,
    organizationId,
    eventId,
    inviteId,
    payload: payload ? (payload as Record<string, unknown>) : null,
  });
  if (missing.length) {
    console.warn("[notifications][create] missing_fields", { type, userId, missing });
  }

  return enqueueNotification({
    dedupeKey,
    userId,
    notificationType: type,
    payload: payloadJson,
  });
}

export { shouldNotify, getNotificationPrefs };
