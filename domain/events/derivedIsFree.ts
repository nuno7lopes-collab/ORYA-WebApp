import { EventPricingMode } from "@prisma/client";

export function deriveIsFreeEvent(input: {
  pricingMode?: EventPricingMode | null;
  ticketPrices?: Array<number | null | undefined>;
}) {
  const pricingMode = input.pricingMode ?? EventPricingMode.STANDARD;
  if (pricingMode === EventPricingMode.FREE_ONLY) return true;
  const prices = (input.ticketPrices ?? []).map((p) => Number(p ?? 0));
  if (prices.length === 0) return false;
  const hasZero = prices.some((p) => p === 0);
  const hasPaid = prices.some((p) => p > 0);
  return hasZero && !hasPaid;
}
