import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const listRankedEvents = vi.hoisted(() => vi.fn());
const prismaEventFindMany = vi.hoisted(() => vi.fn());
const createSupabaseServerMock = vi.hoisted(() => vi.fn());

vi.mock("@/domain/ranking/listRankedEvents", () => ({
  listRankedEvents: (...args: unknown[]) => listRankedEvents(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findMany: prismaEventFindMany },
    profile: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServer: (...args: unknown[]) => createSupabaseServerMock(...args),
}));

vi.mock("@/lib/observability/logger", () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

const baseEvent = (overrides: Partial<any> = {}) => ({
  id: 1,
  slug: "evento-1",
  title: "Evento 1",
  description: "desc",
  startsAt: new Date("2099-01-01T10:00:00Z"),
  endsAt: new Date("2099-01-01T12:00:00Z"),
  status: "PUBLISHED",
  templateType: null,
  interestTags: [],
  ownerUserId: null,
  organization: {
    publicName: "Org Teste",
    businessName: "Org Teste",
    username: "org-teste",
    brandingAvatarUrl: null,
  },
  addressId: "11111111-1111-1111-1111-111111111111",
  addressRef: {
    formattedAddress: "Rua A, Lisboa",
    canonical: { city: "Lisboa" },
    latitude: 38.7223,
    longitude: -9.1393,
  },
  pricingMode: "STANDARD",
  coverImageUrl: null,
  ticketTypes: [],
  ...overrides,
});

describe("GET /api/explorar/list?mode=map", () => {
  beforeEach(() => {
    vi.resetModules();
    prismaEventFindMany.mockReset();
    listRankedEvents.mockReset();
    createSupabaseServerMock.mockReset();
  });

  it("usa fast-path de mapa sem ranking personalizado nem auth", async () => {
    prismaEventFindMany.mockResolvedValue([baseEvent()]);
    const { GET } = await import("@/app/api/explorar/list/route");

    const req = new NextRequest(
      "http://localhost/api/explorar/list?mode=map&north=38.8&south=38.6&east=-9.0&west=-9.3&limit=60",
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(createSupabaseServerMock).not.toHaveBeenCalled();
    expect(listRankedEvents).not.toHaveBeenCalled();
    expect(prismaEventFindMany).toHaveBeenCalledTimes(1);
    expect(body.result.pagination.hasMore).toBe(false);
    expect(body.result.pagination.nextCursor ?? null).toBeNull();
    expect(body.result.items).toHaveLength(1);
  });

  it("ordena por distância ao centro recebido", async () => {
    prismaEventFindMany.mockResolvedValue([
      baseEvent({
        id: 10,
        slug: "longe",
        title: "Longe",
        addressRef: {
          formattedAddress: "Rua B, Porto",
          canonical: { city: "Porto" },
          latitude: 41.1496,
          longitude: -8.6109,
        },
      }),
      baseEvent({
        id: 11,
        slug: "perto",
        title: "Perto",
        addressRef: {
          formattedAddress: "Rua C, Lisboa",
          canonical: { city: "Lisboa" },
          latitude: 38.7224,
          longitude: -9.1391,
        },
      }),
    ]);
    const { GET } = await import("@/app/api/explorar/list/route");

    const req = new NextRequest(
      "http://localhost/api/explorar/list?mode=map&lat=38.7223&lng=-9.1393&limit=10",
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.result.items[0]?.id).toBe(11);
    expect(body.result.items[1]?.id).toBe(10);
  });

  it("aplica filtro de bounds com crossing anti-meridiano", async () => {
    prismaEventFindMany.mockResolvedValue([baseEvent()]);
    const { GET } = await import("@/app/api/explorar/list/route");

    const req = new NextRequest(
      "http://localhost/api/explorar/list?mode=map&north=10&south=-10&east=-170&west=170&limit=10",
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const call = prismaEventFindMany.mock.calls[0]?.[0] as {
      where?: { AND?: Array<{ addressRef?: { OR?: unknown[] } }> };
    };
    const andFilters = call?.where?.AND ?? [];
    const boundsFilter = andFilters.find((entry) => Boolean(entry.addressRef));
    expect(boundsFilter?.addressRef?.OR).toBeDefined();
    expect(Array.isArray(boundsFilter?.addressRef?.OR)).toBe(true);
  });

  it("clampa limit para 50 no modo mapa", async () => {
    prismaEventFindMany.mockResolvedValue(
      Array.from({ length: 180 }, (_, index) =>
        baseEvent({
          id: index + 1,
          slug: `evento-${index + 1}`,
          title: `Evento ${index + 1}`,
        }),
      ),
    );
    const { GET } = await import("@/app/api/explorar/list/route");

    const req = new NextRequest(
      "http://localhost/api/explorar/list?mode=map&lat=38.7223&lng=-9.1393&limit=999",
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.result.items).toHaveLength(50);
    const prismaArgs = prismaEventFindMany.mock.calls[0]?.[0] as { take?: number };
    expect(prismaArgs.take).toBe(150);
  });
});
