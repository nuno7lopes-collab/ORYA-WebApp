type LocationComponents = {
  address?: Record<string, unknown> | null;
  road?: string | null;
  houseNumber?: string | null;
  postalCode?: string | null;
};

type LocationOverrides = {
  houseNumber?: string | null;
  postalCode?: string | null;
};

export type EventLocationInput = {
  locationName?: string | null;
  locationCity?: string | null;
  address?: string | null;
  locationSource?: "OSM" | "MANUAL" | null;
  locationFormattedAddress?: string | null;
  locationComponents?: LocationComponents | Record<string, unknown> | null;
  locationOverrides?: LocationOverrides | Record<string, unknown> | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type EventLocationResolved = {
  name: string | null;
  city: string | null;
  structuredAddress: string | null;
  formattedAddress: string | null;
  displayAddress: string | null;
  mapQuery: string | null;
  hasOverrides: boolean;
  hasPreciseAddress: boolean;
};

const pickString = (value: unknown) => (typeof value === "string" ? value.trim() || null : null);
const normalizeToken = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

export function resolveEventLocation(input: EventLocationInput): EventLocationResolved {
  const locationName = pickString(input.locationName);
  const locationCity = pickString(input.locationCity);
  const address = pickString(input.address);
  const locationFormattedAddress = pickString(input.locationFormattedAddress);

  const rawOverrides =
    input.locationOverrides && typeof input.locationOverrides === "object"
      ? (input.locationOverrides as LocationOverrides)
      : null;
  const overrideHouse = pickString(rawOverrides?.houseNumber);
  const overridePostal = pickString(rawOverrides?.postalCode);
  const hasOverrides = Boolean(overrideHouse || overridePostal);

  const rawComponents =
    input.locationComponents && typeof input.locationComponents === "object"
      ? (input.locationComponents as LocationComponents)
      : null;
  const componentsAddress =
    rawComponents?.address && typeof rawComponents.address === "object"
      ? (rawComponents.address as Record<string, unknown>)
      : null;

  const fallbackRoad = address ? address.split(",")[0]?.trim() || null : null;
  const resolvedRoad =
    pickString(rawComponents?.road) ||
    pickString(componentsAddress?.road) ||
    pickString(componentsAddress?.pedestrian) ||
    pickString(componentsAddress?.footway) ||
    pickString(componentsAddress?.path) ||
    fallbackRoad;
  const resolvedHouse =
    overrideHouse ||
    pickString(rawComponents?.houseNumber) ||
    pickString(componentsAddress?.house_number) ||
    pickString(componentsAddress?.house_name) ||
    null;
  const resolvedPostal =
    overridePostal ||
    pickString(rawComponents?.postalCode) ||
    pickString(componentsAddress?.postcode) ||
    null;
  const resolvedCity =
    locationCity ||
    pickString(componentsAddress?.city) ||
    pickString(componentsAddress?.town) ||
    pickString(componentsAddress?.village) ||
    pickString(componentsAddress?.municipality) ||
    pickString(componentsAddress?.county) ||
    pickString(componentsAddress?.state) ||
    null;
  const resolvedCountry = pickString(componentsAddress?.country);

  const line1 = [resolvedRoad, resolvedHouse].filter(Boolean).join(" ").trim();
  const line2 = [resolvedPostal, resolvedCity].filter(Boolean).join(" ").trim();
  const structuredAddressRaw = [line1, line2, resolvedCountry].filter(Boolean).join(", ").trim();
  const structuredAddress = structuredAddressRaw || null;
  const hasPreciseAddress =
    Boolean(resolvedRoad && (resolvedHouse || resolvedPostal)) ||
    (structuredAddress ? /\d/.test(structuredAddress) : false);

  const withOverrides = (base: string) => {
    let next = base;
    if (overrideHouse && !normalizeToken(next).includes(normalizeToken(overrideHouse))) {
      next = next ? `${next} ${overrideHouse}` : overrideHouse;
    }
    if (overridePostal && !normalizeToken(next).includes(normalizeToken(overridePostal))) {
      next = next ? `${next}, ${overridePostal}` : overridePostal;
    }
    return next.trim();
  };

  const formattedWithOverrides = locationFormattedAddress ? withOverrides(locationFormattedAddress) : "";
  const hasFormattedDigits = formattedWithOverrides ? /\d/.test(formattedWithOverrides) : false;
  const manualAddressRaw = withOverrides(address || "") || formattedWithOverrides;
  const manualQuery = [manualAddressRaw || null, locationCity, locationName].filter(Boolean).join(", ");

  const displayAddress =
    input.locationSource === "MANUAL"
      ? structuredAddress || manualAddressRaw || resolvedCity
      : locationFormattedAddress && locationName
        ? structuredAddress || formattedWithOverrides || locationFormattedAddress
        : structuredAddress || manualAddressRaw || formattedWithOverrides || resolvedCity;

  const addressQuery =
    structuredAddress ||
    formattedWithOverrides ||
    manualQuery ||
    [locationName, locationCity].filter(Boolean).join(", ") ||
    null;
  const coordsQuery =
    Number.isFinite(input.latitude ?? NaN) && Number.isFinite(input.longitude ?? NaN)
      ? `${input.latitude},${input.longitude}`
      : null;
  const shouldPreferAddress =
    input.locationSource === "MANUAL" || hasOverrides || hasPreciseAddress || hasFormattedDigits;
  const mapQuery = shouldPreferAddress ? addressQuery || coordsQuery : coordsQuery || addressQuery;

  const formattedAddress = structuredAddress || formattedWithOverrides || manualAddressRaw || null;

  return {
    name: locationName || locationFormattedAddress || null,
    city: resolvedCity,
    structuredAddress,
    formattedAddress,
    displayAddress: displayAddress || null,
    mapQuery: mapQuery || null,
    hasOverrides,
    hasPreciseAddress,
  };
}

export function formatEventLocationLabel(
  input: EventLocationInput,
  fallback: string,
): string {
  const resolved = resolveEventLocation(input);
  const name = resolved.name;
  const address = resolved.displayAddress;
  if (name && address) {
    return `${name} · ${address}`;
  }
  return name || address || fallback;
}

export function getEventLocationDisplay(
  input: EventLocationInput,
  fallbackPrimary: string,
  fallbackSecondary: string | null = null,
): { primary: string; secondary: string | null } {
  const resolved = resolveEventLocation(input);
  const primary = resolved.name || fallbackPrimary;
  const secondaryCandidate = resolved.displayAddress || resolved.city || null;
  if (!secondaryCandidate) {
    return { primary, secondary: fallbackSecondary };
  }
  const normalizedPrimary = normalizeToken(primary);
  const normalizedSecondary = normalizeToken(secondaryCandidate);
  if (!normalizedSecondary || normalizedSecondary === normalizedPrimary) {
    return { primary, secondary: fallbackSecondary };
  }
  return { primary, secondary: secondaryCandidate };
}
