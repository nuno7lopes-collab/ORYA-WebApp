import { beforeEach, describe, expect, it, vi } from "vitest";

import { recordOutboxEvent } from "@/domain/outbox/producer";
import { prisma } from "@/lib/prisma";

let outboxEvents: any[] = [];

vi.mock("@/lib/prisma", () => {
  const outboxEvent = {
    findUnique: vi.fn(({ where }: any) => outboxEvents.find((evt) => evt.dedupeKey === where.dedupeKey) ?? null),
    create: vi.fn(({ data }: any) => {
      outboxEvents.push(data);
      return data;
    }),
  };
  const prisma = { outboxEvent };
  return { prisma };
});

const prismaMock = vi.mocked(prisma);

describe("outbox producer", () => {
  beforeEach(() => {
    outboxEvents = [];
    prismaMock.outboxEvent.findUnique.mockClear();
    prismaMock.outboxEvent.create.mockClear();
  });

  it("dedupeKey garante 1 row para 2 emits", async () => {
    await recordOutboxEvent({ eventType: "test.event", payload: {}, dedupeKey: "order:123" });
    await recordOutboxEvent({ eventType: "test.event", payload: {}, dedupeKey: "order:123" });

    expect(outboxEvents.length).toBe(1);
    expect(outboxEvents[0].dedupeKey).toBe("order:123");
  });
});
