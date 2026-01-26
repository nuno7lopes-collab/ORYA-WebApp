import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@prisma/client", async () => {
  const actual = await vi.importActual<any>("@prisma/client");
  return {
    ...actual,
    LedgerEntryType: {
      GROSS: "GROSS",
      PLATFORM_FEE: "PLATFORM_FEE",
      PROCESSOR_FEES_FINAL: "PROCESSOR_FEES_FINAL",
      PROCESSOR_FEES_ADJUSTMENT: "PROCESSOR_FEES_ADJUSTMENT",
    },
    ProcessorFeesStatus: { PENDING: "PENDING", FINAL: "FINAL" },
    SourceType: {
      TICKET_ORDER: "TICKET_ORDER",
      BOOKING: "BOOKING",
      PADEL_REGISTRATION: "PADEL_REGISTRATION",
      STORE_ORDER: "STORE_ORDER",
      SUBSCRIPTION: "SUBSCRIPTION",
      MEMBERSHIP: "MEMBERSHIP",
      EVENT: "EVENT",
      TOURNAMENT: "TOURNAMENT",
      MATCH: "MATCH",
      LOYALTY_TX: "LOYALTY_TX",
    },
  };
});

import { LedgerEntryType, ProcessorFeesStatus, SourceType } from "@prisma/client";
import { reconcilePaymentFees } from "@/domain/finance/reconciliation";
import { prisma } from "@/lib/prisma";

let paymentState: any = null;
let ledgerEntries: any[] = [];

vi.mock("@/lib/prisma", () => {
  const ledgerEntry = {
    findFirst: vi.fn(({ where }: any) =>
      ledgerEntries.find(
        (entry) =>
          entry.paymentId === where.paymentId &&
          entry.causationId === where.causationId,
      ) ?? null,
    ),
    findMany: vi.fn(({ where }: any) => {
      if (where?.entryType?.in) {
        return ledgerEntries.filter(
          (entry) =>
            entry.paymentId === where.paymentId &&
            where.entryType.in.includes(entry.entryType),
        );
      }
      return ledgerEntries.filter((entry) => entry.paymentId === where.paymentId);
    }),
    create: vi.fn(({ data }: any) => {
      ledgerEntries.push({ ...data });
      return data;
    }),
  };
  const payment = {
    findUnique: vi.fn(() => paymentState),
    update: vi.fn(({ data }: any) => {
      paymentState = { ...paymentState, ...data };
      return paymentState;
    }),
  };
  const eventLog = {
    create: vi.fn(({ data }: any) => data),
  };
  const outboxEvent = {
    create: vi.fn(({ data }: any) => data),
  };
  const prisma = {
    ledgerEntry,
    payment,
    eventLog,
    outboxEvent,
    $transaction: async (fn: any) => fn(prisma),
  };
  return { prisma };
});

const prismaMock = vi.mocked(prisma);

describe("reconcilePaymentFees", () => {
  beforeEach(() => {
    const sourceId = "1";
    paymentState = {
      id: "pay_1",
      organizationId: 10,
      sourceType: SourceType.BOOKING,
      sourceId,
      pricingSnapshotJson: { currency: "EUR" },
      processorFeesStatus: ProcessorFeesStatus.PENDING,
      processorFeesActual: null,
    };
    ledgerEntries = [
      {
        paymentId: "pay_1",
        entryType: LedgerEntryType.GROSS,
        amount: 1000,
      },
      {
        paymentId: "pay_1",
        entryType: LedgerEntryType.PLATFORM_FEE,
        amount: -200,
      },
    ];
    prismaMock.payment.findUnique.mockImplementation(() => paymentState as any);
  });

  it("finaliza fees e cria adjustment quando muda", async () => {
    const first = await reconcilePaymentFees({
      paymentId: "pay_1",
      processorFeeCents: 300,
      causationId: "bt_1",
    });

    expect(first.status).toBe("FINALIZED");
    expect(paymentState.processorFeesStatus).toBe(ProcessorFeesStatus.FINAL);
    expect(paymentState.processorFeesActual).toBe(300);

    const finalEntry = ledgerEntries.find(
      (entry) => entry.entryType === LedgerEntryType.PROCESSOR_FEES_FINAL,
    );
    expect(finalEntry?.amount).toBe(-300);

    // simular persistência do estado antes da reconciliação seguinte
    paymentState = { ...paymentState, processorFeesStatus: ProcessorFeesStatus.FINAL, processorFeesActual: 300 };

    const second = await reconcilePaymentFees({
      paymentId: "pay_1",
      processorFeeCents: 250,
      causationId: "bt_2",
    });

    expect(second.status).toBe("ADJUSTED");
    const adjustment = ledgerEntries.find(
      (entry) => entry.entryType === LedgerEntryType.PROCESSOR_FEES_ADJUSTMENT,
    );
    expect(adjustment?.amount).toBe(50);

    const net = ledgerEntries.reduce((sum, entry) => sum + entry.amount, 0);
    expect(second.netToOrgFinal).toBe(net);
  });

  it("é idempotente por causationId", async () => {
    const first = await reconcilePaymentFees({
      paymentId: "pay_1",
      processorFeeCents: 300,
      causationId: "bt_dup",
    });

    const second = await reconcilePaymentFees({
      paymentId: "pay_1",
      processorFeeCents: 300,
      causationId: "bt_dup",
    });

    expect(first.status).toBe("FINALIZED");
    expect(second.status).toBe("NOOP");
  });
});
