import { prisma } from "./prisma";
import type { NotificationPriority, NotificationType } from "@prisma/client";

export type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title?: string | null;
  body?: string | null;
  payload?: Record<string, unknown> | null;
  ctaUrl?: string | null;
  ctaLabel?: string | null;
  priority?: NotificationPriority;
  senderVisibility?: "PUBLIC" | "PRIVATE";
  fromUserId?: string | null;
  organizationId?: number | null;
  eventId?: number | null;
  ticketId?: string | null;
  inviteId?: string | null;
};

export async function shouldNotify(userId: string, type: NotificationType) {
  const prefs = await getNotificationPrefs(userId);
  switch (type) {
    case "EVENT_SALE":
      return prefs.allowSalesAlerts;
    case "FOLLOW_REQUEST":
    case "FOLLOW_ACCEPT":
      return prefs.allowFollowRequests;
    case "FOLLOWED_YOU":
      return prefs.allowFollowRequests;
    case "SYSTEM_ANNOUNCE":
    case "STRIPE_STATUS":
    case "CHAT_OPEN":
    case "CHAT_ANNOUNCEMENT":
      return prefs.allowSystemAnnouncements;
    case "EVENT_REMINDER":
    case "NEW_EVENT_FROM_FOLLOWED_ORGANIZATION":
      return prefs.allowEventReminders;
    case "CRM_CAMPAIGN":
    case "MARKETING_PROMO_ALERT":
      return prefs.allowMarketingCampaigns;
    default:
      return true;
  }
}

function sanitizeActor(
  actor: any,
  options: { isPrivate?: boolean; viewerId?: string | null },
) {
  if (!actor || typeof actor !== "object") return actor;
  const isSelf = options.viewerId && actor.id === options.viewerId;
  if (isSelf) return actor;
  if (!("email" in actor)) return actor;
  return { ...actor, email: null };
}

function sanitizePayload(payload: any, opts: { senderVisibility?: "PUBLIC" | "PRIVATE"; viewerId?: string | null }) {
  if (!payload || typeof payload !== "object") return payload;
  const clone: Record<string, unknown> = { ...payload };
  if (clone.actor) {
    clone.actor = sanitizeActor(clone.actor, { isPrivate: opts.senderVisibility === "PRIVATE", viewerId: opts.viewerId });
  }
  return clone;
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

  const data = {
    userId,
    type,
    title: title ?? null,
    body: body ?? null,
    payload: payload ? sanitizePayload(payload, { senderVisibility, viewerId: userId }) : undefined,
    ctaUrl: ctaUrl || undefined,
    ctaLabel: ctaLabel || undefined,
    priority,
    fromUserId: fromUserId || undefined,
    organizationId: organizationId ?? undefined,
    eventId: eventId ?? undefined,
    ticketId: ticketId ?? undefined,
    inviteId: inviteId ?? undefined,
  };

  return prisma.notification.create({ data });
}

export async function getNotificationPrefs(userId: string) {
  const existing = await prisma.notificationPreference.findUnique({ where: { userId } });
  if (existing) return existing;

  const defaults = {
    userId,
    allowEmailNotifications: true,
    allowEventReminders: true,
    allowFollowRequests: true,
    allowSalesAlerts: true,
    allowSystemAnnouncements: true,
    allowMarketingCampaigns: true,
  };

  return prisma.notificationPreference.upsert({
    where: { userId },
    update: {},
    create: defaults,
  });
}
