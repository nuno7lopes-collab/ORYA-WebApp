import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgendaResourceClaimType } from "@prisma/client";

vi.mock("@/lib/reservas/access", () => ({
  ensureReservasModuleAccess: vi.fn(async () => ({ ok: true })),
}));

const { getAvailableSlotsForScopeMock } = vi.hoisted(() => ({
  getAvailableSlotsForScopeMock: vi.fn((params: any) => {
    const startsAt = new Date("2026-01-12T10:00:00.000Z");
    const endsAt = new Date(startsAt.getTime() + params.durationMinutes * 60 * 1000);
    const hasConflict = (params.blocks ?? []).some((block: any) => {
      if (params.scopeType === "PROFESSIONAL" && block.professionalId !== params.scopeId) return false;
      return startsAt < block.end && endsAt > block.start;
    });
    if (hasConflict) return [];
    return [{ startsAt, durationMinutes: 60 }];
  }),
}));

vi.mock("@/lib/reservas/availabilitySelect", () => ({
  getAvailableSlotsForScope: getAvailableSlotsForScopeMock,
}));

import { confirmPendingBooking } from "@/lib/reservas/confirmBooking";

function makeBooking(overrides?: Partial<any>) {
  return {
    id: 1,
    organizationId: 100,
    serviceId: 200,
    userId: null,
    status: "PENDING_CONFIRMATION",
    startsAt: new Date("2026-01-12T10:00:00.000Z"),
    durationMinutes: 60,
    partySize: null,
    professionalId: 10,
    resourceId: null,
    courtId: null,
    price: 1000,
    currency: "EUR",
    pendingExpiresAt: new Date("2026-01-12T12:00:00.000Z"),
    createdAt: new Date("2026-01-12T09:00:00.000Z"),
    snapshotTimezone: "Europe/Lisbon",
    confirmationSnapshot: {
      version: 1,
      createdAt: "2026-01-12T09:00:00.000Z",
      policySnapshot: { policyId: 1 },
    },
    confirmationSnapshotCreatedAt: new Date("2026-01-12T09:00:00.000Z"),
    confirmationSnapshotVersion: 1,
    addons: [],
    bookingPackage: null,
    policyRef: { id: 1, policyId: 1 },
    service: {
      id: 200,
      policyId: 1,
      kind: "GENERAL",
      assignmentMode: "PROFESSIONAL_ONLY",
      partySizeRequired: false,
      partySizeMin: 1,
      partySizeMax: 1,
      partySizeStep: 1,
      isActive: true,
      unitPriceCents: 1000,
      currency: "EUR",
      organizationId: 100,
      professionalLinks: [{ professionalId: 10, professional: { isActive: true } }],
      resourceLinks: [],
      organization: {
        primaryModule: "RESERVAS",
        reservationAssignmentMode: "PROFESSIONAL_ONLY",
        timezone: "Europe/Lisbon",
        feeMode: "ADDED",
        platformFeeBps: 0,
        platformFeeFixedCents: 0,
        orgType: "EXTERNAL",
      },
    },
    ...overrides,
  };
}

describe("confirmPendingBooking event claim conflicts", () => {
  let tx: any;

  beforeEach(() => {
    getAvailableSlotsForScopeMock.mockClear();
    tx = {
      booking: {
        findUnique: vi.fn().mockResolvedValue(makeBooking()),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
      },
      organizationSettings: {
        findUnique: vi.fn().mockResolvedValue({
          bookingGridMinutes: 30,
          bookingAllowedDurations: [60, 90],
          bookingAllowCustomDuration: false,
        }),
      },
      reservationProfessional: {
        findFirst: vi.fn().mockResolvedValue({ id: 10, priority: 1 }),
      },
      availabilitySchedule: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 900,
            scopeType: "ORGANIZATION",
            scopeId: 0,
            startDate: new Date("2026-01-01T00:00:00.000Z"),
            endDate: null,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        ]),
      },
      availabilityOverride: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      classSession: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      agendaResourceClaim: {
        findMany: vi.fn().mockResolvedValue([
          {
            sourceId: "99",
            startsAt: new Date("2026-01-12T10:00:00.000Z"),
            endsAt: new Date("2026-01-12T11:00:00.000Z"),
            resourceType: AgendaResourceClaimType.PROFESSIONAL,
            resourceId: "10",
          },
        ]),
      },
      weeklyAvailabilityTemplate: {
        findMany: vi.fn().mockResolvedValue([
          {
            availabilityId: 900,
            dayOfWeek: 1,
            intervals: [{ start: "08:00", end: "22:00" }],
          },
        ]),
      },
      bookingPolicyRef: {
        upsert: vi.fn(),
      },
      userActivity: {
        create: vi.fn(),
      },
      $executeRaw: vi.fn(async () => undefined),
    };
  });

  it("recusa confirmação quando existe claim de evento no mesmo profissional", async () => {
    const result = await confirmPendingBooking({
      tx,
      bookingId: 1,
      ignoreExpiry: true,
      now: new Date("2026-01-12T09:30:00.000Z"),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SLOT_TAKEN");
      expect(result.message).toBe("Horário já ocupado.");
    }
    expect(tx.agendaResourceClaim.findMany).toHaveBeenCalledTimes(1);
    expect(tx.booking.update).not.toHaveBeenCalled();
    expect(getAvailableSlotsForScopeMock).toHaveBeenCalledTimes(1);
    const firstCall = getAvailableSlotsForScopeMock.mock.calls[0]?.[0];
    expect(firstCall.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          professionalId: 10,
          resourceId: null,
          start: new Date("2026-01-12T10:00:00.000Z"),
          end: new Date("2026-01-12T11:00:00.000Z"),
        }),
      ]),
    );
  });
});
