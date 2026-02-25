import { describe, expect, it } from "vitest";

import { clampCropOffset, computeBaseScale, computeSourceCrop } from "@/app/components/forms/imageCropMath";

describe("imageCropMath", () => {
  it("calcula baseScale com estratégia cover", () => {
    const scale = computeBaseScale({ width: 300, height: 100 }, { width: 1000, height: 500 });
    expect(scale).toBeCloseTo(0.3, 6);
  });

  it("limita offsets ao espaço útil do crop", () => {
    const offset = clampCropOffset(
      { x: 120, y: -90 },
      { width: 300, height: 100 },
      { width: 1000, height: 500 },
      0.3,
    );

    expect(offset.x).toBe(0);
    expect(offset.y).toBe(-25);
  });

  it("produz source rect estável para imagem centrada", () => {
    const source = computeSourceCrop(
      { width: 300, height: 100 },
      { width: 1000, height: 500 },
      { x: 0, y: 0 },
      0.3,
    );

    expect(source.x).toBeCloseTo(0, 6);
    expect(source.y).toBeCloseTo(83.333333, 4);
    expect(source.width).toBeCloseTo(1000, 6);
    expect(source.height).toBeCloseTo(333.333333, 4);
  });

  it("faz clamp do source rect quando o offset ultrapassa o limite", () => {
    const source = computeSourceCrop(
      { width: 300, height: 100 },
      { width: 1000, height: 500 },
      { x: 0, y: 25 },
      0.3,
    );

    expect(source.y).toBeCloseTo(0, 6);
  });
});
