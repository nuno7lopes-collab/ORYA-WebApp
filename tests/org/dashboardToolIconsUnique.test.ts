import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("dashboard tool icons", () => {
  it("defines dedicated icon keys for each dashboard tool card", () => {
    const content = readLocal("app/org/_internal/core/moduleIcons.tsx");
    expect(content).toContain("TOOL_EVENTOS: IconToolEventos");
    expect(content).toContain("TOOL_RESERVAS: IconToolReservas");
    expect(content).toContain("TOOL_CALENDARIO: IconToolCalendario");
    expect(content).toContain("TOOL_FINANCAS: IconToolFinancas");
    expect(content).toContain("TOOL_ANALYTICS: IconToolAnalytics");
  });

  it("ensures academy and calendar do not share the same icon key", () => {
    const content = readLocal("app/org/_internal/core/moduleIcons.tsx");
    expect(content).toContain("TOOL_RESERVAS: IconToolReservas");
    expect(content).toContain("TOOL_CALENDARIO: IconToolCalendario");
    expect(content).not.toContain("TOOL_CALENDARIO: IconToolReservas");
  });
});
