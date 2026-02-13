import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function runRg(args: string[]) {
  try {
    return execFileSync("rg", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    const err = error as { status?: number; stdout?: string };
    if (err.status === 1) return "";
    throw error;
  }
}

describe("canonical org UI href guardrail", () => {
  it("blocks literal /organizacao hrefs in canonical org UI surfaces", () => {
    const output = runRg([
      "-n",
      "['\"]/organizacao",
      "app/org",
      "app/organizacao/OrganizationTopBar.tsx",
      "app/org/_components/subnav",
      "--glob",
      "*.ts",
      "--glob",
      "*.tsx",
    ]);

    expect(output).toBe("");
  });
});
