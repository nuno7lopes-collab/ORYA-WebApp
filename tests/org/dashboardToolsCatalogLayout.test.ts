import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("dashboard tools catalog layout", () => {
  it("keeps the final flat tool order", () => {
    const content = readLocal("app/org/_internal/core/DashboardClient.tsx");
    const match = content.match(/const TOOL_DISPLAY_ORDER: DashboardToolId\[\] = \[([\s\S]*?)\];/);
    expect(match).not.toBeNull();
    const ids = Array.from(match?.[1].matchAll(/"([^"]+)"/g) ?? []).map((entry) => entry[1]);
    expect(ids).toEqual([
      "calendar",
      "academia",
      "checkin",
      "padel-tournaments",
      "eventos",
      "padel-club",
      "inscricoes",
      "mensagens",
      "crm",
      "analytics",
      "financeiro",
      "marketing",
      "loja",
      "staff",
      "politicas",
      "settings",
    ]);
  });

  it("renders tools without flow groups and without KPI cards in create view", () => {
    const content = readLocal("app/org/_internal/core/DashboardClient.tsx");
    expect(content).not.toContain("TOOL_FLOW_ORDER");
    expect(content).not.toContain("toolGroups.map(");
    expect(content).not.toContain("Estado do clube");
    expect(content).not.toContain("Oferta ativa");
    expect(content).not.toContain("Agenda 7 dias");
    expect(content).toContain("Usa a barra lateral para abrir as ferramentas.");
    expect(content).not.toContain("renderToolCard(tool)");
  });

  it("keeps Eventos separado de Torneios no gating de permissões", () => {
    const content = readLocal("app/org/_internal/core/DashboardClient.tsx");
    expect(content).toContain('const canAccessEventos = canAccessModule("EVENTOS");');
    expect(content).toContain("eventos: canAccessEventos");
    expect(content).toContain('moduleKey: "EVENTOS"');
  });
});
