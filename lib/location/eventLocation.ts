import type { Prisma } from "@prisma/client";

export type EventLocationInput = {
  addressRef?: {
    formattedAddress?: string | null;
    canonical?: Prisma.JsonValue | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
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

export const pickCanonicalField = (canonical: Prisma.JsonValue | null, ...keys: string[]) => {
  if (!canonical || typeof canonical !== "object" || Array.isArray(canonical)) return null;
  const record = canonical as Record<string, unknown>;
  for (const key of keys) {
    const value = pickString(record[key]);
    if (value) return value;
  }
  return null;
};

export function resolveEventLocation(input: EventLocationInput): EventLocationResolved {
  const canonical = input.addressRef?.canonical ?? null;
  const formattedAddress = pickString(input.addressRef?.formattedAddress) || null;
  const resolvedCity =
    pickCanonicalField(canonical, "city", "locality", "addressLine2", "region", "state") || null;
  const structuredAddress = formattedAddress;
  const hasPreciseAddress = Boolean(formattedAddress && /\d/.test(formattedAddress));
  const coordsQuery =
    Number.isFinite(input.addressRef?.latitude ?? NaN) && Number.isFinite(input.addressRef?.longitude ?? NaN)
      ? `${input.addressRef?.latitude},${input.addressRef?.longitude}`
      : null;
  const mapQuery = coordsQuery || formattedAddress || null;

  return {
    name: null,
    city: resolvedCity,
    structuredAddress,
    formattedAddress,
    displayAddress: formattedAddress || null,
    mapQuery,
    hasOverrides: false,
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
