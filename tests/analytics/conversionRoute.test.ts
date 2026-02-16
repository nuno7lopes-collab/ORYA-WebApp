import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const paymentCount = vi.hoisted(() => vi.fn());
const paymentGroupBy = vi.hoisted(() => vi.fn());

vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationId", () => ({ resolveOrganizationIdFromRequest: () => null }));
vi.mock("@/lib/http/withApiEnvelope", () => ({ withApiEnvelope: (handler: unknown) => handler }));
vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServer: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "u1" } }, error: null })),
    },
  })),
}));

vi.mock("@/lib/prisma", () => {
  const prisma = {
    payment: {
      count: paymentCount,
      groupBy: paymentGroupBy,
    },
  };
  return { prisma };
});

let GET: typeof import("@/app/api/org/[orgId]/analytics/conversion/route").GET;

beforeEach(async () => {
  vi.resetModules();
  ensureMemberModuleAccess.mockReset();
  getActiveOrganizationForUser.mockReset();
  paymentCount.mockReset();
  paymentGroupBy.mockReset();
  GET = (await import("@/app/api/org/[orgId]/analytics/conversion/route")).GET;
});

describe("analytics conversion route", () => {
  it("returns checkout funnel metrics", async () => {
    getActiveOrganizationForUser.mockResolvedValue({
      organization: { id: 10 },
      membership: { role: "ADMIN", rolePack: null },
    });
    ensureMemberModuleAccess.mockResolvedValue({ ok: true });

    paymentCount.mockResolvedValueOnce(100).mockResolvedValueOnce(65);
    paymentGroupBy
      .mockResolvedValueOnce([
        { sourceType: "BOOKING", _count: { _all: 40 } },
        { sourceType: "PADEL_REGISTRATION", _count: { _all: 60 } },
      ])
      .mockResolvedValueOnce([
        { sourceType: "BOOKING", _count: { _all: 20 } },
        { sourceType: "PADEL_REGISTRATION", _count: { _all: 45 } },
      ]);

    const req = new NextRequest("http://localhost/api/org/10/analytics/conversion?range=30d");
    const res = await GET(req);
    const body = await res.json();
    const data = typeof body?.data?.startedCount === "number" ? body.data : body;

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(data.startedCount).toBe(100);
    expect(data.succeededCount).toBe(65);
    expect(data.conversionRateBps).toBe(6500);
    expect(data.breakdown).toEqual([
      { sourceType: "BOOKING", startedCount: 40, succeededCount: 20, conversionRateBps: 5000 },
      { sourceType: "PADEL_REGISTRATION", startedCount: 60, succeededCount: 45, conversionRateBps: 7500 },
    ]);
  });

  it("returns 403 when module access is denied", async () => {
    getActiveOrganizationForUser.mockResolvedValue({
      organization: { id: 10 },
      membership: { role: "STAFF", rolePack: null },
    });
    ensureMemberModuleAccess.mockResolvedValue({ ok: false });

    const req = new NextRequest("http://localhost/api/org/10/analytics/conversion");
    const res = await GET(req);

    expect(res.status).toBe(403);
  });
});
