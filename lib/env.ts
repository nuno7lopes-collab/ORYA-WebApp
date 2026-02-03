import "server-only";
// Central helper for server-side environment variables (server-only).
// ⚠️ Não importar este módulo em componentes com "use client".
const required = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE",
  "DATABASE_URL",
  "QR_SECRET_KEY",
  "RESEND_API_KEY",
] as const;

type EnvKey = (typeof required)[number];

const isTestRuntime =
  process.env.NODE_ENV === "test" ||
  process.env.ORIGINAL_NODE_ENV === "test" ||
  process.env.VITEST === "true" ||
  typeof process.env.VITEST_WORKER_ID === "string";
const isBuildRuntime = process.env.NEXT_PHASE === "phase-production-build";

const testFallbacks: Partial<Record<EnvKey, string>> = {
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_ANON_KEY: "test-anon-key",
  SUPABASE_SERVICE_ROLE: "test-service-role-key",
  DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres?sslmode=disable",
  QR_SECRET_KEY: "test-qr-secret",
  RESEND_API_KEY: "test-resend-key",
};

function getEnv(key: EnvKey, fallbackKeys: string[] = []): string {
  const value = process.env[key];
  if (value) return value;

  for (const fallbackKey of fallbackKeys) {
    const fallbackValue = process.env[fallbackKey];
    if (fallbackValue) return fallbackValue;
  }

  if (isTestRuntime || isBuildRuntime) {
    const fallback = testFallbacks[key];
    if (fallback) return fallback;
  }

  if (fallbackKeys.length > 0) {
    throw new Error(
      `Missing env var: ${key} (or ${fallbackKeys.join(", ")})`
    );
  }

  throw new Error(`Missing env var: ${key}`);
}

function sanitizePgUrl(raw: string) {
  try {
    const parsed = new URL(raw);
    // Remove unsupported startup params (e.g. options) for Prisma/pg adapters
    if (parsed.searchParams.has("options")) {
      parsed.searchParams.delete("options");
      return parsed.toString();
    }
  } catch {
    // ignore parse errors, return raw
  }
  return raw;
}

function getOptionalUrlEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim().replace(/\/+$/, ""); // remove trailing slash para URLs previsíveis
    }
  }
  return "";
}

function parseBoolean(raw: unknown, fallback: boolean) {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
}

function parseNumber(raw: unknown, fallback: number) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  supabaseUrl: getEnv("SUPABASE_URL", ["NEXT_PUBLIC_SUPABASE_URL"]),
  supabaseAnonKey: getEnv("SUPABASE_ANON_KEY", ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]),
  serviceRoleKey: getEnv("SUPABASE_SERVICE_ROLE"),
  supabaseCookieDomain:
    process.env.SUPABASE_COOKIE_DOMAIN ??
    process.env.AUTH_COOKIE_DOMAIN ??
    process.env.NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN ??
    "",
  dbUrl: sanitizePgUrl(getEnv("DATABASE_URL")),
  qrSecretKey: getEnv("QR_SECRET_KEY"),
  resendApiKey: getEnv("RESEND_API_KEY"),
  resendFrom:
    process.env.RESEND_FROM ??
    process.env.RESEND_FROM_EMAIL ??
    "no-reply@orya.pt",
  appBaseUrl: getOptionalUrlEnv(
    "APP_BASE_URL",
    "NEXT_PUBLIC_BASE_URL",
    "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_APP_URL",
    "SITE_URL",
  ),
  uploadsBucket:
    process.env.SUPABASE_STORAGE_BUCKET_UPLOADS ??
    process.env.SUPABASE_STORAGE_BUCKET ??
    "uploads",
  avatarsBucket: process.env.SUPABASE_STORAGE_BUCKET_AVATARS ?? "",
  eventCoversBucket: process.env.SUPABASE_STORAGE_BUCKET_EVENT_COVERS ?? "",
  storageSignedUrls: parseBoolean(process.env.SUPABASE_STORAGE_SIGNED_URLS, false),
  storageSignedTtlSeconds: parseNumber(process.env.SUPABASE_STORAGE_SIGNED_TTL_SECONDS, 60 * 60 * 24 * 30), // 30 dias
  storeEnabled: parseBoolean(process.env.STORE_ENABLED, false),
};
