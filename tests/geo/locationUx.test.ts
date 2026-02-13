import { describe, expect, it } from "vitest";
import { rankLocationSuggestions } from "@/lib/geo/locationUx";
import type { GeoAutocompleteItem } from "@/lib/geo/provider";

describe("rankLocationSuggestions", () => {
  it("prioritiza locais mais próximos quando existe bias", () => {
    const items: GeoAutocompleteItem[] = [
      {
        providerId: "us-portland",
        label: "Portland Transportation Center",
        secondaryLabel: "Portland, United States",
        name: "Portland Transportation Center",
        locality: "Portland",
        city: "Portland",
        address: "Portland, United States",
        countryCode: "US",
        lat: 43.658,
        lng: -70.256,
      },
      {
        providerId: "pt-porto",
        label: "Porto City Hall",
        secondaryLabel: "Porto, Portugal",
        name: "Porto City Hall",
        locality: "Porto",
        city: "Porto",
        address: "Porto, Portugal",
        countryCode: "PT",
        lat: 41.1496,
        lng: -8.6109,
      },
    ];

    const ranked = rankLocationSuggestions(items, "por", { lat: 41.1579, lng: -8.6291 });
    expect(ranked[0]?.providerId).toBe("pt-porto");
  });

  it("usa countryCode para desempatar quando não há coordenadas", () => {
    const items: GeoAutocompleteItem[] = [
      {
        providerId: "us-portland",
        label: "Portland Transportation Center",
        secondaryLabel: "Portland, United States",
        name: "Portland Transportation Center",
        locality: "Portland",
        city: "Portland",
        address: "Portland, United States",
        countryCode: "US",
        lat: 43.658,
        lng: -70.256,
      },
      {
        providerId: "pt-porto",
        label: "Porto Campanhã",
        secondaryLabel: "Porto, Portugal",
        name: "Porto Campanhã",
        locality: "Porto",
        city: "Porto",
        address: "Porto, Portugal",
        countryCode: "PT",
        lat: 41.15,
        lng: -8.59,
      },
    ];

    const ranked = rankLocationSuggestions(items, "por", null, { countryCode: "PT" });
    expect(ranked[0]?.providerId).toBe("pt-porto");
  });

  it("deduplica sugestões semanticamente", () => {
    const items: GeoAutocompleteItem[] = [
      {
        providerId: "I1",
        label: "Bessa XXI",
        secondaryLabel: "Rua de O Primeiro de Janeiro 100, Porto",
        name: "Bessa XXI",
        locality: "Porto",
        city: "Porto",
        address: "Rua de O Primeiro de Janeiro 100, Porto",
        countryCode: "PT",
        lat: 41.16225,
        lng: -8.64242,
      },
      {
        providerId: "I2",
        label: "Bessa XXI",
        secondaryLabel: "Rua de O Primeiro de Janeiro 100, Porto",
        name: "Bessa XXI",
        locality: "Porto",
        city: "Porto",
        address: "Rua de O Primeiro de Janeiro 100, Porto",
        countryCode: "PT",
        lat: 41.16229,
        lng: -8.64239,
      },
    ];

    const ranked = rankLocationSuggestions(items, "bessa", { lat: 41.1579, lng: -8.6291 }, { countryCode: "PT" });
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.providerId).toBe("I1");
  });

  it("penaliza outliers distantes para queries curtas", () => {
    const items: GeoAutocompleteItem[] = [
      {
        providerId: "us-wd",
        label: "FT LEONARD WD, MO",
        secondaryLabel: "Estados Unidos",
        name: "FT LEONARD WD, MO",
        locality: null,
        city: null,
        address: "Estados Unidos",
        countryCode: "US",
        lat: 37.75989,
        lng: -92.10396,
      },
      {
        providerId: "pt-wdmi",
        label: "wDMI",
        secondaryLabel: "Rua António Mq de Sá 15, Rio Tinto, Portugal",
        name: "wDMI",
        locality: "Rio Tinto",
        city: "Rio Tinto",
        address: "Rua António Mq de Sá 15, Rio Tinto, Portugal",
        countryCode: "PT",
        lat: 41.19415,
        lng: -8.56092,
      },
    ];

    const ranked = rankLocationSuggestions(items, "wd", { lat: 41.1579, lng: -8.6291 }, { countryCode: "PT" });
    expect(ranked[0]?.providerId).toBe("pt-wdmi");
  });

  it("prioriza país esperado para query curta mesmo sem bias", () => {
    const items: GeoAutocompleteItem[] = [
      {
        providerId: "et-bessa",
        label: "Bessa",
        secondaryLabel: "Agulae, Etiópia",
        name: "Bessa",
        locality: "Agulae",
        city: "Agulae",
        address: "Agulae, Etiópia",
        countryCode: "ET",
        lat: 14.0,
        lng: 39.0,
      },
      {
        providerId: "pt-bessa-xxi",
        label: "Bessa XXI",
        secondaryLabel: "Estádio do Bessa Século XXI, Porto, Portugal",
        name: "Bessa XXI",
        locality: "Porto",
        city: "Porto",
        address: "Estádio do Bessa Século XXI, Porto, Portugal",
        countryCode: "PT",
        lat: 41.16225,
        lng: -8.64242,
      },
    ];

    const ranked = rankLocationSuggestions(items, "bessa", null, { countryCode: "PT" });
    expect(ranked[0]?.providerId).toBe("pt-bessa-xxi");
  });

  it("favorece país explícito da intenção quando ranking recebe bypass", () => {
    const items: GeoAutocompleteItem[] = [
      {
        providerId: "pt-madrid-club",
        label: "Madrid Club Porto",
        secondaryLabel: "Porto, Portugal",
        name: "Madrid Club Porto",
        locality: "Porto",
        city: "Porto",
        address: "Porto, Portugal",
        countryCode: "PT",
        lat: 41.15,
        lng: -8.61,
      },
      {
        providerId: "es-madrid",
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
    ];

    const ranked = rankLocationSuggestions(items, "madrid spain", null, { countryCode: "ES" });
    expect(ranked[0]?.providerId).toBe("es-madrid");
  });
});
