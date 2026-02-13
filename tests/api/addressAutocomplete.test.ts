import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  autocomplete: vi.fn(),
  details: vi.fn(),
  reverse: vi.fn(),
  rank: vi.fn(),
}));

vi.mock("@/lib/geo/provider", () => ({
  getGeoResolver: vi.fn(() => ({
    autocomplete: mocks.autocomplete,
    details: mocks.details,
    reverse: mocks.reverse,
  })),
}));

vi.mock("@/lib/geo/rateLimit", () => ({
  checkRateLimit: vi.fn(() => ({ ok: true, resetAt: Date.now() + 60_000 })),
}));

vi.mock("@/lib/geo/ipBias", () => ({
  getClientIp: vi.fn(() => "1.1.1.1"),
  resolveRequestGeoContext: vi.fn(async () => ({
    ip: "1.1.1.1",
    lat: 41.1579,
    lng: -8.6291,
    countryCode: "PT",
    city: "Porto",
    region: "Porto",
    source: "LANG",
  })),
}));

vi.mock("@/lib/geo/cache", () => ({
  buildCacheKey: vi.fn((parts: unknown[]) => parts.join("|")),
  getCache: vi.fn(() => null),
  setCache: vi.fn(),
}));

vi.mock("@/lib/geo/locationUx", () => ({
  rankLocationSuggestions: mocks.rank,
}));

vi.mock("@/lib/http/withApiEnvelope", () => ({
  withApiEnvelope: (handler: unknown) => handler,
}));

vi.mock("@/lib/observability/logger", () => ({
  logError: vi.fn(),
}));

import { GET } from "@/app/api/address/autocomplete/route";
import { buildCacheKey } from "@/lib/geo/cache";

