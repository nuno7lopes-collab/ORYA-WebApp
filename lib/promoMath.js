// JS shim para testes Node (sem loader TS)
export function computePromoDiscountCents({ promo, totalQuantity, amountInCents }) {
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
