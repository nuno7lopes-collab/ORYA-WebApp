const TECHNICAL_ERROR_CODES = new Set([
  "LEGACY_ROUTE_REMOVED",
  "NOT_ORGANIZATION",
  "UNAUTHENTICATED",
  "INTERNAL_ERROR",
  "FORBIDDEN",
  "ORG_ID_REQUIRED",
  "INVALID_ORG_ID",
  "INVALID_STATE",
]);

const TECHNICAL_TOKEN_PATTERN = /^[A-Z0-9_]{4,}$/;

export function sanitizeUiErrorMessage(raw: unknown, fallback: string): string {
  if (typeof raw !== "string") return fallback;
  const message = raw.trim();
  if (!message) return fallback;

  const upper = message.toUpperCase();
  if (TECHNICAL_ERROR_CODES.has(upper)) return fallback;
  if (upper.includes("LEGACY_ROUTE_REMOVED")) return fallback;
  if (TECHNICAL_TOKEN_PATTERN.test(message) && message === upper) return fallback;

  return message;
}
