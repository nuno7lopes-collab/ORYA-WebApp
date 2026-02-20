import {
  detectStripeModeFromPublishableKey,
  normalizeStripeMode,
  resolveStripeRuntimeKey,
} from "../lib/stripeRuntime";

describe("stripe runtime helpers", () => {
  it("normaliza modos de stripe", () => {
    expect(normalizeStripeMode("prod")).toBe("prod");
    expect(normalizeStripeMode("production")).toBe("prod");
    expect(normalizeStripeMode("live")).toBe("prod");
    expect(normalizeStripeMode("test")).toBe("test");
    expect(normalizeStripeMode("staging")).toBe("test");
    expect(normalizeStripeMode("dev")).toBe("test");
  });

  it("deteta modo pela chave publishable", () => {
    expect(detectStripeModeFromPublishableKey("pk_test_123")).toBe("test");
    expect(detectStripeModeFromPublishableKey("pk_live_123")).toBe("prod");
    expect(detectStripeModeFromPublishableKey("pk_legacy")).toBeNull();
  });

  it("prefere a chave runtime e faz fallback para a chave local", () => {
    expect(
      resolveStripeRuntimeKey({
        runtimePublishableKey: "pk_live_runtime",
        fallbackPublishableKey: "pk_test_fallback",
      }),
    ).toBe("pk_live_runtime");
    expect(
      resolveStripeRuntimeKey({
        runtimePublishableKey: "",
        fallbackPublishableKey: "pk_test_fallback",
      }),
    ).toBe("pk_test_fallback");
  });
});