describe("GET /api/address/autocomplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rank.mockImplementation((items: unknown[]) => items);
    mocks.autocomplete.mockResolvedValue({
      sourceProvider: "APPLE_MAPS",
      data: [],
    });
    mocks.details.mockResolvedValue({ sourceProvider: "APPLE_MAPS", data: null });
    mocks.reverse.mockResolvedValue({ sourceProvider: "APPLE_MAPS", data: null });
  });

  it("enriquece top sugestões sem secondaryLabel usando details/reverse", async () => {
    mocks.autocomplete.mockResolvedValue({
      sourceProvider: "APPLE_MAPS",
      data: [
        {
          providerId: "I4C55964E8DA2A50F",
          label: "Bessa XXI",
          secondaryLabel: null,
          name: "Bessa XXI",
          locality: "Porto",
          city: "Porto",
          address: null,
          countryCode: null,
          lat: 41.16225,
          lng: -8.64242,
        },
        {
          providerId: "synthetic:bessa:41.163271:-8.643321",
          label: "Bessa",
          secondaryLabel: null,
          name: "Bessa",
          locality: null,
          city: null,
          address: null,
          countryCode: null,
          lat: 41.163271,
          lng: -8.643321,
        },
      ],
    });

    mocks.details.mockResolvedValue({
      sourceProvider: "APPLE_MAPS",
      data: {
        providerId: "I4C55964E8DA2A50F",
        formattedAddress: "Rua de O Primeiro de Janeiro 100, Porto",
        components: null,
        lat: 41.16225,
        lng: -8.64242,
        name: "Estádio Do Bessa Séc. XXI",
        city: "Porto",
        address: "Rua de O Primeiro de Janeiro 100, Porto",
      },
    });

    mocks.reverse.mockResolvedValue({
      sourceProvider: "APPLE_MAPS",
      data: {
        providerId: null,
        formattedAddress: "Rua de António Pinto Machado, Porto",
        components: null,
        lat: 41.163271,
        lng: -8.643321,
        name: "Rua de António Pinto Machado",
        city: "Porto",
        address: "Rua de António Pinto Machado, Porto",
      },
    });

    const req = new NextRequest("http://localhost/api/address/autocomplete?q=bessa&lang=pt-PT");
    const res = await GET(req);
    const json = (await res.json()) as {
      ok?: boolean;
      items?: Array<{ secondaryLabel?: string | null }>;
      expectedCountryCode?: string | null;
      effectiveCountryCode?: string | null;
      queryCountryIntentCode?: string | null;
      data?: {
        items?: Array<{ secondaryLabel?: string | null }>;
        expectedCountryCode?: string | null;
        effectiveCountryCode?: string | null;
        queryCountryIntentCode?: string | null;
      };
    };
    const items = json.items ?? json.data?.items ?? [];

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(items[0]?.secondaryLabel).toBe("Rua de O Primeiro de Janeiro 100, Porto");
    expect(items[1]?.secondaryLabel).toBe("Rua de António Pinto Machado, Porto");
    expect(json.expectedCountryCode ?? json.data?.expectedCountryCode).toBe("PT");
    expect(json.effectiveCountryCode ?? json.data?.effectiveCountryCode).toBe("PT");
    expect(json.queryCountryIntentCode ?? json.data?.queryCountryIntentCode ?? null).toBe(null);
    expect(mocks.details).toHaveBeenCalledTimes(1);
    expect(mocks.reverse).toHaveBeenCalledTimes(1);
  });

  it("degrada para lista original quando orçamento de enriquecimento estoura", async () => {
    mocks.autocomplete.mockResolvedValue({
      sourceProvider: "APPLE_MAPS",
      data: [
        {
          providerId: "I1111111111111111",
          label: "A",
          secondaryLabel: null,
          name: "A",
          locality: null,
          city: null,
          address: null,
          countryCode: null,
          lat: 41.1,
          lng: -8.6,
        },
        {
          providerId: "I2222222222222222",
          label: "B",
          secondaryLabel: null,
          name: "B",
          locality: null,
          city: null,
          address: null,
          countryCode: null,
          lat: 41.2,
          lng: -8.7,
        },
      ],
    });

    mocks.details.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ sourceProvider: "APPLE_MAPS", data: null }), 300);
        }),
    );

    const req = new NextRequest("http://localhost/api/address/autocomplete?q=ab&lang=pt-PT");
    const res = await GET(req);
    const json = (await res.json()) as {
      items?: Array<{ secondaryLabel?: string | null }>;
      expectedCountryCode?: string | null;
      effectiveCountryCode?: string | null;
      queryCountryIntentCode?: string | null;
      data?: {
        items?: Array<{ secondaryLabel?: string | null }>;
        expectedCountryCode?: string | null;
        effectiveCountryCode?: string | null;
        queryCountryIntentCode?: string | null;
      };
    };
    const items = json.items ?? json.data?.items ?? [];

    expect(res.status).toBe(200);
    expect(items.map((item) => item.secondaryLabel ?? null)).toEqual([null, null]);
    expect(json.expectedCountryCode ?? json.data?.expectedCountryCode).toBe("PT");
    expect(json.effectiveCountryCode ?? json.data?.effectiveCountryCode).toBe("PT");
    expect(json.queryCountryIntentCode ?? json.data?.queryCountryIntentCode ?? null).toBe(null);
    expect(mocks.details).toHaveBeenCalledTimes(2);
  });

  it("ativa auto-bypass quando query explicita outro país", async () => {
    mocks.autocomplete.mockResolvedValue({
      sourceProvider: "APPLE_MAPS",
      data: [
        {
          providerId: "es-1",
          label: "Madrid",
          secondaryLabel: "Madrid, Spain",
          name: "Madrid",
          locality: "Madrid",
          city: "Madrid",
          address: "Madrid, Spain",
          countryCode: "ES",
          lat: 40.4168,
          lng: -3.7038,
        },
      ],
    });

    const req = new NextRequest("http://localhost/api/address/autocomplete?q=madrid%20spain&lang=pt-PT");
    const res = await GET(req);
    const json = (await res.json()) as {
      expectedCountryCode?: string | null;
      effectiveCountryCode?: string | null;
      queryCountryIntentCode?: string | null;
      data?: {
        expectedCountryCode?: string | null;
        effectiveCountryCode?: string | null;
        queryCountryIntentCode?: string | null;
      };
    };

    expect(res.status).toBe(200);
    expect(json.expectedCountryCode ?? json.data?.expectedCountryCode).toBe("PT");
    expect(json.effectiveCountryCode ?? json.data?.effectiveCountryCode).toBe("ES");
    expect(json.queryCountryIntentCode ?? json.data?.queryCountryIntentCode).toBe("ES");
    expect(mocks.rank).toHaveBeenCalled();
    expect(mocks.rank.mock.calls[0]?.[3]).toMatchObject({ countryCode: "ES" });
    expect(buildCacheKey).toHaveBeenCalled();
    const cacheParts = vi.mocked(buildCacheKey).mock.calls[0]?.[0] as unknown[] | undefined;
    expect(cacheParts).toEqual(
      expect.arrayContaining(["address-autocomplete", "v3", "madrid spain", "PT", "ES", "ES", "pt-PT"]),
    );
  });

  it("faz retry com hint de país quando resultados iniciais não têm país esperado", async () => {
    mocks.autocomplete.mockImplementation(async ({ query }: { query: string }) => {
      if (query === "estad") {
        return {
          sourceProvider: "APPLE_MAPS",
          data: [
            {
              providerId: "us-1",
              label: "Estados Unidos",
              secondaryLabel: "Estados Unidos",
              name: "Estados Unidos",
              locality: null,
              city: null,
              address: "Estados Unidos",
              countryCode: "US",
              lat: 39.9997,
              lng: -98.6785,
            },
          ],
        };
      }
      if (query === "estad Portugal") {
        return {
          sourceProvider: "APPLE_MAPS",
          data: [
            {
              providerId: "pt-1",
              label: "Estádio Municipal de Abrantes",
              secondaryLabel: "Abrantes, Portugal",
              name: "Estádio Municipal de Abrantes",
              locality: "Abrantes",
              city: "Abrantes",
              address: "Abrantes, Portugal",
              countryCode: "PT",
              lat: 39.466,
              lng: -8.194,
            },
          ],
        };
      }
      return { sourceProvider: "APPLE_MAPS", data: [] };
    });

    mocks.rank.mockImplementation((items: Array<{ countryCode?: string | null }>) =>
      [...items].sort((a, b) => {
        const aPt = (a.countryCode ?? "").toUpperCase() === "PT" ? 1 : 0;
        const bPt = (b.countryCode ?? "").toUpperCase() === "PT" ? 1 : 0;
        return bPt - aPt;
      }),
    );

    const req = new NextRequest("http://localhost/api/address/autocomplete?q=estad&lang=pt-PT");
    const res = await GET(req);
    const json = (await res.json()) as {
      items?: Array<{ label?: string | null; countryCode?: string | null }>;
      data?: { items?: Array<{ label?: string | null; countryCode?: string | null }> };
    };
    const items = json.items ?? json.data?.items ?? [];

    expect(res.status).toBe(200);
    expect(mocks.autocomplete).toHaveBeenCalledTimes(2);
    expect(mocks.autocomplete.mock.calls[1]?.[0]).toMatchObject({
      query: "estad Portugal",
      lat: 41.1579,
      lng: -8.6291,
      lang: "pt-PT",
    });
    expect(items[0]?.countryCode).toBe("PT");
    expect(items[0]?.label).toContain("Estádio");
  });
});
