import {
  notifyBracketPublished,
  notifyChampion,
  notifyEliminated,
  notifyMatchChanged,
  notifyMatchResult,
  notifyNextOpponent,
  notifyTournamentEve,
} from "@/domain/notifications/producer";
import { computeDedupeKey as dedupeMatchChange } from "@/domain/notifications/matchChangeDedupe";

export async function queueBracketPublished(userIds: string[], tournamentId: number) {
  await Promise.all(userIds.map((userId) => notifyBracketPublished({ userId, tournamentId })));
}

export async function queueTournamentEve(userIds: string[], tournamentId: number) {
  await Promise.all(userIds.map((userId) => notifyTournamentEve({ userId, tournamentId })));
}

export async function queueMatchResult(userIds: string[], matchId: number, tournamentId?: number) {
  await Promise.all(userIds.map((userId) => notifyMatchResult({ userId, matchId, tournamentId })));
}

export async function queueNextOpponent(userIds: string[], matchId: number, tournamentId?: number) {
  await Promise.all(userIds.map((userId) => notifyNextOpponent({ userId, matchId, tournamentId })));
}

export async function queueMatchChanged(params: {
  userIds: string[];
  matchId: number;
  startAt?: Date | null;
  courtId?: number | null;
}) {
  const { userIds, matchId, startAt = null, courtId = null } = params;
  // Use the same dedupe hash as scheduling dedupe so we never send twice for identical change.
  const dedupeKey = dedupeMatchChange(matchId, startAt, courtId);
  await Promise.all(
    userIds.map((userId) =>
      notifyMatchChanged({
        userId,
        matchId,
        startAt,
        courtId,
        // force so the shared dedupeKey applies across recipients
      }),
    ),
  );
  return dedupeKey;
}

export async function queueEliminated(userIds: string[], tournamentId: number) {
  await Promise.all(userIds.map((userId) => notifyEliminated({ userId, tournamentId })));
}

export async function queueChampion(userIds: string[], tournamentId: number) {
  await Promise.all(userIds.map((userId) => notifyChampion({ userId, tournamentId })));
}
