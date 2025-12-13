import test from "node:test";
import assert from "node:assert";
import { computePromoDiscountCents } from "../lib/promoMath.ts";

test("fixed discount clamps to amount and respects minTotal/minQuantity", () => {
  const promo = { type: "FIXED", value: 1_500, minTotalCents: 2_000, minQuantity: 2 };
  const discount = computePromoDiscountCents({ promo, totalQuantity: 1, amountInCents: 2_500 });
  assert.strictEqual(discount, 0, "insuficiente quantidade");

  const discount2 = computePromoDiscountCents({ promo, totalQuantity: 3, amountInCents: 1_200 });
  assert.strictEqual(discount2, 0, "abaixo do mínimo de total");

  const discount3 = computePromoDiscountCents({ promo, totalQuantity: 3, amountInCents: 5_000 });
  assert.strictEqual(discount3, 1_500);
});

test("percentage discount usa basis points e não excede o total", () => {
  const promo = { type: "PERCENTAGE", value: 2_500 }; // 25%
  const discount = computePromoDiscountCents({ promo, totalQuantity: 1, amountInCents: 10_000 });
  assert.strictEqual(discount, 2_500);

  const discount2 = computePromoDiscountCents({ promo, totalQuantity: 1, amountInCents: 1_000 });
  assert.strictEqual(discount2, 250);

  const discount3 = computePromoDiscountCents({ promo, totalQuantity: 1, amountInCents: 0 });
  assert.strictEqual(discount3, 0);
});
