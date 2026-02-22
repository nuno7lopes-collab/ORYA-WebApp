import { describe, expect, it, vi } from "vitest";
import { getAgendaItemsForOrganization } from "@/domain/agendaReadModel/query";
import { SourceType } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agendaItem: { findMany: mocks.findMany },
  },
}));

describe("agenda query", () => {
  it("filtra por org e range", async () => {
    const from = new Date("2025-01-01T00:00:00Z");
    const to = new Date("2025-01-31T23:59:59Z");
    const sourceId = "1";
    mocks.findMany.mockResolvedValue([
      {
        title: "Evento",
        startsAt: from,
        endsAt: to,
        sourceType: SourceType.EVENT,
        sourceId,
        status: "PUBLISHED",
      },
    ]);

    const res = await getAgendaItemsForOrganization({ organizationId: 1, from, to });
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 1, startsAt: { lte: to }, endsAt: { gte: from } }),
      }),
    );
    expect(res).toHaveLength(1);
  });

  it("filtra por clube e court quando fornecidos", async () => {
    const from = new Date("2025-02-01T00:00:00Z");
    const to = new Date("2025-02-28T23:59:59Z");
    mocks.findMany.mockResolvedValue([]);

    await getAgendaItemsForOrganization({ organizationId: 9, from, to, padelClubId: 3, courtId: 7 });
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 9, padelClubId: 3, courtId: 7 }),
      }),
    );
  });

  it("mapeia CLASS_SESSION para kind CLASS", async () => {
    const from = new Date("2025-03-01T00:00:00Z");
    const to = new Date("2025-03-31T23:59:59Z");
    mocks.findMany.mockResolvedValue([
      {
        title: "Aula de Pádel",
        startsAt: from,
        endsAt: to,
        sourceType: SourceType.CLASS_SESSION,
        sourceId: "42",
        status: "SCHEDULED",
        padelClubId: 9,
        courtId: 7,
        resourceId: null,
        professionalId: 11,
      },
    ]);

    const res = await getAgendaItemsForOrganization({ organizationId: 3, from, to });
    expect(res).toEqual([
      expect.objectContaining({
        kind: "CLASS",
        classSessionId: 42,
        status: "SCHEDULED",
        courtId: 7,
        professionalId: 11,
      }),
    ]);
  });
});
