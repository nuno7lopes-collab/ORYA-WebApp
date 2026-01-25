import { describe, expect, it, vi, beforeEach } from "vitest";
import type Stripe from "stripe";
import { PendingPayoutStatus, SourceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripeClient";

let payoutState: any = null;

vi.mock("@/lib/prisma", () => {
  const pendingPayout = {
    findUnique: vi.fn(() => payoutState),
    updateMany: vi.fn((_args: any) => ({ count: 1 })),
    update: vi.fn(({ data }: any) => {
      payoutState = { ...payoutState, ...data };
      return payoutState;
    }),
  };
  const paymentEvent = {
    findUnique: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(null),
  };
  return { prisma: { pendingPayout, paymentEvent } };
});

vi.mock("@/lib/stripeClient", () => {
  const stripe = {
    accounts: { retrieve: vi.fn() },
    transfers: { create: vi.fn() },
  };
  return { stripe };
});

vi.mock("@/lib/operations/enqueue", () => ({
  enqueueOperation: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/observability/finance", () => ({
  logFinanceError: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    stripeWebhookSecret: "whsec_test",
  },
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {},
}));

vi.mock("@/lib/emailSender", () => ({
  sendPurchaseConfirmationEmail: vi.fn(),
  sendEntitlementDeliveredEmail: vi.fn(),
  sendClaimEmail: vi.fn(),
  sendRefundEmail: vi.fn(),
  sendImportantUpdateEmail: vi.fn(),
}));

vi.mock("@/lib/payments/pendingPayout", async () => {
  const actual = await vi.importActual<typeof import("@/lib/payments/pendingPayout")>("@/lib/payments/pendingPayout");
  return {
    ...actual,
    createPendingPayout: vi.fn().mockResolvedValue(null),
  };
});

const prismaMock = vi.mocked(prisma);
const stripeMock = vi.mocked(stripe);

describe("payout flow hardening", () => {
  beforeEach(() => {
    payoutState = {
      id: 1,
      status: PendingPayoutStatus.HELD,
      recipientConnectAccountId: "acct_123",
      amountCents: 700,
      currency: "EUR",
      paymentIntentId: "pi_123",
      holdUntil: new Date(Date.now() - 1000),
      retryCount: 0,
      nextAttemptAt: null,
    };
    prismaMock.pendingPayout.updateMany.mockReturnValue({ count: 1 });
    prismaMock.pendingPayout.update.mockImplementation(({ data }: any) => {
      payoutState = { ...payoutState, ...data };
      return payoutState;
    });
  });

  it("webhook creates PendingPayout on payment_intent.succeeded", async () => {
    const sourceId = "99";
    const { handleStripeEvent } = await import("@/app/api/stripe/webhook/route");
    const { createPendingPayout } = await import("@/lib/payments/pendingPayout");

    const event = {
      id: "evt_1",
      type: "payment_intent.succeeded",
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: "pi_123",
          amount: 1000,
          currency: "eur",
          livemode: false,
          latest_charge: { id: "ch_123", created: Math.floor(Date.now() / 1000) },
          metadata: {
            recipientConnectAccountId: "acct_123",
            payoutAmountCents: "700",
            grossAmountCents: "1000",
            platformFeeCents: "200",
            feeMode: "INCLUDED",
            sourceType: SourceType.TICKET_ORDER,
            sourceId,
            currency: "EUR",
            purchaseId: "purchase_1",
          },
        },
      },
    } as Stripe.Event;

    await handleStripeEvent(event);

    expect(createPendingPayout).toHaveBeenCalledTimes(1);
    expect(createPendingPayout).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentIntentId: "pi_123",
        amountCents: 700,
        recipientConnectAccountId: "acct_123",
        sourceType: SourceType.TICKET_ORDER,
        sourceId,
      }),
    );
  });

  it("release success creates transfer and marks RELEASED", async () => {
    const { releaseSinglePayout } = await import("@/lib/payments/releaseWorker");
    stripeMock.accounts.retrieve.mockResolvedValue({
      payouts_enabled: true,
      details_submitted: true,
      requirements: { currently_due: [] },
      capabilities: { transfers: "active" },
    });
    stripeMock.transfers.create.mockResolvedValue({ id: "tr_123" });

    const result = await releaseSinglePayout(1);

    expect(result.status).toBe("RELEASED");
    expect(payoutState.status).toBe(PendingPayoutStatus.RELEASED);
    expect(payoutState.transferId).toBe("tr_123");
  });

  it("release balance_insufficient retries and keeps HELD", async () => {
    const { releaseSinglePayout } = await import("@/lib/payments/releaseWorker");
    stripeMock.accounts.retrieve.mockResolvedValue({
      payouts_enabled: true,
      details_submitted: true,
      requirements: { currently_due: [] },
      capabilities: { transfers: "active" },
    });
    const error = { code: "balance_insufficient", message: "insufficient available balance" };
    stripeMock.transfers.create.mockRejectedValue(error);

    const result = await releaseSinglePayout(1);

    expect(result.status).toBe("FAILED");
    expect(payoutState.status).toBe(PendingPayoutStatus.HELD);
    expect(payoutState.retryCount).toBe(1);
    expect(payoutState.nextAttemptAt).toBeInstanceOf(Date);
  });
});
