import { prisma } from "@/lib/prisma";
import { Prisma, TournamentMatchStatus } from "@prisma/client";
import {
  validateScore,
  validateGoalScore,
  MatchScorePayload,
  canEditMatch,
} from "@/domain/tournaments/matchRules";

type UpdateResultInput = {
  matchId: number;
  score?: MatchScorePayload;
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
      select: {
        id: true,
        status: true,
        updatedAt: true,
        score: true,
        pairing1Id: true,
        pairing2Id: true,
        nextMatchId: true,
        nextSlot: true,
        stage: { select: { tournamentId: true, tournament: { select: { eventId: true } } } },
      },
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
    let normalizedScore: MatchScorePayload | undefined = undefined;
    let resolvedStatus: TournamentMatchStatus | undefined = undefined;
    if (score) {
      if (score.sets) {
        const validation = validateScore({ sets: score.sets });
        if (!validation.ok && !force) {
          const err = validation;
          const error = err.code === "NO_WINNER" ? "INVALID_SCORE" : err.code;
          throw new Error(error);
        }
        if (validation.ok) {
          winnerSide = validation.winner;
          normalizedScore = validation.normalized;
        }
      } else if (score.goals) {
        const validation = validateGoalScore(score.goals);
        if (!validation.ok && !force) {
          throw new Error(validation.code);
        }
        if (validation.ok) {
          winnerSide = validation.winner;
          normalizedScore = { goals: validation.normalized };
          resolvedStatus = validation.status;
        }
      } else if (!force) {
        throw new Error("INVALID_SCORE");
      }
    }

    const winnerPairingId =
      explicitWinnerPairingId ??
      (winnerSide === "A" ? current.pairing1Id ?? null : winnerSide === "B" ? current.pairing2Id ?? null : null);
    const before = {
      matchId: current.id,
      status: current.status,
      score: current.score,
      pairing1Id: current.pairing1Id,
      pairing2Id: current.pairing2Id,
      updatedAt: current.updatedAt,
    };

    const newStatus: TournamentMatchStatus = status ?? resolvedStatus ?? "DONE";
    const shouldPropagate = Boolean(
      winnerPairingId && current.nextMatchId && current.nextSlot && newStatus !== "DISPUTED",
    );
    const nextMatchBefore =
      shouldPropagate && current.nextMatchId
        ? await tx.tournamentMatch.findUnique({
            where: { id: current.nextMatchId },
            select: { pairing1Id: true, pairing2Id: true },
          })
        : null;

    const scoreValue = (normalizedScore ?? score ?? current.score) as Prisma.InputJsonValue;
    const updated = await tx.tournamentMatch.update({
      where: { id: matchId },
      data: {
        status: newStatus,
        score: scoreValue,
      },
    });

    // Propagar winner para o próximo jogo se houver
    let propagated = false;
    let nextSlotBefore: number | null = null;
    let nextSlotAfter: number | null = null;
    if (shouldPropagate && current.nextMatchId && current.nextSlot) {
      nextSlotBefore =
        current.nextSlot === 1 ? nextMatchBefore?.pairing1Id ?? null : nextMatchBefore?.pairing2Id ?? null;
      nextSlotAfter = winnerPairingId ?? null;
      await tx.tournamentMatch.update({
        where: { id: current.nextMatchId },
        data: current.nextSlot === 1 ? { pairing1Id: winnerPairingId } : { pairing2Id: winnerPairingId },
      });
      propagated = Boolean(winnerPairingId);
    }

    if (newStatus === "DONE") {
      const tournamentConfig = await tx.tournament.findUnique({
        where: { id: current.stage.tournamentId },
        select: { config: true },
      });
      const config = (tournamentConfig?.config as Record<string, unknown> | null) ?? {};
      if (config.featuredMatchId === current.id) {
        await tx.tournament.update({
          where: { id: current.stage.tournamentId },
          data: {
            config: {
              ...config,
              featuredMatchId: null,
              featuredMatchUpdatedAt: new Date().toISOString(),
            },
          },
        });
      }
    }

    // Audit log
    await tx.tournamentAuditLog["create"]({
      data: {
        tournamentId: current.stage.tournamentId,
        userId: userId ?? null,
        action: "EDIT_MATCH_RESULT",
        payloadBefore: before,
        payloadAfter: {
          matchId: current.id,
          status: newStatus,
          score: normalizedScore ?? score ?? current.score,
          propagated,
          nextMatchId: current.nextMatchId,
          nextSlot: current.nextSlot,
          nextSlotBefore,
          nextSlotAfter,
        },
      },
    });

    return updated;
  });
}
