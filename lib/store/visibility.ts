import type { StoreVisibility } from "@prisma/client";

export type StoreVisibilityInput = {
  visibility?: StoreVisibility | null;
};

export function normalizeStoreVisibility(input: StoreVisibilityInput): StoreVisibility {
  return input.visibility ?? ("HIDDEN" as StoreVisibility);
}

export function isPublicVisibility(visibility: StoreVisibility | null | undefined) {
  return visibility === ("PUBLIC" as StoreVisibility);
}

export function isArchivedVisibility(visibility: StoreVisibility | null | undefined) {
  return visibility === ("ARCHIVED" as StoreVisibility);
}

export function isVisibleInCatalog(visibility: StoreVisibility | null | undefined) {
  return visibility === ("PUBLIC" as StoreVisibility);
}
