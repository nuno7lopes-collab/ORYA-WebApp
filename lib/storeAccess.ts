import { StoreStatus } from "@prisma/client";

type StoreLike = {
  status?: StoreStatus | null;
  showOnProfile?: boolean | null;
  catalogLocked?: boolean | null;
  checkoutEnabled?: boolean | null;
} | null;

type PublicStoreAccessInput = {
  status: StoreStatus | null | undefined;
  showOnProfile: boolean | null | undefined;
  catalogLocked: boolean | null | undefined;
  checkoutEnabled: boolean | null | undefined;
} | null;

export type StoreResolvedState =
  | "DISABLED"
  | "HIDDEN"
  | "LOCKED"
  | "CHECKOUT_DISABLED"
  | "ACTIVE";

export function isStoreFeatureEnabled() {
  return true;
}

export function isStoreDigitalEnabled() {
  return true;
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
  return resolveStoreState(store) === "ACTIVE";
}

export function canCheckout(store: StoreLike) {
  return resolveStoreState(store) === "ACTIVE";
}

export function resolvePublicStoreAccess(store: PublicStoreAccessInput): {
  ok: true;
} | {
  ok: false;
  errorCode: "STORE_CLOSED" | "CATALOG_LOCKED" | "CHECKOUT_UNAVAILABLE";
  error: string;
} {
  const state = resolveStoreState(store);
  if (state === "ACTIVE") {
    return { ok: true };
  }
  if (state === "LOCKED") {
    return { ok: false, errorCode: "CATALOG_LOCKED", error: "Catalogo bloqueado." };
  }
  if (state === "CHECKOUT_DISABLED") {
    return { ok: false, errorCode: "CHECKOUT_UNAVAILABLE", error: "Checkout indisponivel." };
  }
  return { ok: false, errorCode: "STORE_CLOSED", error: "Loja fechada." };
}
