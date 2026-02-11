import { describe, expect, it } from "vitest";
import { StoreStatus } from "@prisma/client";
import { canCheckoutStore, isStorePublic, resolveStoreState } from "@/lib/storeAccess";

describe("storeAccess resolveStoreState", () => {
  const activeBase = {
    status: StoreStatus.ACTIVE,
    showOnProfile: true,
    catalogLocked: false,
    checkoutEnabled: true,
  } as const;

  it("applies canonical precedence", () => {
    expect(resolveStoreState(null)).toBe("DISABLED");
    expect(resolveStoreState({ ...activeBase, status: StoreStatus.CLOSED })).toBe("DISABLED");
    expect(resolveStoreState({ ...activeBase, showOnProfile: false })).toBe("HIDDEN");
    expect(resolveStoreState({ ...activeBase, catalogLocked: true })).toBe("LOCKED");
    expect(resolveStoreState({ ...activeBase, checkoutEnabled: false })).toBe("CHECKOUT_DISABLED");
    expect(resolveStoreState(activeBase)).toBe("ACTIVE");
  });

  it("keeps public/checkout helpers aligned to resolved state", () => {
    expect(isStorePublic({ ...activeBase, catalogLocked: true })).toBe(true);
    expect(isStorePublic({ ...activeBase, checkoutEnabled: false })).toBe(true);
    expect(isStorePublic({ ...activeBase, showOnProfile: false })).toBe(false);
    expect(canCheckoutStore({ ...activeBase, checkoutEnabled: false })).toBe(false);
    expect(canCheckoutStore(activeBase)).toBe(true);
  });
});
