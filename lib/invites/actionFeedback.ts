import { sanitizeUiErrorMessage } from "@/lib/uiErrorMessage";

const REFRESH_REQUIRED_CODES = new Set(["INVITE_NOT_PENDING", "INVITE_EXPIRED", "INVITE_NOT_FOUND"]);

function readErrorCode(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const direct = [record.errorCode, record.code, record.error].find((value) => typeof value === "string");
  if (typeof direct === "string" && direct.trim()) return direct.trim().toUpperCase();
  const nestedDetails = record.details;
  if (nestedDetails && typeof nestedDetails === "object") {
    const nestedCode = (nestedDetails as Record<string, unknown>).originalCode;
    if (typeof nestedCode === "string" && nestedCode.trim()) return nestedCode.trim().toUpperCase();
  }
  return null;
}

function resolveStateDriftMessage(code: string) {
  if (code === "INVITE_NOT_PENDING") return "Este convite já foi atualizado por outra ação. A lista foi atualizada.";
  if (code === "INVITE_EXPIRED") return "Este convite expirou. A lista foi atualizada.";
  if (code === "INVITE_NOT_FOUND") return "Este convite já não existe. A lista foi atualizada.";
  return null;
}

export function resolveInviteActionFeedback(payload: unknown, fallback: string) {
  const code = readErrorCode(payload);
  const rawMessage =
    payload && typeof payload === "object" && typeof (payload as Record<string, unknown>).error === "string"
      ? String((payload as Record<string, unknown>).error)
      : null;

  if (code && REFRESH_REQUIRED_CODES.has(code)) {
    return {
      message: resolveStateDriftMessage(code) ?? fallback,
      shouldRefresh: true,
      errorCode: code,
    };
  }

  return {
    message: sanitizeUiErrorMessage(rawMessage, fallback),
    shouldRefresh: false,
    errorCode: code,
  };
}
