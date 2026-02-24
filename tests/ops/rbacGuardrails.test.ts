import { describe, expect, it } from "vitest";
import { spawnSync } from "child_process";

const FORBIDDEN_PATTERNS = 'allowedRoles|ALLOWED_ROLES|isOrgAdminOrAbove\\(|isOrgOwner\\(';

describe("rbac drift guardrails", () => {
  it("blocks ad-hoc RBAC tokens in app/api", () => {
    const result = spawnSync("rg", ["-n", FORBIDDEN_PATTERNS, "app/api", "-S"], { encoding: "utf8" });
    const output = (result.stdout || "").trim();
    if (result.status !== 0 && result.status !== 1) {
      const stderr = (result.stderr || "").trim();
      throw new Error(`rbac guardrail rg failed (status ${result.status}): ${stderr || "unknown error"}`);
    }
    expect(output).toBe("");
  });
});
