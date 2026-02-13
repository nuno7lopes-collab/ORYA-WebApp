import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppleMapsProvider } from "@/lib/geo/appleProvider";

vi.mock("@/lib/maps/appleToken", () => ({
  mintAppleMapsAccessToken: vi.fn(async () => ({ token: "test-token", expiresAt: "2099-01-01T00:00:00.000Z" })),
}));

describe("AppleMapsProvider.autocomplete", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("usa /searchAutocomplete e mapeia linhas/localidade", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            id: "I4C55964E8DA2A50F",
            displayLines: [
              "Bessa XXI",
              "Estádio do Bessa Século XXI, Rua de O Primeiro de Janeiro 100, 4100-365 Porto, Portugal",
            ],
            structuredAddress: {
              locality: "Porto",
              subLocality: "Ramalde",
            },
            location: {
              latitude: 41.1622505,
              longitude: -8.6424226,
            },
          },
        ],
      }),
      text: async () => "",
    });

    const provider = new AppleMapsProvider();
    const items = await provider.autocomplete({
      query: "bessa",
      lang: "pt-PT",
      lat: 41.1579,
      lng: -8.6291,
      limit: 8,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchMock.mock.calls[0]?.[0] ?? "");
    expect(calledUrl).toContain("/v1/searchAutocomplete?");
    expect(calledUrl).toContain("q=bessa");
    expect(calledUrl).toContain("lang=pt-PT");

    expect(items).toHaveLength(1);
    expect(items[0]?.providerId).toBe("I4C55964E8DA2A50F");
    expect(items[0]?.label).toBe("Bessa XXI");
    expect(items[0]?.secondaryLabel).toContain("Porto");
    expect(items[0]?.locality).toBe("Porto");
    expect(items[0]?.city).toBe("Porto");
    expect(items[0]?.lat).toBeCloseTo(41.1622505, 6);
    expect(items[0]?.lng).toBeCloseTo(-8.6424226, 6);
  });

  it("gera providerId sintético estável quando id não existe e filtra sem coords", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            displayLines: ["Bessa", "Porto, Portugal"],
            structuredAddress: {
              fullThoroughfare: "Rua de António Pinto Machado",
              locality: "Porto",
              postCode: "4100-365",
            },
            location: {
              latitude: 41.1632714,
              longitude: -8.6433214,
            },
          },
          {
            displayLines: ["Sem coordenadas", "Porto"],
          },
        ],
      }),
      text: async () => "",
    });

    const provider = new AppleMapsProvider();
    const items = await provider.autocomplete({ query: "bessa", lang: "pt-PT" });

    expect(items).toHaveLength(1);
    expect(items[0]?.providerId.startsWith("synthetic:")).toBe(true);
    expect(items[0]?.secondaryLabel).toBe("Porto, Portugal");
    expect(items[0]?.countryCode).toBe("PT");
  });
});
