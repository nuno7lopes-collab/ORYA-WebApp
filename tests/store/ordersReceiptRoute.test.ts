import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prisma = vi.hoisted(() => ({
  storeOrder: { findFirst: vi.fn() },
}));

const retrievePaymentIntent = vi.hoisted(() => vi.fn());
const retrieveCharge = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/domain/finance/gateway/stripeGateway", () => ({ retrievePaymentIntent, retrieveCharge }));
vi.mock("@/lib/http/withApiEnvelope", () => ({
  withApiEnvelope: (handler: unknown) => handler,
}));

let POST: typeof import("@/app/api/public/store/orders/receipt/route").POST;

beforeEach(async () => {
  vi.resetModules();
  prisma.storeOrder.findFirst.mockReset();
  retrievePaymentIntent.mockReset();
  retrieveCharge.mockReset();
  POST = (await import("@/app/api/public/store/orders/receipt/route")).POST;
});

function makeReq(payload: unknown) {
  return new NextRequest("http://localhost/api/public/store/orders/receipt", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/public/store/orders/receipt", () => {
  it("returns 404 when paymentIntentId is not a Stripe PI (free checkout)", async () => {
    prisma.storeOrder.findFirst.mockResolvedValue({
      id: 1,
      paymentIntentId: "free_store_order_1",
    });

    const res = await POST(makeReq({ orderNumber: "ORD-1", email: "a@b.com" }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(String(body.error)).toContain("Recibo indisponivel");
    expect(retrievePaymentIntent).not.toHaveBeenCalled();
    expect(retrieveCharge).not.toHaveBeenCalled();
  });

  it("returns receipt url when Stripe PI has latest_charge with receipt_url", async () => {
    prisma.storeOrder.findFirst.mockResolvedValue({
      id: 1,
      paymentIntentId: "pi_test",
    });
    retrievePaymentIntent.mockResolvedValue({
      id: "pi_test",
      latest_charge: { receipt_url: "https://stripe.example/receipt" },
    });

    const res = await POST(makeReq({ orderNumber: "ORD-1", email: "a@b.com" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.url).toBe("https://stripe.example/receipt");
    expect(retrievePaymentIntent).toHaveBeenCalledTimes(1);
  });
});

