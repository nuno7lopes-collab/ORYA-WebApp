import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  ensureAuthenticatedMock,
  getActiveOrganizationForUserMock,
  ensureReservasModuleAccessMock,
  recordOrganizationAuditMock,
  markNoShowBookingMock,
  refundBookingPaymentMock,
  profileFindUnique,
  bookingFindFirst,
  prismaMockShape,
} = vi.hoisted(() => {
  const ensureAuthenticatedMock = vi.fn();
  const getActiveOrganizationForUserMock = vi.fn();
  const ensureReservasModuleAccessMock = vi.fn();
  const recordOrganizationAuditMock = vi.fn();
  const markNoShowBookingMock = vi.fn();
  const refundBookingPaymentMock = vi.fn();
  const profileFindUnique = vi.fn();
  const bookingFindFirst = vi.fn();
  const prismaMockShape = {
    profile: { findUnique: profileFindUnique },
    booking: { findFirst: bookingFindFirst },
    $transaction: vi.fn(async (fn: any) =>
      fn({
        booking: { findFirst: bookingFindFirst },
      }),
    ),
  };

  return {
    ensureAuthenticatedMock,
    getActiveOrganizationForUserMock,
    ensureReservasModuleAccessMock,
    recordOrganizationAuditMock,
    markNoShowBookingMock,
    refundBookingPaymentMock,
    profileFindUnique,
    bookingFindFirst,
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

vi.mock("@/lib/organizationContext", () => ({
  getActiveOrganizationForUser: (...args: any[]) => getActiveOrganizationForUserMock(...args),
}));

vi.mock("@/lib/organizationId", () => ({
  resolveOrganizationIdFromRequest: () => null,
}));

vi.mock("@/lib/reservas/access", () => ({
  ensureReservasModuleAccess: (...args: any[]) => ensureReservasModuleAccessMock(...args),
}));

vi.mock("@/lib/http/requestContext", () => ({
  getRequestContext: () => ({ requestId: "req_test", correlationId: "corr_test" }),
  buildResponseHeaders: (_ctx: any, existing?: HeadersInit) => new Headers(existing),
}));

vi.mock("@/lib/organizationAudit", () => ({
  recordOrganizationAudit: (...args: any[]) => recordOrganizationAuditMock(...args),
}));

vi.mock("@/domain/bookings/commands", () => ({
  markNoShowBooking: (...args: any[]) => markNoShowBookingMock(...args),
}));

vi.mock("@/lib/reservas/bookingRefund", () => ({
  refundBookingPayment: (...args: any[]) => refundBookingPaymentMock(...args),
}));

vi.mock("@/lib/notifications", () => ({
  shouldNotify: vi.fn(async () => false),
  createNotification: vi.fn(async () => null),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMockShape,
}));

import { POST } from "@/app/api/organizacao/reservas/[id]/no-show/route";
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
    noShowFeeCents: 2_000,
  },
  pricingSnapshot: {
    baseCents: 10_000,
    discountCents: 0,
    feeCents: 0,
    taxCents: 0,
    totalCents: 10_000,
    feeMode: "INCLUDED",
    platformFeeBps: 800,
    platformFeeFixedCents: 30,
    stripeFeeBps: 140,
    stripeFeeFixedCents: 25,
    stripeFeeEstimateCents: 165,
    cardPlatformFeeCents: 0,
    combinedFeeEstimateCents: 165,
  },
};

describe("booking no-show snapshot route", () => {
  beforeEach(() => {
    ensureAuthenticatedMock.mockReset();
    getActiveOrganizationForUserMock.mockReset();
    ensureReservasModuleAccessMock.mockReset();
    recordOrganizationAuditMock.mockReset();
    markNoShowBookingMock.mockReset();
    refundBookingPaymentMock.mockReset();
    profileFindUnique.mockReset();
    bookingFindFirst.mockReset();
    prismaMock.$transaction.mockClear();

    ensureAuthenticatedMock.mockResolvedValue({ id: "user-1" });
    ensureReservasModuleAccessMock.mockResolvedValue({ ok: true });
    getActiveOrganizationForUserMock.mockResolvedValue({
      organization: { id: 10 },
      membership: { role: "ADMIN" },
    });
    profileFindUnique.mockResolvedValue({ id: "user-1" });
  });

  it("aplica no-show fee por snapshot e reembolsa o restante", async () => {
    bookingFindFirst.mockResolvedValue({
      id: 7,
      userId: "user-guest",
      status: "CONFIRMED",
      startsAt: new Date(Date.now() - 60 * 60 * 1000),
      paymentIntentId: "pi_7",
      organizationId: 10,
      serviceId: 70,
      snapshotTimezone: "Europe/Lisbon",
      confirmationSnapshot: snapshot,
      professional: { userId: "user-1" },
    } as any);
    markNoShowBookingMock.mockResolvedValue({
      booking: { id: 7, status: "NO_SHOW" },
      outboxEventId: "evt_7",
    });

    const res = await POST(
      new Request("http://localhost/api/organizacao/reservas/7/no-show", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "7" }) },
    );

    expect(res.status).toBe(200);
    expect(refundBookingPaymentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 7,
        paymentIntentId: "pi_7",
        amountCents: snapshot.pricingSnapshot.totalCents - snapshot.policySnapshot.noShowFeeCents,
        reason: "NO_SHOW_REFUND",
      }),
    );
  });
});
