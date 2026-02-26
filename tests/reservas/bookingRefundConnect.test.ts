import { beforeEach, describe, expect, it, vi } from "vitest";

const retrievePaymentIntentMock = vi.hoisted(() => vi.fn());
const createRefundMock = vi.hoisted(() => vi.fn());
const cancelPaymentIntentMock = vi.hoisted(() => vi.fn());
const recordOutboxEventMock = vi.hoisted(() => vi.fn(() => ({ eventId: "evt_1" })));
const appendEventLogMock = vi.hoisted(() => vi.fn(() => ({})));

let bookingState: any = null;
let organizationState: any = null;
let paymentEventState: any = null;
let paymentState: any = null;

vi.mock("@/domain/finance/gateway/stripeGateway", () => ({
  retrievePaymentIntent: (...args: any[]) => retrievePaymentIntentMock(...args),
  createRefund: (...args: any[]) => createRefundMock(...args),
  cancelPaymentIntent: (...args: any[]) => cancelPaymentIntentMock(...args),
}));

vi.mock("@/domain/outbox/producer", () => ({
  recordOutboxEvent: (...args: any[]) => recordOutboxEventMock(...args),
}));

vi.mock("@/domain/eventLog/append", () => ({
  appendEventLog: (...args: any[]) => appendEventLogMock(...args),
}));

vi.mock("@/lib/prisma", () => {
  const booking = {
    findUnique: vi.fn(() => bookingState),
  };
  const organization = {
    findUnique: vi.fn(() => organizationState),
  };
  const paymentEvent = {
    findFirst: vi.fn(() => paymentEventState),
  };
  const payment = {
    findUnique: vi.fn(() => paymentState),
  };

  const prisma = {
    booking,
    organization,
    paymentEvent,
    payment,
    $transaction: async (fn: any) => fn(prisma),
  };

  return { prisma };
});

import { refundBookingPayment } from "@/lib/reservas/bookingRefund";
import { prisma } from "@/lib/prisma";

const prismaMock = vi.mocked(prisma);

function succeededIntent(amount: number) {
  return {
    id: "pi_1",
    status: "succeeded",
    amount,
    amount_received: amount,
    charges: {
      data: [{ id: "ch_1", status: "succeeded" }],
    },
  } as any;
}

describe("booking refund connect flags", () => {
  beforeEach(() => {
    bookingState = { organizationId: 10 };
    organizationState = {
      stripeAccountId: "acct_123",
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      orgType: "EXTERNAL",
    };
    paymentEventState = null;
    paymentState = null;

    retrievePaymentIntentMock.mockReset();
    createRefundMock.mockReset();
    cancelPaymentIntentMock.mockReset();
    recordOutboxEventMock.mockClear();
    appendEventLogMock.mockClear();
    prismaMock.booking.findUnique.mockClear();
    prismaMock.organization.findUnique.mockClear();
    prismaMock.paymentEvent.findFirst.mockClear();
    prismaMock.payment.findUnique.mockClear();
  });

  it("ativa reverse_transfer e refund_application_fee para org EXTERNAL", async () => {
    retrievePaymentIntentMock.mockResolvedValue(succeededIntent(1100));
    createRefundMock.mockResolvedValue({ id: "re_ext_1" });

    const refund = await refundBookingPayment({
      bookingId: 1,
      paymentIntentId: "pi_1",
      reason: "ORG_CANCEL",
      amountCents: 1100,
    });

    expect(refund).toEqual({ id: "re_ext_1" });
    expect(createRefundMock).toHaveBeenCalledTimes(1);
    expect(createRefundMock).toHaveBeenCalledWith(
      { payment_intent: "pi_1", amount: 1100 },
      expect.objectContaining({
        requireStripe: true,
        reverseTransfer: true,
        refundApplicationFee: true,
      }),
    );
  });

  it("nao ativa flags connect para org PLATFORM", async () => {
    organizationState = {
      stripeAccountId: null,
      stripeChargesEnabled: false,
      stripePayoutsEnabled: false,
      orgType: "PLATFORM",
    };
    retrievePaymentIntentMock.mockResolvedValue(succeededIntent(900));
    createRefundMock.mockResolvedValue({ id: "re_platform_1" });

    const refund = await refundBookingPayment({
      bookingId: 1,
      paymentIntentId: "pi_1",
      reason: "ORG_CANCEL",
      amountCents: 900,
    });

    expect(refund).toEqual({ id: "re_platform_1" });
    expect(createRefundMock).toHaveBeenCalledTimes(1);
    const refundOpts = createRefundMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(refundOpts.requireStripe).toBe(false);
    expect(refundOpts.reverseTransfer).toBeUndefined();
    expect(refundOpts.refundApplicationFee).toBeUndefined();
  });
});
