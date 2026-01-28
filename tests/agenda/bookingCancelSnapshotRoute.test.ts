import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  ensureAuthenticatedMock,
  recordOrganizationAuditMock,
  cancelBookingMock,
  refundBookingPaymentMock,
  bookingFindUnique,
  prismaMockShape,
} = vi.hoisted(() => {
  const ensureAuthenticatedMock = vi.fn();
  const recordOrganizationAuditMock = vi.fn();
  const cancelBookingMock = vi.fn();
  const refundBookingPaymentMock = vi.fn();
  const bookingFindUnique = vi.fn();
  const prismaMockShape = {
    booking: {
      findUnique: bookingFindUnique,
    },
    $transaction: vi.fn(async (fn: any) =>
      fn({
        booking: {
          findUnique: bookingFindUnique,
        },
      }),
    ),
  };

  return {
    ensureAuthenticatedMock,
    recordOrganizationAuditMock,
    cancelBookingMock,
    refundBookingPaymentMock,
    bookingFindUnique,
    prismaMockShape,
  };
});

vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServer: vi.fn(async () => ({})),
}));

vi.mock("@/lib/security", () => ({
  ensureAuthenticated: (...args: any[]) => ensureAuthenticatedMock(...args),
  isUnauthenticatedError: (err: any) => err?.message === "UNAUTHENTICATED",
}));

vi.mock("@/lib/http/requestContext", () => ({
  getRequestContext: () => ({ requestId: "req_test", correlationId: "corr_test" }),
  buildResponseHeaders: (_ctx: any, existing?: HeadersInit) => {
    const headers = new Headers(existing);
    headers.set("x-request-id", "req_test");
    headers.set("x-correlation-id", "corr_test");
    return headers;
  },
}));

vi.mock("@/lib/organizationAudit", () => ({
  recordOrganizationAudit: (...args: any[]) => recordOrganizationAuditMock(...args),
}));

vi.mock("@/domain/bookings/commands", () => ({
  cancelBooking: (...args: any[]) => cancelBookingMock(...args),
}));

vi.mock("@/lib/reservas/bookingRefund", () => ({
  refundBookingPayment: (...args: any[]) => refundBookingPaymentMock(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMockShape,
}));

import { POST } from "@/app/api/me/reservas/[id]/cancel/route";
import { prisma } from "@/lib/prisma";

const prismaMock = vi.mocked(prisma);

const snapshot = {
  version: 1,
  createdAt: "2026-01-27T12:00:00.000Z",
  currency: "EUR",
  policySnapshot: {
    policyId: 5,
    policyType: "MODERATE",
    cancellationWindowMinutes: 120,
    guestBookingAllowed: false,
    allowPayAtVenue: false,
    depositRequired: false,
    depositAmountCents: 0,
    noShowFeeCents: 0,
  },
  pricingSnapshot: {
    baseCents: 10_000,
    discountCents: 0,
    feeCents: 1_000,
    taxCents: 0,
    totalCents: 11_000,
    feeMode: "ADDED",
    platformFeeBps: 800,
    platformFeeFixedCents: 30,
    stripeFeeBps: 140,
    stripeFeeFixedCents: 25,
    stripeFeeEstimateCents: 179,
    cardPlatformFeeCents: 0,
    combinedFeeEstimateCents: 1_179,
  },
};

describe("booking cancel snapshot route", () => {
  beforeEach(() => {
    ensureAuthenticatedMock.mockReset();
    recordOrganizationAuditMock.mockReset();
    cancelBookingMock.mockReset();
    refundBookingPaymentMock.mockReset();
    bookingFindUnique.mockReset();
    prismaMock.$transaction.mockClear();
  });

  it("usa snapshot para calcular o reembolso", async () => {
    ensureAuthenticatedMock.mockResolvedValue({ id: "user-1" });
    bookingFindUnique.mockResolvedValue({
      id: 1,
      userId: "user-1",
      status: "CONFIRMED",
      startsAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
      paymentIntentId: "pi_1",
      organizationId: 10,
      serviceId: 20,
      availabilityId: null,
      snapshotTimezone: "Europe/Lisbon",
      confirmationSnapshot: snapshot,
    } as any);
    cancelBookingMock.mockResolvedValue({
      booking: { id: 1, status: "CANCELLED_BY_CLIENT" },
      outboxEventId: "evt_1",
    });

    const res = await POST(
      new Request("http://localhost/api/me/reservas/1/cancel", {
        method: "POST",
        body: JSON.stringify({ reason: "teste" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "1" }) },
    );

    expect(res.status).toBe(200);
    expect(refundBookingPaymentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 1,
        paymentIntentId: "pi_1",
        amountCents: snapshot.pricingSnapshot.totalCents,
      }),
    );
  });

  it("falha fechado quando snapshot falta numa reserva confirmada", async () => {
    ensureAuthenticatedMock.mockResolvedValue({ id: "user-1" });
    bookingFindUnique.mockResolvedValue({
      id: 2,
      userId: "user-1",
      status: "CONFIRMED",
      startsAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      paymentIntentId: "pi_2",
      organizationId: 10,
      serviceId: 21,
      availabilityId: null,
      snapshotTimezone: "Europe/Lisbon",
      confirmationSnapshot: null,
    } as any);

    const res = await POST(
      new Request("http://localhost/api/me/reservas/2/cancel", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "2" }) },
    );

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.errorCode).toBe("BOOKING_CONFIRMATION_SNAPSHOT_REQUIRED");
    expect(res.headers.get("x-request-id")).toBe("req_test");
    expect(res.headers.get("x-correlation-id")).toBe("corr_test");
    expect(refundBookingPaymentMock).not.toHaveBeenCalled();
  });
});
