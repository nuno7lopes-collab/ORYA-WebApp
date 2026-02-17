import {
  resolveStorePolicy,
  STORE_RETURN_WINDOW_MAX_DAYS,
  type ResolvedStorePolicy,
  type StorePolicySettingsSource,
  type StoreReturnPolicyMode,
} from "@/lib/store/policySettings";

export const STORE_POLICY_SNAPSHOT_VERSION = "v1";

export type StorePolicySnapshot = {
  supportEmail: string | null;
  supportPhone: string | null;
  legalUrl: string | null;
  termsUrl: string | null;
  privacyPolicy: string | null;
  returnPolicy: string | null;
  returnPolicyMode: StoreReturnPolicyMode | null;
  returnWindowDays: number | null;
};

function normalizeText(value: unknown, maxLen = 2000): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLen) return trimmed.slice(0, maxLen);
  return trimmed;
}

function normalizeMode(value: unknown): StoreReturnPolicyMode | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === "NO_RETURNS" || normalized === "WINDOW_DAYS") {
    return normalized;
  }
  return null;
}

function normalizeWindowDays(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(STORE_RETURN_WINDOW_MAX_DAYS, Math.round(parsed)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function buildStorePolicySnapshot(policy: ResolvedStorePolicy): StorePolicySnapshot {
  return {
    supportEmail: policy.supportEmail,
    supportPhone: policy.supportPhone,
    legalUrl: policy.legalUrl,
    termsUrl: policy.termsUrl,
    privacyPolicy: policy.privacyPolicy,
    returnPolicy: policy.returnPolicy,
    returnPolicyMode: policy.returnPolicyMode,
    returnWindowDays: policy.returnWindowDays,
  };
}

export function parseStorePolicySnapshot(raw: unknown): StorePolicySnapshot | null {
  if (!isRecord(raw)) return null;
  const returnPolicyMode = normalizeMode(raw.returnPolicyMode);
  return {
    supportEmail: normalizeText(raw.supportEmail, 120),
    supportPhone: normalizeText(raw.supportPhone, 120),
    legalUrl: normalizeText(raw.legalUrl),
    termsUrl: normalizeText(raw.termsUrl),
    privacyPolicy: normalizeText(raw.privacyPolicy),
    returnPolicy: normalizeText(raw.returnPolicy),
    returnPolicyMode,
    returnWindowDays: returnPolicyMode === "WINDOW_DAYS" ? normalizeWindowDays(raw.returnWindowDays) : null,
  };
}

export function resolveStorePolicyWithSnapshot(params: {
  snapshot?: unknown;
  settings?: StorePolicySettingsSource | null;
  fallbackSupportEmail?: string | null;
  fallbackSupportPhone?: string | null;
  organizationUsername?: string | null;
}): StorePolicySnapshot {
  const snapshot = parseStorePolicySnapshot(params.snapshot);
  if (snapshot) return snapshot;
  return buildStorePolicySnapshot(
    resolveStorePolicy({
      settings: params.settings ?? null,
      fallbackSupportEmail: params.fallbackSupportEmail ?? null,
      fallbackSupportPhone: params.fallbackSupportPhone ?? null,
      organizationUsername: params.organizationUsername ?? null,
    }),
  );
}
