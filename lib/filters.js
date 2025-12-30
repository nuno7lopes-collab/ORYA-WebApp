// JS shim para testes Node (sem loader TS)
export function clampWithGap(minValue, maxValue, step, gap, bounds) {
  const quantize = (v) => Math.round(v / step) * step;
  const snappedMin = Math.max(bounds.min, Math.min(minValue, maxValue - gap));
  const snappedMax = Math.min(bounds.max, Math.max(maxValue, snappedMin + gap));
  return { min: quantize(snappedMin), max: quantize(snappedMax) };
}
