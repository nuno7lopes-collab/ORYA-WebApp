import { describe, expect, it } from "vitest";
import { advancePadelKnockoutWinner, autoAdvancePadelByes } from "@/domain/padel/knockoutAdvance";

describe("padel knockout advance", () => {
  it("advances winner to the next round", async () => {
    const matches = [
      { id: 1, roundLabel: "SEMIFINAL", pairingAId: 11, pairingBId: 12, winnerPairingId: null },
      { id: 2, roundLabel: "SEMIFINAL", pairingAId: 13, pairingBId: 14, winnerPairingId: null },
      { id: 3, roundLabel: "FINAL", pairingAId: null, pairingBId: null, winnerPairingId: null },
    ];

    const updateMatch = async (matchId: number, data: any) => {
      const target = matches.find((m) => m.id === matchId)!;
      Object.assign(target, data);
      return {
        id: target.id,
        roundLabel: target.roundLabel,
        pairingAId: target.pairingAId ?? null,
        pairingBId: target.pairingBId ?? null,
        winnerPairingId: target.winnerPairingId ?? null,
      };
    };

    await advancePadelKnockoutWinner({
      matches,
      updateMatch,
      winnerMatchId: 1,
      winnerPairingId: 11,
    });

    const final = matches.find((m) => m.id === 3)!;
    expect(final.pairingAId).toBe(11);
  });

  it("auto-advances byes and fills next round", async () => {
    const matches = [
      { id: 10, roundLabel: "SEMIFINAL", pairingAId: 21, pairingBId: null, winnerPairingId: null },
      { id: 11, roundLabel: "SEMIFINAL", pairingAId: 22, pairingBId: 23, winnerPairingId: null },
      { id: 12, roundLabel: "FINAL", pairingAId: null, pairingBId: null, winnerPairingId: null },
    ];

    const updateMatch = async (matchId: number, data: any) => {
      const target = matches.find((m) => m.id === matchId)!;
      Object.assign(target, data);
      return {
        id: target.id,
        roundLabel: target.roundLabel,
        pairingAId: target.pairingAId ?? null,
        pairingBId: target.pairingBId ?? null,
        winnerPairingId: target.winnerPairingId ?? null,
      };
    };

    await autoAdvancePadelByes({
      matches,
      updateMatch,
    });

    const final = matches.find((m) => m.id === 12)!;
    expect(final.pairingAId).toBe(21);
  });
});
