import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const MUTABLE_INFRA_ROUTES = [
  "app/api/admin/infra/start/route.ts",
  "app/api/admin/infra/deploy/route.ts",
  "app/api/admin/infra/resume/route.ts",
  "app/api/admin/infra/soft-pause/route.ts",
  "app/api/admin/infra/hard-pause/route.ts",
  "app/api/admin/infra/migrate/route.ts",
  "app/api/admin/infra/mode/route.ts",
  "app/api/admin/infra/rotate-secrets/route.ts",
];

function runRg(command: string) {
  try {
    return execSync(command, { stdio: "pipe" }).toString().trim();
  } catch (error: any) {
    if (typeof error?.status === "number" && error.status === 1) {
      return "";
    }
    throw error;
  }
}

describe("admin MFA hard-cut guardrails", () => {
  it("blocks legacy break-glass token/header in active code", () => {
    const output = runRg('rg -n "ADMIN_BREAK_GLASS_TOKEN|x-orya-break-glass" app lib infra -S');
    expect(output).toBe("");
  });

  it("blocks MFA management wiring inside infra UI", () => {
    const output = runRg('rg -n "/api/admin/mfa/" "app/admin/(protected)/infra/InfraClient.tsx" -S');
    expect(output).toBe("");
  });

  it("keeps infra mutable routes without per-action MFA fields and with req-aware admin auth", () => {
    for (const file of MUTABLE_INFRA_ROUTES) {
      const content = readFileSync(file, "utf8");
      expect(content.includes("mfaCode") || content.includes("recoveryCode")).toBe(false);
      expect(content.includes("requireAdminUser({ req })")).toBe(true);
    }
  });
});
