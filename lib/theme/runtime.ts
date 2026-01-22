"use client";

import { BACKGROUND_CATALOG } from "@/lib/theme/catalog";
import { REAL_COVER_LIBRARY } from "@/lib/coverLibrary";
import { listEventCoverFallbacks } from "@/lib/eventCover";

const LEGACY_THEME_STORAGE_KEY = "orya_theme_studio_v1";
export const THEME_STORAGE_KEY = "orya_theme_user_v1";
export const THEME_GUEST_STORAGE_KEY = `${THEME_STORAGE_KEY}:guest`;
const LIGHT_MODE_DISABLED = true;

export const getThemeStorageKey = (userId?: string | null) =>
  userId ? `${THEME_STORAGE_KEY}:${userId}` : THEME_GUEST_STORAGE_KEY;

const toRgbTuple = (value: string): string | null => {
  const raw = value.trim();
  if (!raw.startsWith("#")) return null;
  let hex = raw.slice(1);
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((chunk) => `${chunk}${chunk}`)
      .join("");
  }
  if (hex.length !== 6) return null;
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return `${r} ${g} ${b}`;
};

export type ThemePaletteValues = {
  text: string;
  muted: string;
  accent: string;
  accentAlt: string;
  buttonBg: string;
  buttonText: string;
  buttonBorder: string;
};

export type ThemeDraft = {
  mode: "system" | "cover";
  backgroundId: string;
  coverId: string | null;
  paletteId: string;
  customPalette: ThemePaletteValues;
  surfaceId: string;
  buttonPrimaryId: string;
  buttonSecondaryId: string;
  badgeId: string;
};

export type ThemeMode = "dark" | "light";

type CoverItem = {
  id: string;
  imageUrl: string;
};

const FALLBACK_COVERS: CoverItem[] = listEventCoverFallbacks().map((cover) => ({
  id: cover.id,
  imageUrl: cover.url,
}));

const COVER_MAP: Map<string, CoverItem> = (() => {
  const map = new Map<string, CoverItem>();
  REAL_COVER_LIBRARY.forEach((cover) => {
    map.set(cover.id, { id: cover.id, imageUrl: cover.imageUrl });
  });
  FALLBACK_COVERS.forEach((cover) => {
    if (!map.has(cover.id)) map.set(cover.id, cover);
  });
  return map;
})();

const COVER_OVERLAY =
  "linear-gradient(180deg, rgba(7, 9, 14, 0.35) 0%, rgba(4, 6, 10, 0.7) 55%, rgba(2, 3, 6, 0.92) 100%)";

const DARK_PALETTE: ThemePaletteValues = {
  text: "#FFFFFF",
  muted: "#D3DAED",
  accent: "#6BFFFF",
  accentAlt: "#FF7AD1",
  buttonBg: "#6BFFFF",
  buttonText: "#08131F",
  buttonBorder: "#6BFFFF",
};

const LIGHT_PALETTE: ThemePaletteValues = {
  text: "#0A0F1A",
  muted: "#2D3444",
  accent: "#6B7BFF",
  accentAlt: "#FF8AD1",
  buttonBg: "#6B7BFF",
  buttonText: "#FFFFFF",
  buttonBorder: "#8C99FF",
};

const DARK_THEME: ThemeDraft = {
  mode: "system",
  backgroundId: "orya-user",
  coverId: null,
  paletteId: "orya-neon",
  customPalette: DARK_PALETTE,
  surfaceId: "dashboard-card",
  buttonPrimaryId: "cta-primary",
  buttonSecondaryId: "cta-secondary",
  badgeId: "badge-neutral",
};

const LIGHT_THEME: ThemeDraft = {
  mode: "system",
  backgroundId: "orya-light",
  coverId: null,
  paletteId: "cloud-light",
  customPalette: LIGHT_PALETTE,
  surfaceId: "light-card",
  buttonPrimaryId: "cta-primary",
  buttonSecondaryId: "cta-secondary",
  badgeId: "badge-neutral",
};

const cloneThemeDraft = (theme: ThemeDraft): ThemeDraft => ({
  ...theme,
  customPalette: { ...theme.customPalette },
});

export const getThemeDraftForMode = (mode: ThemeMode): ThemeDraft =>
  cloneThemeDraft(mode === "light" ? LIGHT_THEME : DARK_THEME);

export const resolveThemeMode = (draft: ThemeDraft | null): ThemeMode => {
  if (!draft) return "dark";
  return draft.backgroundId === "orya-light" ? "light" : "dark";
};

