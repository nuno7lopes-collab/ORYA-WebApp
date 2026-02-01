import { OSMProvider } from "./osmProvider";
import { AppleMapsProvider } from "./appleProvider";
import { getAppleMapsConfig } from "@/lib/maps/appleConfig";
import { AddressSourceProvider } from "@prisma/client";
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

export function resolveGeoSourceProvider(kind: "autocomplete" | "details" | "reverse" = "details") {
  let appleConfig: ReturnType<typeof getAppleMapsConfig> | null = null;
  try {
    appleConfig = getAppleMapsConfig({ allowMissingInDev: true });
  } catch {
    appleConfig = null;
  }
  if (appleConfig) return AddressSourceProvider.APPLE_MAPS;
  return kind === "autocomplete"
    ? AddressSourceProvider.OSM_PHOTON
    : AddressSourceProvider.OSM_NOMINATIM;
}

export type { GeoAutocompleteItem, GeoDetailsItem, GeoProvider } from "./types";
