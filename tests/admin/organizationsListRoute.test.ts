import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireAdminUser = vi.hoisted(() => vi.fn());
const prisma = vi.hoisted(() => ({
  organization: {
    findMany: vi.fn(),
  },
  event: {
    groupBy: vi.fn(),
  },
  $queryRaw: vi.fn(),
}));

vi.mock("@/lib/admin/auth", () => ({ requireAdminUser }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let GET: typeof import("@/app/api/admin/organizacoes/list/route").GET;

beforeEach(async () => {
  requireAdminUser.mockReset();
  prisma.organization.findMany.mockReset();
  prisma.event.groupBy.mockReset();
  prisma.$queryRaw.mockReset();
  vi.resetModules();
  GET = (await import("@/app/api/admin/organizacoes/list/route")).GET;
});

describe("admin organizations list route", () => {
  it("bloqueia sem admin", async () => {
    requireAdminUser.mockResolvedValue({ ok: false, status: 403, error: "FORBIDDEN" });

    const req = new NextRequest("http://localhost/api/admin/organizacoes/list");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.ok).toBe(false);
  });

  it("aplica filtros e paginação com cursor", async () => {
    requireAdminUser.mockResolvedValue({ ok: true, userId: "u1" });
    const createdAt = new Date("2024-01-10T10:00:00.000Z");
    prisma.organization.findMany.mockResolvedValue([
      {
        id: 2,
        publicName: "Club A",
        status: "ACTIVE",
        createdAt,
        orgType: null,
        stripeAccountId: null,
        stripeChargesEnabled: null,
        stripePayoutsEnabled: null,
        officialEmail: null,
        officialEmailVerifiedAt: null,
        members: [],
      },
      {
        id: 1,
        publicName: "Club B",
        status: "ACTIVE",
        createdAt,
        orgType: null,
        stripeAccountId: null,
        stripeChargesEnabled: null,
        stripePayoutsEnabled: null,
        officialEmail: null,
        officialEmailVerifiedAt: null,
        members: [],
      },
    ]);
    prisma.event.groupBy.mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue([]);

    const req = new NextRequest(
      "http://localhost/api/admin/organizacoes/list?status=ACTIVE&q=Club&limit=1",
    );
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.organizations).toHaveLength(1);
    expect(body.page.nextCursor).toBeTruthy();

    const args = prisma.organization.findMany.mock.calls[0]?.[0];
    expect(args.take).toBe(2);
    expect(args.where.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "ACTIVE" }),
        expect.objectContaining({ OR: expect.any(Array) }),
      ]),
    );
  });
});
