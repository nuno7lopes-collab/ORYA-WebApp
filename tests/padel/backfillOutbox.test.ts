import { beforeEach, describe, expect, it, vi } from "vitest";
import { backfillPadelRegistrationOutbox } from "@/domain/padelRegistrationBackfill";
import { PadelRegistrationStatus } from "@prisma/client";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { prisma } from "@/lib/prisma";

vi.mock("@/domain/outbox/producer", () => ({
  recordOutboxEvent: vi.fn(async () => ({ eventId: "evt_backfill" })),
}));

vi.mock("@/lib/prisma", () => {
  const outboxEvent = {
    findFirst: vi.fn(() => null),
  };
  const padelRegistration = {
    findMany: vi.fn(() => []),
  };
  const prisma = {
    outboxEvent,
    padelRegistration,
  };
  return { prisma };
});

const prismaMock = vi.mocked(prisma);
const recordOutboxEventMock = vi.mocked(recordOutboxEvent);

describe("padel registration backfill", () => {
  beforeEach(() => {
    recordOutboxEventMock.mockClear();
    prismaMock.outboxEvent.findFirst.mockClear();
    prismaMock.padelRegistration.findMany.mockClear();
  });

  it("emite outbox quando falta status/expired", async () => {
    prismaMock.padelRegistration.findMany.mockResolvedValueOnce([
      { id: "reg_1", status: PadelRegistrationStatus.PENDING_PAYMENT, createdAt: new Date() },
      { id: "reg_2", status: PadelRegistrationStatus.EXPIRED, createdAt: new Date() },
    ] as any);

    const result = await backfillPadelRegistrationOutbox({ limit: 10 });
    expect(result.scanned).toBe(2);
    expect(recordOutboxEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "PADREG_STATUS_CHANGED" }),
    );
    expect(recordOutboxEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "PADREG_EXPIRED" }),
    );
  });
});
