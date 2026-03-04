import fs from "node:fs";
import path from "node:path";

describe("community invite auth CTA contract", () => {
  it("mantém CTA para iniciar sessão no ecrã de convite", () => {
    const filePath = path.resolve(
      __dirname,
      "..",
      "app/comunidade/mensagens/convite/[token].tsx",
    );
    const source = fs.readFileSync(filePath, "utf8");

    expect(source).toContain("setRequiresAuth(true)");
    expect(source).toContain('pathname: "/auth"');
    expect(source).toContain("next: `/comunidade/mensagens/convite/${encodeURIComponent(token.trim())}`");
    expect(source).toContain("Iniciar sessão");
  });
});
