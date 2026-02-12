import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

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

describe("padel legacy hard-cut guardrails", () => {
  it("removes swap confirm compatibility route", () => {
    const routePath = resolve(process.cwd(), "app/api/padel/pairings/swap/confirm/[token]/route.ts");
    expect(existsSync(routePath)).toBe(false);
  });

  it("blocks frontend/runtime calls to removed swap confirm endpoint", () => {
    const output = run('rg -n "/api/padel/pairings/swap/confirm" app apps/mobile components lib domain -S');
    expect(output).toBe("");
  });

  it("requires invalid courtId to fail closed in padel match writes", () => {
    const file = resolve(process.cwd(), "app/api/padel/matches/route.ts");
    const content = readFileSync(file, "utf8");
    expect(content).toContain("INVALID_COURT_ID");
    expect(content).not.toContain("non-matching courtId as display number");
  });
});
