import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const prisma = vi.hoisted(() => ({
  padelPlayerHistoryProjection: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let GET: typeof import("@/app/api/padel/me/history/route").GET;

beforeEach(async () => {
  vi.resetModules();
  createSupabaseServer.mockReset();
  prisma.padelPlayerHistoryProjection.findMany.mockReset();

  GET = (await import("@/app/api/padel/me/history/route")).GET;
});

describe("GET /api/padel/me/history", () => {
  it("returns 401 when unauthenticated", async () => {
    createSupabaseServer.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    });

    const req = new NextRequest("http://localhost/api/padel/me/history");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("UNAUTHENTICATED");
  });

  it("returns official titles and competitive history", async () => {
    createSupabaseServer.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u-1" } },
          error: null,
        }),
      },
    });

    prisma.padelPlayerHistoryProjection.findMany.mockResolvedValue([
      {
        id: 1,
        organizationId: 12,
        eventId: 200,
        categoryId: 5,
        playerProfileId: 100,
        partnerPlayerProfileId: 101,
        finalPosition: 1,
        wonTitle: true,
        bracketSnapshot: { any: true },
        computedAt: new Date("2026-02-13T12:00:00.000Z"),
        event: {
          id: 200,
          title: "Open Lisboa",
          slug: "open-lisboa",
          startsAt: new Date("2026-02-10T10:00:00.000Z"),
          endsAt: new Date("2026-02-12T19:00:00.000Z"),
        },
        category: { id: 5, label: "M3" },
        partnerPlayerProfile: { id: 101, fullName: "Partner One", displayName: null },
      },
      {
        id: 2,
        organizationId: 12,
        eventId: 201,
        categoryId: 6,
        playerProfileId: 100,
        partnerPlayerProfileId: null,
        finalPosition: 4,
        wonTitle: false,
        bracketSnapshot: {},
        computedAt: new Date("2026-02-13T12:00:00.000Z"),
        event: {
          id: 201,
          title: "Series Porto",
          slug: "series-porto",
          startsAt: new Date("2026-01-12T10:00:00.000Z"),
          endsAt: new Date("2026-01-12T18:00:00.000Z"),
        },
        category: { id: 6, label: "M2" },
        partnerPlayerProfile: null,
      },
    ]);

    const req = new NextRequest("http://localhost/api/padel/me/history");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.titles).toHaveLength(1);
    expect(body.history).toHaveLength(2);
    expect(body.history[0].event.title).toBe("Open Lisboa");
  });
});
