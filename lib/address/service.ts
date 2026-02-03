import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { GeoDetailsItem } from "@/lib/geo/types";
import { AddressSourceProvider, AddressValidationStatus, Prisma } from "@prisma/client";
import { normalizeAddressFromDetails } from "@/lib/address/normalize";

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalize(obj[key]);
        return acc;
      }, {});
  }
  return value;
};

const roundCoord = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

const hashAddress = (payload: Record<string, unknown>) =>
  crypto.createHash("sha256").update(JSON.stringify(canonicalize(payload))).digest("hex");

const isAddressLookupTableMissingError = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError &&
  err.code === "P2021" &&
  String((err.meta as Record<string, unknown> | undefined)?.table ?? "").includes("address_lookups");

const ADDRESS_SELECT = {
  id: true,
  formattedAddress: true,
  canonical: true,
  latitude: true,
  longitude: true,
  sourceProvider: true,
  sourceProviderPlaceId: true,
  validationStatus: true,
  confidenceScore: true,
} satisfies Prisma.AddressSelect;

export type AddressResolveResult =
  | { ok: true; address: { id: string; formattedAddress: string; canonical: Prisma.JsonValue; latitude: number; longitude: number; sourceProvider: AddressSourceProvider; sourceProviderPlaceId: string | null; validationStatus: AddressValidationStatus; confidenceScore: number } }
  | { ok: false; error: string };

export async function getAddressById(addressId: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  if (!addressId) return null;
  return tx.address.findUnique({ where: { id: addressId }, select: ADDRESS_SELECT });
}

export async function upsertAddressFromGeoDetails(params: {
  details: GeoDetailsItem;
  provider: AddressSourceProvider;
  tx?: Prisma.TransactionClient;
}): Promise<AddressResolveResult> {
  const { details, provider } = params;
  const tx = params.tx ?? prisma;

  const normalized = normalizeAddressFromDetails(details, provider);
  if (!normalized) return { ok: false, error: "MISSING_COORDS" };

  const providerId = typeof details.providerId === "string" && details.providerId.trim()
    ? details.providerId.trim()
    : null;

  if (providerId) {
    try {
      const lookup = await tx.addressLookup.findUnique({
        where: {
          sourceProvider_sourceProviderPlaceId: {
            sourceProvider: provider,
            sourceProviderPlaceId: providerId,
          },
        },
        select: {
          address: {
            select: ADDRESS_SELECT,
          },
        },
      });
      if (lookup?.address) {
        return { ok: true, address: lookup.address };
      }
    } catch (err) {
      if (!isAddressLookupTableMissingError(err)) throw err;
    }
  }

  const lat = roundCoord(normalized.lat);
  const lng = roundCoord(normalized.lng);
  const addressHash = hashAddress({ canonical: normalized.canonical, lat, lng });

  const existing = await tx.address.findUnique({ where: { addressHash }, select: ADDRESS_SELECT });
  if (existing) {
    if (providerId) {
      try {
        await tx.addressLookup.upsert({
          where: {
            sourceProvider_sourceProviderPlaceId: {
              sourceProvider: provider,
              sourceProviderPlaceId: providerId,
            },
          },
          create: {
            addressId: existing.id,
            sourceProvider: provider,
            sourceProviderPlaceId: providerId,
          },
          update: { addressId: existing.id },
        });
      } catch (err) {
        if (!isAddressLookupTableMissingError(err)) throw err;
      }
    }
    return { ok: true, address: existing };
  }

  const created = await tx.address.create({
    data: {
      formattedAddress: normalized.formattedAddress,
      canonical: normalized.canonical as Prisma.JsonObject,
      latitude: lat,
      longitude: lng,
      sourceProvider: provider,
      sourceProviderPlaceId: providerId,
      confidenceScore: normalized.confidenceScore,
      validationStatus: normalized.validationStatus,
      addressHash,
    },
  });

  if (providerId) {
    try {
      await tx.addressLookup.create({
        data: {
          addressId: created.id,
          sourceProvider: provider,
          sourceProviderPlaceId: providerId,
        },
      });
    } catch (err) {
      if (!isAddressLookupTableMissingError(err)) throw err;
    }
  }

  const resolved = await tx.address.findUnique({ where: { id: created.id }, select: ADDRESS_SELECT });
  return { ok: true, address: resolved ?? created };
}

export async function createManualAddress(params: {
  formattedAddress: string;
  canonical?: Prisma.JsonValue | null;
  latitude: number;
  longitude: number;
  tx?: Prisma.TransactionClient;
}) {
  const tx = params.tx ?? prisma;
  const formatted = params.formattedAddress.trim();
  if (!formatted) return { ok: false, error: "ADDRESS_REQUIRED" } as const;
  if (!Number.isFinite(params.latitude) || !Number.isFinite(params.longitude)) {
    return { ok: false, error: "MISSING_COORDS" } as const;
  }

  const lat = roundCoord(params.latitude);
  const lng = roundCoord(params.longitude);
  const canonical = (params.canonical && typeof params.canonical === "object" ? params.canonical : { label: formatted }) as Prisma.JsonObject;
  const addressHash = hashAddress({ canonical, lat, lng });

  const existing = await tx.address.findUnique({ where: { addressHash }, select: ADDRESS_SELECT });
  if (existing) return { ok: true, address: existing } as const;

  const created = await tx.address.create({
    data: {
      formattedAddress: formatted,
      canonical,
      latitude: lat,
      longitude: lng,
      sourceProvider: AddressSourceProvider.MANUAL,
      sourceProviderPlaceId: null,
      confidenceScore: 20,
      validationStatus: AddressValidationStatus.RAW,
      addressHash,
    },
  });

  const resolved = await tx.address.findUnique({ where: { id: created.id }, select: ADDRESS_SELECT });
  return { ok: true, address: resolved ?? created } as const;
}
