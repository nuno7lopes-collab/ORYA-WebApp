import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@prisma/client";

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
