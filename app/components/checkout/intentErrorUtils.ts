export type IntentCycleState = "IDLE" | "PREPARING" | "READY" | "FAILED";

export type IntentErrorPayload = {
  ok?: boolean;
  code?: string | null;
  error?: string | null;
  message?: string | null;
  status?: string | null;
  retryable?: boolean | null;
  nextAction?: string | null;
  [key: string]: any;
};

type IntentUiErrorKind =
  | "TERMINAL_RECOVERABLE"
  | "CONFLICT_NON_RETRYABLE"
  | "AUTH_REQUIRED"
  | "USERNAME_REQUIRED"
  | "GENERIC";

export type IntentUiError = {
  kind: IntentUiErrorKind;
  message: string;
};

type AutoRetryTerminalInput = {
  status: number;
  data: IntentErrorPayload | null;
  retryCount: number;
  maxRetry?: number;
};

export function shouldAutoRetryTerminalIntent(input: AutoRetryTerminalInput) {
  const { status, data, retryCount, maxRetry = 1 } = input;
  if (status !== 409) return false;
  if (retryCount >= maxRetry) return false;
  const code = typeof data?.code === "string" ? data.code : null;
  const retryable = data?.retryable === true;
  const nextAction = typeof data?.nextAction === "string" ? data.nextAction : null;
  return code === "PAYMENT_INTENT_TERMINAL" && retryable && nextAction === "PAY_NOW";
}

type MapIntentErrorToUiInput = {
  status: number;
  data: IntentErrorPayload | null;
  fallbackMessage: string;
  retryCount?: number;
};

const NON_RETRYABLE_CONFLICT_MESSAGES: Record<string, string> = {
  INSUFFICIENT_STOCK: "Stock insuficiente. Remove itens esgotados e tenta novamente.",
  PRICE_CHANGED: "Os preços mudaram. Volta ao passo anterior e revê a seleção.",
  FREE_ALREADY_CLAIMED: "Já usaste a tua entrada gratuita neste evento.",
  PAIRING_SLOT_PAID: "Este lugar já foi pago.",
  PAIRING_CANCELLED: "A dupla foi cancelada.",
  PAIRING_INVALID: "A dupla já não está ativa.",
  IDEMPOTENCY_KEY_PAYLOAD_MISMATCH:
    "O checkout mudou noutro separador. Volta ao passo anterior ou recarrega a página.",
};

export function mapIntentErrorToUi(input: MapIntentErrorToUiInput): IntentUiError {
  const { status, data, fallbackMessage, retryCount = 0 } = input;
  const code = typeof data?.code === "string" ? data.code : null;
  const fallback =
    typeof data?.error === "string" && data.error.trim()
      ? data.error.trim()
      : fallbackMessage;

  if (
    status === 409 &&
    shouldAutoRetryTerminalIntent({ status, data, retryCount, maxRetry: 1 })
  ) {
    return {
      kind: "TERMINAL_RECOVERABLE",
      message: "A sessão de pagamento expirou. Estamos a gerar um novo intento.",
    };
  }

  if (status === 401) {
    return {
      kind: "AUTH_REQUIRED",
      message:
        fallback ||
        "Este checkout requer sessão iniciada. Inicia sessão para continuar.",
    };
  }

  if (status === 403 && (code === "USERNAME_REQUIRED" || code === "USERNAME_REQUIRED_FOR_FREE")) {
    return {
      kind: "USERNAME_REQUIRED",
      message:
        fallback ||
        "Define um username na tua conta para concluir este checkout.",
    };
  }

  if (status === 409) {
    if (code && NON_RETRYABLE_CONFLICT_MESSAGES[code]) {
      return {
        kind: "CONFLICT_NON_RETRYABLE",
        message: NON_RETRYABLE_CONFLICT_MESSAGES[code],
      };
    }
    return { kind: "CONFLICT_NON_RETRYABLE", message: fallback };
  }

  return { kind: "GENERIC", message: fallback };
}
