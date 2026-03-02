import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("dashboard tool icons", () => {
  it("defines dedicated icon keys for each dashboard tool card", () => {
    const content = readLocal("app/org/_internal/core/DashboardClient.tsx");
    expect(content).toContain('id: "eventos"');
    expect(content).toContain('iconKey: "TOOL_EVENTOS"');
    expect(content).toContain('id: "academia"');
    expect(content).toContain('iconKey: "TOOL_RESERVAS"');
    expect(content).toContain('id: "calendar"');
    expect(content).toContain('iconKey: "TOOL_CALENDARIO"');
    expect(content).toContain('id: "financeiro"');
    expect(content).toContain('iconKey: "TOOL_FINANCAS"');
    expect(content).toContain('id: "analytics"');
    expect(content).toContain('iconKey: "TOOL_ANALYTICS"');
  });

  it("ensures academy and calendar do not share the same icon key", () => {
    const content = readLocal("app/org/_internal/core/DashboardClient.tsx");
    expect(content).toContain('id: "academia"');
    expect(content).toContain('iconKey: "TOOL_RESERVAS"');
    expect(content).toContain('id: "calendar"');
    expect(content).toContain('iconKey: "TOOL_CALENDARIO"');
    expect(content).not.toContain('id: "calendar"\n              moduleKey: "RESERVAS",\n              iconKey: "TOOL_RESERVAS"');
  });
});
