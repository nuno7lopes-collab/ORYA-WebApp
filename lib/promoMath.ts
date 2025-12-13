export type PromoShape = {
  type: "PERCENTAGE" | "FIXED";
  value: number; // percentage in basis points (1000 = 10%)
  minQuantity?: number | null;
  minTotalCents?: number | null;
};

export function computePromoDiscountCents(params: {
  promo: PromoShape;
  totalQuantity: number;
  amountInCents: number;
}) {
  const { promo, totalQuantity, amountInCents } = params;
  if (amountInCents <= 0) return 0;
  if (promo.minQuantity && totalQuantity < promo.minQuantity) return 0;
  if (promo.minTotalCents && amountInCents < promo.minTotalCents) return 0;

  let discount = 0;
  if (promo.type === "PERCENTAGE") {
    discount = Math.floor((amountInCents * promo.value) / 10_000);
  } else {
    discount = Math.max(0, promo.value);
  }

  return Math.min(discount, amountInCents);
}
