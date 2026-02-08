import "server-only";
import { normalizeAppEnv, type AppEnv } from "@/lib/appEnvShared";
import { getRequestAppEnv } from "@/lib/appEnvContext";

export function getAppEnv(): AppEnv {
  const forced = normalizeAppEnv(process.env.FORCE_APP_ENV ?? process.env.APP_ENV_FORCE ?? null);
  if (forced) return forced;
  const singleDb = (process.env.SINGLE_DB_MODE ?? "").trim().toLowerCase();
  if (singleDb === "1" || singleDb === "true" || singleDb === "yes" || singleDb === "on") {
    return "prod";
  }
  const override = normalizeAppEnv(process.env.APP_ENV ?? null) ?? normalizeAppEnv(process.env.NEXT_PUBLIC_APP_ENV ?? null);
  if (override) return override;
  return getRequestAppEnv() ?? "prod";
}

export function isTestEnv(): boolean {
  return getAppEnv() === "test";
}
