import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@prisma/client";
import { resolveNotificationCategory } from "@/domain/notifications/registry";

export async function shouldNotify(userId: string, type: NotificationType) {
  const prefs = await getNotificationPrefs(userId);
  const allowSocial = (prefs as any).allowSocialNotifications ?? prefs.allowFollowRequests ?? true;
  const allowEvents = (prefs as any).allowEventNotifications ?? prefs.allowEventReminders ?? true;
  const allowSystem = (prefs as any).allowSystemNotifications ?? prefs.allowSystemAnnouncements ?? true;
  const allowMarketing = (prefs as any).allowMarketingNotifications ?? prefs.allowMarketingCampaigns ?? true;

  const category = resolveNotificationCategory(type);
  if (category === "network") return allowSocial;
  if (category === "events") return allowEvents;
  if (category === "marketing") return false;
  if (category === "system" || category === "chat") return false;
  return false;
}

export async function getNotificationPrefs(userId: string) {
  const existing = await prisma.notificationPreference.findUnique({ where: { userId } });
  if (existing) return existing;

  const defaults = {
    userId,
    allowEmailNotifications: true,
    allowSocialNotifications: true,
    allowEventNotifications: true,
    allowSystemNotifications: true,
    allowMarketingNotifications: true,
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
