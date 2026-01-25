import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleLoyaltyOutboxEvent, recordLoyaltyLedgerOutbox } from "@/domain/loyaltyOutbox";
import { publishOutboxBatch, OUTBOX_MAX_ATTEMPTS } from "@/domain/outbox/publisher";
import { enqueueNotification } from "@/domain/notifications/outbox";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { prisma } from "@/lib/prisma";

let ledgerState: any = null;
let outboxEvents: any[] = [];

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
    loyaltyLedger,
    outboxEvent,
    operation,
    $transaction: async (fn: any) => fn(prisma),
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
    prismaMock.loyaltyLedger.findUnique.mockClear();
    enqueueMock.mockClear();
    recordOutboxMock.mockClear();
    prismaMock.outboxEvent.findMany.mockClear();
    prismaMock.outboxEvent.update.mockClear();
    prismaMock.operation.upsert.mockReset();
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
        attempts: OUTBOX_MAX_ATTEMPTS - 1,
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
    expect(outboxEvents[0].deadLetteredAt).toEqual(now);
    expect(outboxEvents[0].nextAttemptAt).toBeNull();
  });
});
