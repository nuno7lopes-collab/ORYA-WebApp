import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";

function run(command: string, shell = "/bin/zsh") {
  try {
    return execSync(command, { stdio: "pipe", shell }).toString().trim();
  } catch (error: any) {
    if (typeof error?.status === "number" && error.status === 1) {
      return "";
    }
    throw error;
  }
}

describe("canonical docs path guardrails", () => {
  it("blocks references to deprecated non-v1 canonical docs paths", () => {
    const output = run(
      'rg -n "docs/planning_registry\\.md|docs/ssot_registry\\.md|README\\.md|SECURITY_HARDENING\\.md" app components lib domain docs scripts tests -S',
    );
    expect(output).toBe("");
  });
});
