import { ApiError } from "../../lib/api";

const STORE_ERROR_COPY: Record<string, string> = {
  STORE_DISABLED: "A loja está indisponível de momento.",
  STORE_NOT_FOUND: "Loja não encontrada.",
  CATALOG_LOCKED: "O catálogo está temporariamente bloqueado.",
  CHECKOUT_UNAVAILABLE: "O checkout não está disponível nesta loja.",
  CART_NOT_FOUND: "Não foi possível localizar o carrinho.",
  EMPTY_CART: "O carrinho está vazio.",
  ADDRESS_REQUIRED: "Seleciona uma morada para continuar.",
  SHIPPING_QUOTE_FAILED: "Não foi possível calcular o envio.",
  INSUFFICIENT_STOCK: "Um ou mais itens ficaram sem stock.",
  UNAUTHENTICATED: "Inicia sessão para continuar.",
};

export function getStoreErrorMessage(error: unknown, fallback = "Não foi possível completar a operação.") {
  if (error instanceof ApiError) {
    const text = error.message?.trim();
    if (text && STORE_ERROR_COPY[text]) return STORE_ERROR_COPY[text];
    if (text) return text;
  }
  if (error instanceof Error) {
    const text = error.message?.trim();
    if (text && STORE_ERROR_COPY[text]) return STORE_ERROR_COPY[text];
    if (text) return text;
  }
  return fallback;
}
