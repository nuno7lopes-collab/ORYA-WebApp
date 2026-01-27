import { beforeEach, describe, expect, it, vi } from "vitest";
import { SourceType } from "@prisma/client";
import { consumeAgendaMaterializationEvent } from "@/domain/agendaReadModel/consumer";

const mocks = vi.hoisted(() => ({
  eventLogFindUnique: vi.fn(),
  agendaFindUnique: vi.fn(),
  agendaUpsert: vi.fn(),
  eventFindUnique: vi.fn(),
  tournamentFindUnique: vi.fn(),
  bookingFindUnique: vi.fn(),
  softBlockFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    eventLog: { findUnique: mocks.eventLogFindUnique },
    agendaItem: {
      findUnique: mocks.agendaFindUnique,
      upsert: mocks.agendaUpsert,
    },
    event: { findUnique: mocks.eventFindUnique },
    tournament: { findUnique: mocks.tournamentFindUnique },
    booking: { findUnique: mocks.bookingFindUnique },
    softBlock: { findUnique: mocks.softBlockFindUnique },
  },
}));

describe("agenda consumer", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset());
  });

  it("materializa item de evento (allowlist)", async () => {
    const createdAt = new Date("2025-01-01T10:00:00Z");
    const sourceId = "10";
    mocks.eventLogFindUnique.mockResolvedValue({
      id: "evt-1",
      organizationId: 1,
      eventType: "event.created",
      payload: {
        eventId: 10,
        title: "Evento",
        startsAt: createdAt.toISOString(),
        endsAt: createdAt.toISOString(),
        status: "PUBLISHED",
      },
      createdAt,
    });
    mocks.agendaFindUnique.mockResolvedValue(null);

    const res = await consumeAgendaMaterializationEvent("evt-1");
    expect(res.ok).toBe(true);
    expect(mocks.agendaUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          organizationId: 1,
          sourceType: SourceType.EVENT,
          sourceId,
          title: "Evento",
          status: "PUBLISHED",
          lastEventId: "evt-1",
        }),
      }),
    );
  });

  it("dedupe por lastEventId", async () => {
    const createdAt = new Date("2025-01-02T10:00:00Z");
    mocks.eventLogFindUnique.mockResolvedValue({
      id: "evt-2",
      organizationId: 1,
      eventType: "event.updated",
      payload: { eventId: 11, title: "Evento", startsAt: createdAt, endsAt: createdAt, status: "PUBLISHED" },
      createdAt,
    });
    mocks.agendaFindUnique.mockResolvedValue({
      lastEventId: "evt-2",
      updatedAt: createdAt,
    });

    const res = await consumeAgendaMaterializationEvent("evt-2");
    expect(res.ok).toBe(true);
    expect(mocks.agendaUpsert).not.toHaveBeenCalled();
  });

  it("ignora eventos fora da allowlist", async () => {
    mocks.eventLogFindUnique.mockResolvedValue({
      id: "evt-3",
      organizationId: 1,
      eventType: "payment.status.changed",
      payload: {},
      createdAt: new Date(),
    });

    const res = await consumeAgendaMaterializationEvent("evt-3");
    expect(res.ok).toBe(true);
    expect(mocks.agendaUpsert).not.toHaveBeenCalled();
  });

  it("dedupe soft block por lastEventId", async () => {
    const createdAt = new Date("2025-01-03T10:00:00Z");
    mocks.eventLogFindUnique.mockResolvedValue({
      id: "evt-4",
      organizationId: 1,
      eventType: "soft_block.updated",
      payload: {
        softBlockId: 12,
        title: "Bloqueio",
        startsAt: createdAt,
        endsAt: createdAt,
        status: "ACTIVE",
        sourceType: SourceType.SOFT_BLOCK,
        sourceId: "12",
      },
      createdAt,
    });
    mocks.agendaFindUnique.mockResolvedValue({
      lastEventId: "evt-4",
      updatedAt: createdAt,
    });

    const res = await consumeAgendaMaterializationEvent("evt-4");
    expect(res.ok).toBe(true);
    expect(mocks.agendaUpsert).not.toHaveBeenCalled();
  });

  it("materializa hard block deleted via payload", async () => {
    const createdAt = new Date("2025-01-04T10:00:00Z");
    mocks.eventLogFindUnique.mockResolvedValue({
      id: "evt-5",
      organizationId: 1,
      eventType: "hard_block.deleted",
      payload: {
        hardBlockId: 21,
        title: "Manutenção",
        startsAt: createdAt,
        endsAt: createdAt,
        status: "DELETED",
        sourceType: SourceType.HARD_BLOCK,
        sourceId: "21",
      },
      createdAt,
    });
    mocks.agendaFindUnique.mockResolvedValue(null);

    const res = await consumeAgendaMaterializationEvent("evt-5");
    expect(res.ok).toBe(true);
    expect(mocks.agendaUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          organizationId: 1,
          sourceType: SourceType.HARD_BLOCK,
          sourceId: "21",
          status: "DELETED",
          lastEventId: "evt-5",
        }),
      }),
    );
  });
});
