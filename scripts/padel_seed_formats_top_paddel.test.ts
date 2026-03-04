import { describe, expect, it } from "vitest";
import { parseSeedArgs, pickTournamentPriceCents } from "./padel_seed_formats_top_paddel";

describe("padel_seed_formats_top_paddel", () => {
  it("faz parse dos argumentos de CLI com defaults", () => {
    const options = parseSeedArgs(["--run-tag", "run-001"]);
    expect(options.orgUsername).toBe("top_padel");
    expect(options.runTag).toBe("run-001");
    expect(options.priceMin).toBe(10);
    expect(options.priceMax).toBe(20);
    expect(options.targetMaxTeams).toBe(20);
    expect(options.dryRun).toBe(false);
    expect(options.resetExisting).toBe(false);
  });

  it("faz parse das flags booleanas e limites customizados", () => {
    const options = parseSeedArgs([
      "--run-tag",
      "seed-x",
      "--org-username",
      "top_padel",
      "--price-min",
      "12",
      "--price-max",
      "18",
      "--target-max-teams",
      "14",
      "--dry-run",
      "--reset-existing",
    ]);
    expect(options.priceMin).toBe(12);
    expect(options.priceMax).toBe(18);
    expect(options.targetMaxTeams).toBe(14);
    expect(options.dryRun).toBe(true);
    expect(options.resetExisting).toBe(true);
  });

  it("falha quando falta runTag", () => {
    expect(() => parseSeedArgs([])).toThrow("Missing --run-tag");
  });

  it("gera preço determinístico no intervalo", () => {
    const a = pickTournamentPriceCents({
      runTag: "seed-1",
      format: "MEXICANO",
      minEuros: 10,
      maxEuros: 20,
    });
    const b = pickTournamentPriceCents({
      runTag: "seed-1",
      format: "MEXICANO",
      minEuros: 10,
      maxEuros: 20,
    });
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(1000);
    expect(a).toBeLessThanOrEqual(2000);
  });
});

