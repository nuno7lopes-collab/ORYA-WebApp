import "server-only";
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
] as const;

type EnvKey = (typeof required)[number];

function getEnv(key: EnvKey): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing env var: ${key}`);
  }
  return value;
}

export const env = {
  supabaseUrl: getEnv("SUPABASE_URL"),
  supabaseAnonKey: getEnv("SUPABASE_ANON_KEY"),
  serviceRoleKey: getEnv("SUPABASE_SERVICE_ROLE"),
  dbUrl: getEnv("DATABASE_URL"),
  stripeSecretKey: getEnv("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: getEnv("STRIPE_WEBHOOK_SECRET"),
  qrSecretKey: getEnv("QR_SECRET_KEY"),
};