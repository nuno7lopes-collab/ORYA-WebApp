export const PUBLIC_PROFILE_MODULES = [
  "HERO",
  "ABOUT",
  "EVENTS_AGENDA",
  "STORE",
  "SERVICES",
  "FORMS",
  "GALLERY",
  "FAQ",
  "CONTACT",
] as const;

export type PublicProfileModuleType = (typeof PUBLIC_PROFILE_MODULES)[number];

export const PUBLIC_PROFILE_DEFAULT_ORDER: PublicProfileModuleType[] = [
  "HERO",
  "ABOUT",
  "EVENTS_AGENDA",
  "STORE",
  "SERVICES",
  "FORMS",
  "GALLERY",
  "FAQ",
  "CONTACT",
];

export type PublicProfileModuleWidth = "half" | "full";

export type PublicProfileModuleConfig = {
  id: string;
  type: PublicProfileModuleType;
  enabled: boolean;
  width: PublicProfileModuleWidth;
  settings?: Record<string, unknown>;
};

export type PublicProfileLayout = {
  version: 2;
  modules: PublicProfileModuleConfig[];
};

const LEGACY_TO_CANONICAL: Record<string, PublicProfileModuleType> = {
  SERVICOS: "SERVICES",
  AGENDA: "EVENTS_AGENDA",
  FORMULARIOS: "FORMS",
  AVALIACOES: "GALLERY",
  SOBRE: "ABOUT",
  LOJA: "STORE",
};

const DEFAULT_LAYOUT: PublicProfileLayout = {
  version: 2,
  modules: [
    { id: "HERO", type: "HERO", enabled: true, width: "full" },
    { id: "ABOUT", type: "ABOUT", enabled: true, width: "full" },
    {
      id: "EVENTS_AGENDA",
      type: "EVENTS_AGENDA",
      enabled: true,
      width: "full",
      settings: { showSpotlight: true },
    },
    { id: "STORE", type: "STORE", enabled: false, width: "full" },
    {
      id: "SERVICES",
      type: "SERVICES",
      enabled: true,
      width: "full",
      settings: {
        carouselEnabled: true,
        featuredServiceIds: [],
        ctaLabel: "Agendar",
        ctaHref: "#reservar",
        showStats: true,
      },
    },
    {
      id: "FORMS",
      type: "FORMS",
      enabled: true,
      width: "half",
      settings: { ctaLabel: "Responder" },
    },
    {
      id: "GALLERY",
      type: "GALLERY",
      enabled: true,
      width: "half",
      settings: { maxItems: 8 },
    },
    { id: "FAQ", type: "FAQ", enabled: true, width: "half" },
    { id: "CONTACT", type: "CONTACT", enabled: true, width: "half" },
  ],
};

const moduleSet = new Set<PublicProfileModuleType>(PUBLIC_PROFILE_MODULES);
const defaultModuleByType = new Map<PublicProfileModuleType, PublicProfileModuleConfig>(
  DEFAULT_LAYOUT.modules.map((moduleItem) => [moduleItem.type, moduleItem]),
);

function cloneModule(moduleItem: PublicProfileModuleConfig): PublicProfileModuleConfig {
  return {
    id: moduleItem.id,
    type: moduleItem.type,
    enabled: moduleItem.enabled,
    width: moduleItem.width,
    settings: moduleItem.settings ? { ...moduleItem.settings } : undefined,
  };
}

export function getDefaultPublicProfileLayout(): PublicProfileLayout {
  return {
    version: 2,
    modules: DEFAULT_LAYOUT.modules.map((moduleItem) => cloneModule(moduleItem)),
  };
}

type PublicProfileTemplate = {
  id: string;
  title: string;
  description: string;
  modules: PublicProfileModuleConfig[];
};

