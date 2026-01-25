import { describe, expect, it, vi, beforeEach } from "vitest";
import { processNotificationOutboxBatch, __test__computeNextAttemptAt } from "@/domain/notifications/outboxProcessor";
import { prisma } from "@/lib/prisma";
import { deliverNotificationOutboxItem } from "@/domain/notifications/consumer";

vi.mock("@/lib/prisma", () => {
  const notificationOutbox = {
    findMany: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  };
  return { prisma: { notificationOutbox } };
});

vi.mock("@/domain/notifications/consumer", () => ({
  deliverNotificationOutboxItem: vi.fn(),
}));

const prismaMock = vi.mocked(prisma);
const deliverMock = vi.mocked(deliverNotificationOutboxItem);

const baseItem = {
  id: "out-1",
  userId: "u1",
  notificationType: "LOYALTY_EARNED",
  payload: { sourceEventId: "evt-1" },
  retries: 0,
};

describe("notification outbox processor", () => {
  beforeEach(() => {
    prismaMock.notificationOutbox.findMany.mockReset();
    prismaMock.notificationOutbox.updateMany.mockReset();
    prismaMock.notificationOutbox.update.mockReset();
    deliverMock.mockReset();
  });

  it("processa item e marca SENT", async () => {
    prismaMock.notificationOutbox.findMany.mockResolvedValue([baseItem as any]);
    prismaMock.notificationOutbox.updateMany.mockResolvedValue({ count: 1 } as any);
    prismaMock.notificationOutbox.update.mockResolvedValue({} as any);
    deliverMock.mockResolvedValue({} as any);

    const res = await processNotificationOutboxBatch(10);
    expect(res.processed).toBe(1);
    expect(res.failed).toBe(0);
    expect(deliverMock).toHaveBeenCalledTimes(1);
    expect(prismaMock.notificationOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "out-1" },
        data: expect.objectContaining({ status: "SENT" }),
      }),
    );
  });

  it("falha e agenda retry com backoff", async () => {
    prismaMock.notificationOutbox.findMany.mockResolvedValue([baseItem as any]);
    prismaMock.notificationOutbox.updateMany.mockResolvedValue({ count: 1 } as any);
    prismaMock.notificationOutbox.update.mockResolvedValue({} as any);
    deliverMock.mockRejectedValue(new Error("boom"));

    const res = await processNotificationOutboxBatch(10);
    expect(res.processed).toBe(0);
    expect(res.failed).toBe(1);
    const updateCall = prismaMock.notificationOutbox.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe("FAILED");
    expect(updateCall.data.nextAttemptAt).toBeInstanceOf(Date);
  });

  it("backoff cresce com retries", () => {
    const now = new Date("2025-01-01T00:00:00Z");
    const first = __test__computeNextAttemptAt(0, now);
    const second = __test__computeNextAttemptAt(1, now);
    expect(second.getTime()).toBeGreaterThan(first.getTime());
  });
});
