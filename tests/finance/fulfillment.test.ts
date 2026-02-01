import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@prisma/client", async () => {
  const actual = await vi.importActual<any>("@prisma/client");
  return {
    ...actual,
    PaymentStatus: {
      CREATED: "CREATED",
      REQUIRES_ACTION: "REQUIRES_ACTION",
      PROCESSING: "PROCESSING",
      SUCCEEDED: "SUCCEEDED",
      FAILED: "FAILED",
      CANCELLED: "CANCELLED",
      PARTIAL_REFUND: "PARTIAL_REFUND",
      REFUNDED: "REFUNDED",
      DISPUTED: "DISPUTED",
      CHARGEBACK_WON: "CHARGEBACK_WON",
      CHARGEBACK_LOST: "CHARGEBACK_LOST",
    },
    SourceType: {
      TICKET_ORDER: "TICKET_ORDER",
      PADEL_REGISTRATION: "PADEL_REGISTRATION",
      BOOKING: "BOOKING",
      STORE_ORDER: "STORE_ORDER",
      SUBSCRIPTION: "SUBSCRIPTION",
      MEMBERSHIP: "MEMBERSHIP",
      EVENT: "EVENT",
      TOURNAMENT: "TOURNAMENT",
      MATCH: "MATCH",
      LOYALTY_TX: "LOYALTY_TX",
    },
    EntitlementStatus: {
      ACTIVE: "ACTIVE",
      SUSPENDED: "SUSPENDED",
      REVOKED: "REVOKED",
    },
    EntitlementType: {
      EVENT_TICKET: "EVENT_TICKET",
      PADEL_ENTRY: "PADEL_ENTRY",
    },
    TicketStatus: {
      ACTIVE: "ACTIVE",
    },
  };
});

vi.mock("@/lib/checkin/accessPolicy", () => ({
  getLatestPolicyVersionForEvent: vi.fn().mockResolvedValue(null),
  requireLatestPolicyVersionForEvent: vi.fn().mockResolvedValue(1),
}));

