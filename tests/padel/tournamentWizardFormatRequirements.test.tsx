import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("tournament wizard format requirements", () => {
  it("mantém formatos avançados no wizard com opções específicas", () => {
    const source = readLocal("app/org/_internal/core/(dashboard)/padel/torneios/novo/PadelTournamentWizardClient.tsx");

    expect(source).toContain('"QUADRO_AB"');
    expect(source).toContain('"DUPLA_ELIMINACAO"');
    expect(source).toContain('"NON_STOP"');
    expect(source).toContain('"AMERICANO"');
    expect(source).toContain('"MEXICANO"');
  });

  it("aplica regras específicas de NON_STOP e AMERICANO/MEXICANO", () => {
    const source = readLocal("app/org/_internal/core/(dashboard)/padel/torneios/novo/PadelTournamentWizardClient.tsx");

    expect(source).toContain("isAmMxFormat");
    expect(source).toContain("isNonStopFormat");
    expect(source).toContain("amMxMode");
    expect(source).toContain("amMxProgressionMode");
    expect(source).toContain("nonStopMode");
    expect(source).toContain("nonStopRounds");
    expect(source).toContain("Define rondas válidas para NON_STOP em");
  });

  it("persiste configuração por formato no payload final", () => {
    const source = readLocal("app/org/_internal/core/(dashboard)/padel/torneios/novo/PadelTournamentWizardClient.tsx");

    expect(source).toContain("categoryConfigs");
    expect(source).toContain("format,");
    expect(source).toContain("advancedSettings:");
    expect(source).toContain("formatProfilesByCategory");
    expect(source).toContain("selectedCategories.reduce<Record<string, WizardFormatProfile>>");
    expect(source).toContain('acc[String(category.id)]');
    expect(source).toContain("resolveCategoryFormatProfile(cat.id)");
    expect(source).toContain("Formato da categoria");
  });
});
