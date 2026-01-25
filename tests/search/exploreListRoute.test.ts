import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const prismaFindMany = vi.hoisted(() => vi.fn());
const prismaProfileFindUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    searchIndexItem: { findMany: prismaFindMany },
    profile: { findUnique: prismaProfileFindUnique },
  },
}));

vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServer: vi.fn(async () => {
    throw new Error("no session");
  }),
}));

vi.mock("@/domain/social/follows", () => ({
  getOrganizationFollowingSet: vi.fn(async () => new Set()),
}));

let GET: typeof import("@/app/api/explorar/list/route").GET;

beforeEach(async () => {
  prismaFindMany.mockReset();
  prismaProfileFindUnique.mockReset();
  vi.resetModules();
  GET = (await import("@/app/api/explorar/list/route")).GET;
});

const baseIndexItem = (overrides: Partial<any> = {}) => ({
  id: "idx-1",
  organizationId: 1,
  sourceId: "1",
  slug: "evento-1",
  title: "Evento 1",
  description: "Desc",
  startsAt: new Date("2025-01-01T10:00:00Z"),
  endsAt: new Date("2025-01-01T12:00:00Z"),
  status: "PUBLISHED",
  templateType: null,
  pricingMode: "STANDARD",
  isGratis: false,
  priceFromCents: 1000,
  coverImageUrl: null,
  hostName: "Org",
  hostUsername: null,
  locationName: "Local",
  locationCity: "Lisboa",
  address: null,
  latitude: null,
  longitude: null,
  locationFormattedAddress: null,
  locationSource: null,
  ...overrides,
});

describe("explorar list route", () => {
  it("devolve items com DTO público", async () => {
    prismaFindMany.mockResolvedValue([baseIndexItem()]);

    const req = new NextRequest("http://localhost/api/explorar/list?limit=1");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      id: 1,
      title: "Evento 1",
      isGratis: false,
    });
  });
});
