import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const constructStripeWebhookEvent = vi.hoisted(() => vi.fn());
const getStripePayoutsWebhookSecret = vi.hoisted(() => vi.fn());
const logError = vi.hoisted(() => vi.fn());
const logInfo = vi.hoisted(() => vi.fn());
const logWarn = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  organization: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock("@/domain/finance/gateway/stripeGateway", () => ({ constructStripeWebhookEvent }));
vi.mock("@/lib/stripeKeys", () => ({ getStripePayoutsWebhookSecret }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/observability/logger", () => ({ logError, logInfo, logWarn }));

import { POST } from "@/app/api/organizacao/payouts/webhook/route";

function makeAccountUpdatedEvent(input: {
  accountId: string;
  organizationId?: string | null;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
}) {
  const {
    accountId,
    organizationId = null,
    chargesEnabled = true,
    payoutsEnabled = true,
  } = input;
  return {
    type: "account.updated",
    data: {
      object: {
        id: accountId,
        metadata: organizationId ? { organizationId } : {},
        charges_enabled: chargesEnabled,
        payouts_enabled: payoutsEnabled,
      },
    },
  };
}

function makeRequest() {
  return new NextRequest("http://localhost/api/organizacao/payouts/webhook", {
    method: "POST",
    headers: { "stripe-signature": "sig_test" },
    body: "{}",
  });
}

describe("payout webhook route", () => {
  beforeEach(() => {
    constructStripeWebhookEvent.mockReset();
    getStripePayoutsWebhookSecret.mockReset();
    logError.mockReset();
    logInfo.mockReset();
    logWarn.mockReset();
    prisma.organization.findUnique.mockReset();
    prisma.organization.findFirst.mockReset();
    prisma.organization.updateMany.mockReset();
    getStripePayoutsWebhookSecret.mockReturnValue("whsec_test");
  });

  it("devolve 400 sem assinatura", async () => {
    const req = new NextRequest("http://localhost/api/organizacao/payouts/webhook", {
      method: "POST",
      body: "{}",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Missing signature");
  });

  it("falha fechado com 422 quando mapping não existe", async () => {
    constructStripeWebhookEvent.mockReturnValue(
      makeAccountUpdatedEvent({ accountId: "acct_1", organizationId: "10" }),
    );
    prisma.organization.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest());
    expect(res.status).toBe(422);
    expect(await res.text()).toContain("Organization mapping not found");
    expect(prisma.organization.updateMany).not.toHaveBeenCalled();
  });

  it("falha fechado com 409 quando accountId não bate com organização", async () => {
    constructStripeWebhookEvent.mockReturnValue(
      makeAccountUpdatedEvent({ accountId: "acct_new", organizationId: "10" }),
    );
    prisma.organization.findUnique.mockResolvedValue({ id: 10, stripeAccountId: "acct_old" });

    const res = await POST(makeRequest());
    expect(res.status).toBe(409);
    expect(await res.text()).toContain("Account mapping mismatch");
    expect(prisma.organization.updateMany).not.toHaveBeenCalled();
  });

  it("devolve 500 quando updateMany não atualiza exatamente 1 registo", async () => {
    constructStripeWebhookEvent.mockReturnValue(
      makeAccountUpdatedEvent({ accountId: "acct_1", organizationId: "10" }),
    );
    prisma.organization.findUnique.mockResolvedValue({ id: 10, stripeAccountId: "acct_1" });
    prisma.organization.updateMany.mockResolvedValue({ count: 0 });

    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    expect(await res.text()).toContain("Organization update failed");
  });

  it("devolve 200 quando mapping é válido e update é aplicado", async () => {
    constructStripeWebhookEvent.mockReturnValue(
      makeAccountUpdatedEvent({
        accountId: "acct_1",
        organizationId: "10",
        chargesEnabled: true,
        payoutsEnabled: false,
      }),
    );
    prisma.organization.findUnique.mockResolvedValue({ id: 10, stripeAccountId: "acct_1" });
    prisma.organization.updateMany.mockResolvedValue({ count: 1 });

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.result.received).toBe(true);
    expect(prisma.organization.updateMany).toHaveBeenCalledWith({
      where: { id: 10 },
      data: {
        stripeChargesEnabled: true,
        stripePayoutsEnabled: false,
        stripeAccountId: "acct_1",
      },
    });
  });
});
