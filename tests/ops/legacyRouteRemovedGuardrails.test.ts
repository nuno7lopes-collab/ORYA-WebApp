import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function runRg(args: string[]) {
  try {
    return execFileSync("rg", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    const err = error as { status?: number };
    if (err.status === 1) return "";
    throw error;
  }
}

describe("legacy removed query guardrails", () => {
  it("blocks legacy query usage in finance/analytics links", () => {
    const output = runRg([
      "-n",
      "/(analytics|finance)\\?(tab=|section=|analytics=|finance=)",
      "app/org",
      "--glob",
      "*.ts",
      "--glob",
      "*.tsx",
    ]);

    expect(output).toBe("");
  });
});
