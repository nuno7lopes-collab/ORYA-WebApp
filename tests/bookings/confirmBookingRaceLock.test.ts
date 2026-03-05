import { describe, expect, it, vi } from "vitest";

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
    return [{ startsAt, durationMinutes: params.durationMinutes }];
  }),
}));

vi.mock("@/lib/reservas/availabilitySelect", () => ({
  getAvailableSlotsForScope: getAvailableSlotsForScopeMock,
}));

import { confirmPendingBooking } from "@/lib/reservas/confirmBooking";

type SharedBooking = {
  id: number;
  status: "PENDING_CONFIRMATION" | "CONFIRMED";
  pendingExpiresAt: Date;
};

const startsAt = new Date("2026-01-12T10:00:00.000Z");
const createdAt = new Date("2026-01-12T09:00:00.000Z");

function bookingRow(booking: SharedBooking) {
  return {
    id: booking.id,
    organizationId: 100,
    serviceId: 200,
    userId: null,
    status: booking.status,
    startsAt,
    durationMinutes: 60,
    partySize: null,
    professionalId: 10,
    resourceId: null,
    courtId: 7,
    price: 1000,
    currency: "EUR",
    pendingExpiresAt: booking.pendingExpiresAt,
    createdAt,
    snapshotTimezone: "Europe/Lisbon",
    confirmationSnapshot: {
      version: 1,
      createdAt: "2026-01-12T09:00:00.000Z",
      policySnapshot: { policyId: 1 },
    },
    confirmationSnapshotCreatedAt: createdAt,
    confirmationSnapshotVersion: 1,
    addons: [],
    bookingPackage: null,
    policyRef: { id: booking.id, policyId: 1 },
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
  };
}

function buildTransaction(
  shared: Map<number, SharedBooking>,
  lock: { acquire: (owner: string) => Promise<void>; release: (owner: string) => void },
  owner: string,
) {
  return {
    booking: {
      findUnique: vi.fn(async ({ where }: any) => {
        const row = shared.get(where.id);
        return row ? bookingRow(row) : null;
      }),
      findMany: vi.fn(async ({ where }: any) => {
        const excludedId = where?.NOT?.id ?? null;
        const confirmedRows = Array.from(shared.values()).filter(
          (row) => row.id !== excludedId && row.status === "CONFIRMED",
        );
        return confirmedRows.map((row) => ({
          startsAt,
          durationMinutes: 60,
          professionalId: 10,
          resourceId: null,
        }));
      }),
      update: vi.fn(async ({ where }: any) => {
        const row = shared.get(where.id);
        if (row) row.status = "CONFIRMED";
        return { id: where.id };
      }),
    },
    organizationSettings: {
      findUnique: vi.fn(async () => ({
        bookingGridMinutes: 30,
        bookingAllowedDurations: [60, 90],
        bookingAllowCustomDuration: false,
      })),
    },
    reservationProfessional: {
      findFirst: vi.fn(async () => ({ id: 10, priority: 1 })),
    },
    availabilitySchedule: {
      findMany: vi.fn(async () => [
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
      findMany: vi.fn(async () => []),
    },
    classSession: {
      findMany: vi.fn(async () => []),
    },
    agendaResourceClaim: {
      findMany: vi.fn(async () => []),
    },
    weeklyAvailabilityTemplate: {
      findMany: vi.fn(async () => [
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
    academyEnrollment: {
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    userActivity: {
      create: vi.fn(),
    },
    $executeRaw: vi.fn(async () => {
      await lock.acquire(owner);
    }),
  };
}

function createLock() {
  let currentOwner: string | null = null;
  const waiters: Array<() => void> = [];
  return {
    async acquire(owner: string) {
      if (!currentOwner) {
        currentOwner = owner;
        return;
      }
      await new Promise<void>((resolve) => waiters.push(resolve));
      currentOwner = owner;
    },
    release(owner: string) {
      if (currentOwner !== owner) return;
      currentOwner = null;
      const next = waiters.shift();
      if (next) next();
    },
  };
}

describe("confirmPendingBooking advisory lock race", () => {
  it("serializa duas confirmações concorrentes no mesmo court e bloqueia a segunda por conflito", async () => {
    getAvailableSlotsForScopeMock.mockClear();
    const shared = new Map<number, SharedBooking>([
      [1, { id: 1, status: "PENDING_CONFIRMATION", pendingExpiresAt: new Date("2026-01-12T12:00:00.000Z") }],
      [2, { id: 2, status: "PENDING_CONFIRMATION", pendingExpiresAt: new Date("2026-01-12T09:00:00.000Z") }],
    ]);
    const lock = createLock();
    const txA = buildTransaction(shared, lock, "txA");
    const txB = buildTransaction(shared, lock, "txB");
    const now = new Date("2026-01-12T09:30:00.000Z");

    const runA = confirmPendingBooking({
      tx: txA as any,
      bookingId: 1,
      ignoreExpiry: true,
      now,
    }).finally(() => lock.release("txA"));
    const runB = confirmPendingBooking({
      tx: txB as any,
      bookingId: 2,
      ignoreExpiry: true,
      now,
    }).finally(() => lock.release("txB"));

    const [resultA, resultB] = await Promise.all([runA, runB]);

    expect(resultA.ok).toBe(true);
    expect(resultB.ok).toBe(false);
    if (!resultB.ok) {
      expect(resultB.code).toBe("SLOT_TAKEN");
    }

    expect(txA.$executeRaw).toHaveBeenCalledTimes(1);
    expect(txB.$executeRaw).toHaveBeenCalledTimes(1);
    expect(txA.$executeRaw.mock.calls[0]?.[1]).toBe("booking:100");
    expect(txB.$executeRaw.mock.calls[0]?.[1]).toBe("booking:100");
    expect(shared.get(1)?.status).toBe("CONFIRMED");
    expect(shared.get(2)?.status).toBe("PENDING_CONFIRMATION");
  });
});
