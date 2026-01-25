import type { GeoDetailsItem, GeoProvider, GeoAutocompleteItem } from "./types";
import { mintAppleMapsToken } from "@/lib/maps/appleToken";

const APPLE_ENDPOINT = "https://maps-api.apple.com/v1";

async function appleFetch<T>(url: string): Promise<T> {
  const { token } = mintAppleMapsToken();
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

function normalizeLabel(name: string | null, address: string | null) {
  if (name && address) return `${name} · ${address}`;
  return name || address || "";
}

function mapResultToAutocomplete(item: any): GeoAutocompleteItem {
  const id = String(item.id || item.placeId || item.identifier || `${item.name || "place"}-${item.coordinate?.latitude}-${item.coordinate?.longitude}`);
  const address = item.formattedAddress || item.displayAddress || item.address || null;
  const name = item.name || null;
  const city = item.address?.locality || item.locality || null;
  return {
    providerId: id,
    label: normalizeLabel(name, address),
    name,
    city,
    address,
    lat: Number(item.coordinate?.latitude ?? item.location?.latitude ?? item.latitude ?? 0),
    lng: Number(item.coordinate?.longitude ?? item.location?.longitude ?? item.longitude ?? 0),
  };
}

function mapResultToDetails(item: any): GeoDetailsItem {
  const address = item.formattedAddress || item.displayAddress || item.address || null;
  const name = item.name || null;
  const city = item.address?.locality || item.locality || null;
  return {
    providerId: item.id ? String(item.id) : null,
    formattedAddress: address,
    components: item.address ? (item.address as Record<string, unknown>) : null,
    lat: Number(item.coordinate?.latitude ?? item.location?.latitude ?? item.latitude ?? null),
    lng: Number(item.coordinate?.longitude ?? item.location?.longitude ?? item.longitude ?? null),
    name,
    city,
    address,
  };
}

export class AppleMapsProvider implements GeoProvider {
  async autocomplete(args: { query: string; lat?: number | null; lng?: number | null; limit?: number; lang?: string; }): Promise<GeoAutocompleteItem[]> {
    const params = new URLSearchParams({ q: args.query });
    if (args.limit) params.set("limit", String(args.limit));
    if (args.lat != null && args.lng != null) params.set("searchLocation", `${args.lat},${args.lng}`);
    if (args.lang) params.set("lang", args.lang);

    const url = `${APPLE_ENDPOINT}/search?${params.toString()}`;
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
