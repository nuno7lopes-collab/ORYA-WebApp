import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireUser = vi.hoisted(() => vi.fn());
const resolveGroupDashboardScope = vi.hoisted(() => vi.fn());

const parsePositiveInt = vi.hoisted(() =>
  vi.fn((raw: string | null | undefined) => {
    if (!raw) return null;
    const value = Number(raw);
    return Number.isInteger(value) && value > 0 ? value : null;
  }),
);

const parseOrgIds = vi.hoisted(() =>
  vi.fn((raw: string | null) => {
    if (!raw) return [] as number[];
    return raw
      .split(",")
      .map((part) => Number(part.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);
  }),
);

const prisma = vi.hoisted(() => ({
  paymentSnapshot: { findMany: vi.fn() },
  invoice: { findMany: vi.fn() },
  payout: { findMany: vi.fn() },
  crmContact: { findMany: vi.fn() },
  crmCampaign: { findMany: vi.fn() },
  crmCampaignDelivery: { findMany: vi.fn() },
  booking: { findMany: vi.fn() },
  service: { groupBy: vi.fn() },
  padelRankingEntry: { findMany: vi.fn() },
  event: { findMany: vi.fn() },
  padelPlayerProfile: { findMany: vi.fn() },
}));

vi.mock("@/lib/auth/requireUser", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/requireUser")>();
  return {
    ...actual,
    requireUser,
  };
});

vi.mock("@/app/api/org-hub/groups/[groupId]/dashboard/_helpers", () => ({
  parsePositiveInt,
  parseOrgIds,
  resolveGroupDashboardScope,
}));

vi.mock("@/lib/prisma", () => ({ prisma }));

type RouteHandler = (
  req: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) => Promise<Response>;

let financeGet: RouteHandler;
let crmGet: RouteHandler;
let reservasGet: RouteHandler;
let rankingsGet: RouteHandler;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  requireUser.mockResolvedValue({ id: "viewer-1" });
  resolveGroupDashboardScope.mockResolvedValue({
    ok: true,
    organizations: [{ id: 11, name: "Org 11" }],
    scopedOrgIds: [11],
    orgById: new Map([[11, "Org 11"]]),
  });

  prisma.paymentSnapshot.findMany.mockResolvedValue([]);
  prisma.invoice.findMany.mockResolvedValue([]);
  prisma.payout.findMany.mockResolvedValue([]);
  prisma.crmContact.findMany.mockResolvedValue([]);
  prisma.crmCampaign.findMany.mockResolvedValue([]);
  prisma.crmCampaignDelivery.findMany.mockResolvedValue([]);
  prisma.booking.findMany.mockResolvedValue([]);
  prisma.service.groupBy.mockResolvedValue([]);
  prisma.padelRankingEntry.findMany.mockResolvedValue([]);
  prisma.event.findMany.mockResolvedValue([]);
  prisma.padelPlayerProfile.findMany.mockResolvedValue([]);

  ({ GET: financeGet } = await import("@/app/api/org-hub/groups/[groupId]/dashboard/finance/route"));
  ({ GET: crmGet } = await import("@/app/api/org-hub/groups/[groupId]/dashboard/crm/route"));
  ({ GET: reservasGet } = await import("@/app/api/org-hub/groups/[groupId]/dashboard/reservas/route"));
  ({ GET: rankingsGet } = await import("@/app/api/org-hub/groups/[groupId]/dashboard/rankings/route"));
});

const routeCases: Array<{ name: string; path: string; handler: RouteHandler }> = [
  {
    name: "finance",
    path: "http://localhost/api/org-hub/groups/7/dashboard/finance",
    handler: (req, ctx) => financeGet(req, ctx),
  },
  {
    name: "crm",
    path: "http://localhost/api/org-hub/groups/7/dashboard/crm",
    handler: (req, ctx) => crmGet(req, ctx),
  },
  {
    name: "reservas",
    path: "http://localhost/api/org-hub/groups/7/dashboard/reservas",
    handler: (req, ctx) => reservasGet(req, ctx),
  },
  {
    name: "rankings",
    path: "http://localhost/api/org-hub/groups/7/dashboard/rankings",
    handler: (req, ctx) => rankingsGet(req, ctx),
  },
];

describe("group dashboard modulos alem agenda", () => {
  it.each(routeCases)("devolve 403 quando scope resolve para FORBIDDEN em $name", async ({ path, handler }) => {
    resolveGroupDashboardScope.mockResolvedValueOnce({
      ok: false,
      status: 403,
      errorCode: "FORBIDDEN",
      message: "FORBIDDEN",
    });

    const res = await handler(new NextRequest(path), {
      params: Promise.resolve({ groupId: "7" }),
    });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("FORBIDDEN");
  });

  it.each(routeCases)("devolve 200 com resumo vazio quando nao ha orgs em scope em $name", async ({ path, handler }) => {
    resolveGroupDashboardScope.mockResolvedValueOnce({
      ok: true,
      organizations: [],
      scopedOrgIds: [],
      orgById: new Map(),
    });

    const res = await handler(new NextRequest(path), {
      params: Promise.resolve({ groupId: "7" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data?.summary?.organizations).toBe(0);
  });
});
