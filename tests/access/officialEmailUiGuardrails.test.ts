import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const UI_FILES = [
  "app/org/_internal/core/(dashboard)/settings/page.tsx",
  "app/admin/(protected)/organizacoes/page.tsx",
  "app/[username]/page.tsx",
  "app/org/_internal/core/OrganizationTopBar.tsx",
  "app/org/_internal/core/OrganizationDashboardShell.tsx",
  "app/org/_internal/core/DashboardClient.tsx",
  "app/org/_internal/core/(dashboard)/eventos/novo/page.tsx",
];

const bannedPatterns: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /contactEmailFromAccount/, label: "contactEmailFromAccount fallback" },
  { pattern: /officialEmailVerifiedAt\s*\?\?\s*new Date\(\)\.toISOString\(\)/, label: "fake verified fallback" },
  { pattern: /officialEmail[^\n]*\.toLowerCase\(/, label: "officialEmail.toLowerCase" },
  { pattern: /officialEmail[^\n]*\.trim\(/, label: "officialEmail.trim" },
];

describe("official email UI guardrails", () => {
  it("does not include forbidden fallbacks or ad-hoc normalization", () => {
    for (const rel of UI_FILES) {
      const content = fs.readFileSync(path.join(ROOT, rel), "utf8");
      for (const { pattern, label } of bannedPatterns) {
        expect(content, `${rel} should not include ${label}`).not.toMatch(pattern);
      }
    }
  });
});
