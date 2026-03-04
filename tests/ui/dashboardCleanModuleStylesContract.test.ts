import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();

const CLEAN_MODULE_FILES = [
  "app/org/[orgId]/finance/FinanceToolClient.tsx",
  "app/org/_internal/core/pagamentos/PayoutsPanel.tsx",
  "app/org/_internal/core/pagamentos/RefundsPanel.tsx",
  "app/org/_internal/core/pagamentos/invoices/invoices-client.tsx",
  "app/org/[orgId]/calendar/availability/page.tsx",
  "app/org/[orgId]/calendar/_components/CalendarCommandBar.tsx",
  "app/org/[orgId]/calendar/_components/day/SearchableEntitySelect.tsx",
  "app/org/_components/subnav/ToolSubnavShell.tsx",
  "app/org/_internal/core/ObjectiveSubnav.tsx",
  "app/org/_internal/core/(dashboard)/staff/page.tsx",
  "app/org/_internal/core/(dashboard)/settings/verify/page.tsx",
];

describe("dashboard clean module styles contract", () => {
  it("mantem finance/calendar/team sem padrões visuais legacy pesados", () => {
    const bannedPatterns: Array<{ label: string; pattern: RegExp }> = [
      { label: "legacy gradient", pattern: /bg-gradient-to-(br|r|l|b)/ },
      { label: "custom heavy shadow", pattern: /shadow-\[/ },
      { label: "backdrop blur", pattern: /backdrop-blur/ },
      { label: "hover scale old cta", pattern: /hover:scale-\[1\.02\]/ },
    ];

    for (const file of CLEAN_MODULE_FILES) {
      const source = readFileSync(resolve(ROOT, file), "utf8");
      for (const { label, pattern } of bannedPatterns) {
        expect(source, `${file} should not include ${label}`).not.toMatch(pattern);
      }
    }
  });
});
