import { StoreStatus } from "@prisma/client";
import { env } from "@/lib/env";

type StoreLike = {
  status?: StoreStatus | null;
  showOnProfile?: boolean | null;
  checkoutEnabled?: boolean | null;
} | null;

export function isStoreFeatureEnabled() {
  return env.storeEnabled;
}

export function isStoreOpen(store: StoreLike) {
  return store?.status === StoreStatus.OPEN;
}

export function isStorePublic(store: StoreLike) {
  return store?.status === StoreStatus.OPEN && Boolean(store?.showOnProfile);
}

export function canCheckoutStore(store: StoreLike) {
  return (
    store?.status === StoreStatus.OPEN &&
    Boolean(store?.checkoutEnabled) &&
    Boolean(store?.showOnProfile)
  );
}
