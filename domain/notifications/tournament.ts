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
import { prisma } from "@/lib/prisma";

type LivePriority = "CRITICAL" | "NON_CRITICAL";

type LiveDispatchPolicy = {
  priority: LivePriority;
  bypassRateLimit?: boolean;
};

const normalizeDate = (value: Date | string | null | undefined) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

function resolveMatchIdFromPayload(payload: unknown): number | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const value = (payload as Record<string, unknown>).matchId;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

async function canDispatchLiveNotification(params: {
  userId: string;
  matchId: number;
  policy: LiveDispatchPolicy;
}) {
  if (params.policy.bypassRateLimit) return true;

  const isCritical = params.policy.priority === "CRITICAL";
  const windowMinutes = isCritical ? 30 : 90;
  const limit = isCritical ? 3 : 5;
  const cutoff = new Date(Date.now() - windowMinutes * 60_000);

  const recent = await prisma.notificationOutbox.findMany({
    where: {
      userId: params.userId,
      notificationType: { in: ["MATCH_CHANGED", "MATCH_RESULT", "NEXT_OPPONENT"] },
      createdAt: { gte: cutoff },
    },
    select: { payload: true },
  });

  const sameMatchCount = recent.reduce((count, row) => {
    return resolveMatchIdFromPayload(row.payload) === params.matchId ? count + 1 : count;
  }, 0);

  return sameMatchCount < limit;
}

export async function queueBracketPublished(userIds: string[], tournamentId: number) {
  await Promise.all(userIds.map((userId) => notifyBracketPublished({ userId, tournamentId })));
}

export async function queueTournamentEve(userIds: string[], tournamentId: number) {
  await Promise.all(userIds.map((userId) => notifyTournamentEve({ userId, tournamentId })));
}

export async function queueMatchResult(
  userIds: string[],
  matchId: number,
  tournamentId?: number,
  options?: { scheduledAt?: Date | string | null; eventType?: string; priority?: LivePriority },
) {
  const priority = options?.priority ?? "NON_CRITICAL";
  const eventType = options?.eventType ?? "MATCH_RESULT";
  const scheduledAt = options?.scheduledAt ?? null;
  await Promise.all(
    userIds.map(async (userId) => {
      const allowed = await canDispatchLiveNotification({
        userId,
        matchId,
        policy: { priority },
      });
      if (!allowed) return null;
      return notifyMatchResult({ userId, matchId, tournamentId, scheduledAt, eventType });
    }),
  );
}

export async function queueNextOpponent(
  userIds: string[],
  matchId: number,
  tournamentId?: number,
  options?: { scheduledAt?: Date | string | null; eventType?: string; priority?: LivePriority; bypassRateLimit?: boolean },
) {
  const priority = options?.priority ?? "CRITICAL";
  const eventType = options?.eventType ?? "NEXT_OPPONENT";
  const scheduledAt = options?.scheduledAt ?? null;
  await Promise.all(
    userIds.map(async (userId) => {
      const allowed = await canDispatchLiveNotification({
        userId,
        matchId,
        policy: { priority, bypassRateLimit: options?.bypassRateLimit === true },
      });
      if (!allowed) return null;
      return notifyNextOpponent({ userId, matchId, tournamentId, scheduledAt, eventType });
    }),
  );
}

export async function queueMatchChanged(params: {
  userIds: string[];
  matchId: number;
  startAt?: Date | null;
  courtId?: number | null;
  scheduleVersion?: string | null;
  reason?: string | null;
  delayStatus?: string | null;
  priority?: LivePriority;
  eventType?: string;
  scheduledAt?: Date | string | null;
  isCancellation?: boolean;
}) {
  const {
    userIds,
    matchId,
    startAt = null,
    courtId = null,
    scheduleVersion = null,
    reason = null,
    delayStatus = null,
    eventType = "MATCH_CHANGED",
  } = params;
  const scheduledAt = normalizeDate(params.scheduledAt ?? startAt ?? null);

  const inferredCancellation =
    params.isCancellation === true ||
    reason?.toUpperCase().includes("CANCEL") === true ||
    delayStatus?.toUpperCase().includes("CANCEL") === true;
  const priority = params.priority ?? "CRITICAL";

  // Use the same dedupe hash as scheduling dedupe so we never send twice for identical change.
  const dedupeKey = dedupeMatchChange(matchId, startAt, courtId, scheduleVersion, eventType, scheduledAt);
  await Promise.all(
    userIds.map(async (userId) => {
      const allowed = await canDispatchLiveNotification({
        userId,
        matchId,
        policy: { priority, bypassRateLimit: inferredCancellation },
      });
      if (!allowed) return null;
      return notifyMatchChanged({
        userId,
        matchId,
        startAt,
        courtId,
        scheduleVersion,
        reason,
        delayStatus,
        eventType,
        scheduledAt,
      });
    }),
  );
  return dedupeKey;
}

export async function queueEliminated(userIds: string[], tournamentId: number) {
  await Promise.all(userIds.map((userId) => notifyEliminated({ userId, tournamentId })));
}

export async function queueChampion(userIds: string[], tournamentId: number) {
  await Promise.all(userIds.map((userId) => notifyChampion({ userId, tournamentId })));
}
