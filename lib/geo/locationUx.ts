import type { GeoAutocompleteItem } from "./provider";
import {
  KNOWN_COUNTRY_CODES,
  isCountryTokenPresent,
  normalizeGeoText,
} from "./countryIntent";

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

type RankLocationOptions = {
  countryCode?: string | null;
};

const normalizeSearchText = normalizeGeoText;

const tokenizeSearchText = (value: string) =>
  normalizeSearchText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const hasToken = (haystack: string, token: string) => {
  if (!token) return false;
  if (token.length <= 2) {
    const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegex(token)}(?:$|[^a-z0-9])`);
    return pattern.test(haystack);
  }
  return haystack.includes(token);
};

const scoreDistance = (distance: number | null) => {
  if (distance == null) return 0;
  if (distance <= 3) return 135;
  if (distance <= 10) return 105;
  if (distance <= 25) return 82;
  if (distance <= 50) return 64;
  if (distance <= 120) return 42;
  if (distance <= 300) return 25;
  if (distance <= 800) return 10;
  if (distance <= 1600) return -35;
  if (distance <= 3000) return -85;
  return -140;
};

const scoreCountry = (
  haystack: string,
  itemCountryCode: string | null | undefined,
  expectedCountryCode: string | null | undefined,
  queryLength: number,
) => {
  if (!expectedCountryCode) return 0;
  const normalizedExpectedCode = expectedCountryCode.trim().toUpperCase();
  if (!normalizedExpectedCode) return 0;
  const normalizedItemCode = itemCountryCode?.trim().toUpperCase() || null;
  if (normalizedItemCode) {
    if (normalizedItemCode === normalizedExpectedCode) {
      return queryLength <= 5 ? 34 : 22;
    }
    return queryLength <= 5 ? -150 : -52;
  }

  if (isCountryTokenPresent(haystack, normalizedExpectedCode)) return queryLength <= 5 ? 28 : 18;
  const explicitOtherCountry = KNOWN_COUNTRY_CODES.some(
    (code) => code !== normalizedExpectedCode && isCountryTokenPresent(haystack, code),
  );
  if (explicitOtherCountry) return queryLength <= 5 ? -90 : -20;
  return 0;
};

const semanticKey = (item: GeoAutocompleteItem) => {
  const label = normalizeSearchText(item.label);
  const locality = normalizeSearchText(item.locality ?? item.city ?? item.address ?? item.secondaryLabel);
  const latBucket = Number.isFinite(item.lat) ? Math.round(item.lat * 1_000) / 1_000 : 0;
  const lngBucket = Number.isFinite(item.lng) ? Math.round(item.lng * 1_000) / 1_000 : 0;
  return `${label}|${locality}|${latBucket}|${lngBucket}`;
};

const dedupeLocationSuggestions = (items: GeoAutocompleteItem[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = semanticKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const rankLocationSuggestions = (
  items: GeoAutocompleteItem[],
  query: string,
  locationBias: { lat: number; lng: number } | null,
  options?: RankLocationOptions,
) => {
  const normalizedQuery = normalizeSearchText(query);
  const queryTokens = tokenizeSearchText(query);
  const normalizedItems = dedupeLocationSuggestions(items);
  return [...normalizedItems]
    .map((item, idx) => {
      const label = normalizeSearchText(item.label);
      const secondaryLabel = normalizeSearchText(item.secondaryLabel);
      const city = normalizeSearchText(item.city);
      const locality = normalizeSearchText(item.locality);
      const address = normalizeSearchText(item.address);
      const haystack = `${label} ${secondaryLabel} ${address} ${city} ${locality}`.trim();
      const distance =
        locationBias && isFiniteCoordinate(item.lat) && isFiniteCoordinate(item.lng)
          ? distanceKm(locationBias, { lat: item.lat, lng: item.lng })
          : null;
      let score = 0;
      if (normalizedQuery) {
        if (label === normalizedQuery) score += 160;
        if (city === normalizedQuery) score += 125;
        if (locality === normalizedQuery) score += 112;
        if (address === normalizedQuery) score += 110;
        if (label.startsWith(normalizedQuery)) score += 88;
        if (city.startsWith(normalizedQuery)) score += 68;
        if (locality.startsWith(normalizedQuery)) score += 60;
        if (address.startsWith(normalizedQuery)) score += 58;
        if (secondaryLabel.startsWith(normalizedQuery)) score += 46;
        if (hasToken(haystack, normalizedQuery)) score += 36;
        else if (haystack.includes(normalizedQuery)) score += 22;
        else score -= 20;

        for (const token of queryTokens) {
          if (hasToken(haystack, token)) score += 10;
          else score -= 16;
        }
      }
      score += scoreDistance(distance);
      score += scoreCountry(
        `${haystack} ${normalizeSearchText(item.countryCode)}`,
        item.countryCode ?? null,
        options?.countryCode,
        normalizedQuery.length,
      );
      if (distance != null && normalizedQuery.length <= 4 && distance > 1000) {
        score -= 55;
      }
      return {
        item,
        idx,
        distance,
        score,
      };
    })
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
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
    secondaryLabel: typeof item.secondaryLabel === "string" ? item.secondaryLabel : null,
    name: typeof item.name === "string" ? item.name : null,
    locality: typeof item.locality === "string" ? item.locality : null,
    city: typeof item.city === "string" ? item.city : null,
    address: typeof item.address === "string" ? item.address : null,
    countryCode: typeof item.countryCode === "string" ? item.countryCode : null,
    lat,
    lng,
    sourceProvider: typeof item.sourceProvider === "string" ? item.sourceProvider : "APPLE_MAPS",
  };
};
