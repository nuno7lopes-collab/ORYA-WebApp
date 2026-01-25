import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPaymentIntent } from "@/domain/finance/gateway/stripeGateway";

vi.mock("@/lib/stripeClient", () => ({
  stripe: {
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
  },
}));

let paymentIntentCreate: ReturnType<typeof vi.fn>;

describe("stripeGateway connect enforcement", () => {
  beforeEach(async () => {
    const stripeClient = await import("@/lib/stripeClient");
    paymentIntentCreate = vi.mocked(stripeClient.stripe.paymentIntents["create"]);
    paymentIntentCreate.mockReset();
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
});
