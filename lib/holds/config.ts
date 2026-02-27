const HOLD_TTL_SECONDS = 5 * 60;
export const HOLD_TTL_MS = HOLD_TTL_SECONDS * 1000;

function parseBoolean(value: string | undefined): boolean | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

export function isPlatformHoldContractEnabled() {
  const explicit =
    parseBoolean(process.env.FEATURE_PLATFORM_HOLD_CONTRACT) ??
    parseBoolean(process.env.HOLD_CONTRACT_ENABLED);
  if (explicit != null) return explicit;

  if (
    process.env.NODE_ENV === "test" ||
    process.env.ORIGINAL_NODE_ENV === "test" ||
    process.env.VITEST === "true" ||
    typeof process.env.VITEST_WORKER_ID === "string"
  ) {
    return false;
  }

  if (process.env.APP_ENV === "prod") return false;
  return true;
}

export function isInventoryHoldContractEnabled() {
  const explicit = parseBoolean(process.env.FEATURE_INVENTORY_HOLDS);
  if (explicit != null) return explicit;

  if (
    process.env.NODE_ENV === "test" ||
    process.env.ORIGINAL_NODE_ENV === "test" ||
    process.env.VITEST === "true" ||
    typeof process.env.VITEST_WORKER_ID === "string"
  ) {
    return false;
  }

  if (process.env.APP_ENV === "prod") return false;
  return true;
}

export function buildHoldRedisKey(orgId: number, subjectFingerprint: string) {
  return `hold:org:${orgId}:subject:${subjectFingerprint}`;
}
