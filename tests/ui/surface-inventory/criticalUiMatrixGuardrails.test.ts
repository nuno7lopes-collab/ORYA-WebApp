import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type MatrixEntry = {
  id: string;
  surface: string;
  file: string;
  checks: string[];
};

const CHECK_PATTERNS: Record<string, RegExp> = {
  loading: /(\bisLoading\b|\bloading\b|A carregar|a carregar)/i,
  error: /(\berror\b|Erro|erro|Falha|falha|errorMsg|setError)/i,
  empty: /(\bempty\b|Sem\s|vazio|ListEmptyComponent|Ainda não)/i,
  focus: /(focus:ring|focus:border|focus:outline|focus-visible|onFocus|outline-none.*focus)/i,
  a11y: /(aria-|\brole=|ariaCurrent|aria-current)/i,
  a11yMobile: /(accessibilityRole|accessibilityLabel|accessibilityState)/i,
  touchTarget: /(tokens\.layout\.touchTarget|minHeight:\s*tokens\.layout\.touchTarget)/i,
  canonicalNav: /(buildOrgHref|appendOrganizationIdToHref|buildOrgHubHref)/,
  singleActive: /(aria-current=\{active\s*\?\s*"page"\s*:\s*undefined\}|resolveActiveToolSubnavItem)/,
};

describe("critical ui matrix guardrails", () => {
  it("covers required critical surfaces", () => {
    const matrixPath = resolve(process.cwd(), "tests/ui/surface-inventory/critical-ui-matrix.json");
    const entries = JSON.parse(readFileSync(matrixPath, "utf8")) as MatrixEntry[];

    expect(entries.length).toBeGreaterThanOrEqual(35);

    const bySurface = entries.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.surface] = (acc[entry.surface] ?? 0) + 1;
      return acc;
    }, {});
    expect(bySurface.org ?? 0).toBeGreaterThanOrEqual(8);
    expect(bySurface.admin ?? 0).toBeGreaterThanOrEqual(8);
    expect(bySurface.user ?? 0).toBeGreaterThanOrEqual(5);
    expect(bySurface.public ?? 0).toBeGreaterThanOrEqual(3);
    expect(bySurface.mobile ?? 0).toBeGreaterThanOrEqual(10);

    for (const entry of entries) {
      const filePath = resolve(process.cwd(), entry.file);
      const content = readFileSync(filePath, "utf8");

      for (const check of entry.checks) {
        const pattern = CHECK_PATTERNS[check];
        expect(pattern, `unknown check '${check}' in '${entry.id}'`).toBeDefined();
        expect(content, `${entry.id} missing ${check} (${entry.file})`).toMatch(pattern);
      }
    }
  });
});
