import { describe, expect, it } from "vitest";
import { EventPricingMode } from "@prisma/client";
import { resolveTicketPricingSummary } from "@/domain/events/ticketPricing";

describe("resolveTicketPricingSummary", () => {
  it("usa o menor preco de bilhetes compraveis", () => {
    const summary = resolveTicketPricingSummary({
      pricingMode: EventPricingMode.STANDARD,
      ticketTypes: [
        { price: 1800, currency: "eur", status: "ON_SALE", totalQuantity: 50, soldQuantity: 10 },
        { price: 1200, currency: "EUR", status: "UPCOMING", totalQuantity: 100, soldQuantity: 20 },
        { price: 900, currency: "EUR", status: "CLOSED", totalQuantity: 100, soldQuantity: 0 },
      ],
    });

    expect(summary.isGratis).toBe(false);
    expect(summary.priceFromCents).toBe(1200);
    expect(summary.priceFrom).toBe(12);
    expect(summary.priceCurrency).toBe("EUR");
  });

  it("ignora bilhetes esgotados para calcular o preco desde", () => {
    const summary = resolveTicketPricingSummary({
      pricingMode: EventPricingMode.STANDARD,
      ticketTypes: [
        { price: 500, status: "ON_SALE", totalQuantity: 20, soldQuantity: 20 },
        { price: 2000, status: "ON_SALE", totalQuantity: 100, soldQuantity: 10 },
      ],
    });

    expect(summary.priceFromCents).toBe(2000);
    expect(summary.priceFrom).toBe(20);
    expect(summary.isGratis).toBe(false);
  });

  it("devolve gratis quando pricing mode e free_only", () => {
    const summary = resolveTicketPricingSummary({
      pricingMode: EventPricingMode.FREE_ONLY,
      ticketTypes: [],
    });

    expect(summary.isGratis).toBe(true);
    expect(summary.priceFromCents).toBe(0);
    expect(summary.priceFrom).toBe(0);
  });

  it("quando nao ha bilhetes compraveis, nao expoe priceFrom", () => {
    const summary = resolveTicketPricingSummary({
      pricingMode: EventPricingMode.STANDARD,
      ticketTypes: [
        { price: 1500, status: "CLOSED", totalQuantity: 100, soldQuantity: 20 },
        { price: 1000, status: "SOLD_OUT", totalQuantity: 10, soldQuantity: 10 },
      ],
    });

    expect(summary.isGratis).toBe(false);
    expect(summary.priceFromCents).toBeNull();
    expect(summary.priceFrom).toBeNull();
  });
});
