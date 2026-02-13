import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getClientIp, resolveRequestGeoContext } from "@/lib/geo/ipBias";
import { resolveIpCoarseLocation } from "@/domain/location/ipProvider";

vi.mock("@/domain/location/ipProvider", () => ({
  resolveIpCoarseLocation: vi.fn(),
}));

const resolveIpCoarseLocationMock = vi.mocked(resolveIpCoarseLocation);

describe("ipBias", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extrai ip principal do x-forwarded-for", () => {
    const req = new NextRequest("http://localhost/api/address/autocomplete?q=por", {
      headers: { "x-forwarded-for": "8.8.8.8, 1.1.1.1" },
    });
    expect(getClientIp(req)).toBe("8.8.8.8");
  });

  it("usa headers de edge quando disponíveis", async () => {
    const req = new NextRequest("http://localhost/api/address/autocomplete?q=por", {
      headers: {
        "x-vercel-ip-country": "PT",
        "x-vercel-ip-city": "Porto",
        "x-vercel-ip-country-region": "13",
        "x-vercel-ip-latitude": "41.1496",
        "x-vercel-ip-longitude": "-8.6109",
      },
    });

    const context = await resolveRequestGeoContext({ req, lang: "pt-PT" });

    expect(context.countryCode).toBe("PT");
    expect(context.city).toBe("Porto");
    expect(context.lat).toBeCloseTo(41.1496, 4);
    expect(context.lng).toBeCloseTo(-8.6109, 4);
    expect(context.source).toBe("EDGE_HEADERS");
    expect(resolveIpCoarseLocationMock).not.toHaveBeenCalled();
  });

  it("faz fallback para ipapi com ip público", async () => {
    resolveIpCoarseLocationMock.mockResolvedValueOnce({
      countryCode: "PT",
      countryName: "Portugal",
      country: "Portugal",
      region: "Porto",
      city: "Porto",
      approxLat: 41.1496,
      approxLon: -8.6109,
      accuracyMeters: 10_000,
      source: "IP",
      granularity: "COARSE",
    });

    const req = new NextRequest("http://localhost/api/address/autocomplete?q=por", {
      headers: { "x-forwarded-for": "8.8.4.4" },
    });

    const context = await resolveRequestGeoContext({ req, lang: null });

    expect(resolveIpCoarseLocationMock).toHaveBeenCalledWith("8.8.4.4");
    expect(context.countryCode).toBe("PT");
    expect(context.lat).toBeCloseTo(41.1496, 4);
    expect(context.lng).toBeCloseTo(-8.6109, 4);
    expect(context.source).toBe("IP_API");
  });

  it("usa país do idioma quando não há sinais de rede", async () => {
    const req = new NextRequest("http://localhost/api/address/autocomplete?q=por");

    const context = await resolveRequestGeoContext({ req, lang: "pt-PT" });

    expect(context.countryCode).toBe("PT");
    expect(context.source).toBe("LANG");
  });

  it("não consulta ipapi para ip privado", async () => {
    const req = new NextRequest("http://localhost/api/address/autocomplete?q=por", {
      headers: { "x-forwarded-for": "192.168.1.9" },
    });

    const context = await resolveRequestGeoContext({ req, lang: null });

    expect(resolveIpCoarseLocationMock).not.toHaveBeenCalled();
    expect(context.source).toBe("NONE");
  });
});
