import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/internal/outbox/dlq/route";
import { POST } from "@/app/api/internal/outbox/replay/route";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => {
  const outboxEvent = {
    findMany: vi.fn(() => []),
    findUnique: vi.fn(() => null),
    update: vi.fn(() => ({ eventId: "evt-1" })),
  };
  const prisma = { outboxEvent };
  return { prisma };
});

const prismaMock = vi.mocked(prisma);

describe("outbox dlq endpoints", () => {
  beforeEach(() => {
    process.env.ORYA_CRON_SECRET = "secret";
    prismaMock.outboxEvent.findMany.mockReset();
    prismaMock.outboxEvent.findUnique.mockReset();
    prismaMock.outboxEvent.update.mockReset();
  });

  it("lista apenas dead-lettered", async () => {
    prismaMock.outboxEvent.findMany.mockResolvedValueOnce([
      {
        eventId: "evt-1",
        eventType: "PADREG_STATUS_CHANGED",
        attempts: 3,
        createdAt: new Date("2024-01-01T00:00:00Z"),
        deadLetteredAt: new Date("2024-01-02T00:00:00Z"),
        correlationId: "corr-1",
      },
    ] as any);

    const req = new NextRequest("http://localhost/api/internal/outbox/dlq?eventType=PADREG_STATUS_CHANGED", {
      headers: { "X-ORYA-CRON-SECRET": "secret" },
    });
    const res = await GET(req);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(prismaMock.outboxEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deadLetteredAt: { not: null }, publishedAt: null }),
      }),
    );
  });

  it("replay reativa dead-lettered", async () => {
    prismaMock.outboxEvent.findUnique.mockResolvedValueOnce({
      eventId: "evt-1",
      publishedAt: null,
      deadLetteredAt: new Date("2024-01-01T00:00:00Z"),
    } as any);

    const req = new NextRequest("http://localhost/api/internal/outbox/replay", {
      method: "POST",
      headers: {
        "X-ORYA-CRON-SECRET": "secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ eventId: "evt-1" }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(prismaMock.outboxEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventId: "evt-1" } }),
    );
  });

  it("replay falha se já publicado", async () => {
    prismaMock.outboxEvent.findUnique.mockResolvedValueOnce({
      eventId: "evt-1",
      publishedAt: new Date("2024-01-01T00:00:00Z"),
      deadLetteredAt: new Date("2024-01-01T00:00:00Z"),
    } as any);

    const req = new NextRequest("http://localhost/api/internal/outbox/replay", {
      method: "POST",
      headers: {
        "X-ORYA-CRON-SECRET": "secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ eventId: "evt-1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
