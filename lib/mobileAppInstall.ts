const DEFAULT_ORYA_APP_INSTALL_URL = "https://testflight.apple.com/join/rw661rQX";
export const ORYA_APP_INSTALL_CTA_LABEL = "Instalar app ORYA";
export const ORYA_APP_INSTALL_HINT = "Para já via TestFlight (iOS)";

const ORYA_APP_INSTALL_URL_ENV_KEYS = [
  "NEXT_PUBLIC_ORYA_APP_INSTALL_URL",
  "NEXT_PUBLIC_MOBILE_APP_INSTALL_URL",
] as const;

function normalizeInstallUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function resolveOryaAppInstallUrl() {
  for (const key of ORYA_APP_INSTALL_URL_ENV_KEYS) {
    const value = process.env[key];
    if (typeof value !== "string") continue;
    const normalized = normalizeInstallUrl(value);
    if (normalized) return normalized;
  }

  return DEFAULT_ORYA_APP_INSTALL_URL;
}

export const ORYA_APP_INSTALL_URL = resolveOryaAppInstallUrl();
