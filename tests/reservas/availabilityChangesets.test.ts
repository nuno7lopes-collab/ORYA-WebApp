import { describe, expect, it, vi } from "vitest";
import {
  applyAvailabilityChangeset,
  createAvailabilityChangeset,
  mapChangesetError,
  resolveChangesetConflict,
} from "@/lib/reservas/availabilityChangesets";

function createTxMock() {
  return {
    availabilityChangeSet: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    availabilityChangeConflict: {
      findFirst: vi.fn(),
      update: vi.fn(),
      createMany: vi.fn(),
      count: vi.fn(),
    },
    availabilitySchedule: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    weeklyAvailabilityTemplate: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    availabilityOverride: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      upsert: vi.fn(),
    },
    reservationResource: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    agendaItem: {
      findMany: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    classSession: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
    },
    bookingSplit: {
      update: vi.fn(),
    },
    bookingSplitParticipant: {
      updateMany: vi.fn(),
    },
  } as any;
}

function createDraftPayload() {
  return {
    scheduleId: 10,
    startDate: "2026-01-01",
    endDate: null,
    templates: [
      { dayOfWeek: 1, intervals: [{ startMinute: 600, endMinute: 660 }] },
      { dayOfWeek: 2, intervals: [] },
      { dayOfWeek: 3, intervals: [] },
      { dayOfWeek: 4, intervals: [] },
      { dayOfWeek: 5, intervals: [] },
      { dayOfWeek: 6, intervals: [] },
      { dayOfWeek: 0, intervals: [] },
    ],
    overrides: [],
  };
}

