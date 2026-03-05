import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("dashboard tools catalog layout", () => {
  it("keeps the final flat tool order", () => {
    const content = readLocal("app/org/_internal/core/organizationToolNavigation.ts");
    const match = content.match(/const tools: Array<OrganizationNavTool \| null> = \[([\s\S]*?)\n\s*\];/);
    expect(match).not.toBeNull();
    const ids = Array.from(match?.[1].matchAll(/id:\s*"([^"]+)"/g) ?? []).map((entry) => entry[1]);
    expect(ids).toEqual([
      "dashboard",
      "calendar",
      "academy",
      "check-in",
      "padel-tournaments",
      "events",
      "padel-club",
      "forms",
      "chat",
      "crm",
      "analytics",
      "finance",
      "marketing",
      "store",
      "team",
      "policies",
      "settings",
    ]);
  });

  it("renders tools sem flow groups e com KPI cards de resumo diário no create view", () => {
    const content = readLocal("app/org/_internal/core/DashboardClient.tsx");
    expect(content).not.toContain("TOOL_FLOW_ORDER");
    expect(content).not.toContain("toolGroups.map(");
    expect(content).toContain("Ponto de situação");
    expect(content).toContain("dailySummaryKpis.map((kpi)");
    expect(content).toContain("id=\"ferramentas\"");
  });

  it("keeps Eventos separado de Torneios no gating de permissões", () => {
    const dashboard = readLocal("app/org/_internal/core/DashboardClient.tsx");
    const nav = readLocal("app/org/_internal/core/organizationToolNavigation.ts");
    expect(dashboard).toContain('const canAccessEventos = canAccessModule("EVENTOS");');
    expect(nav).toContain('id: "padel-tournaments"');
    expect(nav).toContain("access.canAccessEventos");
    expect(nav).toContain('id: "events"');
  });
});
