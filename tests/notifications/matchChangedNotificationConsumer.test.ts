import { beforeEach, describe, expect, it, vi } from "vitest";
import { deliverNotificationOutboxItem } from "@/domain/notifications/consumer";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => {
  const eventMatchSlot = { findUnique: vi.fn() };
  const notification = {
    upsert: vi.fn(({ create }: any) => ({ id: "notif-1", ...create })),
    create: vi.fn(({ data }: any) => ({ id: "notif-1", ...data })),
    update: vi.fn(),
    updateMany: vi.fn(),
  };
  const pushDeviceToken = { findMany: vi.fn() };
  const notificationMute = { findFirst: vi.fn() };
  const crmCampaignDelivery = { updateMany: vi.fn() };
  return {
    prisma: {
      eventMatchSlot,
      notification,
      pushDeviceToken,
      notificationMute,
      crmCampaignDelivery,
    },
  };
});

vi.mock("@/domain/notifications/prefs", () => ({
  shouldNotify: vi.fn(async () => true),
}));

vi.mock("@/lib/push/apns", () => ({
  deliverApnsPush: vi.fn(async () => ({})),
}));

const prismaMock = vi.mocked(prisma);

describe("MATCH_CHANGED notification consumer payload", () => {
  beforeEach(() => {
    prismaMock.eventMatchSlot.findUnique.mockReset();
    prismaMock.notification.upsert.mockClear();
    prismaMock.pushDeviceToken.findMany.mockReset();
    prismaMock.pushDeviceToken.findMany.mockResolvedValue([]);

    prismaMock.eventMatchSlot.findUnique.mockResolvedValue({
      id: 50,
      startTime: new Date("2026-02-13T15:00:00.000Z"),
      plannedStartAt: null,
      courtId: 3,
      courtNumber: 3,
      courtName: "Court 3",
      event: {
        id: 10,
        title: "Open Lisboa",
        slug: "open-lisboa",
        timezone: "Europe/Lisbon",
        organizationId: 99,
      },
      pairingA: {
        slots: [{ playerProfile: { displayName: "Ana", fullName: "Ana Silva" } }],
      },
      pairingB: {
        slots: [{ playerProfile: { displayName: "Bea", fullName: "Bea Costa" } }],
      },
    });
  });

  it("gera mensagem com reason/delayStatus e deep link canónico", async () => {
    const notification = await deliverNotificationOutboxItem({
      id: "out-1",
      userId: "user-1",
      notificationType: "MATCH_CHANGED",
      payload: {
        matchId: 50,
        startAt: "2026-02-13T15:30:00.000Z",
        courtId: 3,
        scheduleVersion: "2026-02-13T15:20:00.000Z",
        reason: "chuva",
        delayStatus: "RESCHEDULED",
      },
    });

    expect(notification.title).toBe("Jogo reagendado");
    expect(notification.body).toContain("Motivo: chuva");
    expect(notification.ctaUrl).toBe("/eventos/open-lisboa");
    expect(notification.payload).toMatchObject({
      scheduleVersion: "2026-02-13T15:20:00.000Z",
      delayStatus: "RESCHEDULED",
      reason: "chuva",
    });
  });
});
