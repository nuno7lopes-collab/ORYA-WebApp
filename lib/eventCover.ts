import { optimizeImageUrl } from "@/lib/image";
import { REAL_COVER_LIBRARY, type CoverLibraryEntry } from "@/lib/coverLibrary";

type CoverTheme = {
  id: string;
  label: string;
  base: [string, string, string];
  glows: [string, string, string];
};

const COVER_THEMES: CoverTheme[] = [
  {
    id: "neon",
    label: "Neon",
    base: ["#0b0f19", "#0b1224", "#05060b"],
    glows: ["#ff00c8", "#6bffff", "#1646f5"],
  },
  {
    id: "aurora",
    label: "Aurora",
    base: ["#061019", "#0b1b2d", "#05070f"],
    glows: ["#6bffff", "#7c8cff", "#ff72d0"],
  },
  {
    id: "ember",
    label: "Ember",
    base: ["#151006", "#24120b", "#0b0506"],
    glows: ["#ff7a18", "#ff00c8", "#ffd166"],
  },
  {
    id: "mint",
    label: "Mint",
    base: ["#08151a", "#0f1f1a", "#05070a"],
    glows: ["#6bffff", "#4ade80", "#38bdf8"],
  },
  {
    id: "violet",
    label: "Violet",
    base: ["#0f0b1f", "#1a0f2e", "#08060f"],
    glows: ["#9c72ff", "#ff00c8", "#6bffff"],
  },
  {
    id: "sunset",
    label: "Sunset",
    base: ["#1a0b0d", "#2a0f1a", "#07050a"],
    glows: ["#ff00c8", "#f97316", "#fcd34d"],
  },
  {
    id: "royal",
    label: "Royal",
    base: ["#080b1a", "#0b1030", "#05060a"],
    glows: ["#1646f5", "#6bffff", "#9c72ff"],
  },
  {
    id: "midnight",
    label: "Midnight",
    base: ["#05070d", "#080b16", "#030407"],
    glows: ["#6bffff", "#ff00c8", "#1e40af"],
  },
];

const COVER_TOKEN_PREFIX = "orya-cover:";

const buildCoverSvg = (theme: CoverTheme) => {
  const [baseStart, baseMid, baseEnd] = theme.base;
  const [glowA, glowB, glowC] = theme.glows;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <defs>
    <linearGradient id="bg" x1="15%" y1="0%" x2="85%" y2="100%">
      <stop offset="0%" stop-color="${baseStart}"/>
      <stop offset="50%" stop-color="${baseMid}"/>
      <stop offset="100%" stop-color="${baseEnd}"/>
    </linearGradient>
    <radialGradient id="glow1" cx="20%" cy="26%" r="36%">
      <stop offset="0%" stop-color="${glowA}" stop-opacity="0.35"/>
      <stop offset="70%" stop-color="${glowA}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="80%" cy="22%" r="32%">
      <stop offset="0%" stop-color="${glowB}" stop-opacity="0.32"/>
      <stop offset="70%" stop-color="${glowB}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow3" cx="52%" cy="82%" r="42%">
      <stop offset="0%" stop-color="${glowC}" stop-opacity="0.28"/>
      <stop offset="70%" stop-color="${glowC}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="glass" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.08)"/>
      <stop offset="42%" stop-color="rgba(255,255,255,0.02)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0.08)"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.12)"/>
      <stop offset="20%" stop-color="rgba(255,255,255,0.03)"/>
      <stop offset="50%" stop-color="rgba(255,255,255,0.1)"/>
      <stop offset="78%" stop-color="rgba(255,255,255,0.03)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0.14)"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="1200" fill="url(#bg)"/>
  <rect width="1200" height="1200" fill="url(#glow1)"/>
  <rect width="1200" height="1200" fill="url(#glow2)"/>
  <rect width="1200" height="1200" fill="url(#glow3)"/>

  <rect x="120" y="120" width="960" height="960" rx="44" fill="url(#glass)" stroke="rgba(255,255,255,0.12)" stroke-width="2"/>
  <rect x="90" y="90" width="1020" height="1020" fill="url(#sheen)" opacity="0.45"/>

  <g opacity="0.12" stroke="rgba(255,255,255,0.24)" stroke-width="1">
    <path d="M100 300 Q460 220 820 300 T1100 300"/>
    <path d="M90 520 Q470 470 840 540 T1120 520"/>
    <path d="M80 760 Q460 720 840 790 T1120 780"/>
  </g>

  <g opacity="0.32" stroke="rgba(255,255,255,0.18)" stroke-width="1.3" fill="none">
    <circle cx="320" cy="320" r="52"/>
    <circle cx="920" cy="280" r="44"/>
    <circle cx="860" cy="760" r="50"/>
  </g>