describe("availability changesets engine", () => {
  it("cria changeset pendente quando booking fica fora da disponibilidade", async () => {
    const tx = createTxMock();
    tx.availabilityChangeSet.findFirst.mockResolvedValue(null);
    tx.availabilitySchedule.findFirst.mockResolvedValue({ id: 10 });
    tx.availabilitySchedule.findMany.mockResolvedValue([
      {
        id: 10,
        scopeType: "ORGANIZATION",
        scopeId: 0,
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    tx.weeklyAvailabilityTemplate.findMany.mockResolvedValue([
      { availabilityId: 10, dayOfWeek: 1, intervals: [{ startMinute: 600, endMinute: 780 }] },
    ]);
    tx.availabilityOverride.findMany.mockResolvedValue([]);
    tx.reservationResource.findMany.mockResolvedValue([]);
    tx.booking.findMany.mockResolvedValue([
      {
        id: 501,
        startsAt: new Date("2026-02-23T12:00:00.000Z"),
        durationMinutes: 60,
        professionalId: null,
        resourceId: null,
        courtId: null,
      },
    ]);
    tx.classSession.findMany.mockResolvedValue([]);
    tx.agendaItem.findMany.mockResolvedValue([]);
    tx.availabilityChangeSet.create.mockImplementation(({ data }: any) => ({
      id: 77,
      status: data.status,
      scheduleId: data.scheduleId,
      createdAt: new Date(),
      updatedAt: new Date(),
      _count: {
        conflicts: data.conflicts?.createMany?.data?.length ?? 0,
      },
    }));

    const result = await createAvailabilityChangeset({
      tx,
      scope: {
        organizationId: 1,
        scopeType: "ORGANIZATION",
        scopeId: 0,
        timezone: "Europe/Lisbon",
      },
      draftInput: {
        ...createDraftPayload(),
        templates: { 1: [{ startMinute: 600, endMinute: 660 }] },
      },
      requestedByUserId: "user-1",
    });

    expect(result.status).toBe("PENDING");
    expect(result.conflictsOpen).toBe(1);
    expect(tx.availabilityChangeSet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conflicts: expect.objectContaining({
            createMany: expect.objectContaining({
              data: expect.arrayContaining([
                expect.objectContaining({
                  entityType: "BOOKING",
                  entityId: 501,
                  reasonCode: "OUTSIDE_AVAILABILITY",
                }),
              ]),
            }),
          }),
        }),
      }),
    );
  });

  it("cria conflito para aula agendada fora da disponibilidade resultante", async () => {
    const tx = createTxMock();
    tx.availabilityChangeSet.findFirst.mockResolvedValue(null);
    tx.availabilitySchedule.findFirst.mockResolvedValue({ id: 10 });
    tx.availabilitySchedule.findMany.mockResolvedValue([
      {
        id: 10,
        scopeType: "ORGANIZATION",
        scopeId: 0,
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    tx.weeklyAvailabilityTemplate.findMany.mockResolvedValue([
      { availabilityId: 10, dayOfWeek: 1, intervals: [{ startMinute: 600, endMinute: 780 }] },
    ]);
    tx.availabilityOverride.findMany.mockResolvedValue([]);
    tx.reservationResource.findMany.mockResolvedValue([]);
    tx.booking.findMany.mockResolvedValue([]);
    tx.classSession.findMany.mockResolvedValue([
      {
        id: 801,
        startsAt: new Date("2026-02-23T12:00:00.000Z"),
        endsAt: new Date("2026-02-23T13:00:00.000Z"),
        professionalId: null,
        courtId: null,
      },
    ]);
    tx.agendaItem.findMany.mockResolvedValue([]);
    tx.availabilityChangeSet.create.mockImplementation(({ data }: any) => ({
      id: 78,
      status: data.status,
      scheduleId: data.scheduleId,
      createdAt: new Date(),
      updatedAt: new Date(),
      _count: {
        conflicts: data.conflicts?.createMany?.data?.length ?? 0,
      },
    }));

    const result = await createAvailabilityChangeset({
      tx,
      scope: {
        organizationId: 1,
        scopeType: "ORGANIZATION",
        scopeId: 0,
        timezone: "Europe/Lisbon",
      },
      draftInput: {
        ...createDraftPayload(),
        templates: { 1: [{ startMinute: 600, endMinute: 660 }] },
      },
      requestedByUserId: "user-2",
    });

    expect(result.status).toBe("PENDING");
    expect(result.conflictsOpen).toBe(1);
    expect(tx.availabilityChangeSet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conflicts: expect.objectContaining({
            createMany: expect.objectContaining({
              data: expect.arrayContaining([
                expect.objectContaining({
                  entityType: "CLASS_SESSION",
                  entityId: 801,
                  reasonCode: "OUTSIDE_AVAILABILITY",
                }),
              ]),
            }),
          }),
        }),
      }),
    );
  });

  it("cria conflito para match fora da disponibilidade resultante", async () => {
    const tx = createTxMock();
    tx.availabilityChangeSet.findFirst.mockResolvedValue(null);
    tx.availabilitySchedule.findFirst.mockResolvedValue({ id: 10 });
    tx.availabilitySchedule.findMany.mockResolvedValue([
      {
        id: 10,
        scopeType: "ORGANIZATION",
        scopeId: 0,
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    tx.weeklyAvailabilityTemplate.findMany.mockResolvedValue([
      { availabilityId: 10, dayOfWeek: 1, intervals: [{ startMinute: 600, endMinute: 660 }] },
    ]);
    tx.availabilityOverride.findMany.mockResolvedValue([]);
    tx.reservationResource.findMany.mockResolvedValue([]);
    tx.booking.findMany.mockResolvedValue([]);
    tx.classSession.findMany.mockResolvedValue([]);
    tx.agendaItem.findMany.mockResolvedValue([
      {
        sourceType: "MATCH",
        sourceId: "4201",
        startsAt: new Date("2026-02-23T12:00:00.000Z"),
        endsAt: new Date("2026-02-23T13:00:00.000Z"),
        professionalId: null,
        resourceId: null,
        courtId: null,
      },
    ]);
    tx.availabilityChangeSet.create.mockImplementation(({ data }: any) => ({
      id: 79,
      status: data.status,
      scheduleId: data.scheduleId,
      createdAt: new Date(),
      updatedAt: new Date(),
      _count: {
        conflicts: data.conflicts?.createMany?.data?.length ?? 0,
      },
    }));

    const result = await createAvailabilityChangeset({
      tx,
      scope: {
        organizationId: 1,
        scopeType: "ORGANIZATION",
        scopeId: 0,
        timezone: "Europe/Lisbon",
      },
      draftInput: {
        ...createDraftPayload(),
        templates: { 1: [{ startMinute: 600, endMinute: 660 }] },
      },
      requestedByUserId: "user-match",
    });

    expect(result.status).toBe("PENDING");
    expect(result.conflictsOpen).toBe(1);
    expect(tx.availabilityChangeSet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conflicts: expect.objectContaining({
            createMany: expect.objectContaining({
              data: expect.arrayContaining([
                expect.objectContaining({
                  entityType: "MATCH",
                  entityId: 4201,
                  reasonCode: "OUTSIDE_AVAILABILITY",
                }),
              ]),
            }),
          }),
        }),
      }),
    );
  });

  it("bloqueia apply enquanto existirem conflitos abertos", async () => {
    const tx = createTxMock();
    const draftPayload = createDraftPayload();

    tx.availabilityChangeSet.findFirst
      .mockResolvedValueOnce({
        id: 91,
        organizationId: 1,
        scopeType: "ORGANIZATION",
        scopeId: 0,
        scheduleId: 10,
        status: "PENDING",
        draftPayload,
        preflightSummary: {},
      })
      .mockResolvedValueOnce({
        id: 91,
        organizationId: 1,
        scopeType: "ORGANIZATION",
        scopeId: 0,
        draftPayload,
        preflightSummary: {},
        status: "PENDING",
        conflicts: [],
      });

    tx.organization.findUnique.mockResolvedValue({ timezone: "Europe/Lisbon" });
    tx.availabilitySchedule.findFirst.mockResolvedValue({ id: 10 });
    tx.availabilitySchedule.findMany.mockResolvedValue([]);
    tx.weeklyAvailabilityTemplate.findMany.mockResolvedValue([]);
    tx.availabilityOverride.findMany.mockResolvedValue([]);
    tx.reservationResource.findMany.mockResolvedValue([]);
    tx.booking.findMany.mockResolvedValue([]);
    tx.classSession.findMany.mockResolvedValue([]);
    tx.agendaItem.findMany.mockResolvedValue([]);
    tx.availabilityChangeConflict.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    tx.availabilityChangeSet.update.mockResolvedValue({ id: 91 });

    await expect(
      applyAvailabilityChangeset({
        tx,
        changeSetId: 91,
        organizationId: 1,
      }),
    ).rejects.toThrow("AVAILABILITY_CHANGESET_NOT_READY");
  });

  it("deteta conflitos novos no refresh imediatamente antes de aplicar", async () => {
    const tx = createTxMock();
    const draftPayload = createDraftPayload();

    tx.availabilityChangeSet.findFirst
      .mockResolvedValueOnce({
        id: 93,
        organizationId: 1,
        scopeType: "ORGANIZATION",
        scopeId: 0,
        scheduleId: 10,
        status: "READY_TO_APPLY",
        draftPayload,
        preflightSummary: {},
      })
      .mockResolvedValueOnce({
        id: 93,
        organizationId: 1,
        scopeType: "ORGANIZATION",
        scopeId: 0,
        draftPayload,
        preflightSummary: {},
        status: "READY_TO_APPLY",
        conflicts: [],
      });

    tx.organization.findUnique.mockResolvedValue({ timezone: "Europe/Lisbon" });
    tx.availabilitySchedule.findFirst.mockResolvedValue({ id: 10 });
    tx.availabilitySchedule.findMany.mockResolvedValue([
      {
        id: 10,
        scopeType: "ORGANIZATION",
        scopeId: 0,
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    tx.weeklyAvailabilityTemplate.findMany.mockResolvedValue([
      { availabilityId: 10, dayOfWeek: 1, intervals: [{ startMinute: 600, endMinute: 660 }] },
    ]);
    tx.availabilityOverride.findMany.mockResolvedValue([]);
    tx.reservationResource.findMany.mockResolvedValue([]);
    tx.booking.findMany.mockResolvedValue([
      {
        id: 777,
        startsAt: new Date("2026-02-23T12:00:00.000Z"),
        durationMinutes: 60,
        professionalId: null,
        resourceId: null,
        courtId: null,
      },
    ]);
    tx.classSession.findMany.mockResolvedValue([]);
    tx.agendaItem.findMany.mockResolvedValue([]);
    tx.availabilityChangeConflict.createMany.mockResolvedValue({ count: 1 });
    tx.availabilityChangeConflict.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    tx.availabilityChangeSet.update.mockResolvedValue({ id: 93 });

    await expect(
      applyAvailabilityChangeset({
        tx,
        changeSetId: 93,
        organizationId: 1,
      }),
    ).rejects.toThrow("AVAILABILITY_CHANGESET_NOT_READY");

    expect(tx.availabilityChangeConflict.createMany).toHaveBeenCalledTimes(1);
  });

  it("aplica changeset quando nao existem conflitos abertos", async () => {
    const tx = createTxMock();
    const draftPayload = {
      ...createDraftPayload(),
      scheduleId: null,
      overrides: [{ date: "2026-02-24", kind: "BLOCK", intervals: [{ startMinute: 840, endMinute: 900 }] }],
    };

    tx.availabilityChangeSet.findFirst
      .mockResolvedValueOnce({
        id: 92,
        organizationId: 1,
        scopeType: "ORGANIZATION",
        scopeId: 0,
        scheduleId: null,
        status: "READY_TO_APPLY",
        draftPayload,
        preflightSummary: {},
      })
      .mockResolvedValueOnce({
        id: 92,
        organizationId: 1,
        scopeType: "ORGANIZATION",
        scopeId: 0,
        draftPayload,
        preflightSummary: {},
        status: "READY_TO_APPLY",
        conflicts: [],
      });

    tx.organization.findUnique.mockResolvedValue({ timezone: "Europe/Lisbon" });
    tx.availabilitySchedule.findMany.mockResolvedValue([]);
    tx.weeklyAvailabilityTemplate.findMany.mockResolvedValue([]);
    tx.availabilityOverride.findMany.mockResolvedValue([]);
    tx.reservationResource.findMany.mockResolvedValue([]);
    tx.booking.findMany.mockResolvedValue([]);
    tx.classSession.findMany.mockResolvedValue([]);
    tx.agendaItem.findMany.mockResolvedValue([]);
    tx.availabilityChangeConflict.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    tx.availabilitySchedule.create.mockResolvedValue({ id: 999 });
    tx.weeklyAvailabilityTemplate.deleteMany.mockResolvedValue({ count: 0 });
    tx.weeklyAvailabilityTemplate.createMany.mockResolvedValue({ count: 1 });
    tx.availabilityOverride.deleteMany.mockResolvedValue({ count: 0 });
    tx.availabilityOverride.upsert.mockResolvedValue({ id: 1001 });
    tx.availabilityChangeSet.update.mockResolvedValue({ id: 92 });

    const result = await applyAvailabilityChangeset({
      tx,
      changeSetId: 92,
      organizationId: 1,
    });

    expect(result).toEqual({
      applied: true,
      alreadyApplied: false,
      scheduleId: 999,
    });
    expect(tx.weeklyAvailabilityTemplate.createMany).toHaveBeenCalledTimes(1);
    expect(tx.availabilityOverride.upsert).toHaveBeenCalledTimes(1);
  });

  it("rejeita scheduleId fora do escopo do changeset", async () => {
    const tx = createTxMock();
    tx.availabilityChangeSet.findFirst.mockResolvedValue(null);
    tx.availabilitySchedule.findFirst.mockResolvedValue(null);

    await expect(
      createAvailabilityChangeset({
        tx,
        scope: {
          organizationId: 1,
          scopeType: "ORGANIZATION",
          scopeId: 0,
          timezone: "Europe/Lisbon",
        },
        draftInput: createDraftPayload(),
        requestedByUserId: "user-3",
      }),
    ).rejects.toThrow("AVAILABILITY_SCHEDULE_INVALID_SCOPE");
  });

  it("exige resolução externa para conflitos não canceláveis", async () => {
    const tx = createTxMock();
    tx.availabilityChangeSet.findFirst.mockResolvedValue({
      id: 501,
      organizationId: 1,
      scopeType: "ORGANIZATION",
      scopeId: 0,
      status: "PENDING",
      preflightSummary: {},
    });
    tx.availabilityChangeConflict.findFirst.mockResolvedValue({
      id: 601,
      status: "OPEN",
      entityType: "MATCH",
      entityId: 7001,
    });

    await expect(
      resolveChangesetConflict({
        tx,
        organizationId: 1,
        changeSetId: 501,
        conflictId: 601,
        action: "CANCEL",
        actorUserId: "user-1",
        actorRole: "ADMIN",
      }),
    ).rejects.toThrow("CONFLICT_EXTERNAL_RESOLUTION_REQUIRED");
  });

  it("propaga details no mapeamento de AVAILABILITY_CHANGESET_NOT_READY", () => {
    const error = new Error("AVAILABILITY_CHANGESET_NOT_READY") as Error & { details?: Record<string, unknown> };
    error.details = { conflictsOpen: 3 };

    const mapped = mapChangesetError(error);
    expect(mapped.status).toBe(409);
    expect(mapped.errorCode).toBe("AVAILABILITY_CHANGESET_NOT_READY");
    expect(mapped.details).toEqual({ conflictsOpen: 3 });
  });
});
