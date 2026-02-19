import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationType } from "@prisma/client";

const findUnique = vi.hoisted(() => vi.fn());
const upsert = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notificationPreference: {
      findUnique,
      upsert,
    },
  },
}));

describe("domain/notifications/prefs shouldNotify", () => {
  beforeEach(() => {
    findUnique.mockReset();
    upsert.mockReset();
    findUnique.mockResolvedValue({
      userId: "user-1",
      allowEmailNotifications: true,
      allowSocialNotifications: false,
      allowEventNotifications: true,
      allowSystemNotifications: false,
      allowMarketingNotifications: true,
      allowEventReminders: true,
      allowFollowRequests: false,
      allowSalesAlerts: true,
      allowSystemAnnouncements: false,
      allowMarketingCampaigns: true,
    });
  });

  it("respeita preferências por categoria", async () => {
    const { shouldNotify } = await import("@/domain/notifications/prefs");
    await expect(shouldNotify("user-1", NotificationType.FOLLOW_REQUEST)).resolves.toBe(false);
    await expect(shouldNotify("user-1", NotificationType.EVENT_REMINDER)).resolves.toBe(true);
    await expect(shouldNotify("user-1", NotificationType.SYSTEM_ANNOUNCE)).resolves.toBe(false);
    await expect(shouldNotify("user-1", NotificationType.CRM_CAMPAIGN)).resolves.toBe(true);
    await expect(shouldNotify("user-1", NotificationType.CHAT_MESSAGE)).resolves.toBe(false);
  });
});