</svg>`;
};

type CoverLibraryItem = {
  id: string;
  label: string;
  url: string;
  thumbUrl?: string;
  category?: CoverLibraryEntry["category"];
  tags?: string[];
};

const BUILTIN_COVER_LIBRARY: CoverLibraryItem[] = COVER_THEMES.map((theme) => ({
  id: theme.id,
  label: theme.label,
  url: `data:image/svg+xml;utf8,${encodeURIComponent(buildCoverSvg(theme))}`,
  thumbUrl: `data:image/svg+xml;utf8,${encodeURIComponent(buildCoverSvg(theme))}`,
}));

const REAL_COVER_LIBRARY_MAPPED: CoverLibraryItem[] = REAL_COVER_LIBRARY.map((cover) => ({
  id: cover.id,
  label: cover.label,
  url: cover.imageUrl,
  thumbUrl: cover.thumbUrl ?? cover.imageUrl,
  category: cover.category,
  tags: cover.tags,
}));

const COVER_LIBRARY = REAL_COVER_LIBRARY_MAPPED.length > 0 ? REAL_COVER_LIBRARY_MAPPED : BUILTIN_COVER_LIBRARY;
const DEFAULT_COVER = COVER_LIBRARY[0]?.url ?? "";

function getCoverById(id?: string | null) {
  if (!id) return null;
  return COVER_LIBRARY.find((theme) => theme.id === id) ?? null;
}

export function getEventCoverToken(id: string) {
  return `${COVER_TOKEN_PREFIX}${id}`;
}

export function parseEventCoverToken(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith(COVER_TOKEN_PREFIX)) return null;
  const id = trimmed.slice(COVER_TOKEN_PREFIX.length).trim();
  return id || null;
}

function hashSeed(seed: string | number) {
  const input = String(seed);
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getEventCoverFallback(seed?: string | number | null) {
  if (!seed) return DEFAULT_COVER;
  if (typeof seed === "string") {
    const tokenId = parseEventCoverToken(seed);
    const direct = getCoverById(tokenId ?? seed);
    if (direct) return direct.url;
  }
  const index = hashSeed(seed) % COVER_LIBRARY.length;
  return COVER_LIBRARY[index]?.url ?? DEFAULT_COVER;
}

type CoverUrlOptions = {
  seed?: string | number | null;
  width?: number;
  quality?: number;
  format?: "webp" | "avif" | "auto";
  suggestedIds?: string[];
  square?: boolean;
};

export function getEventCoverUrl(
  coverImageUrl: string | null | undefined,
  options: CoverUrlOptions = {},
) {
  const trimmed = coverImageUrl?.trim();
  if (trimmed) {
    const tokenId = parseEventCoverToken(trimmed);
    if (tokenId) {
      return getEventCoverFallback(tokenId);
    }
    const targetWidth = options.width ?? 1200;
    const useSquare = options.square !== false;
    return (
      optimizeImageUrl(
        trimmed,
        targetWidth,
        options.quality ?? 72,
        options.format ?? "webp",
        useSquare ? targetWidth : undefined,
        useSquare ? "cover" : undefined,
      ) ||
      trimmed
    );
  }
  if (Array.isArray(options.suggestedIds) && options.suggestedIds.length > 0) {
    const index = hashSeed(options.seed ?? options.suggestedIds[0]) % options.suggestedIds.length;
    return getEventCoverFallback(options.suggestedIds[index]);
  }
  return getEventCoverFallback(options.seed);
}

export function listEventCoverFallbacks() {
  return COVER_LIBRARY.map((cover) => ({
    ...cover,
    thumbUrl: cover.thumbUrl ?? cover.url,
    token: getEventCoverToken(cover.id),
  }));
}

type CoverSuggestionInput = {
  templateType?: string | null;
  primaryModule?: string | null;
};

export function getEventCoverSuggestionIds(input: CoverSuggestionInput = {}) {
  const templateType = input.templateType ?? null;
  const primaryModule = typeof input.primaryModule === "string" ? input.primaryModule.trim().toUpperCase() : null;

  const pickTop = (items: CoverLibraryItem[]) =>
    items.slice(0, 4).map((item) => item.id);
  const byCategory = (category: CoverLibraryEntry["category"]) =>
    pickTop(COVER_LIBRARY.filter((item) => item.category === category));
  const fallback = pickTop(COVER_LIBRARY);

  if (templateType === "PADEL" || primaryModule === "TORNEIOS") {
    return byCategory("PADEL").length > 0 ? byCategory("PADEL") : fallback;
  }
  if (primaryModule === "RESERVAS") {
    return byCategory("RESERVAS").length > 0 ? byCategory("RESERVAS") : fallback;
  }
  return byCategory("EVENTOS").length > 0 ? byCategory("EVENTOS") : fallback;
}
