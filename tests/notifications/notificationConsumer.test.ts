import { beforeEach, describe, expect, it, vi } from "vitest";
import { consumeNotificationEventLog } from "@/domain/notifications/consumer";
import { prisma } from "@/lib/prisma";
import { enqueueNotification } from "@/domain/notifications/outbox";

let eventLogs: any[] = [];

vi.mock("@/lib/prisma", () => {
  const eventLog = {
    findUnique: vi.fn(({ where }: any) => eventLogs.find((evt) => evt.eventId === where.eventId) ?? null),
  };
  return { prisma: { eventLog } };
});

vi.mock("@/domain/notifications/outbox", () => ({
  enqueueNotification: vi.fn(async (args: any) => ({ id: "out_1", ...args })),
}));

const prismaMock = vi.mocked(prisma);
const enqueueMock = vi.mocked(enqueueNotification);

describe("notification eventlog consumer", () => {
  beforeEach(() => {
    eventLogs = [];
    prismaMock.eventLog.findUnique.mockClear();
    enqueueMock.mockClear();
  });

  it("ignore allowlist: evento fora da lista", async () => {
    eventLogs = [
      {
        eventId: "evt-1",
        eventType: "custom.event",
        organizationId: 1,
        actorUserId: "u1",
        payload: {},
      },
    ];

    const res = await consumeNotificationEventLog("evt-1");
    expect(res.ok).toBe(false);
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("idempotente: dedupeKey consistente para o mesmo eventId", async () => {
    eventLogs = [
      {
        eventId: "evt-2",
        eventType: "loyalty.earned",
        organizationId: 1,
        actorUserId: "u1",
        payload: { ledgerId: "led_1" },
      },
    ];

    const first = await consumeNotificationEventLog("evt-2");
    const second = await consumeNotificationEventLog("evt-2");
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(enqueueMock).toHaveBeenCalledTimes(2);
    const firstKey = enqueueMock.mock.calls[0][0].dedupeKey;
    const secondKey = enqueueMock.mock.calls[1][0].dedupeKey;
    expect(firstKey).toBe(secondKey);
  });
});
