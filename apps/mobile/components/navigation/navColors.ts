import { tokens } from "@orya/shared";

const FALLBACK_RGB = "11, 16, 20";

const hexToRgbChannels = (value: string): string => {
  const normalized = value.trim();
  const fullHex = normalized.match(/^#([0-9a-fA-F]{6})$/);
  if (fullHex) {
    const hex = fullHex[1];
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `${r}, ${g}, ${b}`;
  }
  const shortHex = normalized.match(/^#([0-9a-fA-F]{3})$/);
  if (shortHex) {
    const hex = shortHex[1];
    const r = parseInt(`${hex[0]}${hex[0]}`, 16);
    const g = parseInt(`${hex[1]}${hex[1]}`, 16);
    const b = parseInt(`${hex[2]}${hex[2]}`, 16);
    return `${r}, ${g}, ${b}`;
  }
  return FALLBACK_RGB;
};

const NAV_BASE_RGB = hexToRgbChannels(tokens.colors.background);
const NAV_ELEVATED_RGB = hexToRgbChannels(tokens.colors.backgroundElevated);
const NAV_DEEP_HEX =
  (tokens.colors as Record<string, string>).backgroundDeep ?? "#101826";
const NAV_DEEP_RGB = hexToRgbChannels(NAV_DEEP_HEX);

export const navRgba = (alpha: number) => `rgba(${NAV_BASE_RGB},${alpha})`;
export const navElevatedRgba = (alpha: number) =>
  `rgba(${NAV_ELEVATED_RGB},${alpha})`;
export const navDeepRgba = (alpha: number) => `rgba(${NAV_DEEP_RGB},${alpha})`;

export const NAV_TOP_SOLID = tokens.colors.background;
export const NAV_BOTTOM_SOLID = NAV_DEEP_HEX;
