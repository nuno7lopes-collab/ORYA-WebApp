import { describe, expect, it } from "vitest";
import { validateZeroPriceGuard } from "@/domain/events/pricingGuard";
import { EventPricingMode } from "@prisma/client";

describe("validateZeroPriceGuard", () => {
  it("falha zero sem FREE_ONLY", () => {
    const res = validateZeroPriceGuard({ pricingMode: EventPricingMode.STANDARD, ticketPrices: [0] });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("EVENT_ZERO_PRICE_REQUIRES_EXPLICIT_FREE_MODE");
  });

  it("permite zero com FREE_ONLY", () => {
    const res = validateZeroPriceGuard({ pricingMode: EventPricingMode.FREE_ONLY, ticketPrices: [0, 0] });
    expect(res.ok).toBe(true);
  });

  it("bloqueia paid quando FREE_ONLY", () => {
    const res = validateZeroPriceGuard({ pricingMode: EventPricingMode.FREE_ONLY, ticketPrices: [0, 10] });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("EVENT_FREE_ONLY_DISALLOWS_PAID_TICKETS");
  });
});
