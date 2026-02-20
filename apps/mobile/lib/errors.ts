import { ApiError } from "./api";

const normalize = (message: string) => message.replace(/\s+/g, " ").trim();

const BUSINESS_ERROR_COPY: Record<string, string> = {
  ORGANIZATION_PAYMENTS_NOT_READY:
    "Pagamentos desativados para este evento. Verifica o email oficial e liga a conta Stripe da organização.",
  ORGANIZATION_STRIPE_NOT_CONNECTED:
    "Pagamentos desativados para este evento. Liga a conta Stripe da organização.",
  PAYMENTS_NOT_READY: "Pagamentos indisponíveis neste momento.",
  PAYMENT_INTENT_TERMINAL:
    "A sessão de pagamento expirou. Tenta novamente para gerar um novo pagamento.",
  PAYMENT_INTENT_RETRIEVE_FAILED:
    "Não foi possível recuperar o pagamento. Tenta novamente.",
  IDEMPOTENCY_KEY_PAYLOAD_MISMATCH:
    "A sessão de pagamento já foi usada com dados diferentes. Inicia novamente.",
  CHECKOUT_UNAVAILABLE: "O checkout não está disponível neste momento.",
  PAYMENT_CONFIGURATION_MISSING:
    "Pagamentos indisponíveis neste momento. Tenta novamente mais tarde.",
  STRIPE_KEY_MODE_MISMATCH:
    "Configuração de pagamentos inconsistente entre app e servidor. Fecha e volta a abrir a app.",
  UNAUTHENTICATED: "Inicia sessão para continuar.",
  CHAT_BLOCKED: "Esta conversa está bloqueada.",
  BANNED: "Acesso bloqueado a esta conversa.",
  PAIRING_ALREADY_ACTIVE: "Já tens uma dupla ativa nesta categoria.",
};

const API_PREFIX_PATTERN = /^API\s+(\d{3})\s*:\s*(.+)$/is;

const looksTechnical = (message: string) => {
  const lower = message.toLowerCase();
  if (
    lower.includes("api ") ||
    lower.includes("errorcode") ||
    lower.includes("requestid") ||
    lower.includes("correlationid")
  ) {
    return true;
  }
  if (message.includes("{") && message.includes("}")) return true;
  return false;
};

const isConnectivityErrorMessage = (message: string) => {
  const lower = message.toLowerCase();
  return (
    lower.includes("network request failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("api offline") ||
    lower.includes("api timeout")
  );
};

const readBusinessCopy = (code?: string | null) => {
  if (typeof code !== "string") return null;
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) return null;
  return BUSINESS_ERROR_COPY[normalizedCode] ?? null;
};

type ApiPayloadDetails = {
  status: number | null;
  code: string | null;
  message: string | null;
};

const readMessageFromPayload = (payload: unknown) => {
  if (!payload || typeof payload !== "object") return null;
  const source = payload as Record<string, unknown>;
  if (typeof source.message === "string" && source.message.trim())
    return source.message.trim();
  if (typeof source.error === "string" && source.error.trim())
    return source.error.trim();
  if (
    typeof source.error === "object" &&
    source.error &&
    typeof (source.error as Record<string, unknown>).message === "string"
  ) {
    const nested = (source.error as Record<string, unknown>).message as string;
    return nested.trim() || null;
  }
  return null;
};

const readCodeFromPayload = (payload: unknown) => {
  if (!payload || typeof payload !== "object") return null;
  const source = payload as Record<string, unknown>;
  if (typeof source.errorCode === "string" && source.errorCode.trim()) {
    return source.errorCode.trim().toUpperCase();
  }
  if (
    typeof source.error === "object" &&
    source.error &&
    typeof (source.error as Record<string, unknown>).errorCode === "string"
  ) {
    const nested = (source.error as Record<string, unknown>)
      .errorCode as string;
    return nested.trim().toUpperCase() || null;
  }
  return null;
};

const readStatusFromPayload = (payload: unknown) => {
  if (!payload || typeof payload !== "object") return null;
  const source = payload as Record<string, unknown>;
  if (typeof source.status === "number" && Number.isFinite(source.status)) {
    return source.status;
  }
  return null;
};

const parseApiErrorPrefix = (rawMessage: string): ApiPayloadDetails | null => {
  const match = rawMessage.match(API_PREFIX_PATTERN);
  if (!match) return null;
  const status = Number(match[1]);
  const payloadRaw = match[2]?.trim();
  if (!payloadRaw) {
    return {
      status: Number.isFinite(status) ? status : null,
      code: null,
      message: null,
    };
  }
  try {
    const payload = JSON.parse(payloadRaw) as unknown;
    return {
      status:
        readStatusFromPayload(payload) ??
        (Number.isFinite(status) ? status : null),
      code: readCodeFromPayload(payload),
      message: readMessageFromPayload(payload),
    };
  } catch {
    return {
      status: Number.isFinite(status) ? status : null,
      code: null,
      message: payloadRaw,
    };
  }
};

const sanitizeForUi = (message: string | null | undefined) => {
  if (!message) return null;
  const normalized = normalize(message);
  if (!normalized) return null;
  if (normalized.length > 220) return null;
  if (looksTechnical(normalized)) return null;
  return normalized;
};

export const getUserFacingError = (err: unknown, fallback: string) => {
  if (!err) return fallback;

  if (err instanceof ApiError) {
    const codeCopy = readBusinessCopy(err.code);
    if (codeCopy) return codeCopy;

    const parsed = parseApiErrorPrefix(err.message ?? "");
    const parsedCodeCopy = readBusinessCopy(parsed?.code ?? null);
    if (parsedCodeCopy) return parsedCodeCopy;

    const parsedMessage = sanitizeForUi(parsed?.message);
    if (parsedMessage) return parsedMessage;
  }

  const raw = err instanceof Error ? err.message : String(err);
  const rawParsed = parseApiErrorPrefix(raw);
  const parsedCodeCopy = readBusinessCopy(rawParsed?.code ?? null);
  if (parsedCodeCopy) return parsedCodeCopy;

  const parsedMessage = sanitizeForUi(rawParsed?.message);
  if (parsedMessage) return parsedMessage;

  const normalized = normalize(raw);
  if (!normalized) return fallback;
  if (isConnectivityErrorMessage(normalized)) {
    return "Sem ligação ao servidor. Verifica a internet e tenta novamente.";
  }

  const directCodeCopy = readBusinessCopy(normalized);
  if (directCodeCopy) return directCodeCopy;

  const safeMessage = sanitizeForUi(normalized);
  return safeMessage ?? fallback;
};
