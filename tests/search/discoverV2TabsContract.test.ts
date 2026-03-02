import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("discover v2 tabs contract", () => {
  it("mantem tabs e endpoints da fase 1 alinhados", () => {
    const source = readLocal("app/descobrir/_explorar/DiscoverPadelTabsContent.tsx");

    expect(source).toContain('id: "torneios"');
    expect(source).toContain('id: "clubes"');
    expect(source).toContain('id: "reservas"');
    expect(source).toContain('id: "jogadores"');
    expect(source).toContain('id: "academia"');

    expect(source).toContain("/api/padel/discover");
    expect(source).toContain("/api/padel/public/clubs");
    expect(source).toContain('kind", targetTab === "reservas" ? "COURT" : "CLASS"');
    expect(source).toContain("/api/padel/public/services");
    expect(source).toContain("/api/padel/rankings");
  });

  it("garante redirects legados para query tab", () => {
    const torneios = readLocal("app/descobrir/torneios/page.tsx");
    const eventos = readLocal("app/descobrir/eventos/page.tsx");
    const reservas = readLocal("app/descobrir/reservas/page.tsx");

    expect(torneios).toContain('redirect("/descobrir?tab=torneios")');
    expect(eventos).toContain('redirect("/descobrir?tab=torneios")');
    expect(reservas).toContain('redirect("/descobrir?tab=reservas")');
  });
});
