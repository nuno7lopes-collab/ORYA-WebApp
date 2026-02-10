export type AppEnv = "prod" | "test";

const TEST_HOST_PREFIXES = ["test.", "staging."];

export function isTruthyEnvFlag(value?: string | null): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function normalizeAppEnv(value?: string | null): AppEnv | null {
  if (!value) return null;
  const lowered = value.trim().toLowerCase();
  if (lowered === "prod" || lowered === "production") return "prod";
  if (lowered === "test" || lowered === "testing" || lowered === "staging") return "test";
  return null;
}

export function resolveEnvFromHost(host?: string | null): AppEnv {
  if (!host) return "prod";
  const safeHost = host.split(":")[0]?.toLowerCase() ?? "";
  if (!safeHost) return "prod";
  if (TEST_HOST_PREFIXES.some((prefix) => safeHost.startsWith(prefix))) {
    return "test";
  }
  return "prod";
}
