jest.mock("../lib/api", () => {
  class ApiError extends Error {
    status: number;
    code: string | null;

    constructor(status: number, message: string, code?: string | null) {
      super(message);
      this.status = status;
      this.code =
        typeof code === "string" && code.trim()
          ? code.trim().toUpperCase()
          : null;
      this.name = "ApiError";
    }
  }

  return { ApiError };
});

import { ApiError } from "../lib/api";
import { getUserFacingError } from "../lib/errors";
import { getStoreErrorMessage } from "../features/store/errors";

describe("getUserFacingError", () => {
  it("returns known business copy from ApiError code", () => {
    const error = new ApiError(
      409,
      "irrelevant",
      "ORGANIZATION_PAYMENTS_NOT_READY",
    );
    expect(getUserFacingError(error, "fallback")).toContain(
      "Pagamentos desativados",
    );
  });

  it("extracts human message from prefixed API JSON errors", () => {
    const error = new Error(
      'API 409: {"ok":false,"errorCode":"ORGANIZATION_PAYMENTS_NOT_READY","message":"Pagamentos desativados para este evento."}',
    );
    expect(getUserFacingError(error, "fallback")).toContain(
      "Pagamentos desativados",
    );
  });

  it("maps connectivity errors to a stable offline message", () => {
    const error = new Error("Network request failed");
    expect(getUserFacingError(error, "fallback")).toBe(
      "Sem ligação ao servidor. Verifica a internet e tenta novamente.",
    );
  });

  it("maps community invite link codes to user copy", () => {
    const invalid = new ApiError(404, "irrelevant", "INVITE_LINK_INVALID");
    const expired = new ApiError(410, "irrelevant", "INVITE_LINK_EXPIRED");

    expect(getUserFacingError(invalid, "fallback")).toBe(
      "Este link de convite não é válido.",
    );
    expect(getUserFacingError(expired, "fallback")).toBe(
      "Este link de convite expirou.",
    );
  });
});

describe("getStoreErrorMessage", () => {
  it("uses ApiError code mapping when available", () => {
    const error = new ApiError(409, "any", "CHECKOUT_UNAVAILABLE");
    expect(getStoreErrorMessage(error)).toBe(
      "O checkout não está disponível nesta loja.",
    );
  });

  it("maps API-prefixed error code payloads", () => {
    const error = new Error(
      'API 409: {"ok":false,"errorCode":"STORE_PAYMENTS_NOT_READY","message":"Payments disabled"}',
    );
    expect(getStoreErrorMessage(error)).toBe(
      "Pagamentos indisponíveis nesta loja.",
    );
  });

  it("detects missing payment_intent errors", () => {
    const error = new Error("No such payment_intent");
    expect(getStoreErrorMessage(error)).toBe(
      "Sessão de pagamento inválida. Tenta novamente.",
    );
  });
});
