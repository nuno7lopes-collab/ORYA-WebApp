// Central helper for server-side environment variables (server-only).
// ⚠️ Não importar este módulo em componentes com "use client".
const required = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE",
  "DATABASE_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "QR_SECRET_KEY",
  "RESEND_API_KEY",
] as const;

type EnvKey = (typeof required)[number];

function getEnv(key: EnvKey, fallbackKeys: string[] = []): string {
  const value = process.env[key];
  if (value) return value;

  for (const fallbackKey of fallbackKeys) {
    const fallbackValue = process.env[fallbackKey];
    if (fallbackValue) return fallbackValue;
  }

  if (fallbackKeys.length > 0) {
    throw new Error(
      `Missing env var: ${key} (or ${fallbackKeys.join(", ")})`
    );
  }

  throw new Error(`Missing env var: ${key}`);
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

function parseList(raw: unknown) {
  if (typeof raw !== "string") return [];
  return raw
    .split(/[,\s]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export const env = {
  supabaseUrl: getEnv("SUPABASE_URL", ["NEXT_PUBLIC_SUPABASE_URL"]),
  supabaseAnonKey: getEnv("SUPABASE_ANON_KEY", ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]),
  serviceRoleKey: getEnv("SUPABASE_SERVICE_ROLE"),
  dbUrl: getEnv("DATABASE_URL"),
  stripeSecretKey: getEnv("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: getEnv("STRIPE_WEBHOOK_SECRET"),
  qrSecretKey: getEnv("QR_SECRET_KEY"),
  resendApiKey: getEnv("RESEND_API_KEY"),
  resendFrom:
    process.env.RESEND_FROM ??
    process.env.RESEND_FROM_EMAIL ??
    "no-reply@orya.pt",
  appBaseUrl: getOptionalUrlEnv("APP_BASE_URL", "NEXT_PUBLIC_BASE_URL", "NEXT_PUBLIC_SITE_URL", "VERCEL_URL"),
  uploadsBucket:
    process.env.SUPABASE_STORAGE_BUCKET_UPLOADS ??
    process.env.SUPABASE_STORAGE_BUCKET ??
    "uploads",
  avatarsBucket: process.env.SUPABASE_STORAGE_BUCKET_AVATARS ?? "",
  eventCoversBucket: process.env.SUPABASE_STORAGE_BUCKET_EVENT_COVERS ?? "",
  storageSignedUrls: parseBoolean(process.env.SUPABASE_STORAGE_SIGNED_URLS, false),
  storageSignedTtlSeconds: parseNumber(process.env.SUPABASE_STORAGE_SIGNED_TTL_SECONDS, 60 * 60 * 24 * 30), // 30 dias
  stripePremiumPriceIds: parseList(process.env.STRIPE_PREMIUM_PRICE_IDS),
  stripePremiumProductIds: parseList(process.env.STRIPE_PREMIUM_PRODUCT_IDS),
};
