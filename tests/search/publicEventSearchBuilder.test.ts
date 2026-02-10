import { describe, expect, it, vi, beforeEach } from "vitest";
import { searchPublicEvents } from "@/domain/search/publicEventSearch";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  eventFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    searchIndexItem: { findMany: mocks.findMany },
    event: { findMany: mocks.eventFindMany },
  },
}));

beforeEach(() => {
  mocks.findMany.mockReset();
  mocks.eventFindMany.mockReset();
});

const baseItem = (overrides: Partial<any> = {}) => ({
  id: "idx-1",
  organizationId: 1,
  sourceType: "EVENT",
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
  visibility: "PUBLIC",
  ...overrides,
});

describe("publicEventSearch", () => {
  it("aplica filtro de pesquisa por q", async () => {
    mocks.findMany.mockResolvedValue([baseItem()]);
    mocks.eventFindMany.mockResolvedValue([{ id: 1 }]);

    await searchPublicEvents({ q: "Padel" });

    const call = mocks.findMany.mock.calls[0]?.[0];
    expect(call.where.OR).toBeDefined();
    expect(call.where.visibility).toEqual("PUBLIC");
  });

  it("calcula nextCursor quando há mais itens", async () => {
    mocks.findMany.mockResolvedValue([baseItem({ id: "idx-1" }), baseItem({ id: "idx-2", sourceId: "2" })]);
    mocks.eventFindMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);

    const res = await searchPublicEvents({ limit: 1 });
    expect(res.items).toHaveLength(1);
    expect(res.nextCursor).toBe("idx-2");
  });
});
