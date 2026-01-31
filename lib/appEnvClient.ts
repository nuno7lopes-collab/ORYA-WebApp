"use client";

import { normalizeAppEnv, resolveEnvFromHost, type AppEnv } from "@/lib/appEnvShared";

export function getClientAppEnv(): AppEnv {
  if (typeof window !== "undefined") {
    return resolveEnvFromHost(window.location.hostname);
  }
  const fallback = normalizeAppEnv(process.env.NEXT_PUBLIC_APP_ENV ?? null);
  return fallback ?? "prod";
}
