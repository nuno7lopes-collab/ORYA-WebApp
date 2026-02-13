import { api, unwrapApiResponse } from "../../lib/api";

export type MobileGeoAutocompleteItem = {
  providerId: string;
  label: string;
  secondaryLabel?: string | null;
  name: string | null;
  locality?: string | null;
  city: string | null;
  address: string | null;
  countryCode?: string | null;
  lat: number;
  lng: number;
  sourceProvider?: string | null;
};

export type MobileGeoDetailsItem = {
  providerId: string | null;
  formattedAddress: string | null;
  components: Record<string, unknown> | null;
  lat: number | null;
  lng: number | null;
  name: string | null;
  city: string | null;
  address: string | null;
  sourceProvider?: string | null;
  addressId?: string | null;
  canonical?: Record<string, unknown> | null;
  confidenceScore?: number | null;
  validationStatus?: string | null;
};

export const fetchGeoAutocomplete = async (
  query: string,
  opts?: { lat?: number; lng?: number },
): Promise<MobileGeoAutocompleteItem[]> => {
  const params = new URLSearchParams({ q: query });
  if (Number.isFinite(opts?.lat ?? NaN) && Number.isFinite(opts?.lng ?? NaN)) {
    params.set("lat", String(opts?.lat));
    params.set("lng", String(opts?.lng));
  }
  const response = await api.request<unknown>(`/api/address/autocomplete?${params.toString()}`);
  const payload = unwrapApiResponse<{ items?: MobileGeoAutocompleteItem[] }>(response);
  return payload?.items ?? [];
};

export const fetchGeoDetails = async (
  providerId: string,
  opts?: { sourceProvider?: string | null; lat?: number | null; lng?: number | null },
): Promise<MobileGeoDetailsItem | null> => {
  const params = new URLSearchParams({ providerId });
  if (opts?.sourceProvider) params.set("sourceProvider", opts.sourceProvider);
  if (Number.isFinite(opts?.lat ?? NaN) && Number.isFinite(opts?.lng ?? NaN)) {
    params.set("lat", String(opts?.lat));
    params.set("lng", String(opts?.lng));
  }
  const response = await api.request<unknown>(`/api/address/details?${params.toString()}`);
  const payload = unwrapApiResponse<{ item?: MobileGeoDetailsItem | null }>(response);
  return payload?.item ?? null;
};

export const resolveCityToAddress = async (
  city: string,
): Promise<MobileGeoDetailsItem | null> => {
  const query = city.trim();
  if (!query) return null;
  const suggestions = await fetchGeoAutocomplete(query);
  const first = suggestions[0];
  if (!first?.providerId) return null;
  return fetchGeoDetails(first.providerId, {
    sourceProvider: first.sourceProvider ?? null,
    lat: first.lat,
    lng: first.lng,
  });
};
