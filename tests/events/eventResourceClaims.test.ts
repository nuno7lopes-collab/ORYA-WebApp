import { afterEach, describe, expect, it, vi } from "vitest";
import { AvailabilityScopeType, EventStatus } from "@prisma/client";
import {
  EventResourceClaimsError,
  syncEventResourceClaims,
} from "@/lib/events/resourceClaims";

describe("event resource claims sync", () => {
  afterEach(() => {
    delete process.env.FEATURE_EVENT_CONSUMES_RESOURCES;
  });

  it("cria claims quando evento publicado não tem conflitos", async () => {
    process.env.FEATURE_EVENT_CONSUMES_RESOURCES = "true";

    const tx = {
      eventResource: {
        findMany: vi.fn().mockResolvedValue([
          { scopeType: AvailabilityScopeType.RESOURCE, scopeId: 10 },
        ]),
      },
      reservationResource: {
        findMany: vi.fn().mockResolvedValue([{ id: 10, courtId: null }]),
      },
      reservationProfessional: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      $executeRaw: vi.fn().mockResolvedValue(undefined),
      agendaResourceClaim: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      booking: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      classSession: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as any;

    const result = await syncEventResourceClaims({
      tx,
      organizationId: 12,
      eventId: 99,
      startsAt: new Date("2026-03-01T10:00:00.000Z"),
      endsAt: new Date("2026-03-01T11:00:00.000Z"),
      status: EventStatus.PUBLISHED,
      consumesResources: true,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.applied).toBe(true);
      expect(result.claimsCreated).toBe(1);
    }
    expect(tx.agendaResourceClaim.createMany).toHaveBeenCalledTimes(1);
  });

  it("falha com conflito 409 quando já existe booking sobreposto", async () => {
    process.env.FEATURE_EVENT_CONSUMES_RESOURCES = "true";

    const tx = {
      eventResource: {
        findMany: vi.fn().mockResolvedValue([
          { scopeType: AvailabilityScopeType.RESOURCE, scopeId: 10 },
        ]),
      },
      reservationResource: {
        findMany: vi.fn().mockResolvedValue([{ id: 10, courtId: null }]),
      },
      reservationProfessional: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      $executeRaw: vi.fn().mockResolvedValue(undefined),
      agendaResourceClaim: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      booking: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 501,
            status: "CONFIRMED",
            startsAt: new Date("2026-03-01T10:15:00.000Z"),
            durationMinutes: 45,
            pendingExpiresAt: null,
            updatedAt: new Date("2026-02-01T10:00:00.000Z"),
            professionalId: null,
            resourceId: 10,
            courtId: null,
          },
        ]),
      },
      classSession: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as any;

    await expect(
      syncEventResourceClaims({
        tx,
        organizationId: 12,
        eventId: 99,
        startsAt: new Date("2026-03-01T10:00:00.000Z"),
        endsAt: new Date("2026-03-01T11:00:00.000Z"),
        status: EventStatus.PUBLISHED,
        consumesResources: true,
      }),
    ).rejects.toMatchObject<EventResourceClaimsError>({
      status: 409,
      code: "EVENT_RESOURCES_CONFLICT",
    });

    expect(tx.agendaResourceClaim.createMany).not.toHaveBeenCalled();
  });
});