import {
  PaymentStatus,
  SourceType,
  EntitlementStatus,
  EntitlementType,
  TicketStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { applyPaymentStatusToEntitlements, fulfillPaymentIfSucceeded } from "@/domain/finance/fulfillment";

let payments: any[] = [];
let ticketOrders: any[] = [];
let ticketTypes: any[] = [];
let events: any[] = [];
let entitlements: any[] = [];
let tickets: any[] = [];

vi.mock("@/lib/prisma", () => {
  const payment = {
    findUnique: vi.fn(({ where }: any) => payments.find((p) => p.id === where.id) ?? null),
    update: vi.fn(({ where, data }: any) => {
      const idx = payments.findIndex((p) => p.id === where.id);
      if (idx >= 0) {
        payments[idx] = { ...payments[idx], ...data };
        return payments[idx];
      }
      return null;
    }),
  };
  const ticketOrder = {
    findUnique: vi.fn(({ where }: any) => ticketOrders.find((o) => o.id === where.id) ?? null),
  };
  const ticketType = {
    findMany: vi.fn(({ where }: any) =>
      ticketTypes.filter((t) => (where?.id?.in ?? []).includes(t.id)),
    ),
  };
  const event = {
    findUnique: vi.fn(({ where }: any) => events.find((e) => e.id === where.id) ?? null),
  };
  const eventAccessPolicy = {
    findFirst: vi.fn(() => null),
  };
  const ticket = {
    upsert: vi.fn(({ where, update, create }: any) => {
      const key = where.purchaseId_ticketTypeId_emissionIndex;
      const existingIndex = tickets.findIndex(
        (t) =>
          t.purchaseId === key.purchaseId &&
          t.ticketTypeId === key.ticketTypeId &&
          t.emissionIndex === key.emissionIndex,
      );
      if (existingIndex >= 0) {
        tickets[existingIndex] = { ...tickets[existingIndex], ...update };
        return tickets[existingIndex];
      }
      tickets.push({ ...create });
      return create;
    }),
  };
  const entitlement = {
    upsert: vi.fn(({ where, update, create }: any) => {
      const key = where.purchaseId_saleLineId_lineItemIndex_ownerKey_type;
      const existingIndex = entitlements.findIndex(
        (e) =>
          e.purchaseId === key.purchaseId &&
          e.saleLineId === key.saleLineId &&
          e.lineItemIndex === key.lineItemIndex &&
          e.ownerKey === key.ownerKey &&
          e.type === key.type,
      );
      if (existingIndex >= 0) {
        entitlements[existingIndex] = { ...entitlements[existingIndex], ...update };
        return entitlements[existingIndex];
      }
      entitlements.push({ ...create });
      return create;
    }),
    updateMany: vi.fn(({ where, data }: any) => {
      let count = 0;
      entitlements = entitlements.map((e) => {
        if (e.purchaseId === where.purchaseId) {
          count += 1;
          return { ...e, ...data };
        }
        return e;
      });
      return { count };
    }),
  };

  const prisma = {
    payment,
    ticketOrder,
    ticketType,
    event,
    eventAccessPolicy,
    ticket,
    entitlement,
    $transaction: async (fn: any) => fn(prisma),
  };
  return { prisma };
});

const prismaMock = vi.mocked(prisma);

describe("payment fulfillment v7", () => {
  beforeEach(() => {
    const sourceId = "order_1";
    payments = [
      {
        id: "pay_1",
        status: PaymentStatus.SUCCEEDED,
        sourceType: SourceType.TICKET_ORDER,
        sourceId,
        customerIdentityId: "ident_1",
        pricingSnapshotJson: { gross: 2000, platformFee: 200, currency: "EUR" },
      },
    ];
    ticketOrders = [
      {
        id: "order_1",
        organizationId: 1,
        buyerIdentityId: "ident_1",
        currency: "EUR",
        lines: [
          {
            id: 10,
            ticketTypeId: 1,
            qty: 2,
            unitAmount: 1000,
            totalAmount: 2000,
          },
        ],
      },
    ];
    ticketTypes = [{ id: 1, eventId: 99 }];
    events = [
      {
        id: 99,
        title: "Evento",
        coverImageUrl: null,
        locationName: "Local",
        startsAt: new Date("2026-01-01T10:00:00Z"),
        timezone: "Europe/Lisbon",
      },
    ];
    entitlements = [];
    tickets = [];
    prismaMock.event.findUnique.mockImplementation(({ where }: any) =>
      events.find((e) => e.id === where.id) ?? null,
    );
  });

  it("emite entitlements apenas 1x em chamadas repetidas", async () => {
    const before = { entitlements: entitlements.length, tickets: tickets.length };
    const first = await fulfillPaymentIfSucceeded({ paymentId: "pay_1", causationId: "c1" });
    const afterFirst = { entitlements: entitlements.length, tickets: tickets.length };
    const second = await fulfillPaymentIfSucceeded({ paymentId: "pay_1", causationId: "c1" });
    const afterSecond = { entitlements: entitlements.length, tickets: tickets.length };

    expect(first.status).toBe("FULFILLED");
    expect(second.status).toBe("FULFILLED");
    expect(afterFirst.entitlements - before.entitlements).toBe(2);
    expect(afterFirst.tickets - before.tickets).toBe(2);
    expect(afterSecond.entitlements).toBe(afterFirst.entitlements);
    expect(afterSecond.tickets).toBe(afterFirst.tickets);
    expect(entitlements.every((e) => e.status === EntitlementStatus.ACTIVE)).toBe(true);
    expect(tickets.every((t) => t.status === TicketStatus.ACTIVE)).toBe(true);
  });

  it("refund/dispute aplica SUSPENDED/REVOKED", async () => {
    entitlements = [
      { purchaseId: "pay_1", status: EntitlementStatus.ACTIVE, type: EntitlementType.EVENT_TICKET },
    ];
    const disputed = await applyPaymentStatusToEntitlements({ paymentId: "pay_1", status: PaymentStatus.DISPUTED });
    expect(disputed.status).toBe("UPDATED");
    expect(entitlements[0].status).toBe(EntitlementStatus.SUSPENDED);

    const lost = await applyPaymentStatusToEntitlements({ paymentId: "pay_1", status: PaymentStatus.CHARGEBACK_LOST });
    expect(lost.status).toBe("UPDATED");
    expect(entitlements[0].status).toBe(EntitlementStatus.REVOKED);
  });
});
