import { EventPricingMode } from "@prisma/client";

export function validateZeroPriceGuard(input: {
  pricingMode: EventPricingMode | null | undefined;
  ticketPrices: number[];
}) {
  const pricingMode = input.pricingMode ?? EventPricingMode.STANDARD;
  const hasZero = input.ticketPrices.some((price) => price === 0);
  const hasPaid = input.ticketPrices.some((price) => price > 0);

  if (hasZero && pricingMode !== EventPricingMode.FREE_ONLY) {
    return { ok: false as const, error: "EVENT_ZERO_PRICE_REQUIRES_EXPLICIT_FREE_MODE" as const };
  }
  if (pricingMode === EventPricingMode.FREE_ONLY && hasPaid) {
    return { ok: false as const, error: "EVENT_FREE_ONLY_DISALLOWS_PAID_TICKETS" as const };
  }
  return { ok: true as const };
}
