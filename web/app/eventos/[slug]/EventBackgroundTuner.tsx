"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type BackgroundDefaults = {
  blur: number;
  scale: number;
  saturate: number;
  brightness: number;
  maskStops: [number, number, number, number, number, number];
  maskAlphas: [number, number, number, number, number, number];
  overlayTop: number;
  overlayMid: number;
  overlayBottom: number;
  fadeStart: number;
  fadeMid: number;
  fadeEnd: number;
  fadeDark: number;
};

type EventBackgroundTunerProps = {
  targetId: string;
  defaults: BackgroundDefaults;
};

type PresetKey =
  | "nebula"
  | "aurora"
  | "obsidian"
  | "ember"
  | "sapphire"
  | "rose";

const NEBULA_PRESET: BackgroundDefaults = {
  blur: 72,
  scale: 1.34,
  saturate: 1.4,
  brightness: 1.08,
  maskStops: [0, 22, 44, 66, 86, 100],
  maskAlphas: [1, 0.96, 0.78, 0.46, 0.2, 0],
  overlayTop: 0.32,
  overlayMid: 0.2,
  overlayBottom: 0.08,
  fadeStart: 84,
  fadeMid: 94,
  fadeEnd: 100,
  fadeDark: 0.86,
};

const AURORA_PRESET: BackgroundDefaults = {
  blur: 62,
  scale: 1.3,
  saturate: 1.5,
  brightness: 1.12,
  maskStops: [0, 24, 46, 68, 88, 100],
  maskAlphas: [1, 0.96, 0.78, 0.5, 0.22, 0],
  overlayTop: 0.28,
  overlayMid: 0.16,
  overlayBottom: 0.04,
  fadeStart: 80,
  fadeMid: 92,
  fadeEnd: 100,
  fadeDark: 0.78,
};

const OBSIDIAN_PRESET: BackgroundDefaults = {
  blur: 58,
  scale: 1.22,
  saturate: 0.75,
  brightness: 0.9,
  maskStops: [0, 18, 36, 56, 78, 100],
  maskAlphas: [1, 0.98, 0.82, 0.55, 0.28, 0],
  overlayTop: 0.72,
  overlayMid: 0.55,
  overlayBottom: 0.28,
  fadeStart: 54,
  fadeMid: 72,
  fadeEnd: 90,
  fadeDark: 0.96,
};

const EMBER_PRESET: BackgroundDefaults = {
  blur: 52,
  scale: 1.2,
  saturate: 1.4,
  brightness: 1.18,
  maskStops: [0, 26, 50, 70, 88, 100],
  maskAlphas: [1, 0.95, 0.75, 0.45, 0.2, 0],
  overlayTop: 0.32,
  overlayMid: 0.2,
  overlayBottom: 0.06,
  fadeStart: 78,
  fadeMid: 90,
  fadeEnd: 98,
  fadeDark: 0.72,
};

const SAPPHIRE_PRESET: BackgroundDefaults = {
  blur: 78,
  scale: 1.34,
  saturate: 1.15,
  brightness: 1.08,
  maskStops: [0, 30, 54, 74, 90, 100],
  maskAlphas: [1, 0.98, 0.85, 0.55, 0.25, 0],
  overlayTop: 0.24,
  overlayMid: 0.14,
  overlayBottom: 0.04,
  fadeStart: 86,
  fadeMid: 95,
  fadeEnd: 100,
  fadeDark: 0.7,
};

const ROSE_PRESET: BackgroundDefaults = {
  blur: 66,
  scale: 1.26,
  saturate: 1.22,
  brightness: 1.04,
  maskStops: [0, 22, 44, 64, 84, 100],
  maskAlphas: [1, 0.96, 0.8, 0.5, 0.22, 0],
  overlayTop: 0.36,
  overlayMid: 0.22,
  overlayBottom: 0.08,
  fadeStart: 82,
  fadeMid: 93,
  fadeEnd: 100,
  fadeDark: 0.8,
};

