import { AppleMapsProvider } from "./appleProvider";
import { getAppleMapsConfig } from "@/lib/maps/appleConfig";
import { AddressSourceProvider } from "@prisma/client";
import type { GeoProvider, GeoAutocompleteItem, GeoDetailsItem } from "./types";

type GeoResolved<T> = {
  data: T;
  sourceProvider: AddressSourceProvider;
};

type GeoResolver = {
  autocomplete: (args: {
    query: string;
    lat?: number | null;
    lng?: number | null;
    limit?: number;
    lang?: string;
  }) => Promise<GeoResolved<GeoAutocompleteItem[]>>;
  details: (args: {
    providerId: string;
    lang?: string;
    lat?: number | null;
    lng?: number | null;
  }) => Promise<GeoResolved<GeoDetailsItem | null>>;
  reverse: (args: {
    lat: number;
    lng: number;
    lang?: string;
  }) => Promise<GeoResolved<GeoDetailsItem | null>>;
};

type ProviderHealth = {
  windowStart: number;
  calls: number;
  errors: number;
  cooldownUntil: number;
};

const ERROR_WINDOW_MS = 2 * 60 * 1000;
const ERROR_RATE_THRESHOLD = 0.2;
const ERROR_MIN_CALLS = 5;
const COOLDOWN_MS = 10 * 60 * 1000;

const appleHealth: ProviderHealth = {
  windowStart: Date.now(),
  calls: 0,
  errors: 0,
  cooldownUntil: 0,
};

let resolver: GeoResolver | null = null;

const hasAppleConfig = () => {
  try {
    return Boolean(getAppleMapsConfig({ allowMissingInDev: true }));
  } catch {
    return false;
  }
};

const assertAppleAvailable = () => {
  if (!hasAppleConfig()) {
    throw new Error("APPLE_MAPS_CONFIG_MISSING");
  }
  if (Date.now() < appleHealth.cooldownUntil) {
    throw new Error("APPLE_MAPS_COOLDOWN");
  }
};

const recordAppleResult = (ok: boolean) => {
  const now = Date.now();
  if (now - appleHealth.windowStart > ERROR_WINDOW_MS) {
    appleHealth.windowStart = now;
    appleHealth.calls = 0;
    appleHealth.errors = 0;
  }
  appleHealth.calls += 1;
  if (!ok) appleHealth.errors += 1;
  if (appleHealth.calls >= ERROR_MIN_CALLS) {
    const errorRate = appleHealth.errors / appleHealth.calls;
    if (errorRate >= ERROR_RATE_THRESHOLD) {
      appleHealth.cooldownUntil = now + COOLDOWN_MS;
    }
  }
};

const getAppleProvider = () => new AppleMapsProvider();
export function getGeoProvider(): GeoProvider {
  if (!resolver) {
    resolver = getGeoResolver();
  }
  return {
    autocomplete: async (args) => {
      const resolved = await resolver!.autocomplete(args);
      return resolved.data;
    },
    details: async (args) => {
      const resolved = await resolver!.details({ providerId: args.providerId, lang: args.lang });
      return resolved.data;
    },
    reverse: async (args) => {
      const resolved = await resolver!.reverse(args);
      return resolved.data;
    },
  };
}

export function getGeoResolver(): GeoResolver {
  if (resolver) return resolver;

  const resolverImpl: GeoResolver = {
    autocomplete: async (args) => {
      assertAppleAvailable();
      const apple = getAppleProvider();
      try {
        const items = await apple.autocomplete(args);
        recordAppleResult(true);
        return { data: items, sourceProvider: AddressSourceProvider.APPLE_MAPS };
      } catch (err) {
        recordAppleResult(false);
        throw err;
      }
    },
    details: async (args) => {
      const providerId = args.providerId;
      assertAppleAvailable();
      const apple = getAppleProvider();
      try {
        const item = await apple.details({ providerId, lang: args.lang });
        recordAppleResult(true);
        return { data: item, sourceProvider: AddressSourceProvider.APPLE_MAPS };
      } catch (err) {
        recordAppleResult(false);
        throw err;
      }
    },
    reverse: async (args) => {
      assertAppleAvailable();
      const apple = getAppleProvider();
      try {
        const item = await apple.reverse(args);
        recordAppleResult(true);
        return { data: item, sourceProvider: AddressSourceProvider.APPLE_MAPS };
      } catch (err) {
        recordAppleResult(false);
        throw err;
      }
    },
  };

  resolver = resolverImpl;
  return resolverImpl;
}

export type { GeoAutocompleteItem, GeoDetailsItem, GeoProvider, GeoResolver };
