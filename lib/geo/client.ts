import type { GeoAutocompleteItem, GeoDetailsItem } from "./provider";

export async function fetchGeoAutocomplete(query: string, opts?: { lat?: number; lng?: number }) {
  const params = new URLSearchParams({ q: query });
  if (Number.isFinite(opts?.lat ?? NaN) && Number.isFinite(opts?.lng ?? NaN)) {
    params.set("lat", String(opts?.lat));
    params.set("lng", String(opts?.lng));
  }
  const res = await fetch(`/api/address/autocomplete?${params.toString()}`);
  const data = (await res.json()) as { ok: boolean; items?: GeoAutocompleteItem[]; error?: string };
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Falha ao obter sugestões.");
  }
  return data.items ?? [];
}

export async function fetchGeoDetails(providerId: string) {
  const params = new URLSearchParams({ providerId });
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
