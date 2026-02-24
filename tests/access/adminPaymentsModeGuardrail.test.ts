import { describe, expect, it } from "vitest";

describe("admin payments mode guardrails", () => {
  it("update-payments-mode sincroniza payoutMode em ambos os sentidos", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const file = readFileSync(
      resolve(process.cwd(), "app/api/admin/organizacoes/update-payments-mode/route.ts"),
      "utf8",
    );
    expect(file).toContain("const targetPayoutMode =");
    expect(file).toContain("payoutMode: { not: targetPayoutMode }");
    expect(file).toContain("payoutMode: targetPayoutMode");
    expect(file).not.toContain("if (organization.orgType === orgType) {");
  });

  it("verify-platform-email corrige payoutMode para PLATFORM", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const file = readFileSync(
      resolve(process.cwd(), "app/api/admin/organizacoes/verify-platform-email/route.ts"),
      "utf8",
    );
    expect(file).toContain("payoutMode: { not: PayoutMode.PLATFORM }");
    expect(file).toContain("payoutMode: PayoutMode.PLATFORM");
  });
});
