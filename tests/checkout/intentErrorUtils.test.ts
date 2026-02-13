import { describe, expect, it } from "vitest";
import {
  mapIntentErrorToUi,
  shouldAutoRetryTerminalIntent,
  type IntentErrorPayload,
} from "@/app/components/checkout/intentErrorUtils";

describe("checkout intent retry policy", () => {
  const terminalPayload: IntentErrorPayload = {
    code: "PAYMENT_INTENT_TERMINAL",
    retryable: true,
    nextAction: "PAY_NOW",
  };

  it("auto-retries only terminal retryable 409 on first attempt", () => {
    expect(
      shouldAutoRetryTerminalIntent({
        status: 409,
        data: terminalPayload,
        retryCount: 0,
      }),
    ).toBe(true);

    expect(
      shouldAutoRetryTerminalIntent({
        status: 409,
        data: terminalPayload,
        retryCount: 1,
      }),
    ).toBe(false);
  });

  it("does not auto-retry non-terminal conflicts", () => {
    expect(
      shouldAutoRetryTerminalIntent({
        status: 409,
        data: {
          code: "INSUFFICIENT_STOCK",
          retryable: false,
          nextAction: "NONE",
        },
        retryCount: 0,
      }),
    ).toBe(false);

    expect(
      shouldAutoRetryTerminalIntent({
        status: 500,
        data: terminalPayload,
        retryCount: 0,
      }),
    ).toBe(false);
  });
});

describe("checkout intent error mapper", () => {
  it("maps non-retryable conflict to final UX error", () => {
    const out = mapIntentErrorToUi({
      status: 409,
      data: {
        code: "INSUFFICIENT_STOCK",
        retryable: false,
      },
      fallbackMessage: "fallback",
    });

    expect(out.kind).toBe("CONFLICT_NON_RETRYABLE");
    expect(out.message).toContain("Stock insuficiente");
  });

  it("maps auth/profile errors deterministically", () => {
    const auth = mapIntentErrorToUi({
      status: 401,
      data: { code: "AUTH_REQUIRED", error: "Sessão expirada." },
      fallbackMessage: "fallback",
    });
    expect(auth.kind).toBe("AUTH_REQUIRED");
    expect(auth.message).toBe("Sessão expirada.");

    const username = mapIntentErrorToUi({
      status: 403,
      data: { code: "USERNAME_REQUIRED" },
      fallbackMessage: "fallback",
    });
    expect(username.kind).toBe("USERNAME_REQUIRED");
  });

  it("maps terminal conflicts to recoverable UX copy", () => {
    const out = mapIntentErrorToUi({
      status: 409,
      data: {
        code: "PAYMENT_INTENT_TERMINAL",
        retryable: true,
        nextAction: "PAY_NOW",
      },
      fallbackMessage: "fallback",
    });
    expect(out.kind).toBe("TERMINAL_RECOVERABLE");
    expect(out.message).toContain("novo intento");
  });

  it("maps terminal conflict as final error after retry budget is exhausted", () => {
    const out = mapIntentErrorToUi({
      status: 409,
      data: {
        code: "PAYMENT_INTENT_TERMINAL",
        retryable: true,
        nextAction: "PAY_NOW",
        error: "Sessão de pagamento expirada.",
      },
      fallbackMessage: "fallback",
      retryCount: 1,
    });
    expect(out.kind).toBe("CONFLICT_NON_RETRYABLE");
    expect(out.message).toBe("Sessão de pagamento expirada.");
  });
});
