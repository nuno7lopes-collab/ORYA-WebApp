import "server-only";
import { normalizeAppEnv, type AppEnv } from "@/lib/appEnvShared";
import { getRequestAppEnv } from "@/lib/appEnvContext";

export function getAppEnv(): AppEnv {
  const override = normalizeAppEnv(process.env.APP_ENV ?? null) ?? normalizeAppEnv(process.env.NEXT_PUBLIC_APP_ENV ?? null);
  if (override) return override;
  return getRequestAppEnv() ?? "prod";
}

export function isTestEnv(): boolean {
  return getAppEnv() === "test";
}
