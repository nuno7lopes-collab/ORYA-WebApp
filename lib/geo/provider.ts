import { OSMProvider } from "./osmProvider";
import { AppleMapsProvider } from "./appleProvider";
import { getAppleMapsConfig } from "@/lib/maps/appleConfig";
import type { GeoProvider } from "./types";

let provider: GeoProvider | null = null;

export function getGeoProvider(): GeoProvider {
  if (!provider) {
    let appleConfig: ReturnType<typeof getAppleMapsConfig> | null = null;
    try {
      appleConfig = getAppleMapsConfig({ allowMissingInDev: true });
    } catch (err) {
      throw err;
    }
    if (appleConfig) {
      provider = new AppleMapsProvider();
    } else if (process.env.NODE_ENV === "production") {
      throw new Error("Apple Maps creds missing");
    } else {
      provider = new OSMProvider();
    }
  }
  return provider;
}

export type { GeoAutocompleteItem, GeoDetailsItem, GeoProvider } from "./types";
