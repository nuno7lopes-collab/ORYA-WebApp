import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAgendaItemsForOrganization } from "@/domain/agendaReadModel/query";
import { SourceType } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  agendaFindMany: vi.fn(),
  bookingFindMany: vi.fn(),
  classSessionFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agendaItem: { findMany: mocks.agendaFindMany },
    booking: { findMany: mocks.bookingFindMany },
    classSession: { findMany: mocks.classSessionFindMany },
  },
}));

describe("agenda query", () => {
  beforeEach(() => {
    mocks.agendaFindMany.mockReset();
    mocks.bookingFindMany.mockReset();
    mocks.classSessionFindMany.mockReset();
    mocks.agendaFindMany.mockResolvedValue([]);
    mocks.bookingFindMany.mockResolvedValue([]);
    mocks.classSessionFindMany.mockResolvedValue([]);
  });

  it("filtra por org e range", async () => {
    const from = new Date("2025-01-01T00:00:00Z");
    const to = new Date("2025-01-31T23:59:59Z");
    const sourceId = "1";
    mocks.agendaFindMany.mockResolvedValue([
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
    expect(mocks.agendaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 1, startsAt: { lte: to }, endsAt: { gte: from } }),
      }),
    );
    expect(res).toHaveLength(1);
  });

  it("filtra por clube e court quando fornecidos", async () => {
    const from = new Date("2025-02-01T00:00:00Z");
    const to = new Date("2025-02-28T23:59:59Z");

    await getAgendaItemsForOrganization({ organizationId: 9, from, to, padelClubId: 3, courtId: 7 });
    expect(mocks.agendaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 9, padelClubId: 3, courtId: 7 }),
      }),
    );
    expect(mocks.bookingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 9,
          courtId: 7,
          court: { padelClubId: 3 },
        }),
      }),
    );
  });

  it("mapeia CLASS_SESSION para kind CLASS", async () => {
    const from = new Date("2025-03-01T00:00:00Z");
    const to = new Date("2025-03-31T23:59:59Z");
    mocks.classSessionFindMany.mockResolvedValue([
      {
        id: 42,
        startsAt: from,
        endsAt: to,
        status: "SCHEDULED",
        courtId: 7,
        court: { padelClubId: 9 },
        service: { title: "Aula de Pádel" },
        professionalId: 11,
      },
    ]);

    const res = await getAgendaItemsForOrganization({
      organizationId: 3,
      from,
      to,
      sourceTypes: [SourceType.CLASS_SESSION],
    });
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

  it("exclui pendentes de reservas cujo início já passou", async () => {
    const now = new Date();
    const from = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const to = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    mocks.bookingFindMany.mockResolvedValue([
      {
        id: 10,
        startsAt: new Date(now.getTime() - 60 * 60 * 1000),
        durationMinutes: 60,
        status: "PENDING",
        courtId: null,
        resourceId: null,
        professionalId: null,
        court: null,
        service: { title: "Reserva" },
      },
      {
        id: 11,
        startsAt: new Date(now.getTime() + 30 * 60 * 1000),
        durationMinutes: 60,
        status: "CONFIRMED",
        courtId: null,
        resourceId: null,
        professionalId: null,
        court: null,
        service: { title: "Reserva confirmada" },
      },
    ]);

    const items = await getAgendaItemsForOrganization({
      organizationId: 7,
      from,
      to,
      sourceTypes: [SourceType.BOOKING],
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: "RESERVATION",
      reservationId: 11,
      status: "CONFIRMED",
    });
    expect(mocks.bookingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 7,
          startsAt: expect.objectContaining({
            lte: to,
            gte: expect.any(Date),
          }),
        }),
      }),
    );
  });

  it("prioriza booking transacional confirmado mesmo com read model stale", async () => {
    const from = new Date("2026-03-02T00:00:00.000Z");
    const to = new Date("2026-03-08T23:59:59.999Z");
    mocks.agendaFindMany.mockResolvedValue([
      {
        title: "Reserva stale",
        startsAt: new Date("2026-03-03T10:00:00.000Z"),
        endsAt: new Date("2026-03-03T11:00:00.000Z"),
        sourceType: SourceType.BOOKING,
        sourceId: "50",
        status: "CANCELLED_BY_ORG",
        padelClubId: null,
        courtId: null,
        resourceId: null,
        professionalId: null,
      },
    ]);
    mocks.bookingFindMany.mockResolvedValue([
      {
        id: 50,
        startsAt: new Date("2026-03-03T10:00:00.000Z"),
        durationMinutes: 60,
        status: "CONFIRMED",
        courtId: null,
        resourceId: null,
        professionalId: null,
        court: null,
        service: { title: "Reserva real" },
      },
    ]);

    const items = await getAgendaItemsForOrganization({ organizationId: 2, from, to });

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "RESERVATION",
          reservationId: 50,
          status: "CONFIRMED",
          title: "Reserva real",
        }),
      ]),
    );
    expect(mocks.agendaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sourceType: { in: [SourceType.EVENT, SourceType.TOURNAMENT] },
        }),
      }),
    );
  });
});
