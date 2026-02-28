import { beforeEach, describe, expect, it, vi } from "vitest";

let outboxEvents: any[] = [];
let operations: any[] = [];
let eventLogs: any[] = [];
let nowRef = new Date("2026-02-27T00:00:00Z");
const STALE_CLAIM_MS = 15 * 60 * 1000;

const runOutboxQueryRaw = vi.hoisted(
  () => (query: any) => {
    const sql = typeof query === "string" ? query : query?.sql ?? "";
    const values = Array.isArray(query?.values) ? query.values : [];
    const stringValues = values.filter((value: unknown): value is string => typeof value === "string");
    const processingToken = stringValues[0] ?? "token-test";
    const eventIds = stringValues.slice(1);
    const staleBefore = new Date(nowRef.getTime() - STALE_CLAIM_MS);
    const candidates = outboxEvents
      .filter(
        (evt) =>
          !evt.publishedAt &&
          !evt.deadLetteredAt &&
          (!evt.nextAttemptAt || evt.nextAttemptAt <= nowRef) &&
          (!evt.claimedAt || evt.claimedAt <= staleBefore),
      )
      .sort(
        (a, b) =>
          (a.createdAt?.getTime?.() ?? 0) - (b.createdAt?.getTime?.() ?? 0) ||
          String(a.eventId).localeCompare(String(b.eventId)),
      );

    if (sql.includes("UPDATE app_v3.outbox_events")) {
      const idSet = new Set(eventIds);
      const claimed = candidates.filter((evt) => idSet.has(evt.eventId));
      for (const evt of outboxEvents) {
        if (!idSet.has(evt.eventId)) continue;
        evt.processingToken = processingToken;
        evt.claimedAt = nowRef;
      }
      return claimed;
    }

    return candidates;
  },
);

vi.mock("@/lib/prisma", () => {
  const operation = {
    findUnique: vi.fn(({ where }: any) => operations.find((op) => op.dedupeKey === where.dedupeKey) ?? null),
    create: vi.fn(({ data }: any) => {
      const record = { ...data, id: operations.length + 1, updatedAt: nowRef };
      operations.push(record);
      return record;
    }),
  };

  const outboxEvent = {
    findUnique: vi.fn(({ where }: any) => outboxEvents.find((evt) => evt.eventId === where.eventId) ?? null),
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

  const eventLog = {
    createMany: vi.fn(({ data }: any) => {
      for (const row of data ?? []) {
        const exists = eventLogs.find(
          (item) =>
            item.organizationId === row.organizationId &&
            item.eventType === row.eventType &&
            item.idempotencyKey === row.idempotencyKey,
        );
        if (!exists) eventLogs.push(row);
      }
      return { count: data?.length ?? 0 };
    }),
  };

  const prisma = {
    operation,
    outboxEvent,
    eventLog,
    $queryRaw: vi.fn(runOutboxQueryRaw),
    $transaction: async (fn: any) => {
      const tx = { operation, outboxEvent, eventLog, $queryRaw: prisma.$queryRaw };
      return fn(tx);
    },
  };

  return { prisma };
});

import { publishOutboxBatch } from "@/domain/outbox/publisher";

describe("outbox unknown event integration", () => {
  beforeEach(() => {
    outboxEvents = [];
    operations = [];
    eventLogs = [];
    nowRef = new Date("2026-02-27T00:00:00Z");
    delete process.env.OUTBOX_UNKNOWN_DEFAULT_HANDLER_ENABLED;
  });

  it("dead-lettera evento desconhecido sem crash", async () => {
    outboxEvents = [
      {
        eventId: "evt-unknown-1",
        eventType: "org.context.changed",
        payload: { toOrganizationId: 77, userId: "u1" },
        attempts: 0,
        publishedAt: null,
        nextAttemptAt: null,
        deadLetteredAt: null,
        createdAt: new Date("2026-02-27T00:00:00Z"),
      },
    ];

    const metricSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await publishOutboxBatch({ now: nowRef, batchSize: 10 });

    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe("DEAD_LETTER");
    expect(outboxEvents[0]?.deadLetteredAt).toEqual(nowRef);
    expect(outboxEvents[0]?.reasonCode).toBe("UNKNOWN_EVENT_TYPE");
    expect(outboxEvents[0]?.errorClass).toBe("OutboxUnsupportedEvent");
    expect(operations).toHaveLength(0);
    expect(eventLogs).toHaveLength(1);
    expect(eventLogs[0]?.organizationId).toBe(77);
    expect(eventLogs[0]?.eventType).toBe("outbox.event.unsupported.dead_lettered");
    expect(metricSpy.mock.calls.some((call) => String(call[0]).includes("\"outbox_event_unsupported_total\""))).toBe(
      true,
    );
    metricSpy.mockRestore();
  });

  it("com feature flag OFF mantém comportamento legado", async () => {
    process.env.OUTBOX_UNKNOWN_DEFAULT_HANDLER_ENABLED = "false";
    outboxEvents = [
      {
        eventId: "evt-unknown-2",
        eventType: "org.context.changed",
        payload: { toOrganizationId: 77 },
        attempts: 0,
        publishedAt: null,
        nextAttemptAt: null,
        deadLetteredAt: null,
        createdAt: new Date("2026-02-27T00:00:00Z"),
      },
    ];

    const result = await publishOutboxBatch({ now: nowRef, batchSize: 10 });

    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe("RETRY");
    expect(outboxEvents[0]?.deadLetteredAt).toBeNull();
    expect(outboxEvents[0]?.nextAttemptAt).toBeInstanceOf(Date);
    expect(operations).toHaveLength(1);
    expect(eventLogs).toHaveLength(0);
  });
});
