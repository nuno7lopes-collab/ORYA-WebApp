import { beforeEach, describe, expect, it, vi } from "vitest";
import { refundPurchase } from "@/lib/refunds/refundService";
import { prisma } from "@/lib/prisma";
import { RefundReason } from "@prisma/client";

const stripeRefundCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/stripeClient", () => ({
  stripe: {
    refunds: {
      create: stripeRefundCreate,
    },
  },
}));

const recordOutboxEvent = vi.hoisted(() => vi.fn(() => ({ eventId: "evt_1" })));
const appendEventLog = vi.hoisted(() => vi.fn(() => ({})));

vi.mock("@/domain/outbox/producer", () => ({ recordOutboxEvent }));
vi.mock("@/domain/eventLog/append", () => ({ appendEventLog }));

let refundState: any = null;
let eventState: any = null;
let orgState: any = null;
let saleSummaryState: any = null;

vi.mock("@/lib/prisma", () => {
  const refund = {
    findUnique: vi.fn(({ where }: any) => {
      if (!refundState) return null;
      return refundState.dedupeKey === where.dedupeKey ? refundState : null;
    }),
    create: vi.fn(({ data }: any) => {
      refundState = { id: 1, ...data };
      return refundState;
    }),
  };
  const event = {
    findUnique: vi.fn(() => eventState),
  };
  const organization = {
    findUnique: vi.fn(() => orgState),
  };
  const saleSummary = {
    findUnique: vi.fn(() => saleSummaryState),
  };
  const payment = {
    findUnique: vi.fn(() => ({
      id: "order_1",
      sourceType: "TICKET_ORDER",
      sourceId: "order_1",
      processorFeesActual: 50,
      pricingSnapshotJson: { currency: "EUR", gross: 1000, platformFee: 100 },
    })),
  };
  const ledgerEntry = {
    findMany: vi.fn(() => [
      { entryType: "GROSS", amount: 1000 },
      { entryType: "PLATFORM_FEE", amount: -100 },
      { entryType: "PROCESSOR_FEES_FINAL", amount: -50 },
    ]),
    createMany: vi.fn(() => ({ count: 3 })),
  };
  const prisma = {
    refund,
    event,
    organization,
    saleSummary,
    payment,
    ledgerEntry,
    $transaction: async (fn: any) => fn(prisma),
  };
  return { prisma };
});

const prismaMock = vi.mocked(prisma);

describe("refundPurchase", () => {
  beforeEach(() => {
    stripeRefundCreate.mockReset();
    recordOutboxEvent.mockClear();
    appendEventLog.mockClear();
    refundState = null;
    eventState = { organizationId: 10 };
    orgState = {
      stripeAccountId: "acct_123",
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      orgType: null,
    };
    saleSummaryState = {
      id: 1,
      totalCents: 1000,
      platformFeeCents: 100,
      cardPlatformFeeCents: 0,
      stripeFeeCents: 50,
      paymentIntentId: "pi_1",
      currency: "EUR",
    };
  });

  it("falha hard sem connect READY e não chama Stripe", async () => {
    orgState = {
      stripeAccountId: null,
      stripeChargesEnabled: false,
      stripePayoutsEnabled: false,
      orgType: null,
    };
    await expect(
      refundPurchase({
        purchaseId: "order_1",
        paymentIntentId: "pi_1",
        eventId: 1,
        reason: RefundReason.CANCELLED,
        refundedBy: "user_1",
      }),
    ).rejects.toThrow("FINANCE_CONNECT_NOT_READY");
    expect(stripeRefundCreate).not.toHaveBeenCalled();
    expect(prismaMock.refund.create).not.toHaveBeenCalled();
  });

  it("é idempotente: 2 chamadas -> 1 refund e 1 chamada Stripe", async () => {
    stripeRefundCreate.mockResolvedValue({ id: "re_1" });
    const first = await refundPurchase({
      purchaseId: "order_1",
      paymentIntentId: "pi_1",
      eventId: 1,
      reason: RefundReason.CANCELLED,
      refundedBy: "user_1",
    });
    const second = await refundPurchase({
      purchaseId: "order_1",
      paymentIntentId: "pi_1",
      eventId: 1,
      reason: RefundReason.CANCELLED,
      refundedBy: "user_1",
    });
    expect(first?.dedupeKey).toBe("refund:TICKET_ORDER:order_1");
    expect(second?.dedupeKey).toBe("refund:TICKET_ORDER:order_1");
    expect(stripeRefundCreate).toHaveBeenCalledTimes(1);
    expect(prismaMock.refund.create).toHaveBeenCalledTimes(1);
    expect(recordOutboxEvent).toHaveBeenCalledTimes(1);
    expect(appendEventLog).toHaveBeenCalledTimes(1);
  });
});
