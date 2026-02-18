import { Prisma } from "@prisma/client";
import { type PadelScoreRules, resolvePadelMatchStats } from "@/domain/padel/score";

type WinnerSide = "A" | "B";

const hasOwn = (value: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

export type LiveResultScoreResolution = {
  stats: ReturnType<typeof resolvePadelMatchStats>;
  winnerSide: WinnerSide | null;
  isDrawResult: boolean;
  isByeNeutral: boolean;
  hasIncomingSets: boolean;
  hasTimedPayload: boolean;
  hasScoreEvidence: boolean;
  nextScoreSets: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined;
};

export function hasTimedGamesPayload(score: Record<string, unknown>) {
  return (
    score.mode === "TIMED_GAMES" ||
    hasOwn(score, "gamesA") ||
    hasOwn(score, "gamesB") ||
    hasOwn(score, "endedByBuzzer") ||
    hasOwn(score, "endedAt") ||
    (score.timedGames !== null &&
      typeof score.timedGames === "object" &&
      !Array.isArray(score.timedGames))
  );
}

export function resolveLiveResultScore(params: {
  incomingScore: Record<string, unknown>;
  currentScoreSets: unknown;
  fallbackWinnerSide?: WinnerSide | null;
  scoreRules?: PadelScoreRules | null;
}): LiveResultScoreResolution {
  const hasIncomingSets = hasOwn(params.incomingScore, "sets");
  const hasTimedPayload = hasTimedGamesPayload(params.incomingScore);
  const rawSets = hasIncomingSets ? params.incomingScore.sets : params.currentScoreSets;
  const stats = resolvePadelMatchStats(rawSets, params.incomingScore, params.scoreRules ?? undefined);
  const winnerFromScore =
    params.incomingScore.winnerSide === "A" || params.incomingScore.winnerSide === "B"
      ? (params.incomingScore.winnerSide as WinnerSide)
      : null;
  const winnerSide = stats?.winner ?? winnerFromScore ?? params.fallbackWinnerSide ?? null;
  const isDrawResult = stats?.isDraw === true;
  const isByeNeutral = stats?.resultType === "BYE_NEUTRAL";
  const hasScoreEvidence =
    hasIncomingSets ||
    hasTimedPayload ||
    (Array.isArray(rawSets) && rawSets.length > 0);
  const nextScoreSets = hasIncomingSets
    ? ((stats?.sets ?? params.incomingScore.sets ?? []) as Prisma.InputJsonValue)
    : stats?.mode === "TIMED_GAMES"
      ? ([] as Prisma.InputJsonValue)
      : (params.currentScoreSets as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined);

  return {
    stats,
    winnerSide,
    isDrawResult,
    isByeNeutral,
    hasIncomingSets,
    hasTimedPayload,
    hasScoreEvidence,
    nextScoreSets,
  };
}
