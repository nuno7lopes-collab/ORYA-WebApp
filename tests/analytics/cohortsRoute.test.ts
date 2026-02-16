import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const saleSummaryFindMany = vi.hoisted(() => vi.fn());

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
    saleSummary: {
      findMany: saleSummaryFindMany,
    },
  };
  return { prisma };
});

let GET: typeof import("@/app/api/org/[orgId]/analytics/cohorts/route").GET;

beforeEach(async () => {
  vi.resetModules();
  ensureMemberModuleAccess.mockReset();
  getActiveOrganizationForUser.mockReset();
  saleSummaryFindMany.mockReset();
  GET = (await import("@/app/api/org/[orgId]/analytics/cohorts/route")).GET;
});

describe("analytics cohorts route", () => {
  it("groups financial cohorts by first purchase month", async () => {
    getActiveOrganizationForUser.mockResolvedValue({
      organization: { id: 10 },
      membership: { role: "ADMIN", rolePack: null },
    });
    ensureMemberModuleAccess.mockResolvedValue({ ok: true });

    const now = new Date();
    const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
    const previousMonthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1);

    saleSummaryFindMany.mockResolvedValue([
      {
        createdAt: new Date(previousMonthStart + 2 * 24 * 60 * 60 * 1000),
        ownerIdentityId: "buyer_a",
        ownerUserId: null,
        userId: null,
        netCents: 10000,
        totalCents: 12000,
        platformFeeCents: 1000,
        stripeFeeCents: 1000,
      },
      {
        createdAt: new Date(monthStart + 2 * 24 * 60 * 60 * 1000),
        ownerIdentityId: "buyer_a",
        ownerUserId: null,
        userId: null,
        netCents: 8000,
        totalCents: 9500,
        platformFeeCents: 1000,
        stripeFeeCents: 500,
      },
      {
        createdAt: new Date(previousMonthStart + 4 * 24 * 60 * 60 * 1000),
        ownerIdentityId: "buyer_b",
        ownerUserId: null,
        userId: null,
        netCents: 15000,
        totalCents: 17000,
        platformFeeCents: 1000,
        stripeFeeCents: 1000,
      },
      {
        createdAt: new Date(monthStart + 5 * 24 * 60 * 60 * 1000),
        ownerIdentityId: "buyer_c",
        ownerUserId: null,
        userId: null,
        netCents: 5000,
        totalCents: 6000,
        platformFeeCents: 500,
        stripeFeeCents: 500,
      },
    ]);

    const req = new NextRequest("http://localhost/api/org/10/analytics/cohorts?months=3");
    const res = await GET(req);
    const body = await res.json();
    const data = Array.isArray(body?.data?.cohorts) ? body.data : body;

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(data.months).toBe(3);

    const cohorts = data.cohorts as Array<{
      cohortMonth: string;
      buyers: number;
      retention: Array<{ monthOffset: number; retainedBuyers: number; revenueCents: number }>;
    }>;

    const previousMonthKey = new Date(previousMonthStart).toISOString().slice(0, 7);
    const currentMonthKey = new Date(monthStart).toISOString().slice(0, 7);

    const previousCohort = cohorts.find((item) => item.cohortMonth === previousMonthKey);
    expect(previousCohort).toBeTruthy();
    expect(previousCohort?.buyers).toBe(2);
    expect(previousCohort?.retention[0]).toMatchObject({ monthOffset: 0, retainedBuyers: 2, revenueCents: 25000 });
    expect(previousCohort?.retention[1]).toMatchObject({ monthOffset: 1, retainedBuyers: 1, revenueCents: 8000 });

    const currentCohort = cohorts.find((item) => item.cohortMonth === currentMonthKey);
    expect(currentCohort).toBeTruthy();
    expect(currentCohort?.buyers).toBe(1);
    expect(currentCohort?.retention[0]).toMatchObject({ monthOffset: 0, retainedBuyers: 1, revenueCents: 5000 });
  });
});