const PRESET_OPTIONS: Array<{ key: PresetKey; label: string }> = [
  { key: "nebula", label: "Nebula Drift" },
  { key: "aurora", label: "Aurora Veil" },
  { key: "obsidian", label: "Obsidian Luxe" },
  { key: "ember", label: "Ember Horizon" },
  { key: "sapphire", label: "Sapphire Mist" },
  { key: "rose", label: "Rose Quartz" },
];

export default function EventBackgroundTuner({
  targetId,
  defaults,
}: EventBackgroundTunerProps) {
  const searchParams = useSearchParams();
  const enabled = searchParams?.get("bgtools") === "1";
  const [activePreset, setActivePreset] = useState<PresetKey>("nebula");

  const activeValues = useMemo<BackgroundDefaults>(() => {
    if (activePreset === "nebula") return NEBULA_PRESET;
    if (activePreset === "aurora") return AURORA_PRESET;
    if (activePreset === "obsidian") return OBSIDIAN_PRESET;
    if (activePreset === "ember") return EMBER_PRESET;
    if (activePreset === "sapphire") return SAPPHIRE_PRESET;
    if (activePreset === "rose") return ROSE_PRESET;
    return defaults;
  }, [activePreset, defaults]);

  const cssVars = useMemo(
    () => ({
      "--event-bg-blur": `${activeValues.blur}px`,
      "--event-bg-scale": `${activeValues.scale}`,
      "--event-bg-saturate": `${activeValues.saturate}`,
      "--event-bg-brightness": `${activeValues.brightness}`,
      "--event-bg-mask-stop-1": `${activeValues.maskStops[0]}%`,
      "--event-bg-mask-stop-2": `${activeValues.maskStops[1]}%`,
      "--event-bg-mask-stop-3": `${activeValues.maskStops[2]}%`,
      "--event-bg-mask-stop-4": `${activeValues.maskStops[3]}%`,
      "--event-bg-mask-stop-5": `${activeValues.maskStops[4]}%`,
      "--event-bg-mask-stop-6": `${activeValues.maskStops[5]}%`,
      "--event-bg-mask-alpha-1": `${activeValues.maskAlphas[0]}`,
      "--event-bg-mask-alpha-2": `${activeValues.maskAlphas[1]}`,
      "--event-bg-mask-alpha-3": `${activeValues.maskAlphas[2]}`,
      "--event-bg-mask-alpha-4": `${activeValues.maskAlphas[3]}`,
      "--event-bg-mask-alpha-5": `${activeValues.maskAlphas[4]}`,
      "--event-bg-mask-alpha-6": `${activeValues.maskAlphas[5]}`,
      "--event-bg-overlay-top": `${activeValues.overlayTop}`,
      "--event-bg-overlay-mid": `${activeValues.overlayMid}`,
      "--event-bg-overlay-bottom": `${activeValues.overlayBottom}`,
      "--event-bg-fade-start": `${activeValues.fadeStart}%`,
      "--event-bg-fade-mid": `${activeValues.fadeMid}%`,
      "--event-bg-fade-end": `${activeValues.fadeEnd}%`,
      "--event-bg-fade-dark": `${activeValues.fadeDark}`,
    }),
    [activeValues],
  );

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;
    Object.entries(cssVars).forEach(([key, value]) => {
      target.style.setProperty(key, value);
    });
  }, [targetId, cssVars]);

  if (!enabled) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[60] w-[260px] rounded-2xl border border-white/15 bg-black/70 p-4 text-white shadow-[0_20px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">
        Background presets
      </p>
      <p className="text-sm font-semibold">Evento</p>
      <div className="mt-4 grid gap-2">
        {PRESET_OPTIONS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => setActivePreset(preset.key)}
            className={`rounded-xl border px-3 py-2 text-left text-[12px] font-semibold transition ${
              activePreset === preset.key
                ? "border-white/40 bg-white/15 text-white shadow-[0_0_20px_rgba(255,255,255,0.12)]"
                : "border-white/15 bg-white/5 text-white/70 hover:border-white/30 hover:bg-white/10"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
