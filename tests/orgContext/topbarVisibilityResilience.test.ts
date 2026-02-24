import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("organization topbar visibility resilience", () => {
  it("pins visibility in canonical tool routes and resets when pathname changes", () => {
    const file = readFileSync("app/org/_internal/core/OrganizationTopBar.tsx", "utf8");

    expect(file).toContain("const isPinnedTopbarRoute");
    expect(file).toContain("shouldPinOrganizationTopbar(normalizedPathname)");
    expect(file).toMatch(/setIsVisible\(true\);\s*\n\s*}, \[normalizedPathname\]\);/);
    expect(file).toContain("isPinnedTopbarRoute || isVisible ? \"translate-y-0\" : \"-translate-y-full\"");
  });
});
