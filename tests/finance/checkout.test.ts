import { beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "crypto";

vi.mock("@prisma/client", async () => {
  const actual = await vi.importActual<any>("@prisma/client");
  return {
    ...actual,
    FeeMode: {
      ADDED: "ADDED",
      INCLUDED: "INCLUDED",
      ABSORBED: "ABSORBED",
      ON_TOP: "ON_TOP",
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
    PaymentStatus: {
      CREATED: "CREATED",
      DISPUTED: "DISPUTED",
      CHARGEBACK_WON: "CHARGEBACK_WON",
      CHARGEBACK_LOST: "CHARGEBACK_LOST",
    },
    LedgerEntryType: {
      GROSS: "GROSS",
      PLATFORM_FEE: "PLATFORM_FEE",
      PROCESSOR_FEES_FINAL: "PROCESSOR_FEES_FINAL",
      PROCESSOR_FEES_ADJUSTMENT: "PROCESSOR_FEES_ADJUSTMENT",
    },
  };
});

import { FeeMode, ProcessorFeesStatus, SourceType } from "@prisma/client";
import { createCheckout } from "@/domain/finance/checkout";
import { prisma } from "@/lib/prisma";
import { computePricing } from "@/lib/pricing";
import { getPlatformFees } from "@/lib/platformSettings";

const evaluateEventAccess = vi.hoisted(() => vi.fn());

vi.mock("@/domain/access/evaluateAccess", () => ({ evaluateEventAccess }));

const ORDER_ID = "order-1";
const REG_ID = "reg-1";

let ticketOrderState: any = null;
let padelRegistrationState: any = null;
let createdPayment: any = null;
let createdLedgerEntries: any[] = [];

vi.mock("@/lib/prisma", () => {
  const ticketOrder = {
    findUnique: vi.fn(() => ticketOrderState),
  };
  const padelRegistration = {
    findUnique: vi.fn(() => padelRegistrationState),
  };
  const organization = {
    findUnique: vi.fn(({ where }: any) => {
      if (ticketOrderState && where.id === ticketOrderState.organizationId) {
        return ticketOrderState.organization;
      }
      if (padelRegistrationState && where.id === padelRegistrationState.organizationId) {
        return padelRegistrationState.organization;
      }
      return null;
    }),
  };
  const eventAccessPolicy = {
    findFirst: vi.fn(() => null),
  };
  const emailIdentity = {
    findUnique: vi.fn(() => null),
  };
  const payment = {
    findUnique: vi.fn(() => null),
    create: vi.fn(({ data }: any) => {
      createdPayment = data;
      return data;
    }),
  };
  const ledgerEntry = {
    createMany: vi.fn(({ data }: any) => {
      createdLedgerEntries = data;
      return { count: data.length };
    }),
  };
  const eventLog = {
    create: vi.fn(({ data }: any) => data),
  };
  const outboxEvent = {
    create: vi.fn(({ data }: any) => data),
  };
  const prisma = {
    ticketOrder,
    padelRegistration,
    organization,
    eventAccessPolicy,
    emailIdentity,
    payment,
    ledgerEntry,
    eventLog,
    outboxEvent,
    $transaction: async (fn: any) => fn(prisma),
  };
  return { prisma };
});

vi.mock("@/lib/pricing", () => ({
  computePricing: vi.fn(),
}));

vi.mock("@/lib/platformSettings", () => ({
  getPlatformFees: vi.fn(),
}));

const prismaMock = vi.mocked(prisma);
const computePricingMock = vi.mocked(computePricing);
const getPlatformFeesMock = vi.mocked(getPlatformFees);

describe("createCheckout", () => {
  beforeEach(() => {
    ticketOrderState = {
      id: "order-1",
      organizationId: 10,
      eventId: 1,
      buyerIdentityId: "identity-1",
      currency: "EUR",
      organization: {
        feeMode: null,
        platformFeeBps: null,
        platformFeeFixedCents: null,
        orgType: "EXTERNAL",
      },
      lines: [
        { id: 1, qty: 2, unitAmount: 500, totalAmount: 1000, ticketTypeId: 1 },
      ],
    };
    padelRegistrationState = {
      id: "reg-1",
      organizationId: 11,
      eventId: 2,
      buyerIdentityId: null,
      currency: "EUR",
      organization: {
        feeMode: null,
        platformFeeBps: null,
        platformFeeFixedCents: null,
        orgType: "EXTERNAL",
      },
      lines: [
        { id: 1, qty: 1, unitAmount: 1200, totalAmount: 1200, label: "Inscrição" },
      ],
    };
    createdPayment = null;
    createdLedgerEntries = [];
    evaluateEventAccess.mockReset();
    evaluateEventAccess.mockResolvedValue({ allowed: true, reasonCode: "ALLOWED" });
    prismaMock.payment.findUnique.mockReturnValue(null as any);
    prismaMock.eventAccessPolicy.findFirst.mockResolvedValue(null as any);
    prismaMock.emailIdentity.findUnique.mockResolvedValue(null as any);
    computePricingMock.mockReturnValue({
      subtotalCents: 1000,
      discountCents: 0,
      platformFeeCents: 200,
      totalCents: 1200,
      feeMode: FeeMode.ADDED,
      feeBpsApplied: 500,
      feeFixedApplied: 30,
    });
    getPlatformFeesMock.mockResolvedValue({
      feeBps: 500,
      feeFixedCents: 30,
    });
    vi.spyOn(crypto, "randomUUID").mockReturnValue("payment-1");
    prismaMock.payment.create.mockClear();
    prismaMock.ledgerEntry.createMany.mockClear();
  });

  it("cria snapshot e ledger entries para TICKET_ORDER", async () => {
    const output = await createCheckout({
      sourceType: SourceType.TICKET_ORDER,
      sourceId: ORDER_ID,
      idempotencyKey: "idem-1",
    });

    expect(output.status).toBe("CREATED");
    expect(createdPayment).not.toBeNull();
    expect(createdPayment.pricingSnapshotJson.currency).toBe("EUR");
    expect(createdPayment.pricingSnapshotJson.platformFee).toBe(200);
    expect(createdPayment.processorFeesStatus).toBe(ProcessorFeesStatus.PENDING);
    expect(createdPayment.processorFeesActual).toBe(null);
    expect(createdPayment.feePolicyVersion).toHaveLength(64);
    expect(createdPayment.pricingSnapshotHash).toHaveLength(64);

    expect(createdLedgerEntries).toHaveLength(2);
    const gross = createdLedgerEntries.find((e) => e.entryType === "GROSS");
    const platformFee = createdLedgerEntries.find((e) => e.entryType === "PLATFORM_FEE");
    expect(gross.amount).toBe(1200);
    expect(platformFee.amount).toBe(-200);
  });

  it("idempotency key evita duplicar ledger entries", async () => {
    prismaMock.payment.findUnique.mockReset();
    prismaMock.payment.findUnique
      .mockReturnValueOnce(null as any)
      .mockReturnValueOnce({ id: "payment-1", status: "CREATED", pricingSnapshotHash: "hash" } as any);

    await createCheckout({
      sourceType: SourceType.TICKET_ORDER,
      sourceId: ORDER_ID,
      idempotencyKey: "idem-1",
    });

    await createCheckout({
      sourceType: SourceType.TICKET_ORDER,
      sourceId: ORDER_ID,
      idempotencyKey: "idem-1",
    });

    expect(prismaMock.payment.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.ledgerEntry.createMany).toHaveBeenCalledTimes(1);
  });

  it("cria snapshot para PADEL_REGISTRATION", async () => {
    const output = await createCheckout({
      sourceType: SourceType.PADEL_REGISTRATION,
      sourceId: REG_ID,
      idempotencyKey: "idem-2",
    });

    expect(output.status).toBe("CREATED");
    expect(createdPayment.pricingSnapshotJson.currency).toBe("EUR");
    expect(createdPayment.pricingSnapshotJson.gross).toBe(1200);
  });

  it("é idempotente por idempotencyKey", async () => {
    prismaMock.payment.findUnique.mockReturnValue({
      id: "payment-1",
      status: "CREATED",
      pricingSnapshotHash: "hash-1",
    } as any);

    const output = await createCheckout({
      sourceType: SourceType.TICKET_ORDER,
      sourceId: ORDER_ID,
      idempotencyKey: "idem-3",
    });

    expect(output.paymentId).toBe("payment-1");
    expect(output.pricingSnapshotHash).toBe("hash-1");
  });

  it("bloqueia guest checkout quando guest não é permitido", async () => {
    prismaMock.eventAccessPolicy.findFirst.mockResolvedValue({
      mode: "PUBLIC",
      inviteTokenAllowed: false,
      guestCheckoutAllowed: false,
      inviteIdentityMatch: "EMAIL",
    } as any);
    prismaMock.emailIdentity.findUnique.mockResolvedValue({
      emailNormalized: "guest@example.com",
      userId: null,
    } as any);

    await expect(
      createCheckout({
        sourceType: SourceType.TICKET_ORDER,
        sourceId: ORDER_ID,
        buyerIdentityRef: "identity-guest",
        idempotencyKey: "idem-guest",
      }),
    ).rejects.toThrow("GUEST_CHECKOUT_NOT_ALLOWED");
  });

  it("usa access engine e bloqueia quando nega", async () => {
    prismaMock.eventAccessPolicy.findFirst.mockResolvedValue({
      mode: "INVITE_ONLY",
      inviteTokenAllowed: true,
      guestCheckoutAllowed: true,
      inviteIdentityMatch: "EMAIL",
      inviteTokenTtlSeconds: 3600,
      requiresEntitlementForEntry: false,
    } as any);
    prismaMock.emailIdentity.findUnique.mockResolvedValue({
      emailNormalized: "user@example.com",
      userId: "user-1",
    } as any);
    evaluateEventAccess.mockResolvedValue({ allowed: false, reasonCode: "INVITE_ONLY" });

    await expect(
      createCheckout({
        sourceType: SourceType.TICKET_ORDER,
        sourceId: ORDER_ID,
        inviteToken: "tok",
        buyerIdentityRef: "identity-user",
        idempotencyKey: "idem-access",
      }),
    ).rejects.toThrow("INVITE_TOKEN_REQUIRED");
    expect(evaluateEventAccess).toHaveBeenCalled();
  });
});
