export function clampWithGap(
  minValue: number,
  maxValue: number,
  step: number,
  gap: number,
  bounds: { min: number; max: number }
) {
  const quantize = (v: number) => Math.round(v / step) * step;
  const snappedMin = Math.max(bounds.min, Math.min(minValue, maxValue - gap));
  const snappedMax = Math.min(bounds.max, Math.max(maxValue, snappedMin + gap));
  return { min: quantize(snappedMin), max: quantize(snappedMax) };
}
