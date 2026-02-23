import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const enqueueOperation = vi.hoisted(() => vi.fn(async () => undefined));
const requireInternalSecret = vi.hoisted(() => vi.fn(() => true));
const prisma = vi.hoisted(() => ({
  paymentEvent: { findFirst: vi.fn() },
  saleSummary: { findFirst: vi.fn() },
  ticket: { findFirst: vi.fn() },
}));

vi.mock("@/lib/operations/enqueue", () => ({ enqueueOperation }));
vi.mock("@/lib/security/requireInternalSecret", () => ({ requireInternalSecret }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/http/withApiEnvelope", () => ({
  withApiEnvelope: (handler: unknown) => handler,
}));

let POST: typeof import("@/app/api/internal/reprocess/purchase/route").POST;

beforeEach(async () => {
  vi.resetModules();
  enqueueOperation.mockReset();
  requireInternalSecret.mockReset();
  prisma.paymentEvent.findFirst.mockReset();
  prisma.saleSummary.findFirst.mockReset();
  prisma.ticket.findFirst.mockReset();
  requireInternalSecret.mockReturnValue(true);
  prisma.paymentEvent.findFirst.mockResolvedValue({ stripePaymentIntentId: "pi_123" });
  prisma.saleSummary.findFirst.mockResolvedValue(null);
  prisma.ticket.findFirst.mockResolvedValue(null);
  POST = (await import("@/app/api/internal/reprocess/purchase/route")).POST;
});

function makeReq(payload: unknown) {
  return new NextRequest("http://localhost/api/internal/reprocess/purchase", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-secret": "test",
    },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/internal/reprocess/purchase", () => {
  it("resolve paymentIntentId por purchaseId sem sobrescrever purchaseId", async () => {
    const res = await POST(makeReq({ purchaseId: "pur_123" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(enqueueOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        operationType: "FULFILL_PAYMENT",
        dedupeKey: "pur_123",
        correlations: expect.objectContaining({
          purchaseId: "pur_123",
          paymentIntentId: "pi_123",
        }),
        payload: expect.objectContaining({
          purchaseId: "pur_123",
          paymentIntentId: "pi_123",
        }),
      }),
    );
  });
});
