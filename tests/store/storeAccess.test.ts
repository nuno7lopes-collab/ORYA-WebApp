import { describe, expect, it } from "vitest";
import { StoreStatus } from "@prisma/client";
import {
  canCheckout,
  isPublicStore,
  isStoreDigitalEnabled,
  isStoreFeatureEnabled,
  resolvePublicStoreAccess,
  resolveStoreState,
} from "@/lib/storeAccess";

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
    expect(isPublicStore({ ...activeBase, catalogLocked: true })).toBe(false);
    expect(isPublicStore({ ...activeBase, checkoutEnabled: false })).toBe(false);
    expect(isPublicStore({ ...activeBase, showOnProfile: false })).toBe(false);
    expect(canCheckout({ ...activeBase, checkoutEnabled: false })).toBe(false);
    expect(canCheckout(activeBase)).toBe(true);
  });

  it("maps public access errors deterministically", () => {
    expect(
      resolvePublicStoreAccess({ ...activeBase, catalogLocked: true, checkoutEnabled: true }),
    ).toEqual({ ok: false, errorCode: "CATALOG_LOCKED", error: "Catalogo bloqueado." });
    expect(
      resolvePublicStoreAccess({ ...activeBase, checkoutEnabled: false, catalogLocked: false }),
    ).toEqual({ ok: false, errorCode: "CHECKOUT_UNAVAILABLE", error: "Checkout indisponivel." });
    expect(
      resolvePublicStoreAccess({ ...activeBase, showOnProfile: false }),
    ).toEqual({ ok: false, errorCode: "STORE_CLOSED", error: "Loja fechada." });
    expect(resolvePublicStoreAccess(activeBase)).toEqual({ ok: true });
  });

  it("keeps store feature permanently enabled", () => {
    expect(isStoreFeatureEnabled()).toBe(true);
    expect(isStoreDigitalEnabled()).toBe(true);
  });
});
