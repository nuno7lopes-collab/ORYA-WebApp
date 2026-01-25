import { describe, expect, it } from "vitest";
import { deriveIsFreeEvent } from "@/domain/events/derivedIsFree";
import { EventPricingMode } from "@prisma/client";

describe("deriveIsFreeEvent", () => {
  it("returns true when pricingMode is FREE_ONLY", () => {
    expect(
      deriveIsFreeEvent({
        pricingMode: EventPricingMode.FREE_ONLY,
        ticketPrices: [500, 1000],
      }),
    ).toBe(true);
  });

  it("returns true when all ticket prices are zero", () => {
    expect(
      deriveIsFreeEvent({
        pricingMode: EventPricingMode.STANDARD,
        ticketPrices: [0, 0],
      }),
    ).toBe(true);
  });

  it("returns false when mixed free and paid tickets", () => {
    expect(
      deriveIsFreeEvent({
        pricingMode: EventPricingMode.STANDARD,
        ticketPrices: [0, 500],
      }),
    ).toBe(false);
  });

  it("returns false when all tickets are paid", () => {
    expect(
      deriveIsFreeEvent({
        pricingMode: EventPricingMode.STANDARD,
        ticketPrices: [500, 1000],
      }),
    ).toBe(false);
  });
});
