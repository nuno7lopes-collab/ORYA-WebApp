import { getRequestContext } from "@/lib/http/requestContext";
import { respondError } from "@/lib/http/envelope";

const ERROR_STATUS_MAP: Record<string, number> = {
  UNAUTHENTICATED: 401,
  AUTH_REQUIRED: 401,
  FORBIDDEN: 403,
  ONLY_GROUP_OWNER: 403,
  TOKEN_USER_MISMATCH: 403,
  GROUP_NOT_FOUND: 404,
  ORGANIZATION_NOT_FOUND: 404,
  REQUEST_NOT_FOUND: 404,
  TRANSFER_NOT_FOUND: 404,
  TARGET_OWNER_NOT_FOUND: 404,
  TARGET_USER_NOT_FOUND: 404,
  REQUEST_TYPE_MISMATCH: 409,
  ORGANIZATION_ALREADY_IN_GROUP: 409,
  ORGANIZATION_NOT_IN_GROUP: 409,
  REQUEST_NOT_PENDING_CODES: 409,
  REQUEST_NOT_READY_FOR_EMAIL: 409,
  REQUEST_ALREADY_COMPLETED: 409,
  REQUEST_CANCELLED: 409,
  TRANSFER_NOT_PENDING: 409,
  CODES_NOT_REQUIRED: 409,
  PARTICIPANT_HINT_REQUIRED: 409,
  TARGET_OWNER_EQUALS_CURRENT: 409,
  CANNOT_TRANSFER_TO_SELF: 409,
  REQUEST_EXPIRED: 410,
  TRANSFER_EXPIRED: 410,
  TOKEN_EXPIRED: 410,
  CODES_EXPIRED: 410,
  CODES_WINDOW_EXPIRED: 410,
  REQUEST_LOCKED: 423,
  EMAIL_RESEND_LIMIT_WINDOW: 429,
  EMAIL_RESEND_LIMIT_TOTAL: 429,
  INVALID_CODES: 422,
  TOKEN_INVALID: 422,
  TARGET_OWNER_REQUIRED: 422,
  TOKEN_REQUIRED: 422,
  CODES_WINDOW_INVALID: 422,
  INVALID_BODY: 400,
  BAD_REQUEST: 400,
};

export function failFromMessage(message: string) {
  const ctx = getRequestContext();
  const normalized = (message || "INTERNAL_ERROR").trim();
  const status = ERROR_STATUS_MAP[normalized] ?? 500;
  return respondError(
    ctx,
    {
      errorCode: status === 500 ? "INTERNAL_ERROR" : normalized,
      message: normalized,
      retryable: status >= 500,
    },
    { status },
  );
}

export function requirePositiveInt(raw: string | null | undefined) {
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}
