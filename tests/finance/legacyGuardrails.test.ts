import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function runRg(command: string) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (err: any) {
    if (typeof err?.status === "number" && err.status === 1) {
      return "";
    }
    throw err;
  }
}

describe("finance legacy guardrails", () => {
  it("blocks policyVersionApplied=0 writes", () => {
    const output = runRg(
      'set -o noglob; rg -n "policyVersionApplied\\s*:\\s*0" domain app lib',
    );
    expect(output).toBe("");
  });

  it("blocks legacy fee modes in runtime scope", () => {
    const output = runRg(
      'set -o noglob; rg -n "FeeMode\\.ON_TOP|\\bON_TOP\\b|\\bABSORBED\\b" app domain lib',
    );
    expect(output).toBe("");
  });
});
