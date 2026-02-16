import { describe, expect, it } from "vitest";
import {
  applyInactivityToVisual,
  computeVisualLevel,
  glicko2Update,
  resolveCarryMultiplier,
  resolveTierMultiplier,
  scoreFromGames,
} from "@/domain/padel/ratingEngine";

describe("padel rating engine (B4)", () => {
  it("resolve multiplicadores canónicos por tier", () => {
    expect(resolveTierMultiplier("SOCIAL")).toBe(0.5);
    expect(resolveTierMultiplier("BRONZE")).toBe(1.3);
    expect(resolveTierMultiplier("MAJOR")).toBe(2);
    expect(resolveTierMultiplier("UNKNOWN")).toBe(1.3);
  });

  it("aplica carry/underdog por diferença de rating", () => {
    expect(resolveCarryMultiplier(1700, 1200, 1)).toBe(0.84);
    expect(resolveCarryMultiplier(1200, 1700, 1)).toBe(1.18);
    expect(resolveCarryMultiplier(1500, 1480, 0)).toBe(1);
  });

  it("calcula score relativo por games", () => {
    expect(scoreFromGames(12, 8)).toBeCloseTo(0.6);
    expect(scoreFromGames(8, 12)).toBeCloseTo(0.4);
    expect(scoreFromGames(0, 0)).toBe(0.5);
  });

  it("atualiza rating por glicko2 com variação coerente", () => {
    const strongerWin = glicko2Update({
      rating: 1500,
      rd: 80,
      sigma: 0.06,
      tau: 0.5,
      opponentRating: 1450,
      opponentRd: 90,
      actualScore: 1,
      multiplier: 1.3,
    });
    const upsetLoss = glicko2Update({
      rating: 1500,
      rd: 80,
      sigma: 0.06,
      tau: 0.5,
      opponentRating: 1450,
      opponentRd: 90,
      actualScore: 0,
      multiplier: 1.3,
    });

    expect(strongerWin.rating).toBeGreaterThan(1500);
    expect(upsetLoss.rating).toBeLessThan(1500);
    expect(strongerWin.rd).toBeGreaterThanOrEqual(30);
    expect(strongerWin.rd).toBeLessThanOrEqual(350);
  });

  it("conversão visual mantém líder em 1.00 e deriva por inatividade", () => {
    const leaderLevel = computeVisualLevel(1800, 1800);
    const challengerLevel = computeVisualLevel(1450, 1800);
    const inactive = applyInactivityToVisual(
      challengerLevel,
      new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
      new Date(),
    );

    expect(leaderLevel).toBe(1);
    expect(challengerLevel).toBeGreaterThan(1);
    expect(inactive).toBeGreaterThanOrEqual(challengerLevel);
  });
});
