import type { GeoAutocompleteItem, GeoDetailsItem } from "./provider";

export type GeoAutocompleteWithMetaResult = {
  items: GeoAutocompleteItem[];
  expectedCountryCode: string | null;
  effectiveCountryCode: string | null;
  queryCountryIntentCode: string | null;
  locationBiasSource: string | null;
  sourceProvider: string | null;
};

const normalizeCountryCode = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(trimmed) ? trimmed : null;
};

export async function fetchGeoAutocompleteWithMeta(query: string, opts?: { lat?: number; lng?: number }) {
  const params = new URLSearchParams({ q: query });
  if (Number.isFinite(opts?.lat ?? NaN) && Number.isFinite(opts?.lng ?? NaN)) {
    params.set("lat", String(opts?.lat));
    params.set("lng", String(opts?.lng));
  }
  const res = await fetch(`/api/address/autocomplete?${params.toString()}`);
  const data = (await res.json()) as {
    ok: boolean;
    items?: GeoAutocompleteItem[];
    error?: string;
    expectedCountryCode?: string | null;
    effectiveCountryCode?: string | null;
    queryCountryIntentCode?: string | null;
    countryCode?: string | null;
    locationBiasSource?: string | null;
    sourceProvider?: string | null;
  };
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Falha ao obter sugestões.");
  }
  const expectedCountryCode = normalizeCountryCode(data.expectedCountryCode ?? data.countryCode);
  const effectiveCountryCode = normalizeCountryCode(data.effectiveCountryCode ?? expectedCountryCode);
  const queryCountryIntentCode = normalizeCountryCode(data.queryCountryIntentCode);
  return {
    items: data.items ?? [],
    expectedCountryCode,
    effectiveCountryCode,
    queryCountryIntentCode,
    locationBiasSource: typeof data.locationBiasSource === "string" ? data.locationBiasSource : null,
    sourceProvider: typeof data.sourceProvider === "string" ? data.sourceProvider : null,
  } satisfies GeoAutocompleteWithMetaResult;
}

export async function fetchGeoAutocomplete(query: string, opts?: { lat?: number; lng?: number }) {
  const result = await fetchGeoAutocompleteWithMeta(query, opts);
  return result.items;
}

export async function fetchGeoDetails(
  providerId: string,
  opts?: { lat?: number | null; lng?: number | null }
) {
  const params = new URLSearchParams({ providerId });
  if (Number.isFinite(opts?.lat ?? NaN) && Number.isFinite(opts?.lng ?? NaN)) {
    params.set("lat", String(opts?.lat));
    params.set("lng", String(opts?.lng));
  }
  const res = await fetch(`/api/address/details?${params.toString()}`);
  const data = (await res.json()) as { ok: boolean; item?: GeoDetailsItem; error?: string };
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Falha ao normalizar localização.");
  }
  return data.item ?? null;
}

export async function fetchGeoReverse(lat: number, lng: number) {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  const res = await fetch(`/api/address/reverse?${params.toString()}`);
  const data = (await res.json()) as { ok: boolean; item?: GeoDetailsItem; error?: string };
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Falha no reverse geocode.");
  }
  return data.item ?? null;
}
