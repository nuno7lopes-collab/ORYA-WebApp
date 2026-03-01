import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function read(relPath: string) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

describe("padel public profile guardrails", () => {
  it("mantém hard-cut do perfil público user para /<username>/padel", () => {
    const source = read("app/[username]/page.tsx");
    expect(source).toContain("redirect(`/${usernameParam}/padel`)");
    expect(source).toContain("const canonicalUrl = organization ? `${baseUrl}/${username}` : `${baseUrl}/${username}/padel`");
  });

  it("mantém superfície pública padel com fontes canónicas e blocos obrigatórios", () => {
    const source = read("app/[username]/padel/page.tsx");
    expect(source).toMatch(/prisma\.padelPlayerProfile\.findFirst\(/);
    expect(source).toMatch(/prisma\.padelRatingProfile\.count\(/);
    expect(source).toContain("Próximos e últimos");
    expect(source).toContain("Top 3 clubes");
    expect(source).toContain("Top 3 duplas");
    expect(source).toContain("rating: null");
    expect(source).not.toContain("Padel indisponível.");
  });

  it("regista no SSOT as regras normativas de perfil padel-first", () => {
    const ssot = read("docs/ssot_registry_v1.md");
    expect(ssot).toContain("Superfície pública canónica de jogador competitivo é `/<username>/padel`");
    expect(ssot).toContain("No copy público user-facing de superfícies Padel, deve usar-se `clube`");
  });
});
