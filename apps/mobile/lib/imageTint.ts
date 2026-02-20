import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";
import * as LegacyFileSystem from "expo-file-system/legacy";
import { Buffer } from "buffer";
import UPNG from "upng-js";

type Rgb = { r: number; g: number; b: number };
export type DominantColor = Rgb & { hex: string; source?: "image" | "fallback" };

const tintCache = new Map<string, string>();
const tintInflight = new Map<string, Promise<string>>();
const colorCache = new Map<string, DominantColor>();
const colorInflight = new Map<string, Promise<DominantColor>>();
const failedColorAt = new Map<string, number>();
const localUriCache = new Map<string, string>();
const localUriInflight = new Map<string, Promise<string>>();
const extractionQueue: Array<() => void> = [];
let activeExtractions = 0;

const SAMPLE_SIZE = 20;
const FAILED_RETRY_MS = 8_000;
const EXTRACTION_CONCURRENCY = 2;
const FAILURE_BASE_RGB: Rgb = { r: 23, g: 26, b: 33 };
const DEV_LOG_EVERY_ATTEMPTS = 12;
const DEV_LOG_MAX_INTERVAL_MS = 45_000;

const devExtractionStats = {
  attempts: 0,
  fallbackCount: 0,
  totalDurationMs: 0,
  lastLogAt: 0,
};

const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

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

const mixRgb = (from: Rgb, to: Rgb, weight: number): Rgb => {
  const safe = Math.max(0, Math.min(1, weight));
  return {
    r: clamp(from.r + (to.r - from.r) * safe),
    g: clamp(from.g + (to.g - from.g) * safe),
    b: clamp(from.b + (to.b - from.b) * safe),
  };
};

const hashSeed = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const resolveFallbackRgb = (seed: string): Rgb => {
  const hash = hashSeed(seed || "orya");
  // Keep fallback hues in a cool range to avoid red casts on dark covers.
  const hue = 188 + (hash % 68);
  const saturation = 0.24 + ((hash >> 3) % 20) / 100;
  const lightness = 0.16 + ((hash >> 7) % 12) / 100;
  return hslToRgb(hue, saturation, lightness);
};

const resolveFailureFallbackRgb = (seed: string): Rgb =>
  mixRgb(resolveFallbackRgb(seed), FAILURE_BASE_RGB, 0.82);

const reportDevExtractionStats = ({
  durationMs,
  usedFallback,
}: {
  durationMs: number;
  usedFallback: boolean;
}) => {
  if (!__DEV__) return;
  const duration = Math.max(0, Math.round(durationMs));
  devExtractionStats.attempts += 1;
  devExtractionStats.totalDurationMs += duration;
  if (usedFallback) devExtractionStats.fallbackCount += 1;

  const now = Date.now();
  const byCount = devExtractionStats.attempts % DEV_LOG_EVERY_ATTEMPTS === 0;
  const byInterval = now - devExtractionStats.lastLogAt >= DEV_LOG_MAX_INTERVAL_MS;
  if (!byCount && !byInterval) return;

  const avgMs = Math.round(
    devExtractionStats.totalDurationMs / Math.max(1, devExtractionStats.attempts),
  );
  const fallbackRate = Math.round(
    (devExtractionStats.fallbackCount / Math.max(1, devExtractionStats.attempts)) * 100,
  );
  console.info(
    `[imageTint] extractions=${devExtractionStats.attempts} avg=${avgMs}ms fallback=${fallbackRate}%`,
  );
  devExtractionStats.lastLogAt = now;
};

const isRemoteUri = (uri: string) => /^https?:\/\//i.test(uri);

const resolveFileExtension = (uri: string) => {
  const normalize = (raw: string) => {
    const safe = raw.toLowerCase();
    if (safe === "jpg" || safe === "jpeg") return ".jpg";
    if (safe === "png") return ".png";
    if (safe === "webp") return ".webp";
    if (safe === "heic" || safe === "heif") return ".heic";
    return ".img";
  };
  try {
    const parsed = new URL(uri);
    const fromPath = parsed.pathname.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? "";
    return fromPath ? normalize(fromPath) : ".img";
  } catch {
    const fromRaw = uri.match(/\.([a-z0-9]{2,5})(?:\?|$)/i)?.[1] ?? "";
    return fromRaw ? normalize(fromRaw) : ".img";
  }
};

const withExtractionSlot = async <T>(task: () => Promise<T>): Promise<T> =>
  await new Promise<T>((resolve, reject) => {
    const run = () => {
      activeExtractions += 1;
      task()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          activeExtractions = Math.max(0, activeExtractions - 1);
          const next = extractionQueue.shift();
          if (next) next();
        });
    };

    if (activeExtractions < EXTRACTION_CONCURRENCY) {
      run();
      return;
    }
    extractionQueue.push(run);
  });

