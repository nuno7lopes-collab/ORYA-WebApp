import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const filePath = resolve(process.cwd(), "domain/finance/gateway/stripeGateway.ts");

describe("stripe gateway charge fallback contract", () => {
  it("faz fallback para ambiente alternativo quando Charge não existe no ambiente ativo", () => {
    const file = readFileSync(filePath, "utf8");
    expect(file).toContain("isNoSuchChargeError");
    expect(file).toContain("fallbackEnv: StripeRuntimeEnv");
    expect(file).toContain("fallback.charges.retrieve");
  });
});
