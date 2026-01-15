import { describe, expect, it } from "vitest";
import {
  generateDrawAB,
  generateRoundRobin,
  generateSingleElimination,
} from "@/domain/tournaments/generationCore";

describe("padel generation helpers", () => {
  it("generates round-robin with n-1 rounds", () => {
    const rounds = generateRoundRobin([1, 2, 3, 4], "seed");
    expect(rounds.length).toBe(3);
    rounds.forEach((round) => {
      expect(round.length).toBe(2);
    });

    const pairs = new Set(
      rounds
        .flat()
        .map((m) => [m.a, m.b].sort((a, b) => (a ?? 0) - (b ?? 0)).join("-")),
    );
    expect(pairs.size).toBe(6);
  });

  it("generates single elimination with power-of-two bracket", () => {
    const bracket = generateSingleElimination([1, 2, 3, 4, 5, 6], "seed");
    expect(bracket.length).toBe(3);
    expect(bracket[0].length).toBe(4);
    expect(bracket[1].length).toBe(2);
    expect(bracket[2].length).toBe(1);
  });

  it("generates A/B draw with main bracket and empty consolation", () => {
    const bracket = generateDrawAB([1, 2, 3, 4], "seed");
    expect(bracket.main.length).toBe(2);
    expect(bracket.consolation.length).toBe(0);
  });
});