const resolveLocalUri = async (uri: string): Promise<string> => {
  if (!isRemoteUri(uri)) return uri;
  if (localUriCache.has(uri)) return localUriCache.get(uri) as string;
  if (localUriInflight.has(uri)) return localUriInflight.get(uri) as Promise<string>;

  const promise = (async () => {
    const baseDir = FileSystem.Paths.cache?.uri ?? FileSystem.Paths.document?.uri ?? null;
    if (!baseDir) return uri;
    const ext = resolveFileExtension(uri);
    const cacheUri = `${baseDir}dominant-color-${hashSeed(uri).toString(36)}${ext}`;
    try {
      const info = await LegacyFileSystem.getInfoAsync(cacheUri);
      if (info.exists) {
        localUriCache.set(uri, cacheUri);
        return cacheUri;
      }
    } catch {
      // ignore getInfo failures and try download
    }
    const result = await LegacyFileSystem.downloadAsync(uri, cacheUri);
    localUriCache.set(uri, result.uri);
    return result.uri;
  })()
    .finally(() => {
      localUriInflight.delete(uri);
    });

  localUriInflight.set(uri, promise);
  return promise;
};

const decodeImageToRgba = async (sourceUri: string) => {
  const result = await ImageManipulator.manipulateAsync(
    sourceUri,
    [{ resize: { width: SAMPLE_SIZE, height: SAMPLE_SIZE } }],
    { base64: true, compress: 1, format: ImageManipulator.SaveFormat.PNG },
  );
  if (!result.base64) throw new Error("NO_BASE64");
  const buffer = Buffer.from(result.base64, "base64");
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  );
  const png = UPNG.decode(arrayBuffer);
  const frame = UPNG.toRGBA8(png)?.[0];
  if (!frame) throw new Error("NO_RGBA");
  const rgba =
    frame instanceof Uint8Array ? frame : new Uint8Array(frame as ArrayBuffer);
  if (!rgba || rgba.length < 4) throw new Error("NO_RGBA");
  const width = Math.max(1, png.width | 0);
  const height = Math.max(1, png.height | 0);
  return { rgba, width, height };
};

