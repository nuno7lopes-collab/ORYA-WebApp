import { StoreStatus } from "@prisma/client";
import { env } from "@/lib/env";

type StoreLike = {
  status?: StoreStatus | null;
  showOnProfile?: boolean | null;
  catalogLocked?: boolean | null;
  checkoutEnabled?: boolean | null;
} | null;

export type StoreResolvedState =
  | "DISABLED"
  | "HIDDEN"
  | "LOCKED"
  | "CHECKOUT_DISABLED"
  | "ACTIVE";

export function isStoreFeatureEnabled() {
  return env.storeEnabled;
}

export function isStoreDigitalEnabled() {
  return env.storeDigitalEnabled;
}

export function resolveStoreState(store: StoreLike): StoreResolvedState {
  if (!store || store.status !== StoreStatus.ACTIVE) return "DISABLED";
  if (!store.showOnProfile) return "HIDDEN";
  if (store.catalogLocked) return "LOCKED";
  if (!store.checkoutEnabled) return "CHECKOUT_DISABLED";
  return "ACTIVE";
}

export function isStoreOpen(store: StoreLike) {
  return resolveStoreState(store) !== "DISABLED";
}

export function isPublicStore(store: StoreLike) {
  const state = resolveStoreState(store);
  return state === "LOCKED" || state === "CHECKOUT_DISABLED" || state === "ACTIVE";
}

export function canCheckout(store: StoreLike) {
  return resolveStoreState(store) === "ACTIVE";
}

// Backwards-compatible aliases for existing imports.
export const isStorePublic = isPublicStore;
export const canCheckoutStore = canCheckout;
