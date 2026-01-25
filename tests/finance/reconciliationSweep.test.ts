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
import { sweepPendingProcessorFees } from "@/domain/finance/reconciliationSweep";
import { prisma } from "@/lib/prisma";

let payments: any[] = [];
let ledgerEntries: any[] = [];
let paymentEvents: any[] = [];

vi.mock("@/lib/prisma", () => {
  const payment = {
    findMany: vi.fn(() => payments.filter((p) => p.processorFeesStatus === "PENDING").map((p) => ({ id: p.id }))),
    findUnique: vi.fn(({ where }: any) => payments.find((p) => p.id === where.id) ?? null),
    update: vi.fn(({ where, data }: any) => {
      const idx = payments.findIndex((p) => p.id === where.id);
      if (idx === -1) return null;
      payments[idx] = { ...payments[idx], ...data };
      return payments[idx];
    }),
  };
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
  const paymentEvent = {
    findFirst: vi.fn(({ where }: any) =>
      paymentEvents.find(
        (evt) =>
          evt.purchaseId === where.purchaseId &&
          evt.stripePaymentIntentId != null,
      ) ?? null,
    ),
  };
  const prismaMock = {
    payment,
    ledgerEntry,
    paymentEvent,
    $transaction: async (fn: any) => fn(prismaMock),
  };
  return { prisma: prismaMock };
});

vi.mock("@/lib/stripeClient", () => {
  const paymentIntents = {
    retrieve: vi.fn(async (id: string) => ({
      id,
      latest_charge: id === "pi_1" ? "ch_1" : "ch_2",
    })),
  };
  const charges = {
    retrieve: vi.fn(async (id: string) => ({
      id,
      balance_transaction: id === "ch_1" ? { id: "bt_1", fee: 123 } : null,
    })),
  };
  return { stripe: { paymentIntents, charges } };
});

const prismaMock = vi.mocked(prisma);

describe("sweepPendingProcessorFees", () => {
  beforeEach(() => {
    const sourceId1 = "1";
    const sourceId2 = "2";
    payments = [
      {
        id: "pay_1",
        sourceType: SourceType.TICKET_ORDER,
        sourceId: sourceId1,
        pricingSnapshotJson: { currency: "EUR" },
        processorFeesStatus: ProcessorFeesStatus.PENDING,
        processorFeesActual: null,
      },
      {
        id: "pay_2",
        sourceType: SourceType.TICKET_ORDER,
        sourceId: sourceId2,
        pricingSnapshotJson: { currency: "EUR" },
        processorFeesStatus: ProcessorFeesStatus.PENDING,
        processorFeesActual: null,
      },
    ];
    ledgerEntries = [
      { paymentId: "pay_1", entryType: LedgerEntryType.GROSS, amount: 1000 },
      { paymentId: "pay_1", entryType: LedgerEntryType.PLATFORM_FEE, amount: -100 },
      { paymentId: "pay_2", entryType: LedgerEntryType.GROSS, amount: 2000 },
      { paymentId: "pay_2", entryType: LedgerEntryType.PLATFORM_FEE, amount: -200 },
    ];
    paymentEvents = [
      { purchaseId: "pay_1", stripePaymentIntentId: "pi_1", stripeEventId: "evt_1" },
      { purchaseId: "pay_2", stripePaymentIntentId: "pi_2", stripeEventId: "evt_2" },
    ];
    prismaMock.payment.findUnique.mockImplementation(({ where }: any) =>
      payments.find((p) => p.id === where.id) ?? null,
    );
  });

  it("reconcilia quando há fee e é idempotente", async () => {
    await sweepPendingProcessorFees();

    const pay1 = payments.find((p) => p.id === "pay_1");
    const pay2 = payments.find((p) => p.id === "pay_2");
    expect(pay1?.processorFeesStatus).toBe(ProcessorFeesStatus.FINAL);
    expect(pay1?.processorFeesActual).toBe(123);
    expect(pay2?.processorFeesStatus).toBe(ProcessorFeesStatus.PENDING);

    const feeEntries = ledgerEntries.filter(
      (entry) =>
        entry.paymentId === "pay_1" &&
        entry.entryType === LedgerEntryType.PROCESSOR_FEES_FINAL,
    );
    expect(feeEntries.length).toBe(1);

    await sweepPendingProcessorFees();
    const feeEntriesAfter = ledgerEntries.filter(
      (entry) =>
        entry.paymentId === "pay_1" &&
        entry.entryType === LedgerEntryType.PROCESSOR_FEES_FINAL,
    );
    expect(feeEntriesAfter.length).toBe(1);
  });
});
