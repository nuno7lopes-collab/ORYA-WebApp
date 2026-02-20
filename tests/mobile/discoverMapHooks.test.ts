import { describe, expect, it } from "vitest";
import { quantizeGeoKeyValue } from "@/apps/mobile/features/discover/geoKey";

describe("quantizeGeoKeyValue", () => {
  it("arredonda coordenadas para 3 casas por defeito", () => {
    expect(quantizeGeoKeyValue(38.7223456)).toBe(38.722);
    expect(quantizeGeoKeyValue(-9.1393872)).toBe(-9.139);
  });

  it("devolve null para valores inválidos", () => {
    expect(quantizeGeoKeyValue(undefined)).toBeNull();
    expect(quantizeGeoKeyValue(null)).toBeNull();
    expect(quantizeGeoKeyValue(Number.NaN)).toBeNull();
  });
});
