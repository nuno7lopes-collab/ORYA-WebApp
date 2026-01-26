import { beforeEach, describe, expect, it, vi } from "vitest";
import { SourceType } from "@prisma/client";
import { rebuildAgendaItems } from "@/domain/agendaReadModel/consumer";

const mocks = vi.hoisted(() => ({
  softBlockFindMany: vi.fn(),
  bookingFindMany: vi.fn(),
  matchFindMany: vi.fn(),
  hardBlockFindMany: vi.fn(),
  agendaFindMany: vi.fn(),
  agendaUpsert: vi.fn(),
  agendaUpdate: vi.fn(),
  organizationFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    softBlock: { findMany: mocks.softBlockFindMany },
    booking: { findMany: mocks.bookingFindMany },
    padelMatch: { findMany: mocks.matchFindMany },
    padelCourtBlock: { findMany: mocks.hardBlockFindMany },
    agendaItem: {
      findMany: mocks.agendaFindMany,
      upsert: mocks.agendaUpsert,
      update: mocks.agendaUpdate,
    },
    organization: { findMany: mocks.organizationFindMany },
  },
}));

describe("agenda rebuild", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset());
  });

  it("rebuilds for org and marks missing as DELETED", async () => {
    const start = new Date("2025-01-10T10:00:00Z");
    const end = new Date("2025-01-10T11:00:00Z");

    mocks.softBlockFindMany
      .mockResolvedValueOnce([{ id: 1, startsAt: start, endsAt: end, reason: "Bloqueio" }])
      .mockResolvedValueOnce([]);
    mocks.bookingFindMany
      .mockResolvedValueOnce([
        {
          id: 2,
          startsAt: start,
          durationMinutes: 60,
          status: "CONFIRMED",
          service: { name: "Aula" },
        },
      ])
      .mockResolvedValueOnce([]);
    mocks.matchFindMany
      .mockResolvedValueOnce([
        {
          id: 3,
          plannedStartAt: start,
          plannedEndAt: end,
          plannedDurationMinutes: 60,
          startTime: null,
          status: "PENDING",
        },
      ])
      .mockResolvedValueOnce([]);
    mocks.hardBlockFindMany
      .mockResolvedValueOnce([{ id: 4, startAt: start, endAt: end, label: "Manut" }])
      .mockResolvedValueOnce([]);
    mocks.agendaFindMany
      .mockResolvedValueOnce([
        {
          id: "a-booking",
          sourceType: SourceType.BOOKING,
          sourceId: "2",
          title: "Aula",
          startsAt: start,
          endsAt: end,
          status: "CONFIRMED",
        },
        {
          id: "a-hard",
          sourceType: SourceType.HARD_BLOCK,
          sourceId: "4",
          title: "Antigo",
          startsAt: start,
          endsAt: end,
          status: "ACTIVE",
        },
        {
          id: "a-missing",
          sourceType: SourceType.SOFT_BLOCK,
          sourceId: "999",
          title: "Antigo",
          startsAt: start,
          endsAt: end,
          status: "ACTIVE",
        },
      ])
      .mockResolvedValueOnce([]);

    const res = await rebuildAgendaItems({ organizationId: 1 });

    expect(mocks.organizationFindMany).not.toHaveBeenCalled();

    const upsertTypes = mocks.agendaUpsert.mock.calls.map((call) => call[0].create.sourceType);
    expect(upsertTypes).toEqual(
      expect.arrayContaining([SourceType.SOFT_BLOCK, SourceType.MATCH, SourceType.HARD_BLOCK]),
    );
    expect(upsertTypes).not.toContain(SourceType.BOOKING);

    expect(mocks.agendaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "a-missing" },
        data: expect.objectContaining({ status: "DELETED" }),
      }),
    );

    expect(res.created).toBe(2);
    expect(res.updated).toBe(1);
    expect(res.deleted).toBe(1);
    expect(res.skipped).toBe(1);
  });
});
