import { describe, expect, it } from "vitest";
import { resolvePadelMatchStats } from "@/domain/padel/score";

describe("padel timed games scoring", () => {
  it("aceita TIMED_GAMES com empate quando permitido", () => {
    const stats = resolvePadelMatchStats(null, {
      mode: "TIMED_GAMES",
      gamesA: 4,
      gamesB: 4,
      allowDraw: true,
      endedByBuzzer: true,
    });
    expect(stats).not.toBeNull();
    expect(stats?.mode).toBe("TIMED_GAMES");
    expect(stats?.isDraw).toBe(true);
    expect(stats?.winner).toBeNull();
    expect(stats?.aGames).toBe(4);
    expect(stats?.bGames).toBe(4);
  });

  it("bloqueia empate em TIMED_GAMES quando allowDraw=false", () => {
    const stats = resolvePadelMatchStats(null, {
      mode: "TIMED_GAMES",
      gamesA: 5,
      gamesB: 5,
      allowDraw: false,
    });
    expect(stats).toBeNull();
  });

  it("resolve BYE_NEUTRAL como resultado neutro", () => {
    const stats = resolvePadelMatchStats(null, {
      mode: "TIMED_GAMES",
      resultType: "BYE_NEUTRAL",
    });
    expect(stats).not.toBeNull();
    expect(stats?.resultType).toBe("BYE_NEUTRAL");
    expect(stats?.isDraw).toBe(true);
  });
});
