import { beforeEach, describe, expect, it, vi } from "vitest";

const cancelBookingMock = vi.hoisted(() => vi.fn());
const recordOrganizationAuditMock = vi.hoisted(() => vi.fn());
const parseBookingConfirmationSnapshotMock = vi.hoisted(() => vi.fn());
const computeCancellationRefundFromSnapshotMock = vi.hoisted(() => vi.fn());
const buildBookingConfirmationSnapshotMock = vi.hoisted(() => vi.fn());

vi.mock("@/domain/bookings/commands", () => ({
  cancelBooking: (...args: any[]) => cancelBookingMock(...args),
}));

vi.mock("@/lib/organizationAudit", () => ({
  recordOrganizationAudit: (...args: any[]) => recordOrganizationAuditMock(...args),
}));

vi.mock("@/lib/reservas/confirmationSnapshot", () => ({
  BOOKING_CONFIRMATION_SNAPSHOT_VERSION: 5,
  parseBookingConfirmationSnapshot: (...args: any[]) => parseBookingConfirmationSnapshotMock(...args),
  computeCancellationRefundFromSnapshot: (...args: any[]) => computeCancellationRefundFromSnapshotMock(...args),
  buildBookingConfirmationSnapshot: (...args: any[]) => buildBookingConfirmationSnapshotMock(...args),
}));

import { cancelBookingByOrganizationInTx } from "@/lib/reservas/orgBookingCancellation";

function createBooking(overrides?: Record<string, unknown>) {
  const now = new Date("2026-02-26T10:00:00.000Z");
  return {
    id: 2653,
    userId: "u_1",
    guestEmail: null,
    status: "CONFIRMED",
    startsAt: new Date("2026-03-01T10:00:00.000Z"),
    price: 5_200,
    currency: "EUR",
    paymentIntentId: null,
    organizationId: 2,
    serviceId: 129,
    createdAt: new Date("2026-02-23T17:30:21.184Z"),
    updatedAt: now,
    snapshotTimezone: "Europe/Lisbon",
    confirmationSnapshot: null,
    policyRef: { policyId: 5 },
    service: {
      policyId: 5,
      unitPriceCents: 5_200,
      currency: "EUR",
      organization: {
        feeMode: "ADDED",
        platformFeeBps: 800,
        platformFeeFixedCents: 30,
        orgType: "CLUB",
      },
    },
    addons: [],
    bookingPackage: null,
    courtId: 316,
    resourceId: 321,
    professionalId: 358,
    splitPayment: null,
    ...overrides,
  } as any;
}

function createTx(booking: any) {
  return {
    booking: {
      findFirst: vi.fn(async () => booking),
      update: vi.fn(async () => ({ id: booking.id })),
    },
    bookingSplit: {
      update: vi.fn(async () => ({ id: 1 })),
    },
    bookingSplitParticipant: {
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
  } as any;
}

function fakeSnapshot() {
  return {
    version: 5,
    createdAt: "2026-02-23T17:30:21.184Z",
    currency: "EUR",
    policySnapshot: {
      policyId: 5,
      policyType: "MODERATE",
      allowCancellation: true,
      cancellationWindowMinutes: 2_880,
      cancellationPenaltyBps: 0,
      allowReschedule: true,
      rescheduleWindowMinutes: 2_880,
      guestBookingAllowed: true,
      noShowFeeCents: 0,
    },
    pricingSnapshot: {
      baseCents: 5_200,
      discountCents: 0,
      feeCents: 0,
      platformFeeCents: 0,
      combinedFeeCents: 0,
      processorFeesStatus: "PENDING",
      processorFeesActualCents: null,
      taxCents: 0,
      totalCents: 5_200,
      feeMode: "ADDED",
      platformFeeBps: 800,
      platformFeeFixedCents: 30,
      stripeFeeBps: 0,
      stripeFeeFixedCents: 0,
      cardPlatformFeeCents: 0,
    },
  } as any;
}

describe("org booking cancellation snapshot fallback", () => {
  beforeEach(() => {
    cancelBookingMock.mockReset();
    recordOrganizationAuditMock.mockReset();
    parseBookingConfirmationSnapshotMock.mockReset();
    computeCancellationRefundFromSnapshotMock.mockReset();
    buildBookingConfirmationSnapshotMock.mockReset();
  });

  it("sintetiza snapshot em reserva confirmada sem liquidação financeira", async () => {
    const booking = createBooking();
    const tx = createTx(booking);

    parseBookingConfirmationSnapshotMock.mockReturnValue(null);
    buildBookingConfirmationSnapshotMock.mockResolvedValue({
      ok: true,
      snapshot: fakeSnapshot(),
      policyId: 5,
    });
    computeCancellationRefundFromSnapshotMock.mockReturnValue({ refundCents: 5_200 });
    cancelBookingMock.mockResolvedValue({ booking: { id: booking.id, status: "CANCELLED_BY_ORG" } });

    const result = await cancelBookingByOrganizationInTx({
      tx,
      organizationId: 2,
      bookingId: booking.id,
      actorUserId: "admin_1",
      actorRole: "ADMIN",
    });

    expect(result.snapshotSynthesized).toBe(true);
    expect(tx.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: booking.id },
        data: expect.objectContaining({
          confirmationSnapshot: expect.any(Object),
          confirmationSnapshotVersion: 5,
          confirmationSnapshotCreatedAt: expect.any(Date),
        }),
      }),
    );
    expect(cancelBookingMock).toHaveBeenCalledTimes(1);
    expect(recordOrganizationAuditMock).toHaveBeenCalledTimes(1);
  });

  it("mantém fail-closed quando já existe liquidação financeira", async () => {
    const booking = createBooking({ paymentIntentId: "pi_123" });
    const tx = createTx(booking);

    parseBookingConfirmationSnapshotMock.mockReturnValue(null);

    await expect(
      cancelBookingByOrganizationInTx({
        tx,
        organizationId: 2,
        bookingId: booking.id,
        actorUserId: "admin_1",
        actorRole: "ADMIN",
      }),
    ).rejects.toThrow("BOOKING_CONFIRMATION_SNAPSHOT_REQUIRED");

    expect(buildBookingConfirmationSnapshotMock).not.toHaveBeenCalled();
    expect(cancelBookingMock).not.toHaveBeenCalled();
  });
});
