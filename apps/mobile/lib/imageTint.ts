import * as ImageManipulator from "expo-image-manipulator";
import { Buffer } from "buffer";
import UPNG from "upng-js";

type Rgb = { r: number; g: number; b: number };
export type DominantColor = Rgb & { hex: string };

const tintCache = new Map<string, string>();
const tintInflight = new Map<string, Promise<string>>();
const colorCache = new Map<string, DominantColor>();
const colorInflight = new Map<string, Promise<DominantColor>>();

const clamp = (value: number) => Math.max(0, Math.min(255, value));

const toHex = (value: number) => clamp(value).toString(16).padStart(2, "0");

const rgbToHex = ({ r, g, b }: Rgb) =>
  `#${toHex(r)}${toHex(g)}${toHex(b)}`;

const hslToRgb = (h: number, s: number, l: number): Rgb => {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(1, s));
  const light = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (hue < 60) {
    r1 = c;
    g1 = x;
  } else if (hue < 120) {
    r1 = x;
    g1 = c;
  } else if (hue < 180) {
    g1 = c;
    b1 = x;
  } else if (hue < 240) {
    g1 = x;
    b1 = c;
  } else if (hue < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  return {
    r: clamp((r1 + m) * 255),
    g: clamp((g1 + m) * 255),
    b: clamp((b1 + m) * 255),
  };
};

const resolveFallbackRgb = (seed: string): Rgb => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return hslToRgb(hue, 0.34, 0.2);
};

const extractDominantRgb = async (uri: string): Promise<Rgb> => {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1, height: 1 } }],
    { base64: true, compress: 0.8, format: ImageManipulator.SaveFormat.PNG },
  );
  if (!result.base64) throw new Error("NO_BASE64");
  const buffer = Buffer.from(result.base64, "base64");
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  );
  const png = UPNG.decode(arrayBuffer);
  const rgba = UPNG.toRGBA8(png)?.[0];
  if (!rgba || rgba.length < 3) throw new Error("NO_RGBA");
  const [r, g, b] = rgba;
  return { r, g, b };
};

const buildTint = ({ r, g, b }: Rgb) => {
  const factor = 0.48;
  const darkR = clamp(Math.round(r * factor));
  const darkG = clamp(Math.round(g * factor));
  const darkB = clamp(Math.round(b * factor));
  return `rgba(${darkR}, ${darkG}, ${darkB}, 0.72)`;
};

export const getFallbackTint = (seed: string) => {
  const rgb = resolveFallbackRgb(seed);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.75)`;
};

export const getDominantColor = async (
  uri: string,
  fallbackSeed?: string,
): Promise<DominantColor> => {
  const key = uri || fallbackSeed || "";
  if (!key) {
    const fallback = resolveFallbackRgb("orya");
    return { ...fallback, hex: rgbToHex(fallback) };
  }
  if (colorCache.has(key)) return colorCache.get(key) as DominantColor;
  if (colorInflight.has(key)) return colorInflight.get(key) as Promise<DominantColor>;

  const promise = (async () => {
    try {
      const rgb = await extractDominantRgb(uri);
      const dominant: DominantColor = { ...rgb, hex: rgbToHex(rgb) };
      colorCache.set(key, dominant);
      return dominant;
    } catch {
      const fallback = resolveFallbackRgb(key);
      const dominant: DominantColor = { ...fallback, hex: rgbToHex(fallback) };
      colorCache.set(key, dominant);
      return dominant;
    } finally {
      colorInflight.delete(key);
    }
  })();

  colorInflight.set(key, promise);
  return promise;
};

export const getDominantTint = async (uri: string, fallbackSeed?: string) => {
  const key = uri || fallbackSeed || "";
  if (!key) return "rgba(12, 16, 24, 0.72)";
  if (tintCache.has(key)) return tintCache.get(key) as string;
  if (tintInflight.has(key)) return tintInflight.get(key) as Promise<string>;

  const promise = (async () => {
    try {
      const dominant = await getDominantColor(uri, fallbackSeed);
      const tint = buildTint(dominant);
      tintCache.set(key, tint);
      return tint;
    } catch {
      const fallback = getFallbackTint(key);
      tintCache.set(key, fallback);
      return fallback;
    } finally {
      tintInflight.delete(key);
    }
  })();

  tintInflight.set(key, promise);
  return promise;
};
