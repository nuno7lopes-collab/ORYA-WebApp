"use client";

import { isTruthyEnvFlag, normalizeAppEnv, resolveEnvFromHost, type AppEnv } from "@/lib/appEnvShared";

export function getClientAppEnv(): AppEnv {
  const singleDb = isTruthyEnvFlag(
    process.env.NEXT_PUBLIC_SINGLE_DB_MODE ??
      process.env.SINGLE_DB_MODE ??
      null,
  );
  if (singleDb) return "prod";

  const override = normalizeAppEnv(process.env.NEXT_PUBLIC_APP_ENV ?? null);
  if (override) return override;

  if (typeof window !== "undefined") {
    return resolveEnvFromHost(window.location.hostname);
  }
  return "prod";
}
