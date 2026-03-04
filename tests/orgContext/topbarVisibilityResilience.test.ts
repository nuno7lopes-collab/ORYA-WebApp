import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("organization topbar visibility resilience", () => {
  it("pins visibility in canonical tool routes and resets when pathname changes", () => {
    const file = readFileSync("app/org/_internal/core/OrganizationTopBar.tsx", "utf8");

    expect(file).toContain("const isPinnedTopbarRoute");
    expect(file).toContain("shouldPinOrganizationTopbar(normalizedPathname)");
    expect(file).toMatch(
      /scrollDirectionDeltaRef\.current = 0;\s*setIsVisible\(true\);\s*}, \[normalizedPathname\]\);/,
    );
    expect(file).toMatch(
      /isPinnedTopbarRoute\s*\|\|\s*isVisible[\s\S]*\?\s*"translate-y-0"[\s\S]*:\s*"-translate-y-full"/,
    );
  });
});
