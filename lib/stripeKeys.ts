import "server-only";
import { getAppEnv } from "@/lib/appEnv";
import { type AppEnv } from "@/lib/appEnvShared";

function requireValue(value: string | undefined, label: string): string {
  if (value && value.trim().length > 0) return value.trim();
  throw new Error(`Missing ${label} for current APP_ENV`);
}

function ensureStripeKeyMatchesEnv(key: string, env: "prod" | "test", label: string) {
  if (env === "test" && key.startsWith("sk_live")) {
    throw new Error(`${label} is live but APP_ENV=test`);
  }
  if (env === "prod" && key.startsWith("sk_test")) {
    throw new Error(`${label} is test but APP_ENV=prod`);
  }
}

export function getStripeSecretKeyForEnv(env: AppEnv) {
  const live = process.env.STRIPE_SECRET_KEY_LIVE || process.env.STRIPE_SECRET_KEY;
  const test = process.env.STRIPE_SECRET_KEY_TEST || process.env.STRIPE_SECRET_KEY;
  const value = env === "test" ? requireValue(test, "STRIPE_SECRET_KEY_TEST") : requireValue(live, "STRIPE_SECRET_KEY_LIVE");
  ensureStripeKeyMatchesEnv(value, env, "STRIPE_SECRET_KEY");
  return value;
}

export function getStripeSecretKey() {
  return getStripeSecretKeyForEnv(getAppEnv());
}

export function getStripeWebhookSecret() {
  const env = getAppEnv();
  const live = process.env.STRIPE_WEBHOOK_SECRET_LIVE || process.env.STRIPE_WEBHOOK_SECRET;
  const test = process.env.STRIPE_WEBHOOK_SECRET_TEST || process.env.STRIPE_WEBHOOK_SECRET;
  const value = env === "test" ? requireValue(test, "STRIPE_WEBHOOK_SECRET_TEST") : requireValue(live, "STRIPE_WEBHOOK_SECRET_LIVE");
  return value;
}

export function getStripePayoutsWebhookSecret() {
  const env = getAppEnv();
  const live = process.env.STRIPE_PAYOUTS_WEBHOOK_SECRET_LIVE || process.env.STRIPE_PAYOUTS_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
  const test = process.env.STRIPE_PAYOUTS_WEBHOOK_SECRET_TEST || process.env.STRIPE_PAYOUTS_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
  const value = env === "test" ? requireValue(test, "STRIPE_PAYOUTS_WEBHOOK_SECRET_TEST") : requireValue(live, "STRIPE_PAYOUTS_WEBHOOK_SECRET_LIVE");
  return value;
}