const TEMPLATE_SPECS: Array<{
  id: string;
  title: string;
  description: string;
  modules: Array<{
    type: PublicProfileModuleType;
    width?: PublicProfileModuleWidth;
    enabled?: boolean;
  }>;
}> = [
  {
    id: "events-first",
    title: "Eventos primeiro",
    description: "Destaca agenda, hero e informacao publica.",
    modules: [
      { type: "HERO", width: "full" },
      { type: "EVENTS_AGENDA", width: "full" },
      { type: "ABOUT", width: "full" },
      { type: "SERVICES", width: "full" },
      { type: "FORMS", width: "half" },
      { type: "GALLERY", width: "half" },
      { type: "STORE", width: "full", enabled: false },
      { type: "FAQ", width: "half" },
      { type: "CONTACT", width: "half" },
    ],
  },
  {
    id: "services-first",
    title: "Servicos primeiro",
    description: "Foco em reservas e conversao.",
    modules: [
      { type: "HERO", width: "full" },
      { type: "SERVICES", width: "full" },
      { type: "EVENTS_AGENDA", width: "full" },
      { type: "STORE", width: "full", enabled: false },
      { type: "ABOUT", width: "full" },
      { type: "FORMS", width: "half" },
      { type: "GALLERY", width: "half" },
      { type: "FAQ", width: "half" },
      { type: "CONTACT", width: "half" },
    ],
  },
  {
    id: "store-first",
    title: "Loja primeiro",
    description: "Destaca catalogo e CTA comercial.",
    modules: [
      { type: "HERO", width: "full" },
      { type: "STORE", width: "full", enabled: true },
      { type: "ABOUT", width: "full" },
      { type: "SERVICES", width: "full" },
      { type: "EVENTS_AGENDA", width: "full" },
      { type: "FORMS", width: "half" },
      { type: "GALLERY", width: "half" },
      { type: "FAQ", width: "half" },
      { type: "CONTACT", width: "half" },
    ],
  },
];

export const PUBLIC_PROFILE_TEMPLATES: PublicProfileTemplate[] = TEMPLATE_SPECS.map((template) => ({
  id: template.id,
  title: template.title,
  description: template.description,
  modules: template.modules.map((entry) => {
    const base = defaultModuleByType.get(entry.type);
    if (!base) {
      throw new Error(`Template invalido: ${entry.type}`);
    }
    return {
      ...cloneModule(base),
      width: entry.width ?? base.width,
      enabled: typeof entry.enabled === "boolean" ? entry.enabled : base.enabled,
    };
  }),
}));

function sanitizeString(raw: unknown, fallback?: string): string | undefined {
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function sanitizeBoolean(raw: unknown, fallback?: boolean): boolean {
  if (typeof raw === "boolean") return raw;
  return typeof fallback === "boolean" ? fallback : false;
}

function sanitizeNumber(raw: unknown, fallback: number, min: number, max: number): number {
  const num = Number(raw);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(num)));
}

function sanitizeServicesSettings(
  raw: unknown,
  fallback?: Record<string, unknown>,
): Record<string, unknown> {
  const baseFeatured = Array.isArray(fallback?.featuredServiceIds)
    ? fallback?.featuredServiceIds
    : [];
  const featuredRaw = (raw as Record<string, unknown> | null)?.featuredServiceIds;
  const featuredServiceIds = Array.isArray(featuredRaw)
    ? featuredRaw
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id))
    : baseFeatured;
  const carouselEnabledRaw = (raw as Record<string, unknown> | null)?.carouselEnabled;
  const carouselEnabled =
    typeof carouselEnabledRaw === "boolean"
      ? carouselEnabledRaw
      : (fallback?.carouselEnabled as boolean | undefined) ?? true;
  const ctaLabel = sanitizeString(
    (raw as Record<string, unknown> | null)?.ctaLabel,
    (fallback?.ctaLabel as string | undefined) ?? "Agendar",
  );
  const ctaHref = sanitizeString(
    (raw as Record<string, unknown> | null)?.ctaHref,
    (fallback?.ctaHref as string | undefined) ?? "#reservar",
  );
  const showStats = sanitizeBoolean(
    (raw as Record<string, unknown> | null)?.showStats,
    (fallback?.showStats as boolean | undefined) ?? true,
  );

  return {
    featuredServiceIds,
    carouselEnabled,
    ctaLabel,
    ctaHref,
    showStats,
  };
}

function sanitizeEventsAgendaSettings(
  raw: unknown,
  fallback?: Record<string, unknown>,
): Record<string, unknown> {
  const showSpotlight = sanitizeBoolean(
    (raw as Record<string, unknown> | null)?.showSpotlight,
    (fallback?.showSpotlight as boolean | undefined) ?? true,
  );
  return { showSpotlight };
}

