import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("topbar height feedback loop guardrail", () => {
  it("does not bind topbar self-height classes to --org-topbar-height", () => {
    const content = readFileSync("app/org/_internal/core/OrganizationTopBar.tsx", "utf8");
    expect(content).not.toContain("min-h-[var(--org-topbar-height)]");
    expect(content).not.toContain("h-[var(--org-topbar-height)]");
  });
});
