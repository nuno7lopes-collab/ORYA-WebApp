import { describe, expect, it } from "vitest";
import {
  buildMexicanoRoundRelations,
  deriveMexicanoRoundEntries,
} from "@/domain/padel/mexicanoRecomposition";

describe("mexicano recomposition", () => {
  it("gera confronto por quarteto com fallback BYE para sobras", () => {
    const entries = deriveMexicanoRoundEntries([11, 12, 13, 14, 15]);
    expect(entries).toHaveLength(2);
    expect(entries[0]?.kind).toBe("MATCH");
    if (entries[0]?.kind === "MATCH") {
      expect(entries[0].sideA).toHaveLength(2);
      expect(entries[0].sideB).toHaveLength(2);
      const allPlayers = [...entries[0].sideA, ...entries[0].sideB].sort((a, b) => a - b);
      expect(allPlayers).toEqual([11, 12, 13, 14]);
    }
    expect(entries[1]).toEqual({ kind: "BYE", playerId: 15 });
  });

  it("evita repetição direta de parceiros da ronda anterior quando existe alternativa", () => {
    const previousRound = buildMexicanoRoundRelations([
      {
        sideA: [101, 102],
        sideB: [103, 104],
      },
    ]);
    const entries = deriveMexicanoRoundEntries([101, 102, 103, 104], {
      previousRoundRelations: previousRound,
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind).toBe("MATCH");
    if (entries[0]?.kind === "MATCH") {
      const sideA = entries[0].sideA.sort((a, b) => a - b).join(":");
      const sideB = entries[0].sideB.sort((a, b) => a - b).join(":");
      const teammateKeys = new Set([sideA, sideB]);
      expect(teammateKeys.has("101:102")).toBe(false);
      expect(teammateKeys.has("103:104")).toBe(false);
    }
  });
});
