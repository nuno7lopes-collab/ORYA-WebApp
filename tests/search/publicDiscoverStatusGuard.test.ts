import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  filterOrphaned: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    searchIndexItem: {
      findMany: mocks.findMany,
      findFirst: mocks.findFirst,
    },
  },
}));

vi.mock("@/domain/searchIndex/guard", () => ({
  filterOrphanedEventSearchItems: mocks.filterOrphaned,
}));

import { getPublicDiscoverBySlug, listPublicDiscover } from "@/domain/search/publicDiscover";

const baseItem = (overrides: Partial<any> = {}) => ({
  id: "idx-1",
  sourceId: "1",
  slug: "evento-1",
  title: "Evento 1",
  description: "Desc",
  startsAt: new Date("2026-03-01T10:00:00Z"),
  endsAt: new Date("2026-03-01T12:00:00Z"),
  status: "PUBLISHED",
  templateType: null,
  pricingMode: "STANDARD",
  isGratis: false,
  priceFromCents: 1500,
  coverImageUrl: null,
  hostName: "Org",
  hostUsername: null,
  addressId: "addr-1",
  addressRef: {
    formattedAddress: "Rua Teste 1, Lisboa",
    canonical: { city: "Lisboa" },
    latitude: 38.7223,
    longitude: -9.1393,
  },
  visibility: "PUBLIC",
  sourceType: "EVENT",
  ...overrides,
});

describe("publicDiscover status guard", () => {
  beforeEach(() => {
    mocks.findMany.mockReset();
    mocks.findFirst.mockReset();
    mocks.filterOrphaned.mockReset();
    mocks.filterOrphaned.mockImplementation(async (items: any[]) => items);
  });

  it("nao devolve slug com estado DRAFT no fallback indexado", async () => {
    mocks.findFirst.mockResolvedValue(baseItem({ status: "DRAFT", slug: "legacy-draft" }));

    const item = await getPublicDiscoverBySlug("legacy-draft");

    expect(item).toBeNull();
  });

  it("filtra DRAFT na lista pública do índice", async () => {
    mocks.findMany.mockResolvedValue([
      baseItem({ id: "idx-1", sourceId: "1", slug: "legacy-draft", status: "DRAFT" }),
      baseItem({ id: "idx-2", sourceId: "2", slug: "evento-publicado", status: "PUBLISHED" }),
    ]);

    const result = await listPublicDiscover({ limit: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.slug).toBe("evento-publicado");
  });
});
