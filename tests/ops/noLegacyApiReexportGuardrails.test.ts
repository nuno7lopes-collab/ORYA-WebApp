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

describe("no legacy api re-export guardrail", () => {
  it("blocks re-export of removed legacy handlers in app/api", () => {
    const output = runRg([
      "--pcre2",
      "-n",
      "export\\s+(\\*|\\{[^}]*\\})\\s+from\\s+[\"']@/app/api/(organizacao|org-hub/organizations/owner/(transfer|confirm))[\"']",
      "app/api",
      "--glob",
      "*.ts",
    ]);

    expect(output).toBe("");
  });
});
