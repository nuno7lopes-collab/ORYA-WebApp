export const PUBLIC_PROFILE_MODULES = [
  "SERVICOS",
  "AGENDA",
  "FORMULARIOS",
  "AVALIACOES",
  "SOBRE",
  "LOJA",
] as const;

export type PublicProfileModuleType = (typeof PUBLIC_PROFILE_MODULES)[number];

export const PUBLIC_PROFILE_DEFAULT_ORDER: PublicProfileModuleType[] = [
  "SERVICOS",
  "AGENDA",
  "FORMULARIOS",
  "AVALIACOES",
  "SOBRE",
  "LOJA",
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
  version: 1;
  modules: PublicProfileModuleConfig[];
};

const DEFAULT_LAYOUT: PublicProfileLayout = {
  version: 1,
  modules: [
    {
      id: "SERVICOS",
      type: "SERVICOS",
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
      id: "AGENDA",
      type: "AGENDA",
      enabled: true,
      width: "full",
      settings: { showSpotlight: true },
    },
    {
      id: "FORMULARIOS",
      type: "FORMULARIOS",
      enabled: true,
      width: "half",
      settings: { ctaLabel: "Responder" },
    },
    {
      id: "AVALIACOES",
      type: "AVALIACOES",
      enabled: true,
      width: "half",
      settings: { maxItems: 8 },
    },
    { id: "SOBRE", type: "SOBRE", enabled: true, width: "half" },
    { id: "LOJA", type: "LOJA", enabled: false, width: "half" },
  ],
};

const moduleSet = new Set<PublicProfileModuleType>(PUBLIC_PROFILE_MODULES);
const defaultModuleByType = new Map<PublicProfileModuleType, PublicProfileModuleConfig>(
  DEFAULT_LAYOUT.modules.map((module) => [module.type, module]),
);

function cloneModule(module: PublicProfileModuleConfig): PublicProfileModuleConfig {
  return {
    id: module.id,
    type: module.type,
    enabled: module.enabled,
    width: module.width,
    settings: module.settings ? { ...module.settings } : undefined,
  };
}

export function getDefaultPublicProfileLayout(): PublicProfileLayout {
  return {
    version: 1,
    modules: DEFAULT_LAYOUT.modules.map((module) => cloneModule(module)),
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
    id: "reservas",
    title: "Reservas primeiro",
    description: "Servicos em destaque, agenda logo a seguir.",
    modules: [
      { type: "SERVICOS", width: "full" },
      { type: "AGENDA", width: "full" },
      { type: "FORMULARIOS", width: "half" },
      { type: "AVALIACOES", width: "half" },
      { type: "SOBRE", width: "half" },
      { type: "LOJA", width: "half", enabled: false },
    ],
  },
  {
    id: "eventos",
    title: "Eventos primeiro",
    description: "Agenda em primeiro lugar para organizadores.",
    modules: [
      { type: "AGENDA", width: "full" },
      { type: "SERVICOS", width: "full" },
      { type: "FORMULARIOS", width: "half" },
      { type: "AVALIACOES", width: "half" },
      { type: "SOBRE", width: "half" },
      { type: "LOJA", width: "half", enabled: false },
    ],
  },
  {
    id: "comunidade",
    title: "Comunidade",
    description: "Foco em avaliacoes e prova social.",
    modules: [
      { type: "AVALIACOES", width: "full" },
      { type: "SERVICOS", width: "full" },
      { type: "AGENDA", width: "full" },
      { type: "SOBRE", width: "half" },
      { type: "FORMULARIOS", width: "half" },
      { type: "LOJA", width: "half", enabled: false },
    ],
  },
  {
    id: "premium",
    title: "Premium",
    description: "Layout completo com destaque para servicos e agenda.",
    modules: [
      { type: "SERVICOS", width: "full" },
      { type: "AGENDA", width: "full" },
      { type: "AVALIACOES", width: "full" },
      { type: "FORMULARIOS", width: "half" },
      { type: "SOBRE", width: "half" },
      { type: "LOJA", width: "half", enabled: false },
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
      throw new Error(`Template inválido: ${entry.type}`);
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

function sanitizeServiceSettings(
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

function sanitizeAgendaSettings(
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

function sanitizeReviewsSettings(
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
  if (type === "SERVICOS") {
    return sanitizeServiceSettings(raw, fallback);
  }
  if (type === "AGENDA") {
    return sanitizeAgendaSettings(raw, fallback);
  }
  if (type === "FORMULARIOS") {
    return sanitizeFormsSettings(raw, fallback);
  }
  if (type === "AVALIACOES") {
    return sanitizeReviewsSettings(raw, fallback);
  }
  return fallback ? { ...fallback } : undefined;
}

function normalizeModule(raw: unknown): PublicProfileModuleConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const typeRaw = typeof record.type === "string" ? record.type.trim().toUpperCase() : "";
  if (!typeRaw || !moduleSet.has(typeRaw as PublicProfileModuleType)) return null;
  const type = typeRaw as PublicProfileModuleType;
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
    const module = normalizeModule(entry);
    if (!module) continue;
    if (seen.has(module.type)) continue;
    normalized.push(module);
    seen.add(module.type);
  }

  if (normalized.length === 0) return null;
  return { version: 1, modules: normalized };
}

export function mergeLayoutWithDefaults(layout: PublicProfileLayout): PublicProfileLayout {
  const normalized = layout.modules.map((module) => {
    const defaults = defaultModuleByType.get(module.type);
    const settings = sanitizeModuleSettings(module.type, module.settings, defaults?.settings);
    return {
      ...module,
      id: defaults?.id ?? module.id,
      enabled: typeof module.enabled === "boolean" ? module.enabled : defaults?.enabled ?? true,
      width: module.width ?? defaults?.width ?? "half",
      ...(settings ? { settings } : {}),
    };
  });

  const existingTypes = new Set(normalized.map((module) => module.type));
  const missingDefaults = DEFAULT_LAYOUT.modules.filter((module) => !existingTypes.has(module.type));

  return {
    version: 1,
    modules: [...normalized, ...missingDefaults.map((module) => cloneModule(module))],
  };
}

export function ensurePublicProfileLayout(value: unknown): PublicProfileLayout {
  const sanitized = sanitizePublicProfileLayout(value);
  return mergeLayoutWithDefaults(sanitized ?? getDefaultPublicProfileLayout());
}
