import { describe, expect, it } from "vitest";
import { partitionSuggestionsByCountry } from "@/lib/geo/autocompletePolicy";
import type { GeoAutocompleteItem } from "@/lib/geo/provider";

describe("partitionSuggestionsByCountry", () => {
  it("separa local, foreign e unknown por país efetivo", () => {
    const items: GeoAutocompleteItem[] = [
      {
        providerId: "pt-1",
        label: "Bessa XXI",
        secondaryLabel: "Porto, Portugal",
        name: "Bessa XXI",
        locality: "Porto",
        city: "Porto",
        address: "Porto, Portugal",
        countryCode: "PT",
        lat: 41.16,
        lng: -8.64,
      },
      {
        providerId: "et-1",
        label: "Bessa",
        secondaryLabel: "Agulae, Etiópia",
        name: "Bessa",
        locality: "Agulae",
        city: "Agulae",
        address: "Agulae, Etiópia",
        countryCode: "ET",
        lat: 14,
        lng: 39,
      },
      {
        providerId: "pt-inferred",
        label: "Estádio",
        secondaryLabel: "Porto, Portugal",
        name: "Estádio",
        locality: null,
        city: null,
        address: null,
        countryCode: null,
        lat: 41.15,
        lng: -8.61,
      },
      {
        providerId: "unknown",
        label: "Local",
        secondaryLabel: null,
        name: "Local",
        locality: null,
        city: null,
        address: null,
        countryCode: null,
        lat: 0,
        lng: 0,
      },
    ];

    const partition = partitionSuggestionsByCountry(items, "PT");
    expect(partition.local.map((item) => item.providerId)).toEqual(["pt-1", "pt-inferred"]);
    expect(partition.foreign.map((item) => item.providerId)).toEqual(["et-1"]);
    expect(partition.unknown.map((item) => item.providerId)).toEqual(["unknown"]);
  });

  it("mantém tudo em unknown quando país efetivo é nulo", () => {
    const items: GeoAutocompleteItem[] = [
      {
        providerId: "a",
        label: "A",
        secondaryLabel: null,
        name: "A",
        locality: null,
        city: null,
        address: null,
        countryCode: "PT",
        lat: 0,
        lng: 0,
      },
    ];

    const partition = partitionSuggestionsByCountry(items, null);
    expect(partition.local).toEqual([]);
    expect(partition.foreign).toEqual([]);
    expect(partition.unknown).toEqual(items);
  });
});
