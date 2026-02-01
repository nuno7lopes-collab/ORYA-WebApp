import type { GeoDetailsItem } from "@/lib/geo/types";
import { AddressSourceProvider, AddressValidationStatus } from "@prisma/client";

type CanonicalAddress = {
  name: string | null;
  street: string | null;
  houseNumber: string | null;
  postalCode: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  provider: AddressSourceProvider;
};

type NormalizedAddress = {
  canonical: CanonicalAddress;
  formattedAddress: string;
  lat: number;
  lng: number;
  confidenceScore: number;
  validationStatus: AddressValidationStatus;
};

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

const extractAddressRecord = (components: Record<string, unknown>) => {
  const nested = asRecord(components.address);
  return nested ?? components;
};

const normalizeCity = (address: Record<string, unknown>, fallback?: string | null) =>
  pickString(
    fallback,
    address.city,
    address.town,
    address.village,
    address.municipality,
    address.county,
    address.locality,
    address.suburb,
    address.state,
  );

const normalizeRegion = (address: Record<string, unknown>) =>
  pickString(
    address.state,
    address.region,
    address.administrativeArea,
    address.county,
    address.province,
  );

const normalizeCountry = (address: Record<string, unknown>) =>
  pickString(address.country, address.countryName, address.country_name);

const normalizeCountryCode = (address: Record<string, unknown>) =>
  pickString(address.countryCode, address.country_code, address.country_code_iso, address.countryCodeISO);

const normalizeStreet = (address: Record<string, unknown>) =>
  pickString(
    address.road,
    address.street,
    address.thoroughfare,
    address.pedestrian,
    address.footway,
    address.path,
  );

const normalizeHouseNumber = (address: Record<string, unknown>) =>
  pickString(address.house_number, address.houseNumber, address.subThoroughfare, address.house_name);

const normalizePostalCode = (address: Record<string, unknown>) =>
  pickString(address.postcode, address.postalCode, address.zip, address.zipCode);

export function normalizeAddressFromDetails(
  details: GeoDetailsItem,
  provider: AddressSourceProvider,
): NormalizedAddress | null {
  if (!details) return null;
  const lat = typeof details.lat === "number" && Number.isFinite(details.lat) ? details.lat : null;
  const lng = typeof details.lng === "number" && Number.isFinite(details.lng) ? details.lng : null;
  if (lat == null || lng == null) return null;

  const components = asRecord(details.components) ?? {};
  const address = extractAddressRecord(components);
  const name = pickString(details.name, components.name, address.name, address.amenity, address.building);
  const street = normalizeStreet(address) ?? pickString(details.address);
  const houseNumber = normalizeHouseNumber(address);
  const postalCode = normalizePostalCode(address);
  const city = normalizeCity(address, details.city ?? null);
  const region = normalizeRegion(address);
  const country = normalizeCountry(address);
  const countryCode = normalizeCountryCode(address);

  const addressLine1 = pickString(
    [street, houseNumber].filter(Boolean).join(" "),
    street,
    details.address,
  );
  const addressLine2 = pickString([postalCode, city].filter(Boolean).join(" "), city, postalCode);

  const formattedAddress =
    pickString(details.formattedAddress) ||
    pickString(
      [addressLine1, addressLine2, country].filter(Boolean).join(", "),
      [street, city].filter(Boolean).join(", "),
      city,
      country,
    ) ||
    "";

  let confidenceScore = 0;
  if (details.formattedAddress) confidenceScore += 20;
  if (street || details.address) confidenceScore += 20;
  if (houseNumber) confidenceScore += 10;
  if (postalCode) confidenceScore += 15;
  if (city) confidenceScore += 15;
  if (country || countryCode) confidenceScore += 10;
  if (details.providerId) confidenceScore += 10;
  confidenceScore = Math.min(100, confidenceScore);

  const validationStatus = formattedAddress && (street || city) ? AddressValidationStatus.NORMALIZED : AddressValidationStatus.RAW;

  return {
    canonical: {
      name: name || null,
      street: street || null,
      houseNumber: houseNumber || null,
      postalCode: postalCode || null,
      city: city || null,
      region: region || null,
      country: country || null,
      countryCode: countryCode || null,
      addressLine1: addressLine1 || null,
      addressLine2: addressLine2 || null,
      provider,
    },
    formattedAddress: formattedAddress || "",
    lat,
    lng,
    confidenceScore,
    validationStatus,
  };
}

export type { CanonicalAddress, NormalizedAddress };
