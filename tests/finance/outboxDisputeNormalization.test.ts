import { beforeEach, describe, expect, it, vi } from "vitest";

const enqueueOperation = vi.hoisted(() => vi.fn(async () => ({ id: 1 })));

vi.mock("@/lib/operations/enqueue", () => ({
  enqueueOperation,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

import { consumeStripeWebhookEvent } from "@/domain/finance/outbox";

describe("consumeStripeWebhookEvent dispute normalization", () => {
  beforeEach(() => {
    enqueueOperation.mockClear();
  });

  it("normalizes charge.dispute.created to payment.dispute_opened", async () => {
    await consumeStripeWebhookEvent({
      id: "evt_opened",
      type: "charge.dispute.created",
      data: {
        object: {
          id: "dp_1",
          payment_intent: "pi_1",
          metadata: { paymentId: "pay_1" },
        },
      },
    } as any);

    expect(enqueueOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        operationType: "PROCESS_STRIPE_EVENT",
        payload: expect.objectContaining({
          stripeEventType: "payment.dispute_opened",
          stripeEventId: "evt_opened",
        }),
      }),
    );
  });

  it("normalizes charge.dispute.closed (won) to payment.dispute_closed + WON", async () => {
    await consumeStripeWebhookEvent({
      id: "evt_closed_won",
      type: "charge.dispute.closed",
      data: {
        object: {
          id: "dp_2",
          status: "won",
          payment_intent: "pi_2",
          metadata: { paymentId: "pay_2" },
        },
      },
    } as any);

    expect(enqueueOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        operationType: "PROCESS_STRIPE_EVENT",
        payload: expect.objectContaining({
          stripeEventType: "payment.dispute_closed",
          stripeEventId: "evt_closed_won",
          stripeEventObject: expect.objectContaining({ outcome: "WON" }),
        }),
      }),
    );
  });

  it("normalizes charge.dispute.closed (lost) to payment.dispute_closed + LOST", async () => {
    await consumeStripeWebhookEvent({
      id: "evt_closed_lost",
      type: "charge.dispute.closed",
      data: {
        object: {
          id: "dp_3",
          status: "lost",
          payment_intent: "pi_3",
          metadata: { paymentId: "pay_3" },
        },
      },
    } as any);

    expect(enqueueOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        operationType: "PROCESS_STRIPE_EVENT",
        payload: expect.objectContaining({
          stripeEventType: "payment.dispute_closed",
          stripeEventId: "evt_closed_lost",
          stripeEventObject: expect.objectContaining({ outcome: "LOST" }),
        }),
      }),
    );
  });
});
