import type { GeoDetailsItem, GeoProvider, GeoAutocompleteItem } from "./types";
import { mintAppleMapsAccessToken } from "@/lib/maps/appleToken";
import { detectCountryCodeFromText, normalizeGeoText } from "./countryIntent";

const APPLE_ENDPOINT = "https://maps-api.apple.com/v1";

async function appleFetch<T>(url: string): Promise<T> {
  const { token } = await mintAppleMapsAccessToken();
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`APPLE_MAPS_ERROR:${res.status}:${text}`);
  }
  return (await res.json()) as T;
}

const pickString = (...values: Array<unknown>) => {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
};

const asRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const toNullableNumber = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeToken = normalizeGeoText;

const slugify = (value: string) =>
  normalizeToken(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "place";

const normalizeDisplayLines = (value: unknown) => {
  if (!Array.isArray(value)) return [] as string[];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
};

const inferCountryCode = (...values: Array<unknown>) => {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (/^[A-Za-z]{2}$/.test(trimmed)) {
      return trimmed.toUpperCase();
    }
    const detected = detectCountryCodeFromText(trimmed);
    if (detected) return detected;
  }
  return null;
};

const buildStructuredSecondaryLabel = (structuredAddress: Record<string, unknown> | null, fallbackCountry?: string | null) => {
  if (!structuredAddress) return pickString(fallbackCountry);
  const thoroughfare = pickString(
    structuredAddress.fullThoroughfare,
    [structuredAddress.thoroughfare, structuredAddress.subThoroughfare].filter(Boolean).join(" "),
    structuredAddress.thoroughfare,
  );
  const locality = pickString(
    structuredAddress.locality,
    structuredAddress.city,
    structuredAddress.subLocality,
    structuredAddress.dependentLocality,
  );
  const postCode = pickString(structuredAddress.postCode, structuredAddress.postalCode, structuredAddress.zipCode);
  const country = pickString(structuredAddress.country, fallbackCountry);
  return pickString(
    [thoroughfare, postCode, locality].filter(Boolean).join(", "),
    [thoroughfare, locality].filter(Boolean).join(", "),
    [locality, country].filter(Boolean).join(", "),
    locality,
    country,
  );
};

const makeSyntheticProviderId = (primaryLabel: string, lat: number, lng: number) =>
  `synthetic:${slugify(primaryLabel)}:${lat.toFixed(6)}:${lng.toFixed(6)}`;

const resolveAddressLabel = (item: any) =>
  item.formattedAddress ||
  item.displayAddress ||
  (Array.isArray(item.formattedAddressLines) ? item.formattedAddressLines.filter(Boolean).join(", ") : null) ||
  (Array.isArray(item.displayLines) ? item.displayLines.filter(Boolean).join(", ") : null) ||
  item.address?.formattedAddress ||
  item.address?.fullAddress ||
  item.address ||
  null;

function mapResultToAutocomplete(item: any): GeoAutocompleteItem {
  const lat = Number(item.location?.latitude ?? item.coordinate?.latitude ?? item.center?.latitude ?? item.latitude ?? NaN);
  const lng = Number(item.location?.longitude ?? item.coordinate?.longitude ?? item.center?.longitude ?? item.longitude ?? NaN);
  const displayLines = normalizeDisplayLines(item.displayLines);
  const structuredAddress = asRecord(item.structuredAddress) ?? asRecord(item.address);
  const primaryLabel = pickString(displayLines[0], item.name, item.place?.name, item.title, item.query, "Local");
  const fallbackSecondary = pickString(displayLines[1], resolveAddressLabel(item));
  const secondaryLabel = fallbackSecondary || buildStructuredSecondaryLabel(structuredAddress, pickString(item.country, item.countryName));
  const locality = pickString(
    structuredAddress?.locality,
    structuredAddress?.city,
    structuredAddress?.subLocality,
    item.locality,
    item.city,
  );
  const countryCode = inferCountryCode(
    item.countryCode,
    structuredAddress?.countryCode,
    structuredAddress?.country_code,
    pickString(item.country, item.countryName),
    secondaryLabel,
  );
  const rawProviderId = pickString(item.id, item.placeId, item.identifier, item.place?.id);
  const providerId =
    rawProviderId ||
    (Number.isFinite(lat) && Number.isFinite(lng)
      ? makeSyntheticProviderId(primaryLabel ?? "place", lat, lng)
      : makeSyntheticProviderId(primaryLabel ?? "place", 0, 0));
  return {
    providerId,
    label: primaryLabel ?? "",
    secondaryLabel: secondaryLabel ?? null,
    name: pickString(item.name, item.place?.name, primaryLabel),
    locality,
    city: locality,
    address: secondaryLabel ?? null,
    countryCode,
    lat,
    lng,
  };
}

function mapResultToDetails(item: any): GeoDetailsItem {
  const address = resolveAddressLabel(item);
  const displayLines = normalizeDisplayLines(item.displayLines ?? item.formattedAddressLines);
  const formattedAddress = pickString(address, displayLines.join(", "));
  const structuredAddress = asRecord(item.address) ?? asRecord(item.structuredAddress);
  const name = pickString(item.name, item.place?.name, displayLines[0]);
  const city =
    pickString(
      structuredAddress?.locality,
      structuredAddress?.city,
      item.locality,
      structuredAddress?.subLocality,
    ) ||
    null;
  return {
    providerId: item.id ? String(item.id) : item.placeId ? String(item.placeId) : null,
    formattedAddress,
    components: structuredAddress,
    lat: toNullableNumber(item.coordinate?.latitude ?? item.location?.latitude ?? item.center?.latitude ?? item.latitude),
    lng: toNullableNumber(item.coordinate?.longitude ?? item.location?.longitude ?? item.center?.longitude ?? item.longitude),
    name,
    city,
    address: pickString(address, displayLines[1], city),
  };
}

export class AppleMapsProvider implements GeoProvider {
  async autocomplete(args: { query: string; lat?: number | null; lng?: number | null; limit?: number; lang?: string; }): Promise<GeoAutocompleteItem[]> {
    const params = new URLSearchParams({ q: args.query });
    if (args.limit) params.set("limit", String(args.limit));
    if (args.lat != null && args.lng != null) params.set("searchLocation", `${args.lat},${args.lng}`);
    if (args.lang) params.set("lang", args.lang);

    const url = `${APPLE_ENDPOINT}/searchAutocomplete?${params.toString()}`;
    const data = await appleFetch<{ results?: any[] }>(url);
    const results = data.results ?? [];
    return results.map(mapResultToAutocomplete).filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
  }

  async details(args: { providerId: string; lang?: string; }): Promise<GeoDetailsItem | null> {
    const params = new URLSearchParams({ ids: args.providerId });
    if (args.lang) params.set("lang", args.lang);
    const url = `${APPLE_ENDPOINT}/place?${params.toString()}`;
    const data = await appleFetch<{ results?: any[] }>(url);
    const item = data.results?.[0];
    if (!item) return null;
    return mapResultToDetails(item);
  }

  async reverse(args: { lat: number; lng: number; lang?: string; }): Promise<GeoDetailsItem | null> {
    const params = new URLSearchParams({ loc: `${args.lat},${args.lng}` });
    if (args.lang) params.set("lang", args.lang);
    const url = `${APPLE_ENDPOINT}/reverseGeocode?${params.toString()}`;
    const data = await appleFetch<{ results?: any[] }>(url);
    const item = data.results?.[0];
    if (!item) return null;
    return mapResultToDetails(item);
  }
}
