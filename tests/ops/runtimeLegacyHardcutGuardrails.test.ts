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

describe("runtime legacy hard-cut guardrails", () => {
  it("blocks legacy runtime tokens removed in hard-cut", () => {
    const output = run(
      'rg -n "legacyStale|mapV7StatusToLegacy|deriveRegistrationStatusFromPairing|Backwards-compatible aliases for existing imports" app lib domain tests -S -g "!tests/ops/runtimeLegacyHardcutGuardrails.test.ts"',
    );
    expect(output).toBe("");
  });
});
