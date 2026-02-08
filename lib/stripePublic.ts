"use client";

import { getClientAppEnv } from "@/lib/appEnvClient";
import { normalizeAppEnv } from "@/lib/appEnvShared";

function normalizeKey(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function getStripePublishableKey(): string {
  const override = normalizeAppEnv(process.env.NEXT_PUBLIC_STRIPE_MODE ?? process.env.NEXT_PUBLIC_STRIPE_ENV ?? null);
  const env = override ?? getClientAppEnv();
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
