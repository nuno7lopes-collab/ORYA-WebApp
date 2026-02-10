import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const prismaFindMany = vi.hoisted(() => vi.fn());
const prismaProfileFindUnique = vi.hoisted(() => vi.fn());
const prismaEventFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    searchIndexItem: { findMany: prismaFindMany },
    profile: { findUnique: prismaProfileFindUnique },
    event: { findMany: prismaEventFindMany },
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
  prismaEventFindMany.mockReset();
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
  startsAt: new Date("2099-01-01T10:00:00Z"),
  endsAt: new Date("2099-01-01T12:00:00Z"),
  status: "PUBLISHED",
  templateType: null,
  pricingMode: "STANDARD",
  isGratis: false,
  priceFromCents: 1000,
  coverImageUrl: null,
  hostName: "Org",
  hostUsername: null,
  locationName: "Local",
  address: null,
  latitude: null,
  longitude: null,
  locationFormattedAddress: "Rua Teste 1, Lisboa",
  locationSource: "APPLE_MAPS",
  addressRef: {
    formattedAddress: "Rua Teste 1, Lisboa",
    canonical: { city: "Lisboa" },
    latitude: 38.7223,
    longitude: -9.1393,
  },
  ...overrides,
});

describe("explorar list route", () => {
  it("devolve items com DTO público", async () => {
    prismaFindMany.mockResolvedValue([baseIndexItem()]);
    prismaEventFindMany.mockResolvedValue([{ id: 1 }]);

    const req = new NextRequest("http://localhost/api/explorar/list?limit=1");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.result.items).toHaveLength(1);
    expect(body.result.items[0]).toMatchObject({
      id: 1,
      title: "Evento 1",
      isGratis: false,
    });
  });
});
