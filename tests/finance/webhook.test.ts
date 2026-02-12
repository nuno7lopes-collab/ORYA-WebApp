import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@prisma/client", async () => {
  const actual = await vi.importActual<any>("@prisma/client");
  return {
    ...actual,
    PaymentStatus: {
      CREATED: "CREATED",
      DISPUTED: "DISPUTED",
      CHARGEBACK_WON: "CHARGEBACK_WON",
      CHARGEBACK_LOST: "CHARGEBACK_LOST",
    },
  };
});

import { PaymentStatus } from "@prisma/client";
import { handleStripeWebhook } from "@/domain/finance/webhook";
import { prisma } from "@/lib/prisma";

const recordOutboxEvent = vi.hoisted(() => vi.fn());
vi.mock("@/domain/outbox/producer", () => ({
  recordOutboxEvent,
}));

let paymentState: any = null;

vi.mock("@/lib/prisma", () => {
  const payment = {
    findUnique: vi.fn(() => paymentState),
    update: vi.fn(({ data }: any) => {
      paymentState = { ...paymentState, ...data };
      return paymentState;
    }),
  };
  const entitlement = {
    updateMany: vi.fn(() => ({ count: 0 })),
  };
  const ticket = {
    updateMany: vi.fn(() => ({ count: 0 })),
  };
  const eventLog = {
    create: vi.fn(({ data }: any) => data),
  };
  const prisma = {
    payment,
    entitlement,
    ticket,
    eventLog,
    $transaction: async (fn: any) => fn(prisma),
  };
  return { prisma };
});

const prismaMock = vi.mocked(prisma);

describe("handleStripeWebhook", () => {
  beforeEach(() => {
    paymentState = {
      id: "pay_1",
      status: PaymentStatus.CREATED,
      organizationId: 10,
      sourceType: "BOOKING",
      sourceId: "booking_1",
    };
    prismaMock.payment.findUnique.mockReturnValue(paymentState as any);
    prismaMock.entitlement.updateMany.mockClear();
    prismaMock.ticket.updateMany.mockClear();
  });

  it("marca pagamento como DISPUTED em payment.dispute_opened", async () => {
    const result = await handleStripeWebhook({
      id: "evt_1",
      type: "payment.dispute_opened",
      data: { object: { id: "dp_1", metadata: { paymentId: "pay_1" } } },
    });

    expect(result.handled).toBe(true);
    expect(result.status).toBe(PaymentStatus.DISPUTED);
    expect(paymentState.status).toBe(PaymentStatus.DISPUTED);
    expect(prismaMock.entitlement.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "SUSPENDED" } })
    );
    expect(prismaMock.ticket.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "DISPUTED" } })
    );
    expect(recordOutboxEvent).toHaveBeenCalled();
  });

  it("marca pagamento como CHARGEBACK_WON em payment.dispute_closed (WON)", async () => {
    const result = await handleStripeWebhook({
      id: "evt_2",
      type: "payment.dispute_closed",
      data: { object: { id: "dp_2", metadata: { paymentId: "pay_1" }, outcome: "WON" } },
    });

    expect(result.handled).toBe(true);
    expect(result.status).toBe(PaymentStatus.CHARGEBACK_WON);
    expect(prismaMock.entitlement.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ACTIVE" } })
    );
    expect(prismaMock.ticket.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ACTIVE" } })
    );
    expect(recordOutboxEvent).toHaveBeenCalled();
  });

  it("marca pagamento como CHARGEBACK_LOST em payment.dispute_closed (LOST)", async () => {
    const result = await handleStripeWebhook({
      id: "evt_3",
      type: "payment.dispute_closed",
      data: { object: { id: "dp_3", metadata: { paymentId: "pay_1" }, outcome: "LOST" } },
    });

    expect(result.handled).toBe(true);
    expect(result.status).toBe(PaymentStatus.CHARGEBACK_LOST);
    expect(prismaMock.entitlement.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "REVOKED" } })
    );
    expect(prismaMock.ticket.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "CHARGEBACK_LOST" } })
    );
    expect(recordOutboxEvent).toHaveBeenCalled();
  });

  it("rejeita payment.dispute_closed sem outcome válido", async () => {
    const result = await handleStripeWebhook({
      id: "evt_4",
      type: "payment.dispute_closed",
      data: { object: { id: "dp_4", metadata: { paymentId: "pay_1" }, outcome: "UNKNOWN" } },
    });

    expect(result.handled).toBe(false);
    expect(result.reason).toBe("DISPUTE_OUTCOME_INVALID");
  });
});
