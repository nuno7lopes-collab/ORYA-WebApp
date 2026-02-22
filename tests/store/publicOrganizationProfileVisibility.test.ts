import { describe, expect, it } from "vitest";
import { canOpenPublicStorefront } from "@/lib/publicOrganizationProfile";

describe("publicOrganizationProfile store visibility", () => {
  it("only opens storefront when all operational gates pass", () => {
    expect(
      canOpenPublicStorefront({
        status: "ACTIVE",
        showOnProfile: true,
        checkoutEnabled: true,
        catalogLocked: false,
        paymentsReady: true,
        publicProductCount: 3,
      }),
    ).toBe(true);
  });

  it("closes storefront when checkout is disabled", () => {
    expect(
      canOpenPublicStorefront({
        status: "ACTIVE",
        showOnProfile: true,
        checkoutEnabled: false,
        catalogLocked: false,
        paymentsReady: true,
        publicProductCount: 3,
      }),
    ).toBe(false);
  });

  it("closes storefront when catalog is locked, products are missing, or payments are not ready", () => {
    expect(
      canOpenPublicStorefront({
        status: "ACTIVE",
        showOnProfile: true,
        checkoutEnabled: true,
        catalogLocked: true,
        paymentsReady: true,
        publicProductCount: 3,
      }),
    ).toBe(false);
    expect(
      canOpenPublicStorefront({
        status: "ACTIVE",
        showOnProfile: true,
        checkoutEnabled: true,
        catalogLocked: false,
        paymentsReady: true,
        publicProductCount: 0,
      }),
    ).toBe(false);
    expect(
      canOpenPublicStorefront({
        status: "ACTIVE",
        showOnProfile: true,
        checkoutEnabled: true,
        catalogLocked: false,
        paymentsReady: false,
        publicProductCount: 2,
      }),
    ).toBe(false);
  });
});
