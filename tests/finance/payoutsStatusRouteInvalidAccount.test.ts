import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const resolveOrganizationIdFromRequest = vi.hoisted(() => vi.fn());
const retrieveStripeAccount = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  organization: { update: vi.fn() },
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationId", () => ({ resolveOrganizationIdFromRequest }));
vi.mock("@/domain/finance/gateway/stripeGateway", () => ({ retrieveStripeAccount }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/http/withApiEnvelope", () => ({
  withApiEnvelope: (handler: unknown) => handler,
}));

let GET: typeof import("@/app/api/org/[orgId]/finance/payouts/status/route").GET;

beforeEach(async () => {
  vi.resetModules();
  createSupabaseServer.mockReset();
  getActiveOrganizationForUser.mockReset();
  resolveOrganizationIdFromRequest.mockReset();
  retrieveStripeAccount.mockReset();
  prisma.organization.update.mockReset();

  createSupabaseServer.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
    },
  });
  resolveOrganizationIdFromRequest.mockReturnValue(12);

  GET = (await import("@/app/api/org/[orgId]/finance/payouts/status/route")).GET;
});

describe("GET /api/org/[orgId]/finance/payouts/status invalid stripeAccountId", () => {
  it("returns NOT_CONNECTED and clears invalid stripeAccountId", async () => {
    getActiveOrganizationForUser.mockResolvedValue({
      organization: {
        id: 12,
        orgType: "EXTERNAL",
        stripeAccountId: "acct_platform_orya_shared",
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
      },
      membership: { role: "OWNER" },
    });

    const req = new NextRequest("http://localhost/api/org/12/finance/payouts/status");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe("NOT_CONNECTED");
    expect(retrieveStripeAccount).not.toHaveBeenCalled();
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: 12 },
      data: {
        stripeAccountId: null,
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
      },
    });
  });
});
