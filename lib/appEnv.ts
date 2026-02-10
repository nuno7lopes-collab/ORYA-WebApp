import "server-only";
import { isTruthyEnvFlag, normalizeAppEnv, type AppEnv } from "@/lib/appEnvShared";
import { getRequestAppEnv } from "@/lib/appEnvContext";

let warnedSingleDbMismatch = false;

export function getAppEnv(): AppEnv {
  const forced = normalizeAppEnv(process.env.FORCE_APP_ENV ?? process.env.APP_ENV_FORCE ?? null);
  const override = normalizeAppEnv(process.env.APP_ENV ?? null) ?? normalizeAppEnv(process.env.NEXT_PUBLIC_APP_ENV ?? null);
  const singleDb = isTruthyEnvFlag(process.env.SINGLE_DB_MODE);
  if (singleDb) {
    if (!warnedSingleDbMismatch) {
      const mismatch = forced && forced !== "prod" ? forced : override && override !== "prod" ? override : null;
      if (mismatch) {
        warnedSingleDbMismatch = true;
        console.warn(
          `[env] SINGLE_DB_MODE ativo, mas APP_ENV=${mismatch}. Forçando \"prod\" para evitar divergências.`,
        );
      }
    }
    return "prod";
  }
  if (forced) return forced;
  if (override) return override;
  return getRequestAppEnv() ?? "prod";
}

export function isTestEnv(): boolean {
  return getAppEnv() === "test";
}
