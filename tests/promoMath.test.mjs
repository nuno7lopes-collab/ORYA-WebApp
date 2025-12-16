import test from "node:test";
import assert from "node:assert";
import { computePromoDiscountCents } from "../lib/promoMath.js";

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

test("minCart (minTotalCents) impede desconto abaixo do mínimo", () => {
  const promo = { type: "FIXED", value: 500, minTotalCents: 2_000 };
  const discount = computePromoDiscountCents({ promo, totalQuantity: 1, amountInCents: 1_500 });
  const discount2 = computePromoDiscountCents({ promo, totalQuantity: 1, amountInCents: 2_500 });
  assert.strictEqual(discount, 0);
  assert.strictEqual(discount2, 500);
});

test("desconto fixo nunca excede o total", () => {
  const promo = { type: "FIXED", value: 10_000 };
  const discount = computePromoDiscountCents({ promo, totalQuantity: 1, amountInCents: 5_000 });
  assert.strictEqual(discount, 5_000);
});

test("minQuantity é respetivo ao limite e permite desconto quando atinge o limiar", () => {
  const promo = { type: "PERCENTAGE", value: 1_000, minQuantity: 3 }; // 10%
  const below = computePromoDiscountCents({ promo, totalQuantity: 2, amountInCents: 10_000 });
  const at = computePromoDiscountCents({ promo, totalQuantity: 3, amountInCents: 10_000 });
  assert.strictEqual(below, 0);
  assert.strictEqual(at, 1_000);
});

test("percentagem >100% é limitada ao total e valores não positivos devolvem 0", () => {
  const promo = { type: "PERCENTAGE", value: 15_000 }; // 150%
  const discount = computePromoDiscountCents({ promo, totalQuantity: 1, amountInCents: 4_000 });
  assert.strictEqual(discount, 4_000, "nunca pode ultrapassar o total");

  const promoZero = { type: "PERCENTAGE", value: 0 };
  const zeroDiscount = computePromoDiscountCents({ promo: promoZero, totalQuantity: 1, amountInCents: 4_000 });
  assert.strictEqual(zeroDiscount, 0, "valor nulo devolve 0");
});
