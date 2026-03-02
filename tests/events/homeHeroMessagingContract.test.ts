import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("home hero messaging contract", () => {
  it("mantem copy premium focada na app", () => {
    const source = readLocal("app/page.tsx");

    expect(source).toContain("A melhor app de padel.");
    expect(source).toContain("Instala a ORYA para descobrir torneios perto de ti e entrar em jogo mais rápido.");
    expect(source).toContain("Torneios perto de ti");
    expect(source).not.toContain("backoffice");
    expect(source).not.toContain("mensalidade");
    expect(source).not.toContain("Abrir Padel Hub");
  });

  it("remove links de produto extra no footer da home", () => {
    const source = readLocal("app/components/home/HomeFooter.tsx");

    expect(source).not.toContain("Abrir Padel Hub");
    expect(source).not.toContain("ORYA_APP_INSTALL_CTA_LABEL");
    expect(source).not.toContain("ORYA_APP_INSTALL_URL");
  });
});
