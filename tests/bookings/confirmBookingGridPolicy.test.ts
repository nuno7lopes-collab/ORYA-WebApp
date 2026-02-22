import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/reservas/access", () => ({
  ensureReservasModuleAccess: vi.fn(async () => ({ ok: true })),
}));

import { confirmPendingBooking } from "@/lib/reservas/confirmBooking";

function makeBooking(overrides?: Partial<any>) {
  return {
    id: 1,
    organizationId: 100,
    serviceId: 200,
    userId: "u1",
    status: "PENDING_CONFIRMATION",
    startsAt: new Date("2026-01-12T10:15:00.000Z"),
    durationMinutes: 60,
    partySize: null,
    professionalId: null,
    resourceId: null,
    courtId: null,
    price: 1000,
    currency: "EUR",
    pendingExpiresAt: new Date("2026-01-12T12:00:00.000Z"),
    createdAt: new Date("2026-01-12T09:00:00.000Z"),
    snapshotTimezone: "Europe/Lisbon",
    confirmationSnapshot: null,
    confirmationSnapshotCreatedAt: null,
    confirmationSnapshotVersion: null,
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
      professionalLinks: [],
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

describe("confirmPendingBooking grid policy", () => {
  let tx: any;

  beforeEach(() => {
    tx = {
      booking: {
        findUnique: vi.fn(),
      },
      organizationSettings: {
        findUnique: vi.fn(),
      },
      $executeRaw: vi.fn(),
    };
  });

  it("recusa startsAt fora do grid configurado", async () => {
    tx.booking.findUnique.mockResolvedValue(makeBooking());
    tx.organizationSettings.findUnique.mockResolvedValue({
      bookingGridMinutes: 30,
      bookingAllowedDurations: [60, 90],
      bookingAllowCustomDuration: false,
    });

    const result = await confirmPendingBooking({ tx, bookingId: 1, ignoreExpiry: true });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_START_GRID");
    }
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it("recusa duração fora da policy quando custom está desativado", async () => {
    tx.booking.findUnique.mockResolvedValue(
      makeBooking({
        startsAt: new Date("2026-01-12T10:00:00.000Z"),
        durationMinutes: 45,
      }),
    );
    tx.organizationSettings.findUnique.mockResolvedValue({
      bookingGridMinutes: 30,
      bookingAllowedDurations: [60, 90],
      bookingAllowCustomDuration: false,
    });

    const result = await confirmPendingBooking({ tx, bookingId: 1, ignoreExpiry: true });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_DURATION_POLICY");
    }
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
