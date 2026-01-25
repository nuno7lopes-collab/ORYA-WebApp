import { beforeEach, describe, expect, it, vi } from "vitest";

import { publishOutboxBatch, OUTBOX_MAX_ATTEMPTS } from "@/domain/outbox/publisher";
import { prisma } from "@/lib/prisma";

let outboxEvents: any[] = [];

vi.mock("@/lib/prisma", () => {
  const operation = {
    upsert: vi.fn(() => ({ id: 1 })),
  };
  const outboxEvent = {
    findMany: vi.fn(({ take }: any) => {
      const now = new Date();
      const pending = outboxEvents.filter(
        (evt) =>
          !evt.publishedAt &&
          !evt.deadLetteredAt &&
          (!evt.nextAttemptAt || evt.nextAttemptAt <= now),
      );
      return pending.slice(0, take ?? pending.length);
    }),
    update: vi.fn(({ where, data }: any) => {
      const event = outboxEvents.find((evt) => evt.eventId === where.eventId);
      if (event) Object.assign(event, data);
      return event ?? null;
    }),
  };
  const prisma = {
    outboxEvent,
    operation,
    $transaction: async (fn: any) => fn(prisma),
  };
  return { prisma };
});

const prismaMock = vi.mocked(prisma);

describe("Outbox publisher", () => {
  beforeEach(() => {
    outboxEvents = [];
    prismaMock.operation.upsert.mockReset();
    prismaMock.outboxEvent.findMany.mockClear();
    prismaMock.outboxEvent.update.mockClear();
  });

  it("publica e marca publishedAt (idempotente)", async () => {
    outboxEvents = [
      {
        eventId: "evt-1",
        eventType: "payment.status.changed",
        payload: { foo: "bar" },
        attempts: 0,
        publishedAt: null,
        nextAttemptAt: null,
        deadLetteredAt: null,
      },
    ];

    const now = new Date("2024-01-01T00:00:00Z");
    await publishOutboxBatch({ now });
    expect(outboxEvents[0].publishedAt).toEqual(now);

    await publishOutboxBatch({ now });
    expect(prismaMock.operation.upsert).toHaveBeenCalledTimes(1);
  });

  it("falha → backoff + attempts", async () => {
    outboxEvents = [
      {
        eventId: "evt-2",
        eventType: "payment.status.changed",
        payload: {},
        attempts: 0,
        publishedAt: null,
        nextAttemptAt: null,
        deadLetteredAt: null,
      },
    ];
    prismaMock.operation.upsert.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    const now = new Date("2024-01-01T00:00:00Z");
    await publishOutboxBatch({ now });
    expect(outboxEvents[0].attempts).toBe(1);
    expect(outboxEvents[0].nextAttemptAt).toBeInstanceOf(Date);
    expect(outboxEvents[0].deadLetteredAt).toBeNull();
  });

  it("dead-letter quando atinge MAX_ATTEMPTS", async () => {
    outboxEvents = [
      {
        eventId: "evt-3",
        eventType: "payment.status.changed",
        payload: {},
        attempts: OUTBOX_MAX_ATTEMPTS - 1,
        publishedAt: null,
        nextAttemptAt: null,
        deadLetteredAt: null,
      },
    ];
    prismaMock.operation.upsert.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const now = new Date("2024-01-01T00:00:00Z");
    await publishOutboxBatch({ now });
    expect(outboxEvents[0].deadLetteredAt).toEqual(now);
    expect(outboxEvents[0].nextAttemptAt).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
