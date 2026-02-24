import { describe, expect, it } from "vitest";
import { execSync } from "child_process";

function assertNoMatches(command: string, label: string) {
  try {
    execSync(command, { stdio: "pipe" });
    throw new Error(`${label} found matches`);
  } catch (err: any) {
    if (typeof err?.status === "number" && err.status === 1) {
      return;
    }
    const output = err?.stdout ? String(err.stdout) : "";
    const stderr = err?.stderr ? String(err.stderr) : "";
    throw new Error(`${label} check failed\n${output}${stderr}`);
  }
}

describe("bookings canonical query guardrails", () => {
  it("blocks legacy query-based bookings navigation patterns", () => {
    expect(() =>
      assertNoMatches(
        [
          "rg -n",
          "\"/bookings\\\\?tab=availability|[?&]bookings=(availability|prices|integrations)\"",
          "app lib -S",
        ].join(" "),
        "Legacy bookings query pattern",
      ),
    ).not.toThrow();
  });
});
