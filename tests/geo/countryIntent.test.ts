import { describe, expect, it } from "vitest";
import {
  detectCountryCodeFromText,
  isCountryTokenPresent,
  normalizeGeoText,
} from "@/lib/geo/countryIntent";

describe("countryIntent", () => {
  it("normaliza acentos e espaços", () => {
    expect(normalizeGeoText("  Etiópia   ")).toBe("etiopia");
  });

  it("deteta países em PT e EN", () => {
    expect(detectCountryCodeFromText("Porto, Portugal")).toBe("PT");
    expect(detectCountryCodeFromText("Madrid, Spain")).toBe("ES");
    expect(detectCountryCodeFromText("Paris, France")).toBe("FR");
    expect(detectCountryCodeFromText("Agulae, Etiópia")).toBe("ET");
    expect(detectCountryCodeFromText("Shymkent, Cazaquistão")).toBe("KZ");
    expect(detectCountryCodeFromText("Lomé, Togo")).toBe("TG");
  });

  it("usa boundary para tokens curtos", () => {
    expect(isCountryTokenPresent("Porto, PT", "PT")).toBe(true);
    expect(isCountryTokenPresent("aptitude", "PT")).toBe(false);
  });

  it("retorna null quando não há intenção explícita", () => {
    expect(detectCountryCodeFromText("Rua de Ceuta 12, Porto")).toBe(null);
  });
});
