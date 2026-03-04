import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const SETTINGS_PAGE = "app/org/_internal/core/(dashboard)/settings/page.tsx";

describe("settings clean styles contract", () => {
  it("usa escopo clean-v1 e evita padrões visuais antigos", () => {
    const source = readFileSync(resolve(ROOT, SETTINGS_PAGE), "utf8");

    expect(source).toContain('data-org-ui="clean-v1"');
    expect(source).toContain("org-clean-section");
    expect(source).toContain("CTA_PRIMARY_CLEAN");
    expect(source).toContain("CTA_SECONDARY_CLEAN");
    expect(source).toContain("CTA_DANGER_CLEAN");

    const bannedPatterns: Array<{ label: string; pattern: RegExp }> = [
      { label: "legacy gradient surface", pattern: /bg-gradient-to-br/ },
      { label: "heavy backdrop blur", pattern: /backdrop-blur-3xl/ },
      { label: "heavy custom shadow", pattern: /shadow-\[/ },
    ];

    for (const { label, pattern } of bannedPatterns) {
      expect(source, `settings page should not include ${label}`).not.toMatch(pattern);
    }
  });
});
