import { beforeEach, describe, expect, it, vi } from "vitest";

import { publishOutboxBatch, OUTBOX_MAX_ATTEMPTS, buildFairOutboxBatch } from "@/domain/outbox/publisher";
import { prisma } from "@/lib/prisma";

let outboxEvents: any[] = [];
let operations: any[] = [];
let currentNow = new Date();
const STALE_CLAIM_MS = 15 * 60 * 1000;
const lockedIds = new Set<string>();

const runOutboxQueryRaw = vi.hoisted(
  () => (query: any) => {
    const sql = typeof query === "string" ? query : query?.sql ?? "";
    const values = Array.isArray(query?.values) ? query.values : [];
    const stringValues = values.filter((value: unknown): value is string => typeof value === "string");
    const processingToken = stringValues[0] ?? `token-${Math.random().toString(36).slice(2)}`;
    const eventIds = stringValues.slice(1);
    const staleBefore = new Date(currentNow.getTime() - STALE_CLAIM_MS);
    const pending = outboxEvents.filter(
      (evt) =>
        !evt.publishedAt &&
        !evt.deadLetteredAt &&
        (!evt.nextAttemptAt || evt.nextAttemptAt <= currentNow) &&
        (!evt.claimedAt || evt.claimedAt <= staleBefore),
    );
    const sorted = pending
      .map((evt) => ({ ...evt, createdAt: evt.createdAt ?? currentNow }))
      .sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || String(a.eventId).localeCompare(String(b.eventId)),
      );

    if (sql.includes("UPDATE app_v3.outbox_events")) {
      const claimIds = eventIds.length ? new Set(eventIds) : null;
      const claimed = eventIds.length
        ? eventIds
            .map((id) => sorted.find((evt) => evt.eventId === id))
            .filter(Boolean)
        : sorted.filter((evt) => !claimIds || claimIds.has(evt.eventId));
      for (const evt of outboxEvents) {
        if (!claimed.find((c) => c?.eventId === evt.eventId)) continue;
        evt.processingToken = processingToken;
        evt.claimedAt = currentNow;
      }
      return claimed as typeof sorted;
    }

    return sorted;
  },
);

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
    findUnique: vi.fn(({ where }: any) => outboxEvents.find((evt) => evt.eventId === where.eventId) ?? null),
    update: vi.fn(({ where, data }: any) => {
      const event = outboxEvents.find((evt) => evt.eventId === where.eventId);
      if (event) Object.assign(event, data);
      return event ?? null;
    }),
    updateMany: vi.fn(({ where, data }: any) => {
      const ids = Array.isArray(where?.eventId?.in) ? where.eventId.in : [where?.eventId].filter(Boolean);
      const token = where?.processingToken ?? null;
      let count = 0;
      for (const evt of outboxEvents) {
        if (!ids.includes(evt.eventId)) continue;
        if (token && evt.processingToken !== token) continue;
        Object.assign(evt, data);
        count += 1;
      }
      return { count };
    }),
  };
  const prisma = {
    outboxEvent,
    operation,
    $queryRaw: vi.fn(runOutboxQueryRaw),
    $transaction: async (fn: any) => {
      const txLocks = new Set<string>();
      const tx = {
        ...prisma,
        $queryRaw: vi.fn((query: any) => {
          const candidates = runOutboxQueryRaw(query);
          const unlocked = candidates.filter((evt) => !lockedIds.has(evt.eventId));
          for (const evt of unlocked) {
            lockedIds.add(evt.eventId);
            txLocks.add(evt.eventId);
          }
          return unlocked;
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
    prismaMock.outboxEvent.updateMany.mockClear();
    prismaMock.outboxEvent.findUnique.mockClear();
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
        createdAt: new Date("2024-01-01T00:00:00Z"),
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
        createdAt: new Date("2024-01-01T00:00:00Z"),
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
        createdAt: new Date("2024-01-01T00:00:00Z"),
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
        createdAt: new Date("2024-01-01T00:00:00Z"),
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
        createdAt: new Date("2024-01-01T00:00:00Z"),
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
        createdAt: new Date(now.getTime() - 2000),
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
        createdAt: new Date(now.getTime() - 1000),
      },
    ];

    await publishOutboxBatch({ now });
    const stale = outboxEvents.find((evt) => evt.eventId === "evt-stale");
    const fresh = outboxEvents.find((evt) => evt.eventId === "evt-fresh");
    expect(stale?.processingToken).toBeTruthy();
    expect(fresh?.processingToken).toBeFalsy();
  });

  it("processa até batchSize e não reclama todos os eventos", async () => {
    outboxEvents = [
      {
        eventId: "evt-a1",
        eventType: "A",
        payload: {},
        attempts: 0,
        publishedAt: null,
        nextAttemptAt: null,
        deadLetteredAt: null,
        createdAt: new Date("2024-01-01T00:00:00Z"),
      },
      {
        eventId: "evt-a2",
        eventType: "A",
        payload: {},
        attempts: 0,
        publishedAt: null,
        nextAttemptAt: null,
        deadLetteredAt: null,
        createdAt: new Date("2024-01-01T00:00:01Z"),
      },
      {
        eventId: "evt-b1",
        eventType: "B",
        payload: {},
        attempts: 0,
        publishedAt: null,
        nextAttemptAt: null,
        deadLetteredAt: null,
        createdAt: new Date("2024-01-01T00:00:02Z"),
      },
    ];

    const now = new Date("2024-01-01T00:00:00Z");
    currentNow = now;
    await publishOutboxBatch({ now, batchSize: 2 });
    const claimed = outboxEvents.filter((evt) => evt.processingToken);
    expect(claimed).toHaveLength(2);
    expect(prismaMock.operation.create).toHaveBeenCalledTimes(2);
  });

  it("intercala eventTypes no batch (fairness)", async () => {
    outboxEvents = [
      {
        eventId: "evt-a1",
        eventType: "A",
        payload: {},
        attempts: 0,
        publishedAt: null,
        nextAttemptAt: null,
        deadLetteredAt: null,
        createdAt: new Date("2024-01-01T00:00:00Z"),
      },
      {
        eventId: "evt-a2",
        eventType: "A",
        payload: {},
        attempts: 0,
        publishedAt: null,
        nextAttemptAt: null,
        deadLetteredAt: null,
        createdAt: new Date("2024-01-01T00:00:01Z"),
      },
      {
        eventId: "evt-b1",
        eventType: "B",
        payload: {},
        attempts: 0,
        publishedAt: null,
        nextAttemptAt: null,
        deadLetteredAt: null,
        createdAt: new Date("2024-01-01T00:00:02Z"),
      },
      {
        eventId: "evt-b2",
        eventType: "B",
        payload: {},
        attempts: 0,
        publishedAt: null,
        nextAttemptAt: null,
        deadLetteredAt: null,
        createdAt: new Date("2024-01-01T00:00:03Z"),
      },
    ];

    const now = new Date("2024-01-01T00:00:00Z");
    currentNow = now;
    await publishOutboxBatch({ now, batchSize: 3 });
    const order = operations.map((op) => op.payload.eventId);
    expect(order.slice(0, 3)).toEqual(["evt-a1", "evt-b1", "evt-a2"]);
  });

  it("buildFairOutboxBatch respeita round-robin", () => {
    const events = [
      { eventId: "a1", eventType: "A", createdAt: new Date("2024-01-01T00:00:00Z") },
      { eventId: "a2", eventType: "A", createdAt: new Date("2024-01-01T00:00:01Z") },
      { eventId: "b1", eventType: "B", createdAt: new Date("2024-01-01T00:00:02Z") },
      { eventId: "b2", eventType: "B", createdAt: new Date("2024-01-01T00:00:03Z") },
    ] as any[];
    const batch = buildFairOutboxBatch(events, 3).map((e) => e.eventId);
    expect(batch).toEqual(["a1", "b1", "a2"]);
  });
});
