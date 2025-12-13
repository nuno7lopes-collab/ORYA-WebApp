import test from "node:test";
import assert from "node:assert";
import { clampWithGap } from "../lib/filters.js";

test("clampWithGap keeps min below max with gap", () => {
  const { min, max } = clampWithGap(10, 12, 1, 5, { min: 0, max: 100 });
  assert.strictEqual(max - min >= 5, true);
  assert.strictEqual(min, 7); // 12 - gap (5) quantized to step 1
  assert.strictEqual(max, 12);
});

test("clampWithGap respects bounds and quantizes step", () => {
  const { min, max } = clampWithGap(-10, 3.2, 0.5, 4, { min: 0, max: 10 });
  assert.strictEqual(min, 0); // bounded
  assert.strictEqual(max, 4); // min + gap, quantized to 0.5
});

test("clampWithGap prevents overlap when handles cross", () => {
  const { min, max } = clampWithGap(90, 95, 5, 10, { min: 0, max: 100 });
  assert.strictEqual(min, 90);
  assert.strictEqual(max, 100); // clamped to bounds
});
