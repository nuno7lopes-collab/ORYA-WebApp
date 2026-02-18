import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prisma = vi.hoisted(() => ({
  storeOrder: { findFirst: vi.fn() },
  storeProductOption: { findMany: vi.fn() },
  storeProductOptionValue: { findMany: vi.fn() },
  paymentEvent: { findMany: vi.fn() },
}));

const resolvePaymentStatusMap = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/domain/finance/resolvePaymentStatus", () => ({ resolvePaymentStatusMap }));
vi.mock("@/lib/http/withApiEnvelope", () => ({
  withApiEnvelope: (handler: unknown) => handler,
}));

let POST: typeof import("@/app/api/public/store/orders/lookup/route").POST;

beforeEach(async () => {
  vi.resetModules();
  prisma.storeOrder.findFirst.mockReset();
  prisma.storeProductOption.findMany.mockReset();
  prisma.storeProductOptionValue.findMany.mockReset();
  prisma.paymentEvent.findMany.mockReset();
  resolvePaymentStatusMap.mockReset();

  prisma.storeProductOption.findMany.mockResolvedValue([]);
  prisma.storeProductOptionValue.findMany.mockResolvedValue([]);
  prisma.paymentEvent.findMany.mockResolvedValue([]);
  resolvePaymentStatusMap.mockResolvedValue(new Map());

  POST = (await import("@/app/api/public/store/orders/lookup/route")).POST;
});

function makeReq(payload: unknown) {
  return new NextRequest("http://localhost/api/public/store/orders/lookup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/public/store/orders/lookup payment status fallback", () => {
  it("falls back to storeOrder.status when finance status is missing", async () => {
    prisma.storeOrder.findFirst.mockResolvedValue({
      id: 1,
      orderNumber: "ORD-1",
      status: "PAID",
      purchaseId: "store_order_1",
      paymentIntentId: "free_store_order_1",
      subtotalCents: 0,
      discountCents: 0,
      shippingCents: 0,
      totalCents: 0,
      currency: "EUR",
      customerName: "A",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      storePolicySnapshotJson: {},
      store: {
        id: 12,
        organization: {
          username: "org",
          publicName: "Org",
          businessName: null,
          officialEmail: "support@org.com",
          settings: {
            supportEmail: "support@org.com",
            supportPhone: null,
            storeReturnPolicyMode: null,
            storeReturnWindowDays: null,
          },
        },
      },
      shippingZone: null,
      shippingMethod: null,
      addresses: [],
      shipments: [],
      lines: [],
    });

    const res = await POST(makeReq({ orderNumber: "ORD-1", email: "a@b.com" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.order.paymentStatus).toBe("PAID");
  });
});

