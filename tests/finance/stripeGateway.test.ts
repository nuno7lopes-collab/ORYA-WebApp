import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPaymentIntent, createRefund } from "@/domain/finance/gateway/stripeGateway";

vi.mock("@/lib/stripeClient", () => {
  const stripe = {
    paymentIntents: {
      create: vi.fn(),
      retrieve: vi.fn(),
      cancel: vi.fn(),
    },
    accounts: {
      create: vi.fn(),
      retrieve: vi.fn(),
    },
    accountLinks: {
      create: vi.fn(),
    },
    charges: {
      retrieve: vi.fn(),
    },
    refunds: {
      create: vi.fn(),
    },
    transfers: {
      create: vi.fn(),
    },
    webhooks: {
      constructEvent: vi.fn(),
    },
  };
  return { stripe, getStripeClient: () => stripe };
});

let paymentIntentCreate: ReturnType<typeof vi.fn>;
let refundCreate: ReturnType<typeof vi.fn>;

describe("stripeGateway connect enforcement", () => {
  beforeEach(async () => {
    const stripeClient = await import("@/lib/stripeClient");
    paymentIntentCreate = vi.mocked(stripeClient.stripe.paymentIntents["create"]);
    refundCreate = vi.mocked(stripeClient.stripe.refunds["create"]);
    paymentIntentCreate.mockReset();
    refundCreate.mockReset();
  });

  it("falha hard quando connect não está READY", async () => {
    await expect(
      createPaymentIntent(
        {
          amount: 100,
          currency: "eur",
          payment_method_types: ["card"],
        },
        {
          requireStripe: true,
          org: {
            stripeAccountId: null,
            stripeChargesEnabled: false,
            stripePayoutsEnabled: false,
            orgType: null,
          },
        },
      ),
    ).rejects.toThrow("FINANCE_CONNECT_NOT_READY");
    expect(paymentIntentCreate).not.toHaveBeenCalled();
  });

  it("permite quando connect READY e chama Stripe via gateway", async () => {
    paymentIntentCreate.mockResolvedValue({ id: "pi_test" });
    const result = await createPaymentIntent(
      {
        amount: 100,
        currency: "eur",
        payment_method_types: ["card"],
      },
      {
        requireStripe: true,
        org: {
          stripeAccountId: "acct_123",
          stripeChargesEnabled: true,
          stripePayoutsEnabled: true,
          orgType: null,
        },
      },
    );
    expect(paymentIntentCreate).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ id: "pi_test" });
  });

  it("propaga flags connect no createRefund", async () => {
    refundCreate.mockResolvedValue({ id: "re_test" });
    const result = await createRefund(
      {
        payment_intent: "pi_test",
        amount: 100,
      },
      {
        idempotencyKey: "refund:1",
        requireStripe: true,
        reverseTransfer: true,
        refundApplicationFee: true,
        org: {
          stripeAccountId: "acct_123",
          stripeChargesEnabled: true,
          stripePayoutsEnabled: true,
          orgType: null,
        },
      },
    );

    expect(refundCreate).toHaveBeenCalledWith(
      {
        payment_intent: "pi_test",
        amount: 100,
        reverse_transfer: true,
        refund_application_fee: true,
      },
      { idempotencyKey: "refund:1" },
    );
    expect(result).toEqual({ id: "re_test" });
  });
});
