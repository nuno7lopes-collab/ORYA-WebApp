import type { GeoAutocompleteItem } from "./provider";

export const RECENT_LOCATION_KEY = "orya-recent-locations";
export const MAX_RECENT_LOCATIONS = 5;

const EARTH_RADIUS_KM = 6371;

export const isFiniteCoordinate = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

const toRadians = (value: number) => (value * Math.PI) / 180;

export const distanceKm = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
  const latDelta = toRadians(to.lat - from.lat);
  const lngDelta = toRadians(to.lng - from.lng);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(lngDelta / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const formatDistanceLabel = (distance: number) => {
  if (!Number.isFinite(distance)) return null;
  if (distance < 1) return `${Math.max(100, Math.round((distance * 1000) / 100) * 100)} m`;
  if (distance < 10) return `${distance.toFixed(1)} km`;
  return `${Math.round(distance)} km`;
};

const looksPortuguese = (item: GeoAutocompleteItem) => {
  const haystack = [item.city, item.address, item.label].filter(Boolean).join(" ").toLowerCase();
  return /\bportugal\b/.test(haystack) || /(?:^|[,\s])pt(?:$|[,\s])/.test(haystack);
};

export const rankLocationSuggestions = (
  items: GeoAutocompleteItem[],
  query: string,
  locationBias: { lat: number; lng: number } | null,
) => {
  const normalizedQuery = query.trim().toLowerCase();
  return [...items]
    .map((item, idx) => {
      const label = item.label.toLowerCase();
      const city = (item.city ?? "").toLowerCase();
      const address = (item.address ?? "").toLowerCase();
      const startsWithQuery = label.startsWith(normalizedQuery) || city.startsWith(normalizedQuery);
      const queryInAddress = address.includes(normalizedQuery);
      const distance =
        locationBias && isFiniteCoordinate(item.lat) && isFiniteCoordinate(item.lng)
          ? distanceKm(locationBias, { lat: item.lat, lng: item.lng })
          : null;
      return {
        item,
        idx,
        startsWithQuery,
        queryInAddress,
        isPortuguese: looksPortuguese(item),
        distance,
      };
    })
    .sort((a, b) => {
      if (a.startsWithQuery !== b.startsWithQuery) return a.startsWithQuery ? -1 : 1;
      if (a.queryInAddress !== b.queryInAddress) return a.queryInAddress ? -1 : 1;
      if (a.isPortuguese !== b.isPortuguese) return a.isPortuguese ? -1 : 1;
      if (a.distance !== null && b.distance !== null) return a.distance - b.distance;
      if (a.distance !== null) return -1;
      if (b.distance !== null) return 1;
      return a.idx - b.idx;
    })
    .map((entry) => entry.item);
};

export const sanitizeRecentLocation = (input: unknown): GeoAutocompleteItem | null => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const item = input as Record<string, unknown>;
  const providerId = typeof item.providerId === "string" ? item.providerId : "";
  const label = typeof item.label === "string" ? item.label : "";
  const lat = typeof item.lat === "number" ? item.lat : NaN;
  const lng = typeof item.lng === "number" ? item.lng : NaN;
  if (!providerId || !label || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    providerId,
    label,
    name: typeof item.name === "string" ? item.name : null,
    city: typeof item.city === "string" ? item.city : null,
    address: typeof item.address === "string" ? item.address : null,
    lat,
    lng,
    sourceProvider: typeof item.sourceProvider === "string" ? item.sourceProvider : "APPLE_MAPS",
  };
};
