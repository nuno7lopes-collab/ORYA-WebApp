import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getUserWithPolicy = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const resolveOrganizationIdFromRequest = vi.hoisted(() => vi.fn());
const resolvePaymentStatusMap = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  event: { findMany: vi.fn() },
  saleSummary: { findMany: vi.fn() },
  refund: { groupBy: vi.fn() },
  padelPairing: { groupBy: vi.fn(), count: vi.fn() },
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/auth/getUserWithPolicy", () => ({ getUserWithPolicy }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/organizationId", () => ({ resolveOrganizationIdFromRequest }));
vi.mock("@/domain/finance/resolvePaymentStatus", () => ({ resolvePaymentStatusMap }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/http/withApiEnvelope", () => ({
  withApiEnvelope: (handler: unknown) => handler,
}));

let GETOverview: typeof import("@/app/api/org/[orgId]/finance/overview/route").GET;
let GETReconciliation: typeof import("@/app/api/org/[orgId]/finance/reconciliation/route").GET;

function unwrapPayload(body: any) {
  if (body?.data && typeof body.data === "object") return body.data;
  if (body?.result && typeof body.result === "object") return body.result;
  return body;
}

beforeEach(async () => {
  vi.resetModules();

  createSupabaseServer.mockReset();
  getUserWithPolicy.mockReset();
  getActiveOrganizationForUser.mockReset();
  ensureMemberModuleAccess.mockReset();
  resolveOrganizationIdFromRequest.mockReset();
  resolvePaymentStatusMap.mockReset();
  prisma.event.findMany.mockReset();
  prisma.saleSummary.findMany.mockReset();
  prisma.refund.groupBy.mockReset();
  prisma.padelPairing.groupBy.mockReset();
  prisma.padelPairing.count.mockReset();

  createSupabaseServer.mockResolvedValue({});
  getUserWithPolicy.mockResolvedValue({
    data: { user: { id: "user-1" } },
    error: null,
  });
  resolveOrganizationIdFromRequest.mockReturnValue(2);
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 2 },
    membership: { role: "OWNER", rolePack: null },
  });
  ensureMemberModuleAccess.mockResolvedValue({ ok: true });

  prisma.event.findMany.mockResolvedValue([
    {
      id: 11,
      title: "Evento Financeiro",
      slug: "evento-financeiro",
      startsAt: new Date("2026-02-20T10:00:00.000Z"),
      status: "PUBLISHED",
      payoutMode: "AUTO",
    },
  ]);
  prisma.refund.groupBy.mockResolvedValue([]);
  prisma.padelPairing.groupBy.mockResolvedValue([]);
  prisma.padelPairing.count.mockResolvedValue(0);

  GETOverview = (await import("@/app/api/org/[orgId]/finance/overview/route")).GET;
  GETReconciliation = (await import("@/app/api/org/[orgId]/finance/reconciliation/route")).GET;
});

describe("finance status guardrails", () => {
  it("overview mantém 200, inclui card fees e ignora apenas estados explicitamente não pagos", async () => {
    const recentCreatedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    prisma.saleSummary.findMany.mockResolvedValue([
      {
        id: 1,
        eventId: 11,
        purchaseId: "pay_ok",
        createdAt: recentCreatedAt,
        subtotalCents: 10000,
        discountCents: 0,
        platformFeeCents: 1000,
        cardPlatformFeeCents: 200,
        stripeFeeCents: 300,
        netCents: null,
        totalCents: 10000,
        lines: [{ quantity: 2 }],
      },
      {
        id: 2,
        eventId: 11,
        purchaseId: "pay_refunded",
        createdAt: recentCreatedAt,
        subtotalCents: 5000,
        discountCents: 0,
        platformFeeCents: 500,
        cardPlatformFeeCents: 100,
        stripeFeeCents: 100,
        netCents: 4300,
        totalCents: 5000,
        lines: [{ quantity: 1 }],
      },
      {
        id: 3,
        eventId: 11,
        purchaseId: null,
        createdAt: recentCreatedAt,
        subtotalCents: 3000,
        discountCents: 0,
        platformFeeCents: 300,
        cardPlatformFeeCents: 0,
        stripeFeeCents: 90,
        netCents: null,
        totalCents: 3000,
        lines: [{ quantity: 1 }],
      },
    ]);
    resolvePaymentStatusMap.mockResolvedValue(
      new Map([
        ["pay_ok", { status: "PAID", source: "PAYMENT" }],
        ["pay_refunded", { status: "REFUNDED", source: "PAYMENT" }],
      ]),
    );

    const req = new NextRequest("http://localhost/api/org/2/finance/overview");
    const res = await GETOverview(req);
    const body = await res.json();
    const data = unwrapPayload(body);

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(data.totals).toMatchObject({
      grossCents: 13000,
      feesCents: 1890,
      netCents: 11110,
      tickets: 3,
      eventsWithSales: 1,
    });
    expect(data.rolling.last7).toMatchObject({
      grossCents: 13000,
      feesCents: 1890,
      netCents: 11110,
      tickets: 3,
    });
    expect(resolvePaymentStatusMap).toHaveBeenCalledWith(["pay_ok", "pay_refunded"]);
  });

  it("reconciliation aplica o mesmo filtro de estado e mantém taxas alinhadas", async () => {
    prisma.saleSummary.findMany.mockResolvedValue([
      {
        eventId: 11,
        purchaseId: "pay_ok",
        subtotalCents: 10000,
        totalCents: 10000,
        platformFeeCents: 1000,
        cardPlatformFeeCents: 200,
        stripeFeeCents: 300,
        netCents: null,
        lines: [{ quantity: 2 }],
      },
      {
        eventId: 11,
        purchaseId: "pay_refunded",
        subtotalCents: 5000,
        totalCents: 5000,
        platformFeeCents: 500,
        cardPlatformFeeCents: 100,
        stripeFeeCents: 100,
        netCents: 4300,
        lines: [{ quantity: 1 }],
      },
      {
        eventId: 11,
        purchaseId: null,
        subtotalCents: 3000,
        totalCents: 3000,
        platformFeeCents: 300,
        cardPlatformFeeCents: 0,
        stripeFeeCents: 90,
        netCents: null,
        lines: [{ quantity: 1 }],
      },
    ]);
    resolvePaymentStatusMap.mockResolvedValue(
      new Map([
        ["pay_ok", { status: "PAID", source: "PAYMENT" }],
        ["pay_refunded", { status: "REFUNDED", source: "PAYMENT" }],
      ]),
    );

    const req = new NextRequest("http://localhost/api/org/2/finance/reconciliation");
    const res = await GETReconciliation(req);
    const body = await res.json();
    const data = unwrapPayload(body);

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(data.summary).toMatchObject({
      grossCents: 13000,
      feesCents: 1890,
      netCents: 11110,
      refundsCents: 0,
      netAfterRefundsCents: 11110,
    });
    expect(data.events).toHaveLength(1);
    expect(data.events[0]).toMatchObject({
      id: 11,
      grossCents: 13000,
      feesCents: 1890,
      netCents: 11110,
      netAfterRefundsCents: 11110,
    });
    expect(resolvePaymentStatusMap).toHaveBeenCalledWith(["pay_ok", "pay_refunded"]);
  });
});
