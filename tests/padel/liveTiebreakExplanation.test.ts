import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("padel live tiebreak explanation contract", () => {
  it("read-model expõe tiebreakExplanation por linha de standings", () => {
    const readModel = readLocal("domain/padel/liveReadModel.ts");
    expect(readModel).toContain("tiebreakExplanation");
    expect(readModel).toContain("Desempate aplicado pelos critérios oficiais do torneio.");
    expect(readModel).toContain("Posição definida por pontos e saldo no grupo.");
  });
});
