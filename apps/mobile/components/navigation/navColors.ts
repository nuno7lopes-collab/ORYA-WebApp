import { tokens } from "@orya/shared";

type RgbTuple = readonly [number, number, number];

const FALLBACK_RGB: RgbTuple = [11, 16, 20];
export const NAV_BAR_BLUR_INTENSITY = 24;
export const NAV_BAR_MILK_ALPHA = 0.74;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const hexToRgbTuple = (value: string): RgbTuple => {
  const normalized = value.trim();
  const fullHex = normalized.match(/^#([0-9a-fA-F]{6})$/);
  if (fullHex) {
    const hex = fullHex[1];
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return [r, g, b];
  }
  const shortHex = normalized.match(/^#([0-9a-fA-F]{3})$/);
  if (shortHex) {
    const hex = shortHex[1];
    const r = parseInt(`${hex[0]}${hex[0]}`, 16);
    const g = parseInt(`${hex[1]}${hex[1]}`, 16);
    const b = parseInt(`${hex[2]}${hex[2]}`, 16);
    return [r, g, b];
  }
  return FALLBACK_RGB;
};

const GRADIENT_STOPS: ReadonlyArray<{ stop: number; color: RgbTuple }> = [
  { stop: 0, color: hexToRgbTuple(tokens.colors.background) },
  { stop: 0.5, color: hexToRgbTuple(tokens.colors.backgroundElevated) },
  { stop: 1, color: hexToRgbTuple(tokens.colors.backgroundDeep) },
];

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

const toRgbString = ([r, g, b]: RgbTuple) => `rgb(${r}, ${g}, ${b})`;

const toRgbaString = ([r, g, b]: RgbTuple, alpha: number) =>
  `rgba(${r}, ${g}, ${b}, ${clamp01(alpha)})`;

const interpolateColor = (start: RgbTuple, end: RgbTuple, t: number): RgbTuple => [
  Math.round(lerp(start[0], end[0], t)),
  Math.round(lerp(start[1], end[1], t)),
  Math.round(lerp(start[2], end[2], t)),
];

export const sampleBackgroundRgb = (progress: number): RgbTuple => {
  const clamped = clamp01(progress);
  for (let index = 0; index < GRADIENT_STOPS.length - 1; index += 1) {
    const current = GRADIENT_STOPS[index];
    const next = GRADIENT_STOPS[index + 1];
    if (clamped >= current.stop && clamped <= next.stop) {
      const segment =
        next.stop === current.stop
          ? 0
          : (clamped - current.stop) / (next.stop - current.stop);
      return interpolateColor(current.color, next.color, segment);
    }
  }
  return GRADIENT_STOPS[GRADIENT_STOPS.length - 1]?.color ?? FALLBACK_RGB;
};

export const sampleBackgroundColor = (progress: number) =>
  toRgbString(sampleBackgroundRgb(progress));

export const sampleBackgroundColorAlpha = (progress: number, alpha: number) =>
  toRgbaString(sampleBackgroundRgb(progress), alpha);
