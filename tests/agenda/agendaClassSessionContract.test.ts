import { beforeEach, describe, expect, it, vi } from "vitest";
import { SourceType } from "@prisma/client";
import { getAgendaItemsForOrganization } from "@/domain/agendaReadModel/query";

const findMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agendaItem: {
      findMany,
    },
  },
}));

describe("agenda class-session contract", () => {
  beforeEach(() => {
    findMany.mockReset();
  });

  it("devolve kind CLASS com classSessionId no contrato da agenda", async () => {
    const from = new Date("2026-02-22T00:00:00.000Z");
    const to = new Date("2026-02-22T23:59:59.999Z");

    findMany.mockResolvedValue([
      {
        title: "Aula Tática",
        startsAt: from,
        endsAt: to,
        sourceType: SourceType.CLASS_SESSION,
        sourceId: "77",
        status: "SCHEDULED",
        padelClubId: 3,
        courtId: 9,
        resourceId: null,
        professionalId: 12,
      },
    ]);

    const items = await getAgendaItemsForOrganization({ organizationId: 11, from, to });

    expect(items[0]).toMatchObject({
      kind: "CLASS",
      classSessionId: 77,
      courtId: 9,
      professionalId: 12,
    });
  });

  it("preserva filtros de court/professional para sessões de aula", async () => {
    const from = new Date("2026-02-22T00:00:00.000Z");
    const to = new Date("2026-02-22T23:59:59.999Z");
    findMany.mockResolvedValue([]);

    await getAgendaItemsForOrganization({
      organizationId: 11,
      from,
      to,
      scopeFilter: { courtIds: [9], professionalIds: [12] },
      scopeMode: "AND",
      sourceTypes: [SourceType.CLASS_SESSION],
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sourceType: { in: [SourceType.CLASS_SESSION] },
          courtId: { in: [9] },
          professionalId: { in: [12] },
        }),
      }),
    );
  });
});
