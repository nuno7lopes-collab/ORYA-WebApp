import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/platformSettings", () => ({
  getPlatformFees: vi.fn(async () => ({ feeBps: 800, feeFixedCents: 30 })),
}));

import { backfillBookingConfirmationSnapshots } from "@/lib/reservas/backfillConfirmationSnapshot";

const bookingFindMany = vi.fn();
const bookingUpdate = vi.fn();
const organizationPolicyFindFirst = vi.fn();

const basePolicy = {
  id: 5,
  policyType: "MODERATE",
  cancellationWindowMinutes: 2880,
  guestBookingAllowed: false,
  noShowFeeCents: 0,
};

const makeBooking = (id: number, status: string) =>
  ({
    id,
    status,
    organizationId: 10,
    price: 10_000,
    currency: "EUR",
    createdAt: new Date("2026-01-20T10:00:00.000Z"),
    updatedAt: new Date("2026-01-21T10:00:00.000Z"),
    policyRef: { policyId: 5 },
    service: {
      policyId: 5,
      unitPriceCents: 10_000,
      currency: "EUR",
      organization: {
        feeMode: "ADDED",
        platformFeeBps: 800,
        platformFeeFixedCents: 30,
        orgType: "CLUB",
      },
    },
  }) as any;

describe("booking confirmation snapshot backfill", () => {
  beforeEach(() => {
    bookingFindMany.mockReset();
    bookingUpdate.mockReset();
    organizationPolicyFindFirst.mockReset();
    organizationPolicyFindFirst.mockResolvedValue(basePolicy);
  });

  it("dry-run não escreve mas conta corretamente", async () => {
    bookingFindMany.mockResolvedValue([makeBooking(1, "CONFIRMED")]);

    const summary = await backfillBookingConfirmationSnapshots(
      {
        booking: { findMany: bookingFindMany, update: bookingUpdate },
        organizationPolicy: { findFirst: organizationPolicyFindFirst },
      } as any,
      { dryRun: true, limit: 10 },
    );

    expect(summary.dryRun).toBe(true);
    expect(summary.scanned).toBe(1);
    expect(summary.updated).toBe(0);
    expect(summary.skipped).toBe(1);
    expect(bookingUpdate).not.toHaveBeenCalled();
  });

  it("respeita --limit e atualiza apenas o subset", async () => {
    const bookings = [makeBooking(2, "CONFIRMED"), makeBooking(3, "CONFIRMED")];
    bookingFindMany.mockImplementation(async (args: any) => bookings.slice(0, args.take));
    bookingUpdate.mockResolvedValue({ id: 2 });

    const summary = await backfillBookingConfirmationSnapshots(
      {
        booking: { findMany: bookingFindMany, update: bookingUpdate },
        organizationPolicy: { findFirst: organizationPolicyFindFirst },
      } as any,
      { dryRun: false, limit: 1 },
    );

    expect(summary.limit).toBe(1);
    expect(summary.scanned).toBe(1);
    expect(summary.updated).toBe(1);
    expect(bookingUpdate).toHaveBeenCalledTimes(1);
  });
});
