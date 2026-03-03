import { beforeEach, describe, expect, it, vi } from "vitest";
import { SourceType } from "@prisma/client";
import { getAgendaItemsForOrganization } from "@/domain/agendaReadModel/query";

const mocks = vi.hoisted(() => ({
  agendaFindMany: vi.fn(),
  bookingFindMany: vi.fn(),
  classSessionFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agendaItem: {
      findMany: mocks.agendaFindMany,
    },
    booking: {
      findMany: mocks.bookingFindMany,
    },
    classSession: {
      findMany: mocks.classSessionFindMany,
    },
  },
}));

describe("agenda class-session contract", () => {
  beforeEach(() => {
    mocks.agendaFindMany.mockReset();
    mocks.bookingFindMany.mockReset();
    mocks.classSessionFindMany.mockReset();
    mocks.agendaFindMany.mockResolvedValue([]);
    mocks.bookingFindMany.mockResolvedValue([]);
    mocks.classSessionFindMany.mockResolvedValue([]);
  });

  it("devolve kind CLASS com classSessionId no contrato da agenda", async () => {
    const from = new Date("2026-02-22T00:00:00.000Z");
    const to = new Date("2026-02-22T23:59:59.999Z");

    mocks.classSessionFindMany.mockResolvedValue([
      {
        id: 77,
        startsAt: from,
        endsAt: to,
        status: "SCHEDULED",
        service: { title: "Aula Tática" },
        courtId: 9,
        court: { padelClubId: 3 },
        professionalId: 12,
      },
    ]);

    const items = await getAgendaItemsForOrganization({
      organizationId: 11,
      from,
      to,
      sourceTypes: [SourceType.CLASS_SESSION],
    });

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

    await getAgendaItemsForOrganization({
      organizationId: 11,
      from,
      to,
      scopeFilter: { courtIds: [9], professionalIds: [12] },
      scopeMode: "AND",
      sourceTypes: [SourceType.CLASS_SESSION],
    });

    expect(mocks.classSessionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          courtId: { in: [9] },
          professionalId: { in: [12] },
        }),
      }),
    );
  });
});
