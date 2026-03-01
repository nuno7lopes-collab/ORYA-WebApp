import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prismaServiceFindMany = vi.hoisted(() => vi.fn());
const enforcePublicRateLimit = vi.hoisted(() => vi.fn(async () => null));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    service: { findMany: prismaServiceFindMany },
  },
}));

vi.mock("@/lib/padel/publicRateLimit", () => ({
  enforcePublicRateLimit: (...args: unknown[]) => enforcePublicRateLimit(...args),
}));

describe("GET /api/padel/public/services", () => {
  beforeEach(() => {
    prismaServiceFindMany.mockReset();
    enforcePublicRateLimit.mockClear();
    prismaServiceFindMany.mockResolvedValue([]);
  });

  it("valida kind inválido", async () => {
    const { GET } = await import("@/app/api/padel/public/services/route");
    const req = new NextRequest("http://localhost/api/padel/public/services?kind=INVALID");
    const res = await GET(req);
    const body = await res.json();
    const payload = body.result ?? body;

    expect(res.status).toBe(400);
    expect(payload.error).toBe("INVALID_KIND");
  });

  it("aplica filtros de procura, cidade, preço e paginação", async () => {
    const { GET } = await import("@/app/api/padel/public/services/route");
    const req = new NextRequest(
      "http://localhost/api/padel/public/services?q=coach&city=Lisboa&kind=CLASS&priceMin=10&priceMax=25&limit=5&cursor=77&date=today",
    );
    const res = await GET(req);
    await res.json();

    expect(res.status).toBe(200);

    const args = prismaServiceFindMany.mock.calls[0]?.[0];
    expect(args?.take).toBe(6);
    expect(args?.cursor).toEqual({ id: 77 });
    expect(args?.skip).toBe(1);
    expect(args?.where?.kind).toBe("CLASS");
    expect(args?.where?.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          unitPriceCents: expect.objectContaining({ gte: 1000, lte: 2500 }),
        }),
      ]),
    );

    const serializedWhere = JSON.stringify(args?.where ?? {});
    expect(serializedWhere).toContain("coach");
    expect(serializedWhere).toContain("Lisboa");
  });

  it("mapeia items e devolve paginação com cursor", async () => {
    prismaServiceFindMany.mockResolvedValue([
      {
        id: 101,
        title: "Aula Avançada",
        description: "Sessão com treinador",
        durationMinutes: 60,
        unitPriceCents: 1800,
        currency: "EUR",
        kind: "CLASS",
        category: { label: "Competição" },
        addressRef: { formattedAddress: "Lisboa" },
        organization: {
          id: 9,
          publicName: "Clube LX",
          businessName: null,
          username: "clubelx",
          addressRef: { formattedAddress: "Lisboa" },
        },
        instructor: {
          id: "trainer-1",
          fullName: "Rita Coach",
          username: "ritacoach",
        },
      },
      {
        id: 99,
        title: "Aula Intermédia",
        description: null,
        durationMinutes: 60,
        unitPriceCents: 1500,
        currency: "EUR",
        kind: "CLASS",
        category: { label: null },
        addressRef: { formattedAddress: "Porto" },
        organization: {
          id: 9,
          publicName: "Clube LX",
          businessName: null,
          username: "clubelx",
          addressRef: { formattedAddress: "Lisboa" },
        },
        instructor: null,
      },
    ]);

    const { GET } = await import("@/app/api/padel/public/services/route");
    const req = new NextRequest("http://localhost/api/padel/public/services?kind=CLASS&limit=1");
    const res = await GET(req);
    const body = await res.json();
    const payload = body.result ?? body;

    expect(res.status).toBe(200);
    expect(body.ok ?? body.result?.ok).toBe(true);
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]).toMatchObject({
      id: 101,
      title: "Aula Avançada",
      kind: "CLASS",
      categoryLabel: "Competição",
      addressFormatted: "Lisboa",
      organization: {
        id: 9,
        publicName: "Clube LX",
        username: "clubelx",
      },
      instructor: {
        id: "trainer-1",
        fullName: "Rita Coach",
        username: "ritacoach",
      },
    });
    expect(payload.pagination).toEqual({ hasMore: true, nextCursor: 101 });
  });
});
