import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("padel calendar copy hygiene", () => {
  it("remove mensagens técnicas de URL do fluxo de calendário", () => {
    const manualPanel = readLocal(
      "app/org/_internal/core/(dashboard)/padel/calendar/CalendarManualAdjustmentsPanel.tsx",
    );
    const matchPanel = readLocal(
      "app/org/_internal/core/(dashboard)/padel/calendar/CalendarMatchAdjustmentsPanel.tsx",
    );

    expect(manualPanel).not.toContain("eventId no URL");
    expect(matchPanel).not.toContain("eventId no URL");
    expect(manualPanel).toContain("Seleciona um torneio");
    expect(matchPanel).toContain("Seleciona um torneio");
  });

  it("mantém operações avançadas com copy curto e objetivo", () => {
    const hub = readLocal(
      "app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx",
    );

    expect(hub).toContain("Bloqueios e overrides");
    expect(hub).toContain("Registos recentes");
    expect(hub).not.toContain("Operações avançadas de bloqueio");
  });
});
