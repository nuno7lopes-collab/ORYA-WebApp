import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("tournament wizard ui contract", () => {
  it("removes checklist/chips copy from create wizard", () => {
    const source = readLocal("app/org/_internal/core/(dashboard)/padel/torneios/novo/PadelTournamentWizardClient.tsx");

    expect(source).not.toContain("CreateWizardChecklist");
    expect(source).not.toContain("CreateWizardShell");
    expect(source).not.toContain("CreateWizardSectionCard");
    expect(source).not.toContain("Criar = rascunho");
    expect(source).not.toContain('handleSubmit("PUBLISH")');
    expect(source).not.toContain("statusLabel=");
  });
});
