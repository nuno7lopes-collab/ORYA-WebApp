import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = process.cwd();
const APP_ORG_DIR = resolve(ROOT, "app/org");
const DASHBOARD_DIR = resolve(ROOT, "app/org/_internal/core/(dashboard)");
const DASHBOARD_SHELL_FILE = resolve(ROOT, "app/org/_internal/core/OrganizationDashboardShell.tsx");
const DASHBOARD_UI_FILE = resolve(ROOT, "app/org/_internal/core/dashboardUi.ts");
const GLOBALS_FILE = resolve(ROOT, "app/globals.css");

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolutePath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(absolutePath));
      continue;
    }
    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(absolutePath);
    }
  }
  return files;
}

describe("dashboard clean rollout contract", () => {
  it("ativa clean-v1 no shell global do dashboard", () => {
    const source = readFileSync(DASHBOARD_SHELL_FILE, "utf8");
    expect(source).toContain("data-org-dashboard-shell");
    expect(source).toContain('data-org-ui="clean-v1"');
  });

  it("usa CTAs clean por defeito no dashboardUi interno", () => {
    const source = readFileSync(DASHBOARD_UI_FILE, "utf8");
    expect(source).toContain("export const CTA_PRIMARY = CTA_PRIMARY_CLEAN;");
    expect(source).toContain("export const CTA_SECONDARY = CTA_SECONDARY_CLEAN;");
    expect(source).toContain("export const CTA_DANGER = CTA_DANGER_CLEAN;");
  });

  it("mantem o escopo clean-v1 para overrides globais do dashboard", () => {
    const source = readFileSync(GLOBALS_FILE, "utf8");
    expect(source).toContain('[data-org-dashboard-shell][data-org-ui="clean-v1"]');
  });

  it("força neutralização global de gradientes/sombras/blur no shell clean-v1", () => {
    const source = readFileSync(GLOBALS_FILE, "utf8");
    expect(source).toContain('[data-org-dashboard-shell][data-org-ui="clean-v1"] :is(');
    expect(source).toContain('[class*="bg-gradient"]');
    expect(source).toContain('[data-org-dashboard-shell][data-org-ui="clean-v1"] [class*="shadow"]');
    expect(source).toContain('[data-org-dashboard-shell][data-org-ui="clean-v1"] [class*="backdrop-blur"]');
  });

  it("evita imports diretos de _shared/dashboardUi nas páginas do dashboard", () => {
    const files = collectSourceFiles(DASHBOARD_DIR);
    const offenders = files.filter((file) => {
      const source = readFileSync(file, "utf8");
      return source.includes('from "@/app/org/_shared/dashboardUi"');
    });
    expect(offenders).toEqual([]);
  });

  it("evita imports diretos de _shared/dashboardUi nas rotas /org (exceto adapter interno)", () => {
    const files = collectSourceFiles(APP_ORG_DIR);
    const offenders = files.filter((file) => {
      if (file === DASHBOARD_UI_FILE) return false;
      const source = readFileSync(file, "utf8");
      return source.includes('from "@/app/org/_shared/dashboardUi"');
    });
    expect(offenders).toEqual([]);
  });
});
