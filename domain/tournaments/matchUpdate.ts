import { prisma } from "@/lib/prisma";
import { Prisma, TournamentMatchStatus } from "@prisma/client";
import { validateScore, ScorePayload, canEditMatch } from "@/domain/tournaments/matchRules";

type UpdateResultInput = {
  matchId: number;
  score?: ScorePayload;
  status?: TournamentMatchStatus;
  explicitWinnerPairingId?: number | null;
  expectedUpdatedAt?: Date | string | null;
  userId?: string | null;
  force?: boolean;
};

export async function updateMatchResult({
  matchId,
  score,
  status,
  explicitWinnerPairingId,
  expectedUpdatedAt,
  userId,
  force = false,
}: UpdateResultInput) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.tournamentMatch.findUnique({
      where: { id: matchId },
      include: { stage: { select: { tournamentId: true, tournament: { select: { eventId: true } } } } },
    });
    if (!current) throw new Error("MATCH_NOT_FOUND");

    if (!canEditMatch(current.status, force)) {
      throw new Error("MATCH_LOCKED");
    }

    if (!expectedUpdatedAt) {
      throw new Error("MISSING_VERSION");
    }
    const expected = new Date(expectedUpdatedAt);
    if (current.updatedAt.getTime() !== expected.getTime()) {
      throw new Error("MATCH_CONFLICT");
    }

    let winnerSide: "A" | "B" | null = null;
    let normalizedScore: ScorePayload | undefined = undefined;
    if (score) {
      const validation = validateScore(score);
      if (!validation.ok && !force) {
        const err = validation;
        const error = err.code === "NO_WINNER" ? "INVALID_SCORE" : err.code;
        throw new Error(error);
      }
      if (validation.ok) {
        winnerSide = validation.winner;
        normalizedScore = validation.normalized;
      }
    }

    const winnerPairingId =
      explicitWinnerPairingId ||
      (winnerSide === "A" ? current.pairing1Id ?? null : winnerSide === "B" ? current.pairing2Id ?? null : null);
    const before = {
      status: current.status,
      score: current.score,
      pairing1Id: current.pairing1Id,
      pairing2Id: current.pairing2Id,
    };

    const newStatus: TournamentMatchStatus = status ?? "DONE";
    const updated = await tx.tournamentMatch.update({
      where: { id: matchId },
      data: {
        status: newStatus,
        score: normalizedScore ?? score ?? current.score,
        winnerPairingId: winnerPairingId ?? undefined,
      },
    });

    // Propagar winner para o próximo jogo se houver
    if (winnerPairingId && updated.nextMatchId && updated.nextSlot) {
      await tx.tournamentMatch.update({
        where: { id: updated.nextMatchId },
        data: updated.nextSlot === 1 ? { pairing1Id: winnerPairingId } : { pairing2Id: winnerPairingId },
      });
    }

    // Audit log
    await tx.tournamentAuditLog.create({
      data: {
        tournamentId: current.stage.tournamentId,
        userId: userId ?? null,
        action: "EDIT_MATCH",
        payloadBefore: before,
        payloadAfter: {
          status: newStatus,
          score: score ?? current.score,
          propagated: Boolean(winner && updated.nextMatchId),
        },
      },
    });

    return updated;
  });
}
