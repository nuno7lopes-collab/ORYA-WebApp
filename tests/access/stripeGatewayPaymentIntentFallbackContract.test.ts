import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const filePath = resolve(process.cwd(), "domain/finance/gateway/stripeGateway.ts");

describe("stripe gateway payment intent fallback contract", () => {
  it("faz fallback para ambiente alternativo quando PI não existe no ambiente ativo", () => {
    const file = readFileSync(filePath, "utf8");
    expect(file).toContain("isNoSuchPaymentIntentError");
    expect(file).toContain("fallbackEnv: StripeRuntimeEnv");
    expect(file).toContain("getStripeClientForEnv(fallbackEnv)");
  });
});
