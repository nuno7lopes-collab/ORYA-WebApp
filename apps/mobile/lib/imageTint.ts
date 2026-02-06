import * as ImageManipulator from "expo-image-manipulator";
import { Buffer } from "buffer";
import UPNG from "upng-js";

const tintCache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

const clamp = (value: number) => Math.max(0, Math.min(255, value));

export const getFallbackTint = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsla(${hue}, 36%, 16%, 0.75)`;
};

const buildTint = (r: number, g: number, b: number) => {
  const factor = 0.48;
  const darkR = clamp(Math.round(r * factor));
  const darkG = clamp(Math.round(g * factor));
  const darkB = clamp(Math.round(b * factor));
  return `rgba(${darkR}, ${darkG}, ${darkB}, 0.72)`;
};

export const getDominantTint = async (uri: string, fallbackSeed?: string) => {
  const key = uri || fallbackSeed || "";
  if (!key) return "rgba(12, 16, 24, 0.72)";
  if (tintCache.has(key)) return tintCache.get(key) as string;
  if (inflight.has(key)) return inflight.get(key) as Promise<string>;

  const promise = (async () => {
    try {
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
      const tint = buildTint(r, g, b);
      tintCache.set(key, tint);
      return tint;
    } catch {
      const fallback = getFallbackTint(key);
      tintCache.set(key, fallback);
      return fallback;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
};