const extractDominantRgb = async (uri: string): Promise<Rgb> => {
  let sampled: { rgba: Uint8Array; width: number; height: number } | undefined;
  let sourceUri = await resolveLocalUri(uri);
  try {
    sampled = await decodeImageToRgba(sourceUri);
  } catch {
    if (sourceUri !== uri) {
      try {
        await LegacyFileSystem.deleteAsync(sourceUri, { idempotent: true });
      } catch {
        // ignore cache cleanup failures
      }
      localUriCache.delete(uri);
      try {
        sourceUri = await resolveLocalUri(uri);
        sampled = await decodeImageToRgba(sourceUri);
      } catch {
        sampled = await decodeImageToRgba(uri);
      }
    } else {
      sampled = await decodeImageToRgba(uri);
    }
  }

  if (!sampled) throw new Error("NO_RGBA");
  const { rgba, width, height } = sampled;

  type Bucket = {
    score: number;
    weight: number;
    sumR: number;
    sumG: number;
    sumB: number;
  };

  const buckets = new Map<string, Bucket>();
  let totalWeight = 0;
  let totalSaturation = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;

  const quantize = (value: number) => Math.round(value / 24) * 24;
  const centerX = (width - 1) / 2;
  const centerY = (height - 1) / 2;
  const maxDx = Math.max(1, centerX);
  const maxDy = Math.max(1, centerY);

  for (let i = 0; i < rgba.length; i += 4) {
    const alpha = rgba[i + 3] ?? 255;
    if (alpha < 46) continue;

    const r = rgba[i] ?? 0;
    const g = rgba[i + 1] ?? 0;
    const b = rgba[i + 2] ?? 0;
    const alphaWeight = alpha / 255;

    const pixel = i / 4;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    const dx = Math.abs(x - centerX) / maxDx;
    const dy = Math.abs(y - centerY) / maxDy;
    const edgePenalty = 1 - Math.min(1, (dx + dy) / 2) * 0.2;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const chroma = max - min;
    const saturation = max === 0 ? 0 : chroma / max;
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const lumaPenalty = luminance < 0.025 ? 0.38 : luminance > 0.97 ? 0.48 : 1;
    const baseWeight = alphaWeight * edgePenalty * lumaPenalty;
    if (baseWeight <= 0) continue;

    const scoreWeight =
      baseWeight * (1 + saturation * 2.2 + (chroma / 255) * 0.6);
    const key = `${quantize(r)}-${quantize(g)}-${quantize(b)}`;
    const bucket = buckets.get(key) ?? {
      score: 0,
      weight: 0,
      sumR: 0,
      sumG: 0,
      sumB: 0,
    };

    bucket.score += scoreWeight;
    bucket.weight += baseWeight;
    bucket.sumR += r * baseWeight;
    bucket.sumG += g * baseWeight;
    bucket.sumB += b * baseWeight;
    buckets.set(key, bucket);

    totalWeight += baseWeight;
    totalSaturation += saturation * baseWeight;
    sumR += r * baseWeight;
    sumG += g * baseWeight;
    sumB += b * baseWeight;
  }

  if (totalWeight <= 0) throw new Error("NO_WEIGHT");

  const globalRgb: Rgb = {
    r: clamp(sumR / totalWeight),
    g: clamp(sumG / totalWeight),
    b: clamp(sumB / totalWeight),
  };

  const averageSaturation = totalSaturation / totalWeight;
  if (averageSaturation < 0.09 || buckets.size === 0) {
    return globalRgb;
  }

  let bestBucket: Bucket | null = null;
  for (const bucket of buckets.values()) {
    if (!bestBucket || bucket.score > bestBucket.score) {
      bestBucket = bucket;
    }
  }
  if (!bestBucket || bestBucket.weight <= 0) return globalRgb;

  const dominanceRatio = bestBucket.weight / totalWeight;
  const globalLuminance =
    (0.2126 * globalRgb.r + 0.7152 * globalRgb.g + 0.0722 * globalRgb.b) / 255;
  if (dominanceRatio < 0.26) {
    // Avoid tiny saturated details (e.g. logos/text) dominating dark covers.
    return globalRgb;
  }

  const bucketRgb: Rgb = {
    r: clamp(bestBucket.sumR / bestBucket.weight),
    g: clamp(bestBucket.sumG / bestBucket.weight),
    b: clamp(bestBucket.sumB / bestBucket.weight),
  };

  const colorDistance =
    (Math.abs(bucketRgb.r - globalRgb.r) +
      Math.abs(bucketRgb.g - globalRgb.g) +
      Math.abs(bucketRgb.b - globalRgb.b)) /
    3;
  if (globalLuminance < 0.22 && colorDistance > 64 && dominanceRatio < 0.5) {
    return globalRgb;
  }

  const globalBlendWeight =
    dominanceRatio < 0.38 ? 0.62 : dominanceRatio < 0.55 ? 0.42 : 0.24;
  return mixRgb(bucketRgb, globalRgb, globalBlendWeight);
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
  const uriKey = typeof uri === "string" ? uri.trim() : "";
  const seedKey = typeof fallbackSeed === "string" ? fallbackSeed.trim() : "";
  const key = uriKey || seedKey || "";
  if (!key) {
    const fallback = resolveFallbackRgb("orya");
    return { ...fallback, hex: rgbToHex(fallback), source: "fallback" };
  }
  if (colorCache.has(key)) return colorCache.get(key) as DominantColor;
  if (colorInflight.has(key)) return colorInflight.get(key) as Promise<DominantColor>;

  const failedAt = failedColorAt.get(key);
  if (uriKey && failedAt && Date.now() - failedAt < FAILED_RETRY_MS) {
    const fallback = resolveFailureFallbackRgb(seedKey || key);
    reportDevExtractionStats({ durationMs: 0, usedFallback: true });
    return { ...fallback, hex: rgbToHex(fallback), source: "fallback" } as DominantColor;
  }

  const promise: Promise<DominantColor> = (async (): Promise<DominantColor> => {
    const startedAt = Date.now();
    try {
      if (!uriKey) throw new Error("NO_URI");
      const rgb = await withExtractionSlot(() => extractDominantRgb(uriKey));
      const dominant: DominantColor = {
        ...rgb,
        hex: rgbToHex(rgb),
        source: "image",
      };
      colorCache.set(key, dominant);
      failedColorAt.delete(key);
      reportDevExtractionStats({
        durationMs: Date.now() - startedAt,
        usedFallback: false,
      });
      return dominant;
    } catch (error) {
      failedColorAt.set(key, Date.now());
      reportDevExtractionStats({
        durationMs: Date.now() - startedAt,
        usedFallback: true,
      });
      if (__DEV__) {
        const message =
          error instanceof Error ? error.message : "dominant-color-error";
        console.info(`[imageTint] dominant fallback (${message}) for ${key}`);
      }
      const fallback = resolveFailureFallbackRgb(seedKey || key);
      return { ...fallback, hex: rgbToHex(fallback), source: "fallback" } as DominantColor;
    } finally {
      colorInflight.delete(key);
    }
  })();

  colorInflight.set(key, promise);
  return promise;
};

export const getDominantTint = async (uri: string, fallbackSeed?: string) => {
  const uriKey = typeof uri === "string" ? uri.trim() : "";
  const seedKey = typeof fallbackSeed === "string" ? fallbackSeed.trim() : "";
  const key = uriKey || seedKey || "";
  if (!key) return "rgba(12, 16, 24, 0.72)";
  if (tintCache.has(key)) return tintCache.get(key) as string;
  if (tintInflight.has(key)) return tintInflight.get(key) as Promise<string>;

  const promise = (async () => {
    try {
      const dominant = await getDominantColor(uri, fallbackSeed);
      if (uriKey && dominant.source !== "image") {
        const fallback = resolveFailureFallbackRgb(seedKey || key);
        return buildTint(fallback);
      }
      const tint = buildTint(dominant);
      // Persist tint only when it came from real image extraction.
      if (dominant.source === "image" || !uriKey) {
        tintCache.set(key, tint);
      }
      return tint;
    } catch {
      const fallback = getFallbackTint(seedKey || key);
      return fallback;
    } finally {
      tintInflight.delete(key);
    }
  })();

  tintInflight.set(key, promise);
  return promise;
};
