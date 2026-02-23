import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("tournament wizard availability UX contract", () => {
  it("expõe atalhos para configurar dias/horários de forma rápida", () => {
    const source = readLocal("app/org/_internal/core/(dashboard)/padel/torneios/novo/PadelTournamentWizardClient.tsx");

    expect(source).toContain("Adicionar dia seguinte");
    expect(source).toContain("Aplicar 1.º horário a todos");
    expect(source).toContain("Copiar acima");
    expect(source).toContain("Dias válidos:");
    expect(source).toContain("Existem janelas sobrepostas no dia");
    expect(source).toContain("Horário inválido");
  });
});