function sanitizeFormsSettings(
  raw: unknown,
  fallback?: Record<string, unknown>,
): Record<string, unknown> {
  const ctaLabel = sanitizeString(
    (raw as Record<string, unknown> | null)?.ctaLabel,
    (fallback?.ctaLabel as string | undefined) ?? "Responder",
  );
  return { ctaLabel };
}

function sanitizeGallerySettings(
  raw: unknown,
  fallback?: Record<string, unknown>,
): Record<string, unknown> {
  const fallbackMaxItems = Number(fallback?.maxItems ?? 8);
  const rawMaxItems = (raw as Record<string, unknown> | null)?.maxItems;
  const maxItems = sanitizeNumber(rawMaxItems, fallbackMaxItems, 1, 12);
  return { maxItems };
}

function sanitizeModuleSettings(
  type: PublicProfileModuleType,
  raw: unknown,
  fallback?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (type === "SERVICES") {
    return sanitizeServicesSettings(raw, fallback);
  }
  if (type === "EVENTS_AGENDA") {
    return sanitizeEventsAgendaSettings(raw, fallback);
  }
  if (type === "FORMS") {
    return sanitizeFormsSettings(raw, fallback);
  }
  if (type === "GALLERY") {
    return sanitizeGallerySettings(raw, fallback);
  }
  return fallback ? { ...fallback } : undefined;
}

function normalizeModuleType(rawType: unknown): PublicProfileModuleType | null {
  if (typeof rawType !== "string") return null;
  const normalized = rawType.trim().toUpperCase();
  if (!normalized) return null;
  const canonical = LEGACY_TO_CANONICAL[normalized] ?? normalized;
  if (!moduleSet.has(canonical as PublicProfileModuleType)) return null;
  return canonical as PublicProfileModuleType;
}

function normalizeModule(raw: unknown): PublicProfileModuleConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const type = normalizeModuleType(record.type);
  if (!type) return null;

  const defaults = defaultModuleByType.get(type);
  const enabled = typeof record.enabled === "boolean" ? record.enabled : defaults?.enabled ?? true;
  const widthRaw = record.width;
  const width: PublicProfileModuleWidth =
    widthRaw === "full" || widthRaw === "half" ? widthRaw : defaults?.width ?? "half";
  const settings = sanitizeModuleSettings(type, record.settings, defaults?.settings);

  return {
    id: defaults?.id ?? type,
    type,
    enabled,
    width,
    ...(settings ? { settings } : {}),
  };
}

export function sanitizePublicProfileLayout(value: unknown): PublicProfileLayout | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const modulesRaw = record.modules;
  if (!Array.isArray(modulesRaw)) return null;

  const normalized: PublicProfileModuleConfig[] = [];
  const seen = new Set<PublicProfileModuleType>();
  for (const entry of modulesRaw) {
    const moduleItem = normalizeModule(entry);
    if (!moduleItem) continue;
    if (seen.has(moduleItem.type)) continue;
    normalized.push(moduleItem);
    seen.add(moduleItem.type);
  }

  if (normalized.length === 0) return null;
  return { version: 2, modules: normalized };
}

export function mergeLayoutWithDefaults(layout: PublicProfileLayout): PublicProfileLayout {
  const normalized = layout.modules.map((moduleItem) => {
    const defaults = defaultModuleByType.get(moduleItem.type);
    const settings = sanitizeModuleSettings(moduleItem.type, moduleItem.settings, defaults?.settings);
    return {
      ...moduleItem,
      id: defaults?.id ?? moduleItem.id,
      enabled: typeof moduleItem.enabled === "boolean" ? moduleItem.enabled : defaults?.enabled ?? true,
      width: moduleItem.width ?? defaults?.width ?? "half",
      ...(settings ? { settings } : {}),
    };
  });

  const existingTypes = new Set(normalized.map((moduleItem) => moduleItem.type));
  const missingDefaults = DEFAULT_LAYOUT.modules.filter((moduleItem) => !existingTypes.has(moduleItem.type));

  return {
    version: 2,
    modules: [...normalized, ...missingDefaults.map((moduleItem) => cloneModule(moduleItem))],
  };
}

export function ensurePublicProfileLayout(value: unknown): PublicProfileLayout {
  const sanitized = sanitizePublicProfileLayout(value);
  return mergeLayoutWithDefaults(sanitized ?? getDefaultPublicProfileLayout());
}
