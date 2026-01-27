import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const UI_FILES = [
  "app/organizacao/(dashboard)/settings/page.tsx",
  "app/admin/organizacoes/page.tsx",
  "app/[username]/page.tsx",
  "app/organizacao/OrganizationTopBar.tsx",
  "app/organizacao/OrganizationDashboardShell.tsx",
  "app/organizacao/DashboardClient.tsx",
  "app/organizacao/(dashboard)/eventos/novo/page.tsx",
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
