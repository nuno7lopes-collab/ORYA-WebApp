import { OSMProvider } from "./osmProvider";
import type { GeoProvider } from "./types";

let provider: GeoProvider | null = null;

export function getGeoProvider(): GeoProvider {
  if (!provider) {
    provider = new OSMProvider();
  }
  return provider;
}

export type { GeoAutocompleteItem, GeoDetailsItem, GeoProvider } from "./types";
