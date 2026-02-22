import { ApiError } from "../../lib/api";

const STORE_ERROR_COPY: Record<string, string> = {
  NOT_FOUND: "Loja não encontrada.",
  STORE_DISABLED: "A loja está indisponível de momento.",
  STORE_NOT_FOUND: "Loja não encontrada.",
  CATALOG_LOCKED: "O catálogo está temporariamente bloqueado.",
  CHECKOUT_UNAVAILABLE: "O checkout não está disponível nesta loja.",
  PAYMENTS_NOT_READY: "Pagamentos indisponíveis nesta loja.",
  CART_NOT_FOUND: "Não foi possível localizar o carrinho.",
  EMPTY_CART: "O carrinho está vazio.",
  ADDRESS_REQUIRED: "Seleciona uma morada para continuar.",
  SHIPPING_QUOTE_FAILED: "Não foi possível calcular o envio.",
  INSUFFICIENT_STOCK: "Um ou mais itens ficaram sem stock.",
  UNAUTHENTICATED: "Inicia sessão para continuar.",
  STORE_PAYMENTS_NOT_READY: "Pagamentos indisponíveis nesta loja.",
};

const API_PREFIX_PATTERN = /^API\s+\d{3}\s*:\s*(.+)$/is;

const isMissingPaymentIntentError = (message: string) => {
  const lower = message.toLowerCase();
  if (!lower.includes("payment_intent")) return false;
  return (
    lower.includes("no such") ||
    lower.includes("nao existe") ||
    lower.includes("não existe")
  );
};

const parseApiCodeFromMessage = (message: string) => {
  const match = message.match(API_PREFIX_PATTERN);
  if (!match) return null;
  const payloadRaw = match[1]?.trim();
  if (!payloadRaw) return null;
  try {
    const payload = JSON.parse(payloadRaw) as Record<string, unknown>;
    if (typeof payload.errorCode === "string" && payload.errorCode.trim()) {
      return payload.errorCode.trim().toUpperCase();
    }
    if (
      payload.error &&
      typeof payload.error === "object" &&
      typeof (payload.error as Record<string, unknown>).errorCode === "string"
    ) {
      const nestedCode = (payload.error as Record<string, unknown>)
        .errorCode as string;
      return nestedCode.trim().toUpperCase() || null;
    }
    return null;
  } catch {
    return null;
  }
};

export function getStoreErrorMessage(
  error: unknown,
  fallback = "Não foi possível completar a operação.",
) {
  if (error instanceof ApiError) {
    const code = error.code?.trim().toUpperCase();
    if (code && STORE_ERROR_COPY[code]) return STORE_ERROR_COPY[code];
    const text = error.message?.trim();
    if (text && STORE_ERROR_COPY[text]) return STORE_ERROR_COPY[text];
    const parsedCode = text ? parseApiCodeFromMessage(text) : null;
    if (parsedCode && STORE_ERROR_COPY[parsedCode])
      return STORE_ERROR_COPY[parsedCode];
    if (text && isMissingPaymentIntentError(text)) {
      return "Sessão de pagamento inválida. Tenta novamente.";
    }
    if (text) return text;
  }
  if (error instanceof Error) {
    const text = error.message?.trim();
    if (text && STORE_ERROR_COPY[text]) return STORE_ERROR_COPY[text];
    const parsedCode = text ? parseApiCodeFromMessage(text) : null;
    if (parsedCode && STORE_ERROR_COPY[parsedCode])
      return STORE_ERROR_COPY[parsedCode];
    if (text && isMissingPaymentIntentError(text)) {
      return "Sessão de pagamento inválida. Tenta novamente.";
    }
    if (text) return text;
  }
  return fallback;
}
