import { prisma } from "@/lib/prisma";
import { generateAndPersistTournamentStructure } from "@/domain/tournaments/generation";
import { updateMatchResult } from "@/domain/tournaments/matchUpdate";
import { TournamentFormat } from "@prisma/client";

type TournamentGeneratePayload = {
  tournamentId: number;
  format: TournamentFormat;
  pairings: Array<number | null>;
  seed?: string | null;
  inscriptionDeadlineAt?: string | null;
  forceGenerate?: boolean;
  userId: string;
  targetSize?: number | null;
  preserveOrder?: boolean;
};

export async function handleTournamentOutboxEvent(input: {
  eventType: string;
  payload: Record<string, unknown>;
}) {
  const { eventType, payload } = input;
  if (eventType === "TOURNAMENT_MATCH_RESULT_REQUESTED") {
    const data = payload as {
      matchId?: number;
      score?: unknown;
      status?: string;
      winnerPairingId?: number | null;
      expectedUpdatedAt?: string | null;
      userId?: string | null;
      force?: boolean;
    };
    if (!data?.matchId) {
      throw new Error("TOURNAMENT_MATCH_RESULT_INVALID_PAYLOAD");
    }
    await updateMatchResult({
      matchId: Number(data.matchId),
      score: data.score as any,
      status: data.status as any,
      explicitWinnerPairingId: data.winnerPairingId ?? null,
      expectedUpdatedAt: data.expectedUpdatedAt ? new Date(data.expectedUpdatedAt) : undefined,
      userId: data.userId ?? null,
      force: Boolean(data.force),
    });
    return { ok: true };
  }

  if (eventType !== "TOURNAMENT_GENERATE") return { ok: true };

  const data = payload as TournamentGeneratePayload;
  if (!data?.tournamentId || !data?.userId) {
    throw new Error("TOURNAMENT_GENERATE_INVALID_PAYLOAD");
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: data.tournamentId },
    select: { generatedAt: true },
  });
  if (tournament?.generatedAt && !data.forceGenerate) {
    return { ok: true, skipped: true };
  }

  await generateAndPersistTournamentStructure({
    tournamentId: data.tournamentId,
    format: data.format,
    pairings: data.pairings ?? [],
    seed: data.seed ?? null,
    inscriptionDeadlineAt: data.inscriptionDeadlineAt ? new Date(data.inscriptionDeadlineAt) : null,
    forceGenerate: Boolean(data.forceGenerate),
    userId: data.userId,
    targetSize: data.targetSize ?? null,
    preserveOrder: Boolean(data.preserveOrder),
  });

  return { ok: true };
}
