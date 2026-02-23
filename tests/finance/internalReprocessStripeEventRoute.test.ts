import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const enqueueOperation = vi.hoisted(() => vi.fn(async () => undefined));
const retrieveStripeEvent = vi.hoisted(() => vi.fn());
const requireInternalSecret = vi.hoisted(() => vi.fn(() => true));

vi.mock("@/lib/operations/enqueue", () => ({ enqueueOperation }));
vi.mock("@/domain/finance/gateway/stripeGateway", () => ({ retrieveStripeEvent }));
vi.mock("@/lib/security/requireInternalSecret", () => ({ requireInternalSecret }));
vi.mock("@/lib/http/withApiEnvelope", () => ({
  withApiEnvelope: (handler: unknown) => handler,
}));

let POST: typeof import("@/app/api/internal/reprocess/stripe-event/route").POST;

beforeEach(async () => {
  vi.resetModules();
  enqueueOperation.mockReset();
  retrieveStripeEvent.mockReset();
  requireInternalSecret.mockReset();
  requireInternalSecret.mockReturnValue(true);
  POST = (await import("@/app/api/internal/reprocess/stripe-event/route")).POST;
});

function makeReq(payload: unknown) {
  return new NextRequest("http://localhost/api/internal/reprocess/stripe-event", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-secret": "test",
    },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/internal/reprocess/stripe-event", () => {
  it("reenfileira payment_intent.succeeded com payload canónico", async () => {
    retrieveStripeEvent.mockResolvedValue({
      id: "evt_1",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_123",
          metadata: { purchaseId: "pur_123" },
        },
      },
    });

    const res = await POST(makeReq({ stripeEventId: "evt_1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(enqueueOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        operationType: "PROCESS_STRIPE_EVENT",
        dedupeKey: "evt_1",
        correlations: expect.objectContaining({
          stripeEventId: "evt_1",
          paymentIntentId: "pi_123",
          purchaseId: "pur_123",
        }),
        payload: expect.objectContaining({
          stripeEventType: "payment_intent.succeeded",
          paymentIntentId: "pi_123",
          purchaseId: "pur_123",
        }),
      }),
    );
  });

  it("devolve 400 para tipos de evento não suportados", async () => {
    retrieveStripeEvent.mockResolvedValue({
      id: "evt_2",
      type: "customer.created",
      data: { object: { id: "cus_1" } },
    });

    const res = await POST(makeReq({ stripeEventId: "evt_2" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe("UNSUPPORTED_STRIPE_EVENT_TYPE");
    expect(enqueueOperation).not.toHaveBeenCalled();
  });
});
