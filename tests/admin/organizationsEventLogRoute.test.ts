import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireAdminUser = vi.hoisted(() => vi.fn());
const prisma = vi.hoisted(() => ({
  eventLog: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/admin/auth", () => ({ requireAdminUser }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let GET: typeof import("@/app/api/admin/organizacoes/event-log/route").GET;

beforeEach(async () => {
  requireAdminUser.mockReset();
  prisma.eventLog.findMany.mockReset();
  vi.resetModules();
  GET = (await import("@/app/api/admin/organizacoes/event-log/route")).GET;
});

describe("admin organization event log route", () => {
  it("valida orgId", async () => {
    requireAdminUser.mockResolvedValue({ ok: true, userId: "u1" });
    const req = new NextRequest("http://localhost/api/admin/organizacoes/event-log");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it("paginacao e filtro por eventType", async () => {
    requireAdminUser.mockResolvedValue({ ok: true, userId: "u1" });
    const createdAt = new Date("2024-01-10T10:00:00.000Z");
    prisma.eventLog.findMany.mockResolvedValue([
      {
        id: "uuid-2",
        eventType: "PAYMENT_CAPTURED",
        actorUserId: null,
        organizationId: 1,
        sourceId: "src-1",
        createdAt,
        payload: {},
      },
      {
        id: "uuid-1",
        eventType: "PAYMENT_CAPTURED",
        actorUserId: null,
        organizationId: 1,
        sourceId: "src-0",
        createdAt,
        payload: {},
      },
    ]);

    const req = new NextRequest(
      "http://localhost/api/admin/organizacoes/event-log?orgId=1&eventType=PAYMENT_CAPTURED&limit=1",
    );
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.items).toHaveLength(1);
    expect(body.page.nextCursor).toBeTruthy();

    const args = prisma.eventLog.findMany.mock.calls[0]?.[0];
    expect(args.take).toBe(2);
    expect(args.where.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ organizationId: 1 }),
        expect.objectContaining({ eventType: "PAYMENT_CAPTURED" }),
      ]),
    );
  });
});
