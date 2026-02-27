import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const constructStripeWebhookEvent = vi.hoisted(() => vi.fn());
const appendEventLog = vi.hoisted(() => vi.fn());
const recordOutboxEvent = vi.hoisted(() => vi.fn(async () => undefined));

const prisma = vi.hoisted(() => ({
  organization: { findFirst: vi.fn() },
  payment: { findUnique: vi.fn() },
  event: { findUnique: vi.fn() },
  booking: { findUnique: vi.fn() },
  storeOrder: { findUnique: vi.fn() },
  store: { findUnique: vi.fn() },
  outboxEvent: { update: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) => fn(prisma)),
}));

vi.mock("@/lib/stripeKeys", () => ({
  getStripeWebhookSecret: vi.fn(() => "whsec_test"),
}));

vi.mock("@/domain/finance/gateway/stripeGateway", () => ({
  constructStripeWebhookEvent,
  retrieveCharge: vi.fn(),
  retrievePaymentIntent: vi.fn(),
}));

vi.mock("@/domain/eventLog/append", () => ({ appendEventLog }));
vi.mock("@/domain/outbox/producer", () => ({ recordOutboxEvent }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/http/withApiEnvelope", () => ({ withApiEnvelope: (handler: unknown) => handler }));

let POST: typeof import("@/app/api/stripe/webhook/route").POST;

function makeReq() {
  return new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: {
      "stripe-signature": "sig_test",
      "content-type": "application/json",
    },
    body: "{}",
  });
}

beforeEach(async () => {
  vi.resetModules();
  constructStripeWebhookEvent.mockReset();
  appendEventLog.mockReset();
  recordOutboxEvent.mockReset();
  prisma.$transaction.mockReset();
  prisma.$transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => fn(prisma));

  const event = {
    id: "evt_replay_1",
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: "pi_123",
        metadata: {
          orgId: "10",
          purchaseId: "pur_123",
          sourceType: "BOOKING",
          sourceId: "123",
        },
      },
    },
  };
  constructStripeWebhookEvent.mockReturnValue(event);

  appendEventLog
    .mockResolvedValueOnce({ eventId: "log_1" })
    .mockResolvedValueOnce(null);

  POST = (await import("@/app/api/stripe/webhook/route")).POST;
});

describe("POST /api/stripe/webhook idempotência", () => {
  it("ignora replay do mesmo stripe event.id sem duplicar outbox", async () => {
    const first = await POST(makeReq());
    const firstBody = await first.json();
    const second = await POST(makeReq());
    const secondBody = await second.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(firstBody.ok).toBe(true);
    expect(secondBody.ok).toBe(true);

    expect(appendEventLog).toHaveBeenCalledTimes(2);
    expect(recordOutboxEvent).toHaveBeenCalledTimes(1);
  });

  it("ignora replay do mesmo stripe event.id para flow EVENT_TICKET/TICKET_ORDER", async () => {
    constructStripeWebhookEvent.mockReturnValue({
      id: "evt_replay_event_ticket",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_event_ticket_1",
          metadata: {
            orgId: "20",
            purchaseId: "pur_event_ticket_1",
            sourceType: "TICKET_ORDER",
            sourceId: "345",
          },
        },
      },
    });
    appendEventLog
      .mockResolvedValueOnce({ eventId: "log_event_1" })
      .mockResolvedValueOnce(null);

    const first = await POST(makeReq());
    const firstBody = await first.json();
    const second = await POST(makeReq());
    const secondBody = await second.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(firstBody.ok).toBe(true);
    expect(secondBody.ok).toBe(true);

    expect(appendEventLog).toHaveBeenCalledTimes(2);
    expect(recordOutboxEvent).toHaveBeenCalledTimes(1);
  });
});
