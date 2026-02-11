import { describe, expect, it } from "vitest";
import { StoreShippingMode } from "@prisma/client";
import { computeMethodShipping } from "@/lib/store/shipping";

describe("computeMethodShipping", () => {
  const method = {
    id: 1,
    name: "Standard",
    baseRateCents: 700,
    mode: StoreShippingMode.VALUE_TIERS,
    freeOverCents: null,
    tiers: [
      { minSubtotalCents: 0, maxSubtotalCents: 1999, rateCents: 700 },
      { minSubtotalCents: 2000, maxSubtotalCents: 4999, rateCents: 350 },
      { minSubtotalCents: 5000, maxSubtotalCents: null, rateCents: 0 },
    ],
  } as const;

  it("uses store-level free shipping threshold first", () => {
    const result = computeMethodShipping({
      method,
      subtotalCents: 5000,
      storeFreeThresholdCents: 4000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.shippingCents).toBe(0);
    expect(result.freeOverRemainingCents).toBe(0);
  });

  it("uses method free-over when store threshold is not reached", () => {
    const result = computeMethodShipping({
      method: { ...method, mode: StoreShippingMode.FLAT, freeOverCents: 2000 },
      subtotalCents: 2200,
      storeFreeThresholdCents: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.shippingCents).toBe(0);
    expect(result.methodFreeOverRemainingCents).toBe(0);
  });

  it("computes shipping from matching value tier", () => {
    const result = computeMethodShipping({
      method,
      subtotalCents: 2800,
      storeFreeThresholdCents: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.shippingCents).toBe(350);
  });

  it("returns error when value tier does not match", () => {
    const result = computeMethodShipping({
      method: { ...method, tiers: [{ minSubtotalCents: 10000, maxSubtotalCents: null, rateCents: 0 }] },
      subtotalCents: 2800,
      storeFreeThresholdCents: null,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("Sem tier valido.");
  });
});
