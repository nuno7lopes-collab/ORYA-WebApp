export type StripeMode = "test" | "prod";

const clean = (value: string | null | undefined) => value?.trim() ?? "";

export const normalizeStripeMode = (value: unknown): StripeMode | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "test" ||
    normalized === "testing" ||
    normalized === "staging" ||
    normalized === "dev" ||
    normalized === "development"
  ) {
    return "test";
  }
  if (normalized === "prod" || normalized === "production" || normalized === "live") return "prod";
  return null;
};

export const detectStripeModeFromPublishableKey = (
  key: string | null | undefined,
): StripeMode | null => {
  const normalized = clean(key);
  if (!normalized) return null;
  if (normalized.startsWith("pk_test")) return "test";
  if (normalized.startsWith("pk_live")) return "prod";
  return null;
};

export const resolveStripeRuntimeKey = (params: {
  runtimePublishableKey?: string | null;
  fallbackPublishableKey?: string | null;
}) => {
  const runtime = clean(params.runtimePublishableKey);
  if (runtime) return runtime;
  const fallback = clean(params.fallbackPublishableKey);
  return fallback || null;
};

export const stripeModeLabel = (mode: StripeMode | null) => {
  if (mode === "test") return "teste";
  if (mode === "prod") return "produção";
  return "desconhecido";
};
