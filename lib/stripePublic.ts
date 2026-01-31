"use client";

import { getClientAppEnv } from "@/lib/appEnvClient";

function normalizeKey(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function getStripePublishableKey(): string {
  const env = getClientAppEnv();
  const live = normalizeKey(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  const test = normalizeKey(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  const value = env === "test" ? test : live;
  if (!value) {
    throw new Error("Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY for current APP_ENV");
  }
  if (env === "test" && value.startsWith("pk_live")) {
    throw new Error("Publishable key is live but APP_ENV=test");
  }
  if (env === "prod" && value.startsWith("pk_test")) {
    throw new Error("Publishable key is test but APP_ENV=prod");
  }
  return value;
}
