import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("stripe publishable key helpers contract", () => {
  it("mantém resolução explícita de chaves por ambiente", () => {
    const file = readFileSync(resolve(process.cwd(), "lib/stripeKeys.ts"), "utf8");
    expect(file).toContain("getStripePublishableKeyForEnv");
    expect(file).toContain("tryGetStripePublishableKeyForEnv");
    expect(file).toContain("ensureStripePublishableKeyMatchesEnv");
  });
});
