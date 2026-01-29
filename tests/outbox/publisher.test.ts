import { beforeEach, describe, expect, it, vi } from "vitest";

import { publishOutboxBatch, OUTBOX_MAX_ATTEMPTS } from "@/domain/outbox/publisher";
import { prisma } from "@/lib/prisma";

let outboxEvents: any[] = [];
let operations: any[] = [];
let currentNow = new Date();
const STALE_CLAIM_MS = 15 * 60 * 1000;
const lockedIds = new Set<string>();

vi.mock("@/lib/prisma", () => {
  const operation = {
    findUnique: vi.fn(({ where }: any) => operations.find((op) => op.dedupeKey === where.dedupeKey) ?? null),
    create: vi.fn(({ data }: any) => {
      const record = { ...data, id: operations.length + 1, updatedAt: currentNow };
      operations.push(record);
      return record;
    }),
  };
  const outboxEvent = {
    update: vi.fn(({ where, data }: any) => {
      const event = outboxEvents.find((evt) => evt.eventId === where.eventId);
      if (event) Object.assign(event, data);
      return event ?? null;
    }),
  };
  const prisma = {
    outboxEvent,
    operation,
    $transaction: async (fn: any) => {
      const txLocks = new Set<string>();
      const tx = {
        ...prisma,
        $queryRaw: vi.fn(() => {
          const staleBefore = new Date(currentNow.getTime() - STALE_CLAIM_MS);
          const pending = outboxEvents.filter(
            (evt) =>
              !evt.publishedAt &&
              !evt.deadLetteredAt &&
              (!evt.nextAttemptAt || evt.nextAttemptAt <= currentNow) &&
              (!evt.claimedAt || evt.claimedAt <= staleBefore) &&
              !lockedIds.has(evt.eventId),
          );
          if (!pending.length) return [];
          const event = pending[0];
          lockedIds.add(event.eventId);
          txLocks.add(event.eventId);
          return [event];
        }),
      };
      try {
        return await fn(tx);
      } finally {
        for (const id of txLocks) lockedIds.delete(id);
      }
    },
  };
  return { prisma };
});

const prismaMock = vi.mocked(prisma);

describe("Outbox publisher", () => {
  beforeEach(() => {
    outboxEvents = [];
    operations = [];
    currentNow = new Date("2024-01-01T00:00:00Z");
    lockedIds.clear();
    prismaMock.operation.findUnique.mockClear();
    prismaMock.operation.create.mockClear();
    prismaMock.outboxEvent.update.mockClear();
  });

  it("enfileira operação e mantém publishedAt null até sucesso", async () => {
    outboxEvents = [
      {
        eventId: "evt-1",
        eventType: "payment.status.changed",
        causationId: "caus-1",
        correlationId: "corr-1",
        payload: { foo: "bar" },
        attempts: 0,
        publishedAt: null,
        nextAttemptAt: null,
        deadLetteredAt: null,
      },
    ];

    const now = new Date("2024-01-01T00:00:00Z");
    currentNow = now;
    await publishOutboxBatch({ now });
    expect(outboxEvents[0].publishedAt).toBeNull();
    expect(outboxEvents[0].claimedAt).toEqual(now);
    expect(outboxEvents[0].processingToken).toBeTruthy();
    expect(outboxEvents[0].nextAttemptAt).toBeInstanceOf(Date);
    expect(prismaMock.operation.create).toHaveBeenCalledTimes(1);
  });

  it("marca publishedAt quando operação já foi concluída", async () => {
    outboxEvents = [
      {
        eventId: "evt-2",
        eventType: "payment.status.changed",
        causationId: "caus-2",
        correlationId: "corr-2",
        payload: {},
        attempts: 0,
        publishedAt: null,
        nextAttemptAt: null,
        deadLetteredAt: null,
      },
    ];
    operations = [
      { id: 1, dedupeKey: "outbox:evt-2", status: "SUCCEEDED", updatedAt: new Date("2024-01-02T00:00:00Z") },
    ];

    const now = new Date("2024-01-01T00:00:00Z");
    currentNow = now;
    await publishOutboxBatch({ now });
    expect(outboxEvents[0].publishedAt).toEqual(new Date("2024-01-02T00:00:00Z"));
    expect(prismaMock.operation.create).not.toHaveBeenCalled();
  });

  it("falha → backoff + attempts", async () => {
    outboxEvents = [
      {
        eventId: "evt-3",
        eventType: "payment.status.changed",
        causationId: "caus-3",
        correlationId: "corr-3",
        payload: {},
        attempts: 0,
        publishedAt: null,
        nextAttemptAt: null,
        deadLetteredAt: null,
      },
    ];
    prismaMock.operation.create.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    const now = new Date("2024-01-01T00:00:00Z");
    currentNow = now;
    await publishOutboxBatch({ now });
    expect(outboxEvents[0].attempts).toBe(1);
    expect(outboxEvents[0].nextAttemptAt).toBeInstanceOf(Date);
    expect(outboxEvents[0].deadLetteredAt).toBeNull();
  });

  it("dead-letter quando atinge MAX_ATTEMPTS", async () => {
    outboxEvents = [
      {
        eventId: "evt-4",
        eventType: "payment.status.changed",
        payload: {},
        attempts: OUTBOX_MAX_ATTEMPTS,
        publishedAt: null,
        nextAttemptAt: null,
        deadLetteredAt: null,
      },
    ];
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const now = new Date("2024-01-01T00:00:00Z");
    currentNow = now;
    await publishOutboxBatch({ now });
    expect(outboxEvents[0].deadLetteredAt).toEqual(now);
    expect(outboxEvents[0].nextAttemptAt).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("workers concorrentes só enfileiram uma vez", async () => {
    outboxEvents = [
      {
        eventId: "evt-5",
        eventType: "payment.status.changed",
        payload: {},
        attempts: 0,
        publishedAt: null,
        nextAttemptAt: null,
        deadLetteredAt: null,
      },
    ];

    const now = new Date("2024-01-01T00:00:00Z");
    currentNow = now;
    await Promise.all([publishOutboxBatch({ now }), publishOutboxBatch({ now })]);
    expect(prismaMock.operation.create).toHaveBeenCalledTimes(1);
  });

  it("reclama eventos com claim stale", async () => {
    const now = new Date("2024-01-01T00:00:00Z");
    currentNow = now;
    outboxEvents = [
      {
        eventId: "evt-stale",
        eventType: "payment.status.changed",
        payload: {},
        attempts: 0,
        publishedAt: null,
        nextAttemptAt: null,
        deadLetteredAt: null,
        claimedAt: new Date(now.getTime() - STALE_CLAIM_MS - 1000),
      },
      {
        eventId: "evt-fresh",
        eventType: "payment.status.changed",
        payload: {},
        attempts: 0,
        publishedAt: null,
        nextAttemptAt: null,
        deadLetteredAt: null,
        claimedAt: new Date(now.getTime() - 60 * 1000),
      },
    ];

    await publishOutboxBatch({ now });
    const stale = outboxEvents.find((evt) => evt.eventId === "evt-stale");
    const fresh = outboxEvents.find((evt) => evt.eventId === "evt-fresh");
    expect(stale?.processingToken).toBeTruthy();
    expect(fresh?.processingToken).toBeFalsy();
  });
});