export const readThemeDraft = (raw: string | null): ThemeDraft | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ThemeDraft>;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.mode !== "system" && parsed.mode !== "cover") return null;
    if (typeof parsed.backgroundId !== "string") return null;
    if (typeof parsed.paletteId !== "string") return null;
    if (!parsed.customPalette || typeof parsed.customPalette !== "object") return null;
    return {
      mode: parsed.mode,
      backgroundId: parsed.backgroundId,
      coverId: typeof parsed.coverId === "string" ? parsed.coverId : null,
      paletteId: parsed.paletteId,
      customPalette: {
        text: String(parsed.customPalette.text ?? ""),
        muted: String(parsed.customPalette.muted ?? ""),
        accent: String(parsed.customPalette.accent ?? ""),
        accentAlt: String(parsed.customPalette.accentAlt ?? ""),
        buttonBg: String(parsed.customPalette.buttonBg ?? ""),
        buttonText: String(parsed.customPalette.buttonText ?? ""),
        buttonBorder: String(parsed.customPalette.buttonBorder ?? ""),
      },
      surfaceId: String(parsed.surfaceId ?? ""),
      buttonPrimaryId: String(parsed.buttonPrimaryId ?? ""),
      buttonSecondaryId: String(parsed.buttonSecondaryId ?? ""),
      badgeId: String(parsed.badgeId ?? ""),
    };
  } catch {
    return null;
  }
};

export const loadThemeDraft = (userId?: string | null): ThemeDraft | null => {
  if (typeof window === "undefined") return null;
  const storageKey = getThemeStorageKey(userId);
  const stored = readThemeDraft(window.localStorage.getItem(storageKey));
  if (stored) return stored;
  if (userId) {
    const guestStored = readThemeDraft(window.localStorage.getItem(THEME_GUEST_STORAGE_KEY));
    if (guestStored) return guestStored;
  }
  const legacy = readThemeDraft(window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY));
  if (legacy) {
    window.localStorage.setItem(storageKey, JSON.stringify(legacy));
    return legacy;
  }
  return null;
};

export const saveThemeDraft = (theme: ThemeDraft, userId?: string | null) => {
  if (typeof window === "undefined") return;
  const storageKey = getThemeStorageKey(userId);
  window.localStorage.setItem(storageKey, JSON.stringify(theme));
  window.localStorage.setItem(THEME_GUEST_STORAGE_KEY, JSON.stringify(theme));
  dispatchThemeUpdate(theme);
};

export const clearThemeDraft = (userId?: string | null) => {
  if (typeof window === "undefined") return;
  const storageKey = getThemeStorageKey(userId);
  window.localStorage.removeItem(storageKey);
};

export const applyThemeToRoot = (theme: ThemeDraft, root?: HTMLElement) => {
  if (typeof document === "undefined") return;
  const target = root ?? document.documentElement;
  const resolvedTheme =
    LIGHT_MODE_DISABLED && theme.backgroundId === "orya-light"
      ? getThemeDraftForMode("dark")
      : theme;
  const isLight = resolvedTheme.backgroundId === "orya-light";
  const background =
    BACKGROUND_CATALOG.find((preset) => preset.id === resolvedTheme.backgroundId) ??
    BACKGROUND_CATALOG[0];

  let bgColor = background.color;
  let bgImage = background.image;
  let bgOverlay = background.overlay;
  let bgOverlayOpacity = background.overlayOpacity;

  if (resolvedTheme.mode === "cover" && resolvedTheme.coverId) {
    const cover = COVER_MAP.get(resolvedTheme.coverId);
    if (cover?.imageUrl) {
      bgColor = "#05060a";
      bgImage = `url(${cover.imageUrl})`;
      bgOverlay = COVER_OVERLAY;
      bgOverlayOpacity = 1;
    }
  }

  target.style.setProperty("--theme-bg-color", bgColor);
  target.style.setProperty("--theme-bg-image", bgImage);
  target.style.setProperty("--theme-bg-overlay", bgOverlay);
  target.style.setProperty("--theme-bg-overlay-opacity", String(bgOverlayOpacity));

  const palette = resolvedTheme.customPalette;
  target.style.setProperty("--theme-text", palette.text);
  target.style.setProperty("--theme-muted", palette.muted);
  target.style.setProperty("--theme-accent", palette.accent);
  target.style.setProperty("--theme-accent-alt", palette.accentAlt);
  target.style.setProperty("--theme-button-bg", palette.buttonBg);
  target.style.setProperty("--theme-button-text", palette.buttonText);
  target.style.setProperty("--theme-button-border", palette.buttonBorder);
  const textRgb = toRgbTuple(palette.text);
  const mutedRgb = toRgbTuple(palette.muted) ?? textRgb;
  if (textRgb) {
    target.style.setProperty("--theme-text-rgb", textRgb);
  }
  if (mutedRgb) {
    target.style.setProperty("--theme-muted-rgb", mutedRgb);
  }

  target.style.setProperty("--background", bgColor);
  target.style.setProperty("--foreground", palette.text);

  target.dataset.themeSurface = resolvedTheme.surfaceId || "";
  target.dataset.themeButtonPrimary = resolvedTheme.buttonPrimaryId || "";
  target.dataset.themeButtonSecondary = resolvedTheme.buttonSecondaryId || "";
  target.dataset.themeBadge = resolvedTheme.badgeId || "";
  const themeMode = isLight ? "light" : "dark";
  target.dataset.themeMode = themeMode;
  if (typeof document !== "undefined" && document.body) {
    document.body.dataset.themeMode = themeMode;
  }
};

export const dispatchThemeUpdate = (theme: ThemeDraft) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("orya-theme-updated", { detail: theme }));
};
