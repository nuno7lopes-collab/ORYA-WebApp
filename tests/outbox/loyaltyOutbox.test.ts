import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleLoyaltyOutboxEvent, recordLoyaltyLedgerOutbox } from "@/domain/loyaltyOutbox";
import { publishOutboxBatch, OUTBOX_MAX_ATTEMPTS } from "@/domain/outbox/publisher";
import { enqueueNotification } from "@/domain/notifications/outbox";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { prisma } from "@/lib/prisma";

let ledgerState: any = null;
let outboxEvents: any[] = [];
let operations: any[] = [];
let currentNow = new Date();
const lockedIds = new Set<string>();
const STALE_CLAIM_MS = 15 * 60 * 1000;

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

vi.mock("@/domain/outbox/producer", () => ({
  recordOutboxEvent: vi.fn(async (payload: any) => payload),
}));
vi.mock("@/domain/eventLog/append", () => ({
  appendEventLog: vi.fn(async () => null),
}));

vi.mock("@/domain/notifications/outbox", () => ({
  enqueueNotification: vi.fn(async () => ({ id: "notif_1" })),
}));

vi.mock("@/lib/prisma", () => {
  const loyaltyLedger = {
    findUnique: vi.fn(({ where }: any) => {
      if (where?.id === ledgerState?.id) return ledgerState;
      return null;
    }),
  };
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
    loyaltyLedger,
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
const enqueueMock = vi.mocked(enqueueNotification);
const recordOutboxMock = vi.mocked(recordOutboxEvent);

describe("loyalty outbox consumer", () => {
  beforeEach(() => {
    ledgerState = {
      id: "ledger_1",
      entryType: "EARN",
      points: 150,
      userId: "user_1",
      programId: "program_1",
      organizationId: 10,
      program: {
        id: "program_1",
        name: "Pontos ORYA",
        pointsName: "Pontos",
        organization: { publicName: "ORYA Club", businessName: null },
      },
      rule: { name: "Check-in" },
      reward: null,
    };
    outboxEvents = [];
    operations = [];
    currentNow = new Date("2024-01-01T00:00:00Z");
    lockedIds.clear();
    prismaMock.loyaltyLedger.findUnique.mockClear();
    enqueueMock.mockClear();
    recordOutboxMock.mockClear();
    prismaMock.outboxEvent.update.mockClear();
    prismaMock.outboxEvent.updateMany?.mockClear();
    prismaMock.outboxEvent.findUnique?.mockClear();
    prismaMock.operation.findUnique.mockClear();
    prismaMock.operation.create.mockClear();
  });

  it("enfileira notificação para earned", async () => {
    const result = await handleLoyaltyOutboxEvent({
      eventType: "LOYALTY_EARNED",
      payload: { ledgerId: "ledger_1" },
    });

    expect(result).toEqual({ ok: true });
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey: "loyalty:ledger_1:LOYALTY_EARNED",
        notificationType: "LOYALTY_EARNED",
        userId: "user_1",
      }),
    );
  });

  it("ignora mismatch de evento", async () => {
    const result = await handleLoyaltyOutboxEvent({
      eventType: "LOYALTY_SPENT",
      payload: { ledgerId: "ledger_1" },
    });

    expect(result).toEqual({ ok: false, code: "EVENT_MISMATCH" });
  });

  it("recorda outbox para earned/spent na mesma tx", async () => {
    await recordLoyaltyLedgerOutbox({ ...(ledgerState as any), entryType: "EARN" });
    await recordLoyaltyLedgerOutbox({ ...(ledgerState as any), entryType: "SPEND" });

    expect(recordOutboxMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "LOYALTY_EARNED",
        payload: { ledgerId: "ledger_1" },
      }),
      expect.anything(),
    );
    expect(recordOutboxMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "LOYALTY_SPENT",
        payload: { ledgerId: "ledger_1" },
      }),
      expect.anything(),
    );
  });

  it("consumer é idempotente por dedupeKey (mesmo eventId 2x)", async () => {
    const input = { eventType: "LOYALTY_EARNED", payload: { ledgerId: "ledger_1" } };
    await handleLoyaltyOutboxEvent(input);
    await handleLoyaltyOutboxEvent(input);
    expect(enqueueMock).toHaveBeenCalledTimes(2);
    expect(enqueueMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ dedupeKey: "loyalty:ledger_1:LOYALTY_EARNED" }),
    );
    expect(enqueueMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ dedupeKey: "loyalty:ledger_1:LOYALTY_EARNED" }),
    );
  });

  it("retry/backoff + dead-letter no publisher", async () => {
    outboxEvents = [
      {
        eventId: "evt-2",
        eventType: "loyalty.earned",
        payload: {},
        attempts: OUTBOX_MAX_ATTEMPTS,
        publishedAt: null,
        nextAttemptAt: null,
        deadLetteredAt: null,
        createdAt: new Date("2024-01-01T00:00:00Z"),
      },
    ];
    const now = new Date("2024-01-01T00:00:00Z");
    currentNow = now;
    await publishOutboxBatch({ now });
    expect(outboxEvents[0].deadLetteredAt).toEqual(now);
    expect(outboxEvents[0].nextAttemptAt).toBeNull();
  });
});
