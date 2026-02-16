// Utils partilhados para normalizar/validar telefones de forma consistente.
import { getCountryCallingCode, isSupportedCountry, type CountryCode } from "libphonenumber-js/min";

const DEFAULT_COUNTRY_CALLING_CODE = "351";
const COUNTRY_HEADER_KEYS = [
  "x-vercel-ip-country",
  "cf-ipcountry",
  "cloudfront-viewer-country",
  "x-country-code",
  "x-geo-country",
] as const;

type NormalizePhoneOptions = {
  defaultCountryCallingCode?: string;
  defaultCountryIso2?: string | null;
  defaultLocale?: string | null;
};

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function resolveCountryCallingCode(input?: string): string {
  const digits = digitsOnly(input ?? "");
  return digits || DEFAULT_COUNTRY_CALLING_CODE;
}

function normalizeCountryIso2(value: string | null | undefined): CountryCode | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return null;
  return isSupportedCountry(normalized as CountryCode) ? (normalized as CountryCode) : null;
}

export function inferCountryIso2FromLocale(locale: string | null | undefined): CountryCode | null {
  if (!locale) return null;
  const normalized = locale.trim().replace(/_/g, "-");
  if (!normalized) return null;

  const [firstToken] = normalized.split(",");
  const subtags = firstToken
    .split(";")[0]
    .trim()
    .split("-")
    .filter(Boolean);
  if (subtags.length < 2) return null;

  for (const subtag of subtags.slice(1)) {
    if (/^[A-Za-z]{2}$/.test(subtag)) {
      return normalizeCountryIso2(subtag);
    }
  }
  return null;
}

export function inferCountryIso2FromHeaders(headers: Headers | null | undefined): CountryCode | null {
  if (!headers) return null;
  for (const key of COUNTRY_HEADER_KEYS) {
    const countryIso2 = normalizeCountryIso2(headers.get(key));
    if (countryIso2) return countryIso2;
  }
  return null;
}

export function resolvePhoneNormalizationOptions(params: {
  headers?: Headers | null;
  locale?: string | null;
  countryIso2?: string | null;
  defaultCountryCallingCode?: string;
} = {}): NormalizePhoneOptions {
  const locale = params.locale ?? params.headers?.get("accept-language") ?? null;
  const countryIso2 =
    normalizeCountryIso2(params.countryIso2) ??
    inferCountryIso2FromHeaders(params.headers) ??
    inferCountryIso2FromLocale(locale);

  return {
    defaultCountryCallingCode: params.defaultCountryCallingCode,
    defaultCountryIso2: countryIso2,
    defaultLocale: locale,
  };
}

// Remove caracteres inválidos, permitindo apenas dígitos e um único "+" no início.
export function sanitizePhone(input: string): string {
  const raw = typeof input === "string" ? input : String(input ?? "");
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const plusAtStart = trimmed.startsWith("+");
  const cleaned = trimmed.replace(/[^\d+]/g, "");
  const digits = digitsOnly(cleaned);

  if (!digits) return plusAtStart ? "+" : "";
  return plusAtStart || cleaned.includes("+") ? `+${digits}` : digits;
}

// Validação sintática: 6 a 15 dígitos; aceita formatos nacionais, +internacional e 00internacional.
export function isValidPhone(input: string): boolean {
  const value = sanitizePhone(input);
  if (!value) return false;
  if (value.startsWith("+")) return /^\+\d{6,15}$/.test(value);
  if (value.startsWith("00")) return /^00\d{6,15}$/.test(value);
  return /^\d{6,15}$/.test(value);
}

// Normaliza prefixo internacional para formato com "+".
// Ex.: 912345678 -> +351912345678, 00351912345678 -> +351912345678.
export function normalizePhone(input: string, options: NormalizePhoneOptions = {}): string {
  const sanitized = sanitizePhone(input);
  if (!sanitized) return "";

  const digits = digitsOnly(sanitized);
  if (!digits) return "";

  if (sanitized.startsWith("+")) {
    const internationalDigits = digits.startsWith("00") ? digits.replace(/^00+/, "") : digits;
    return internationalDigits ? `+${internationalDigits}` : "";
  }

  if (digits.startsWith("00")) {
    const internationalDigits = digits.replace(/^00+/, "");
    return internationalDigits ? `+${internationalDigits}` : "";
  }

  const countryFromLocale = inferCountryIso2FromLocale(options.defaultLocale);
  const countryIso2 = normalizeCountryIso2(options.defaultCountryIso2) ?? countryFromLocale;
  const countryCallingCode = countryIso2 ? getCountryCallingCode(countryIso2) : null;
  const callingCode = resolveCountryCallingCode(countryCallingCode ?? options.defaultCountryCallingCode);
  if (digits.startsWith(callingCode) && digits.length > callingCode.length) {
    return `+${digits}`;
  }

  return `+${callingCode}${digits}`;
}
