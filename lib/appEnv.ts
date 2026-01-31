import "server-only";
import { headers } from "next/headers";
import { normalizeAppEnv, resolveEnvFromHost, type AppEnv } from "@/lib/appEnvShared";

export function getAppEnv(): AppEnv {
  const override = normalizeAppEnv(process.env.APP_ENV ?? null);
  if (override) return override;
  try {
    const hdrs = headers();
    const host = hdrs.get("x-forwarded-host") || hdrs.get("host");
    return resolveEnvFromHost(host);
  } catch {
    return "prod";
  }
}

export function isTestEnv(): boolean {
  return getAppEnv() === "test";
}
