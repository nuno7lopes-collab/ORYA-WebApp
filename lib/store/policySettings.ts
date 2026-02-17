import { normalizeUsernameInput } from "@/lib/username";

export const STORE_POLICY_MAX_CHARS = 2000;
export const STORE_SUPPORT_MAX_CHARS = 120;
export const STORE_RETURN_WINDOW_MAX_DAYS = 730;
export const STORE_RETURN_WINDOW_DEFAULT_DAYS = 14;
export const STORE_RETURN_POLICY_MODES = ["NO_RETURNS", "WINDOW_DAYS"] as const;

export type StoreReturnPolicyMode = (typeof STORE_RETURN_POLICY_MODES)[number];

export type StorePolicySettingsSource = {
  supportEmail?: string | null;
  supportPhone?: string | null;
  storeReturnPolicyMode?: string | null;
  storeReturnWindowDays?: number | null;
};

export type ResolvedStorePolicy = {
  supportEmail: string | null;
  supportPhone: string | null;
  legalUrl: string | null;
  termsUrl: string | null;
  privacyPolicy: string | null;
  returnPolicy: string | null;
  returnPolicyMode: StoreReturnPolicyMode | null;
  returnWindowDays: number | null;
};

function normalizeText(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLen) {
    return trimmed.slice(0, maxLen);
  }
  return trimmed;
}

function normalizeStoreReturnMode(value: unknown): StoreReturnPolicyMode | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === "NO_RETURNS" || normalized === "WINDOW_DAYS") {
    return normalized;
  }
  return null;
}

function normalizeWindowDays(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(STORE_RETURN_WINDOW_MAX_DAYS, Math.max(0, Math.round(parsed)));
}

function buildReturnPolicyText(mode: StoreReturnPolicyMode, returnWindowDays: number | null): string {
  const base =
    mode === "NO_RETURNS"
      ? "Sem devolucoes. Em caso de defeito, contactar o suporte."
      : returnWindowDays === 0
        ? "Devolucoes permitidas no proprio dia da compra, para produtos sem sinais de uso."
        : `Devolucoes permitidas durante ${returnWindowDays ?? STORE_RETURN_WINDOW_DEFAULT_DAYS} dia(s) apos a compra, para produtos sem sinais de uso.`;
  return base;
}

function buildLegalUrl(username: string | null): string | null {
  if (!username) return null;
  return `/${username}/legal`;
}

function buildPrivacyPolicyText(legalUrl: string | null): string {
  if (legalUrl) {
    return `A privacidade desta organizacao segue o template legal da ORYA. Consulta ${legalUrl}#privacidade para detalhes completos.`;
  }
  return "A privacidade desta organizacao segue o template legal da ORYA.";
}

function buildTermsUrl(legalUrl: string | null): string | null {
  if (!legalUrl) return null;
  return `${legalUrl}#termos`;
}

export function resolveStorePolicy(params: {
  settings?: StorePolicySettingsSource | null;
  fallbackSupportEmail?: string | null;
  fallbackSupportPhone?: string | null;
  organizationUsername?: string | null;
}): ResolvedStorePolicy {
  const settings = params.settings ?? null;
  const username = normalizeUsernameInput(params.organizationUsername ?? "");
  const legalUrl = buildLegalUrl(username);

  const supportEmail =
    normalizeText(settings?.supportEmail, STORE_SUPPORT_MAX_CHARS) ??
    normalizeText(params.fallbackSupportEmail, STORE_SUPPORT_MAX_CHARS);

  const supportPhone =
    normalizeText(settings?.supportPhone, STORE_SUPPORT_MAX_CHARS) ??
    normalizeText(params.fallbackSupportPhone, STORE_SUPPORT_MAX_CHARS);

  const mode = normalizeStoreReturnMode(settings?.storeReturnPolicyMode);
  const normalizedDays = normalizeWindowDays(settings?.storeReturnWindowDays);

  const returnWindowDays = mode === "WINDOW_DAYS" ? normalizedDays ?? STORE_RETURN_WINDOW_DEFAULT_DAYS : null;

  const resolvedMode = mode ?? "WINDOW_DAYS";
  const returnPolicy = buildReturnPolicyText(resolvedMode, returnWindowDays);
  const privacyPolicy = buildPrivacyPolicyText(legalUrl);
  const termsUrl = buildTermsUrl(legalUrl);

  return {
    supportEmail,
    supportPhone,
    legalUrl,
    termsUrl,
    privacyPolicy,
    returnPolicy,
    returnPolicyMode: resolvedMode,
    returnWindowDays,
  };
}

export function normalizeStorePolicyModeInput(value: unknown): StoreReturnPolicyMode {
  const mode = normalizeStoreReturnMode(value);
  return mode ?? "WINDOW_DAYS";
}

export function normalizeStoreReturnWindowInput(value: unknown, mode: StoreReturnPolicyMode): number | null {
  if (mode === "NO_RETURNS") return null;
  const normalized = normalizeWindowDays(value);
  return normalized ?? STORE_RETURN_WINDOW_DEFAULT_DAYS;
}

export function normalizeStoreSupportEmailInput(value: unknown): string | null {
  return normalizeText(value, STORE_SUPPORT_MAX_CHARS);
}

export function normalizeStoreSupportPhoneInput(value: unknown): string | null {
  return normalizeText(value, STORE_SUPPORT_MAX_CHARS);
}
