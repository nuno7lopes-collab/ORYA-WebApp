import { prisma } from "@/lib/prisma";
import { computeAutoSchedulePlan } from "@/domain/padel/autoSchedule";
import { queueMatchChanged, queueMatchResult, queueNextOpponent, queueChampion, queueEliminated } from "@/domain/notifications/tournament";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { createNotification, shouldNotify } from "@/lib/notifications";
import { computePadelStandingsByGroup, normalizePadelPointsTable, normalizePadelTieBreakRules } from "@/domain/padel/standings";
import { getPadelRuleSetSnapshot } from "@/domain/padel/ruleSetSnapshot";
import { advancePadelKnockoutWinner, extractBracketPrefix, sortRoundsBySize } from "@/domain/padel/knockoutAdvance";
import { autoGeneratePadelMatches } from "@/domain/padel/autoGenerateMatches";
import { updatePadelMatch } from "@/domain/padel/matches/commands";
import { resolvePartnershipScheduleConstraints } from "@/domain/padel/partnershipSchedulePolicy";
import { Prisma } from "@prisma/client";

type DelayPolicy = "SINGLE_MATCH" | "CASCADE_SAME_COURT" | "GLOBAL_REPLAN";
const DEFAULT_DELAY_POLICY: DelayPolicy = "CASCADE_SAME_COURT";

type AutoScheduleRequestedPayload = {
  eventId: number;
  organizationId: number;
  actorUserId: string;
  scheduledUpdates: Array<{
    matchId: number;
    courtId: number;
    start: string;
    end: string;
    durationMinutes: number;
    score?: Record<string, unknown> | null;
  }>;
};

type MatchDelayRequestedPayload = {
  matchId: number;
  eventId: number;
  organizationId: number;
  actorUserId: string;
  reason?: string | null;
  clearSchedule?: boolean;
  autoReschedule?: boolean;
  delayPolicy?: DelayPolicy | null;
  windowStart?: string | null;
  windowEnd?: string | null;
};

type MatchUpdatedPayload = {
  matchId: number;
  eventId: number;
  organizationId: number;
  actorUserId: string;
  beforeStatus: string | null;
};

const SYSTEM_MATCH_EVENT = "PADEL_MATCH_SYSTEM_UPDATED";
const MATCH_BATCH_GENERATED = "PADEL_MATCH_GENERATED";
const MATCH_DELETED_EVENT = "PADEL_MATCH_DELETED";

function normalizeDelayPolicy(value: unknown): DelayPolicy {
  if (value === "SINGLE_MATCH" || value === "CASCADE_SAME_COURT" || value === "GLOBAL_REPLAN") {
    return value;
  }
  return DEFAULT_DELAY_POLICY;
}

type OutboxMatchParticipant = {
  side: "A" | "B";
  participantId: number;
  participant: {
    sourcePairingId: number | null;
    playerProfile: {
      userId: string | null;
      displayName: string | null;
      fullName: string | null;
    } | null;
  } | null;
};

const uniqueStrings = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)));

const resolveSideParticipantIds = (participants: OutboxMatchParticipant[], side: "A" | "B") =>
  participants
    .filter((row) => row.side === side)
    .map((row) => row.participantId)
    .filter((id): id is number => typeof id === "number" && Number.isFinite(id));

const resolveSideUserIds = (participants: OutboxMatchParticipant[], side: "A" | "B") =>
  uniqueStrings(
    participants
      .filter((row) => row.side === side)
      .map((row) => row.participant?.playerProfile?.userId ?? null),
  );

const resolveSideSourcePairingId = (participants: OutboxMatchParticipant[], side: "A" | "B") =>
  participants
    .filter((row) => row.side === side)
    .map((row) => row.participant?.sourcePairingId)
    .find((id): id is number => typeof id === "number" && Number.isFinite(id)) ?? null;

const resolveParticipantLabel = (participants: OutboxMatchParticipant[], side: "A" | "B") => {
  const names = participants
    .filter((row) => row.side === side)
    .map((row) => row.participant?.playerProfile?.displayName || row.participant?.playerProfile?.fullName)
    .filter((name): name is string => typeof name === "string" && name.trim().length > 0);
  return names.length > 0 ? names.join(" / ") : "Jogador";
};

type MatchParticipantProjection = Array<{
  side: "A" | "B";
  participant: { playerProfileId: number | null; playerProfile: { email: string | null } | null } | null;
}>;

function resolveSideProfileIds(participants: MatchParticipantProjection, side: "A" | "B") {
  return participants
    .filter((row) => row.side === side)
    .map((row) => row.participant?.playerProfileId)
    .filter((id): id is number => typeof id === "number" && Number.isFinite(id));
}

function resolveSideEmails(participants: MatchParticipantProjection, side: "A" | "B") {
  const values = participants
    .filter((row) => row.side === side)
    .map((row) => row.participant?.playerProfile?.email?.trim().toLowerCase())
    .filter((email): email is string => typeof email === "string" && email.length > 0);
  return Array.from(new Set(values));
}

export async function handlePadelOutboxEvent(params: { eventType: string; payload: Prisma.JsonValue }) {
  switch (params.eventType) {
    case "PADEL_AUTO_SCHEDULE_REQUESTED":
      return handleAutoScheduleRequested(params.payload as AutoScheduleRequestedPayload);
    case "PADEL_MATCH_DELAY_REQUESTED":
      return handleMatchDelayRequested(params.payload as MatchDelayRequestedPayload);
    case "PADEL_MATCH_UPDATED":
      return handleMatchUpdated(params.payload as MatchUpdatedPayload);
    case SYSTEM_MATCH_EVENT:
    case MATCH_BATCH_GENERATED:
    case MATCH_DELETED_EVENT:
      return { ok: true } as const;
    default:
      return { ok: false, code: "PADEL_OUTBOX_UNHANDLED" } as const;
  }
}

async function handleAutoScheduleRequested(payload: AutoScheduleRequestedPayload) {
  if (!payload?.scheduledUpdates?.length) return { ok: true } as const;
  await prisma.$transaction(async (tx) => {
    for (const update of payload.scheduledUpdates) {
      await updatePadelMatch({
        tx,
        matchId: update.matchId,
        eventId: payload.eventId,
        organizationId: payload.organizationId,
        actorUserId: payload.actorUserId,
        eventType: SYSTEM_MATCH_EVENT,
        data: {
          plannedStartAt: new Date(update.start),
          plannedEndAt: new Date(update.end),
          plannedDurationMinutes: update.durationMinutes,
          courtId: update.courtId,
          ...(update.score ? { score: update.score as Prisma.InputJsonValue } : {}),
        },
      });
    }
  });
  await recordOrganizationAuditSafe({
    organizationId: payload.organizationId,
    actorUserId: payload.actorUserId,
    action: "PADEL_CALENDAR_AUTO_SCHEDULE",
    metadata: {
      eventId: payload.eventId,
      scheduledCount: payload.scheduledUpdates.length,
      matchIds: payload.scheduledUpdates.map((u) => u.matchId),
    },
  });
  return { ok: true } as const;
}

async function handleMatchDelayRequested(payload: MatchDelayRequestedPayload) {
  if (!payload?.matchId) return { ok: false, code: "MATCH_ID_REQUIRED" } as const;
  const match = await prisma.eventMatchSlot.findUnique({
    where: { id: payload.matchId },
    select: {
      id: true,
      status: true,
      plannedStartAt: true,
      plannedEndAt: true,
      plannedDurationMinutes: true,
      startTime: true,
      courtId: true,
      roundLabel: true,
      roundType: true,
      groupLabel: true,
      score: true,
      participants: {
        orderBy: [{ side: "asc" }, { slotOrder: "asc" }, { id: "asc" }],
        select: {
          side: true,
          participant: {
            select: {
              playerProfileId: true,
              playerProfile: { select: { email: true } },
            },
          },
        },
      },
      event: {
        select: {
          id: true,
          organizationId: true,
          startsAt: true,
          endsAt: true,
          padelTournamentConfig: {
            select: { padelClubId: true, partnerClubIds: true, advancedSettings: true },
          },
        },
      },
    },
  });
  if (!match || !match.event?.organizationId) return { ok: false, code: "MATCH_NOT_FOUND" } as const;

  const score = (match.score && typeof match.score === "object" ? match.score : {}) as Record<string, unknown>;
  const nowIso = new Date().toISOString();
  const delayPolicy = normalizeDelayPolicy(payload.delayPolicy);
  const delayedStartRef = match.plannedStartAt ?? match.startTime ?? null;
  const delayedCourtId = match.courtId ?? null;
  const scoreUpdate = {
    ...score,
    delayStatus: "DELAYED",
    delayedAt: nowIso,
    delayedBy: payload.actorUserId,
    delayReason: payload.reason ?? null,
  };

  await updatePadelMatch({
    matchId: match.id,
    eventId: match.event.id,
    organizationId: match.event.organizationId,
    actorUserId: payload.actorUserId,
    eventType: SYSTEM_MATCH_EVENT,
    data: {
      ...(payload.clearSchedule !== false
        ? { plannedStartAt: null, plannedEndAt: null, plannedDurationMinutes: null, courtId: null, startTime: null }
        : {}),
      score: scoreUpdate as Prisma.InputJsonValue,
    },
  });

  if (payload.autoReschedule !== false) {
    const windowStart = payload.windowStart ? new Date(payload.windowStart) : match.event.startsAt ?? null;
    const windowEnd = payload.windowEnd ? new Date(payload.windowEnd) : match.event.endsAt ?? null;
    if (windowStart && windowEnd) {
      const hasCascadeCourt = delayPolicy === "CASCADE_SAME_COURT" && typeof delayedCourtId === "number";
      const affectedMatchScope =
        delayPolicy === "SINGLE_MATCH" || (delayPolicy === "CASCADE_SAME_COURT" && !hasCascadeCourt)
          ? { id: match.id }
          : delayPolicy === "CASCADE_SAME_COURT"
            ? {
                OR: [
                  { id: match.id },
                  {
                    status: "PENDING",
                    courtId: delayedCourtId,
                    OR: delayedStartRef
                      ? [{ plannedStartAt: { gte: delayedStartRef } }, { startTime: { gte: delayedStartRef } }]
                      : [{ plannedStartAt: { not: null } }, { startTime: { not: null } }],
                  },
                ],
              }
            : {
                status: "PENDING",
              };
      const matchesInScope = await prisma.eventMatchSlot.findMany({
        where: {
          eventId: match.event.id,
          ...(affectedMatchScope as Record<string, unknown>),
        },
        select: {
          id: true,
          status: true,
          plannedStartAt: true,
          plannedEndAt: true,
          plannedDurationMinutes: true,
          startTime: true,
          courtId: true,
          roundLabel: true,
          roundType: true,
          groupLabel: true,
          score: true,
          participants: {
            orderBy: [{ side: "asc" }, { slotOrder: "asc" }, { id: "asc" }],
            select: {
              side: true,
              participant: {
                select: {
                  playerProfileId: true,
                  playerProfile: { select: { email: true } },
                },
              },
            },
          },
        },
      });
      const affectedMatchIds = Array.from(new Set(matchesInScope.map((item) => item.id)));
      const unscheduledMatches = matchesInScope.filter((item) => item.status === "PENDING");
      if (unscheduledMatches.length === 0) {
        await recordOrganizationAuditSafe({
          organizationId: match.event.organizationId,
          actorUserId: payload.actorUserId,
          action: "PADEL_MATCH_DELAY_RESCHEDULE_SKIPPED",
          metadata: {
            matchId: match.id,
            eventId: match.event.id,
            delayPolicy,
            reason: "NO_PENDING_MATCHES_IN_SCOPE",
          },
        });
      }
      for (const affected of unscheduledMatches) {
        if (affected.id === match.id) continue;
        await updatePadelMatch({
          matchId: affected.id,
          eventId: match.event.id,
          organizationId: match.event.organizationId,
          actorUserId: payload.actorUserId,
          eventType: SYSTEM_MATCH_EVENT,
          data: {
            plannedStartAt: null,
            plannedEndAt: null,
            plannedDurationMinutes: null,
            courtId: null,
            startTime: null,
          },
        });
      }

      const clubIds = [
        match.event.padelTournamentConfig?.padelClubId ?? null,
        ...(match.event.padelTournamentConfig?.partnerClubIds ?? []),
      ].filter((id): id is number => typeof id === "number" && Number.isFinite(id));
      const courts = clubIds.length
        ? await prisma.padelClubCourt.findMany({
            where: { padelClubId: { in: clubIds }, isActive: true },
            select: { id: true, name: true, displayOrder: true, padelClubId: true },
            orderBy: [{ displayOrder: "asc" }],
          })
        : [];
      const [scheduledMatches] = await Promise.all([
        prisma.eventMatchSlot.findMany({
          where: {
            eventId: match.event.id,
            OR: [{ startTime: { not: null } }, { plannedStartAt: { not: null } }],
            ...(affectedMatchIds.length > 0 ? { id: { notIn: affectedMatchIds } } : {}),
          },
          select: {
            id: true,
            plannedStartAt: true,
            plannedEndAt: true,
            plannedDurationMinutes: true,
            startTime: true,
            courtId: true,
            participants: {
              orderBy: [{ side: "asc" }, { slotOrder: "asc" }, { id: "asc" }],
              select: {
                side: true,
                participant: {
                  select: {
                    playerProfileId: true,
                    playerProfile: { select: { email: true } },
                  },
                },
              },
            },
          },
        }),
      ]);

      const [availabilities, courtBlocks] = await Promise.all([
        prisma.calendarAvailability.findMany({
          where: { eventId: match.event.id, organizationId: match.event.organizationId },
          select: { playerProfileId: true, playerEmail: true, startAt: true, endAt: true },
        }),
        prisma.calendarBlock.findMany({
          where: { eventId: match.event.id, organizationId: match.event.organizationId },
          select: { courtId: true, startAt: true, endAt: true },
        }),
      ]);
      const partnershipConstraints = await resolvePartnershipScheduleConstraints({
        organizationId: match.event.organizationId,
        windowStart,
        windowEnd,
        courts: courts.map((court) => ({ id: court.id, padelClubId: court.padelClubId ?? null })),
      });
      if (!partnershipConstraints.ok) {
        await recordOrganizationAuditSafe({
          organizationId: match.event.organizationId,
          actorUserId: payload.actorUserId,
          action: "PADEL_MATCH_DELAY_RESCHEDULE_BLOCKED",
          metadata: {
            matchId: match.id,
            eventId: match.event.id,
            delayPolicy,
            errors: partnershipConstraints.errors,
          },
        });
        return { ok: true, code: "PARTNERSHIP_CONSTRAINTS_BLOCKED" } as const;
      }
      const effectiveCourtBlocks = [
        ...courtBlocks,
        ...partnershipConstraints.additionalCourtBlocks.map((block) => ({
          courtId: block.courtId,
          startAt: block.startAt,
          endAt: block.endAt,
        })),
      ];

      const advanced = (match.event.padelTournamentConfig?.advancedSettings || {}) as {
        scheduleDefaults?: {
          durationMinutes?: number | null;
          slotMinutes?: number | null;
          bufferMinutes?: number | null;
          minRestMinutes?: number | null;
          priority?: "GROUPS_FIRST" | "KNOCKOUT_FIRST";
        };
      };
      const scheduleDefaults = advanced.scheduleDefaults ?? {};
      const durationMinutes = Math.max(1, Math.round(scheduleDefaults.durationMinutes ?? 60));
      const slotMinutes = Math.max(5, Math.round(scheduleDefaults.slotMinutes ?? 15));
      const bufferMinutes = Math.max(0, Math.round(scheduleDefaults.bufferMinutes ?? 5));
      const minRestMinutes = Math.max(0, Math.round(scheduleDefaults.minRestMinutes ?? 10));
      const priority = scheduleDefaults.priority === "KNOCKOUT_FIRST" ? "KNOCKOUT_FIRST" : "GROUPS_FIRST";

      const scheduleResult = computeAutoSchedulePlan({
        unscheduledMatches: unscheduledMatches.map((entry) => ({
          id: entry.id,
          plannedDurationMinutes: entry.plannedDurationMinutes,
          courtId: entry.courtId,
          sideAProfileIds: resolveSideProfileIds(entry.participants as MatchParticipantProjection, "A"),
          sideBProfileIds: resolveSideProfileIds(entry.participants as MatchParticipantProjection, "B"),
          sideAEmails: resolveSideEmails(entry.participants as MatchParticipantProjection, "A"),
          sideBEmails: resolveSideEmails(entry.participants as MatchParticipantProjection, "B"),
          roundLabel: entry.roundLabel,
          roundType: entry.roundType,
          groupLabel: entry.groupLabel,
        })),
        scheduledMatches: scheduledMatches.map((entry) => ({
          id: entry.id,
          plannedStartAt: entry.plannedStartAt,
          plannedEndAt: entry.plannedEndAt,
          plannedDurationMinutes: entry.plannedDurationMinutes,
          startTime: entry.startTime,
          courtId: entry.courtId,
          sideAProfileIds: resolveSideProfileIds(entry.participants as MatchParticipantProjection, "A"),
          sideBProfileIds: resolveSideProfileIds(entry.participants as MatchParticipantProjection, "B"),
          sideAEmails: resolveSideEmails(entry.participants as MatchParticipantProjection, "A"),
          sideBEmails: resolveSideEmails(entry.participants as MatchParticipantProjection, "B"),
        })),
        courts,
        availabilities,
        courtBlocks: effectiveCourtBlocks,
        config: {
          windowStart,
          windowEnd,
          durationMinutes,
          slotMinutes,
          bufferMinutes,
          minRestMinutes,
          priority,
        },
      });

      for (const next of scheduleResult.scheduled) {
        const isDelayedMatch = next.matchId === match.id;
        const scopedScore =
          isDelayedMatch
            ? ({
                ...scoreUpdate,
                delayStatus: "RESCHEDULED",
                rescheduledAt: nowIso,
                rescheduledBy: payload.actorUserId,
              } as Prisma.InputJsonValue)
            : undefined;
        await updatePadelMatch({
          matchId: next.matchId,
          eventId: match.event.id,
          organizationId: match.event.organizationId,
          actorUserId: payload.actorUserId,
          eventType: SYSTEM_MATCH_EVENT,
          data: {
            plannedStartAt: next.start,
            plannedEndAt: next.end,
            plannedDurationMinutes: next.durationMinutes,
            courtId: next.courtId,
            ...(scopedScore ? { score: scopedScore } : {}),
          },
        });
      }
    }
  }

  await recordOrganizationAuditSafe({
    organizationId: match.event.organizationId,
    actorUserId: payload.actorUserId,
    action: "PADEL_MATCH_DELAY",
    metadata: {
      matchId: match.id,
      eventId: match.event.id,
      reason: payload.reason ?? null,
      autoReschedule: payload.autoReschedule !== false,
      delayPolicy,
    },
  });
  return { ok: true } as const;
}

async function handleMatchUpdated(payload: MatchUpdatedPayload) {
  if (!payload?.matchId) return { ok: false, code: "MATCH_ID_REQUIRED" } as const;
  const updated = await prisma.eventMatchSlot.findUnique({
    where: { id: payload.matchId },
    select: {
      id: true,
      eventId: true,
      status: true,
      roundType: true,
      roundLabel: true,
      groupLabel: true,
      categoryId: true,
      winnerParticipantId: true,
      winnerSide: true,
      pairingAId: true,
      pairingBId: true,
      winnerPairingId: true,
      courtId: true,
      courtNumber: true,
      startTime: true,
      plannedStartAt: true,
      event: {
        select: {
          id: true,
          slug: true,
          title: true,
          organizationId: true,
          timezone: true,
          padelTournamentConfig: { select: { advancedSettings: true, format: true, ruleSetId: true } },
        },
      },
      pairingA: {
        select: {
          id: true,
          slots: {
            select: {
              profileId: true,
              playerProfile: { select: { displayName: true, fullName: true } },
            },
          },
        },
      },
      pairingB: {
        select: {
          id: true,
          slots: {
            select: {
              profileId: true,
              playerProfile: { select: { displayName: true, fullName: true } },
            },
          },
        },
      },
      participants: {
        orderBy: [{ side: "asc" }, { slotOrder: "asc" }, { id: "asc" }],
        select: {
          side: true,
          participantId: true,
          participant: {
            select: {
              sourcePairingId: true,
              playerProfile: {
                select: {
                  userId: true,
                  displayName: true,
                  fullName: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!updated || !updated.event?.organizationId) return { ok: false, code: "MATCH_NOT_FOUND" } as const;

  const systemContext = {
    eventId: updated.event.id,
    organizationId: updated.event.organizationId,
    actorUserId: payload.actorUserId,
    eventType: SYSTEM_MATCH_EVENT,
  };

  const participantRows = (updated.participants ?? []) as OutboxMatchParticipant[];
  const participantUserIds = uniqueStrings(
    participantRows.map((row) => row.participant?.playerProfile?.userId ?? null),
  );
  const involvedUserIds =
    participantUserIds.length > 0
      ? participantUserIds
      : uniqueStrings([
          ...((updated.pairingA?.slots ?? []).map((s) => s.profileId) as Array<string | null | undefined>),
          ...((updated.pairingB?.slots ?? []).map((s) => s.profileId) as Array<string | null | undefined>),
        ]);

  const matchCourtId = updated.courtId ?? updated.courtNumber ?? null;
  await queueMatchChanged({
    userIds: involvedUserIds,
    matchId: updated.id,
    startAt: updated.startTime ?? null,
    courtId: matchCourtId,
  });

  const resolvedWinnerSide = updated.winnerSide === "A" || updated.winnerSide === "B" ? updated.winnerSide : null;
  const winnerSideParticipantIds =
    resolvedWinnerSide !== null ? resolveSideParticipantIds(participantRows, resolvedWinnerSide) : [];
  const resolvedWinnerParticipantId =
    typeof updated.winnerParticipantId === "number"
      ? updated.winnerParticipantId
      : winnerSideParticipantIds[0] ?? null;
  const resolvedWinnerPairingId =
    updated.winnerPairingId ??
    (resolvedWinnerSide !== null ? resolveSideSourcePairingId(participantRows, resolvedWinnerSide) : null);

  if (resolvedWinnerParticipantId || resolvedWinnerPairingId) {
    await queueMatchResult(involvedUserIds, updated.id, updated.eventId);
    await queueNextOpponent(involvedUserIds, updated.id, updated.eventId);

    if (updated.roundType === "KNOCKOUT") {
      const config = await prisma.padelTournamentConfig.findUnique({
        where: { eventId: updated.eventId },
        select: { format: true },
      });
      const koMatches = await prisma.eventMatchSlot.findMany({
        where: {
          eventId: updated.eventId,
          roundType: "KNOCKOUT",
          ...(updated.categoryId ? { categoryId: updated.categoryId } : {}),
        },
        select: {
          id: true,
          roundLabel: true,
          pairingAId: true,
          pairingBId: true,
          winnerPairingId: true,
          winnerParticipantId: true,
          winnerSide: true,
          participants: {
            orderBy: [{ side: "asc" }, { slotOrder: "asc" }, { id: "asc" }],
            select: {
              side: true,
              participantId: true,
            },
          },
        },
        orderBy: [{ roundLabel: "asc" }, { id: "asc" }],
      });
      const isDoubleElim = config?.format === "DUPLA_ELIMINACAO";
      const isGrandFinalLabel = (label?: string | null) => {
        if (!label) return false;
        const trimmed = label.trim();
        const base = trimmed.startsWith("A ") || trimmed.startsWith("B ") ? trimmed.slice(2).trim() : trimmed;
        return /^GF$|^GRAND_FINAL$|^GRAND FINAL$/i.test(base);
      };
      const isGrandFinalResetLabel = (label?: string | null) => {
        if (!label) return false;
        const trimmed = label.trim();
        const base = trimmed.startsWith("A ") || trimmed.startsWith("B ") ? trimmed.slice(2).trim() : trimmed;
        return /^GF2$|^GRAND_FINAL_RESET$|^GRAND FINAL 2$/i.test(base);
      };
      const isGrandFinalAnyLabel = (label?: string | null) =>
        isGrandFinalLabel(label) || isGrandFinalResetLabel(label);
      const bracketPrefix = extractBracketPrefix(updated.roundLabel);
      const bracketMatches = koMatches.filter((m) => extractBracketPrefix(m.roundLabel) === bracketPrefix);
      const roundOrder = sortRoundsBySize(bracketMatches);
      const aMatches = koMatches.filter((m) => extractBracketPrefix(m.roundLabel) === "A ");
      const bMatches = koMatches.filter((m) => extractBracketPrefix(m.roundLabel) === "B ");
      const aRoundOrder = sortRoundsBySize(aMatches);
      const aRoundOrderNoGF = aRoundOrder.filter((label) => !isGrandFinalAnyLabel(label));
      const bRoundOrder = sortRoundsBySize(bMatches);
      const getRoundMatches = (matches: typeof koMatches, label: string | null) =>
        matches.filter((m) => (m.roundLabel || "?") === (label || "?")).sort((a, b) => a.id - b.id);
      const parseLoserRoundIndex = (label?: string | null) => {
        if (!label) return null;
        const trimmed = label.trim();
        const base = trimmed.startsWith("A ") || trimmed.startsWith("B ") ? trimmed.slice(2).trim() : trimmed;
        if (!/^L\\d+$/i.test(base)) return null;
        const parsed = Number(base.slice(1));
        return Number.isFinite(parsed) ? parsed : null;
      };
      const grandFinal = isDoubleElim ? aMatches.find((m) => isGrandFinalLabel(m.roundLabel)) : null;
      const grandFinalReset = isDoubleElim ? aMatches.find((m) => isGrandFinalResetLabel(m.roundLabel)) : null;

      const isGrandFinal = isDoubleElim && isGrandFinalLabel(updated.roundLabel);
      const isGrandFinalReset = isDoubleElim && isGrandFinalResetLabel(updated.roundLabel);
      const shouldAutoAdvance = !(isDoubleElim && (isGrandFinal || isGrandFinalReset));

      if (shouldAutoAdvance) {
        await advancePadelKnockoutWinner({
          matches: koMatches,
          updateMatch: async (matchId, data) => {
            const sideAParticipantIds =
              Array.isArray(data.sideAParticipantIds) && data.sideAParticipantIds.length > 0
                ? data.sideAParticipantIds
                : data.sideAParticipantIds === undefined
                  ? undefined
                  : [];
            const sideBParticipantIds =
              Array.isArray(data.sideBParticipantIds) && data.sideBParticipantIds.length > 0
                ? data.sideBParticipantIds
                : data.sideBParticipantIds === undefined
                  ? undefined
                  : [];

            const matchUpdateData: Prisma.EventMatchSlotUncheckedUpdateInput = {
              ...(typeof data.pairingAId !== "undefined" ? { pairingAId: data.pairingAId } : {}),
              ...(typeof data.pairingBId !== "undefined" ? { pairingBId: data.pairingBId } : {}),
              ...(typeof data.winnerPairingId !== "undefined" ? { winnerPairingId: data.winnerPairingId } : {}),
              ...(typeof data.winnerParticipantId !== "undefined"
                ? { winnerParticipantId: data.winnerParticipantId }
                : {}),
              ...(typeof data.winnerSide !== "undefined" ? { winnerSide: data.winnerSide } : {}),
              ...(typeof data.status !== "undefined" ? { status: data.status } : {}),
              ...(typeof data.score !== "undefined" ? { score: data.score } : {}),
              ...(typeof data.scoreSets !== "undefined" ? { scoreSets: data.scoreSets } : {}),
            };

            const applyInTx = async (tx: Prisma.TransactionClient) => {
              const { match } = await updatePadelMatch({
                tx,
                matchId,
                data: matchUpdateData,
                ...systemContext,
                select: {
                  id: true,
                  roundLabel: true,
                  pairingAId: true,
                  pairingBId: true,
                  winnerPairingId: true,
                  winnerParticipantId: true,
                  winnerSide: true,
                },
              });
              if (typeof sideAParticipantIds !== "undefined") {
                await tx.padelMatchParticipant.deleteMany({ where: { matchId, side: "A" } });
                if (sideAParticipantIds.length > 0) {
                  await tx.padelMatchParticipant.createMany({
                    data: sideAParticipantIds.map((participantId, slotOrder) => ({
                      matchId,
                      participantId,
                      side: "A",
                      slotOrder,
                    })),
                    skipDuplicates: true,
                  });
                }
                if (sideAParticipantIds.length > 0) {
                  await tx.eventMatchSlot.update({
                    where: { id: matchId },
                    data: { pairingAId: null },
                  });
                }
              }
              if (typeof sideBParticipantIds !== "undefined") {
                await tx.padelMatchParticipant.deleteMany({ where: { matchId, side: "B" } });
                if (sideBParticipantIds.length > 0) {
                  await tx.padelMatchParticipant.createMany({
                    data: sideBParticipantIds.map((participantId, slotOrder) => ({
                      matchId,
                      participantId,
                      side: "B",
                      slotOrder,
                    })),
                    skipDuplicates: true,
                  });
                }
                if (sideBParticipantIds.length > 0) {
                  await tx.eventMatchSlot.update({
                    where: { id: matchId },
                    data: { pairingBId: null },
                  });
                }
              }

              const refreshed = await tx.eventMatchSlot.findUnique({
                where: { id: matchId },
                select: {
                  id: true,
                  roundLabel: true,
                  pairingAId: true,
                  pairingBId: true,
                  winnerPairingId: true,
                  winnerParticipantId: true,
                  winnerSide: true,
                  participants: {
                    orderBy: [{ side: "asc" }, { slotOrder: "asc" }, { id: "asc" }],
                    select: { side: true, participantId: true },
                  },
                },
              });
              if (!refreshed) return match as any;
              return {
                id: refreshed.id,
                roundLabel: refreshed.roundLabel,
                pairingAId: refreshed.pairingAId ?? null,
                pairingBId: refreshed.pairingBId ?? null,
                winnerPairingId: refreshed.winnerPairingId ?? null,
                winnerParticipantId: refreshed.winnerParticipantId ?? null,
                winnerSide:
                  refreshed.winnerSide === "A" || refreshed.winnerSide === "B" ? refreshed.winnerSide : null,
                sideAParticipantIds: (refreshed.participants ?? [])
                  .filter((row) => row.side === "A")
                  .map((row) => row.participantId),
                sideBParticipantIds: (refreshed.participants ?? [])
                  .filter((row) => row.side === "B")
                  .map((row) => row.participantId),
              };
            };

            return prisma.$transaction((tx) => applyInTx(tx));
          },
          winnerMatchId: updated.id,
          winnerPairingId: resolvedWinnerPairingId,
          winnerParticipantId: resolvedWinnerParticipantId,
          winnerParticipantIds: winnerSideParticipantIds,
          winnerSide: resolvedWinnerSide,
        });
      }

      const loserPairingId =
        resolvedWinnerPairingId && updated.pairingAId && updated.pairingBId
          ? resolvedWinnerPairingId === updated.pairingAId
            ? updated.pairingBId
            : updated.pairingAId
          : null;

      if (
        config?.format === "QUADRO_AB" &&
        bracketPrefix === "A " &&
        updated.pairingAId &&
        updated.pairingBId &&
        roundOrder.length > 0 &&
        (updated.roundLabel || "") === roundOrder[0]
      ) {
        const bMatches = koMatches.filter((m) => extractBracketPrefix(m.roundLabel) === "B ");
        if (bMatches.length > 0 && loserPairingId) {
          const bRoundOrder = sortRoundsBySize(bMatches);
          const bFirstRound = bRoundOrder[0];
          if (bFirstRound) {
            const aFirstRoundMatches = bracketMatches
              .filter((m) => (m.roundLabel || "?") === roundOrder[0])
              .sort((a, b) => a.id - b.id);
            const aPlayableMatches = aFirstRoundMatches.filter((m) => m.pairingAId && m.pairingBId);
            const aIndex = aPlayableMatches.findIndex((m) => m.id === updated.id);
            const bFirstRoundMatches = bMatches
              .filter((m) => (m.roundLabel || "?") === bFirstRound)
              .sort((a, b) => a.id - b.id);
            if (aIndex !== -1 && bFirstRoundMatches.length > 0) {
              const targetIdx = Math.floor(aIndex / 2);
              const target = bFirstRoundMatches[targetIdx];
              if (target) {
                const updateTarget: Record<string, number> = {};
                if (aIndex % 2 === 0) {
                  if (!target.pairingAId) updateTarget.pairingAId = loserPairingId;
                  else if (!target.pairingBId) updateTarget.pairingBId = loserPairingId;
                } else {
                  if (!target.pairingBId) updateTarget.pairingBId = loserPairingId;
                  else if (!target.pairingAId) updateTarget.pairingAId = loserPairingId;
                }
                if (Object.keys(updateTarget).length > 0) {
                  await updatePadelMatch({
                    matchId: target.id,
                    data: updateTarget,
                    ...systemContext,
                  });
                }
              }
            }
          }
        }
      }

      if (isDoubleElim && bracketPrefix === "A " && loserPairingId && aRoundOrderNoGF.length > 0 && bMatches.length > 0) {
        const currentLabel = updated.roundLabel ?? aRoundOrderNoGF[0];
        const wIndex = currentLabel ? aRoundOrderNoGF.findIndex((label) => label === currentLabel) : -1;
        if (wIndex >= 0) {
          const loserRoundIndex = wIndex === 0 ? 1 : 2 * (wIndex + 1) - 2;
          const loserRoundLabel = `B L${loserRoundIndex}`;
          const aRoundMatches = getRoundMatches(aMatches, currentLabel);
          const bRoundMatches = getRoundMatches(bMatches, loserRoundLabel);
          const aIndex = aRoundMatches.findIndex((m) => m.id === updated.id);
          if (aIndex !== -1 && bRoundMatches.length > 0) {
            const targetIdx = wIndex === 0 ? Math.floor(aIndex / 2) : aIndex;
            const target = bRoundMatches[targetIdx];
            if (target) {
              const updateTarget: Record<string, number> = {};
              if (wIndex === 0) {
                if (aIndex % 2 === 0) {
                  if (!target.pairingAId) updateTarget.pairingAId = loserPairingId;
                  else if (!target.pairingBId) updateTarget.pairingBId = loserPairingId;
                } else {
                  if (!target.pairingBId) updateTarget.pairingBId = loserPairingId;
                  else if (!target.pairingAId) updateTarget.pairingAId = loserPairingId;
                }
              } else {
                if (!target.pairingBId) updateTarget.pairingBId = loserPairingId;
                else if (!target.pairingAId) updateTarget.pairingAId = loserPairingId;
              }
              if (Object.keys(updateTarget).length > 0) {
                await updatePadelMatch({
                  matchId: target.id,
                  data: updateTarget,
                  ...systemContext,
                });
              }
            }
          }
        }
      }

      if (isDoubleElim && bracketPrefix === "B " && resolvedWinnerPairingId && bRoundOrder.length > 0) {
        const currentLoserRound = parseLoserRoundIndex(updated.roundLabel);
        const lastLoserRound = Math.max(
          ...bRoundOrder.map((label) => parseLoserRoundIndex(label) ?? 0),
        );
        if (currentLoserRound && lastLoserRound && currentLoserRound === lastLoserRound) {
          if (grandFinal) {
            const updateTarget: Record<string, number> = {};
            if (!grandFinal.pairingAId) updateTarget.pairingAId = resolvedWinnerPairingId;
            else if (!grandFinal.pairingBId) updateTarget.pairingBId = resolvedWinnerPairingId;
            if (Object.keys(updateTarget).length > 0) {
              await updatePadelMatch({
                matchId: grandFinal.id,
                data: updateTarget,
                ...systemContext,
              });
            }
          }
        }
      }

      let gfResetNeeded: boolean | null = null;
      if (isDoubleElim && isGrandFinal && resolvedWinnerPairingId) {
        const winnersFinalLabel =
          aRoundOrderNoGF.length > 0 ? aRoundOrderNoGF[aRoundOrderNoGF.length - 1] : null;
        const winnersFinal = winnersFinalLabel ? getRoundMatches(aMatches, winnersFinalLabel)[0] : null;
        const winnersFinalWinner = winnersFinal?.winnerPairingId ?? null;

        const lastLoserRoundLabel = bRoundOrder.length > 0 ? bRoundOrder[bRoundOrder.length - 1] : null;
        const lastLoserMatch = lastLoserRoundLabel ? getRoundMatches(bMatches, lastLoserRoundLabel)[0] : null;
        const losersFinalWinner = lastLoserMatch?.winnerPairingId ?? null;

        if (losersFinalWinner) {
          gfResetNeeded = resolvedWinnerPairingId === losersFinalWinner;
        } else if (winnersFinalWinner) {
          gfResetNeeded = resolvedWinnerPairingId !== winnersFinalWinner;
        }

        if (grandFinalReset && gfResetNeeded !== null) {
          if (gfResetNeeded) {
            const pairingAId = grandFinal?.pairingAId ?? winnersFinalWinner ?? null;
            const pairingBId = grandFinal?.pairingBId ?? resolvedWinnerPairingId ?? null;
            await updatePadelMatch({
              matchId: grandFinalReset.id,
              data: {
                pairingAId,
                pairingBId,
                winnerPairingId: null,
                status: "PENDING",
                score: {},
                scoreSets: Prisma.DbNull,
              },
              ...systemContext,
            });
          } else {
            await updatePadelMatch({
              matchId: grandFinalReset.id,
              data: {
                pairingAId: null,
                pairingBId: null,
                winnerPairingId: null,
                status: "CANCELLED",
                score: {},
                scoreSets: Prisma.DbNull,
              },
              ...systemContext,
            });
          }
        }
      }

      const isFirstRound = roundOrder.length > 0 && (updated.roundLabel || "") === roundOrder[0];
      const finalRound = roundOrder[roundOrder.length - 1];
      const isFinal = finalRound ? (updated.roundLabel || "") === finalRound : false;
      const isMainBracket = bracketPrefix !== "B ";
      const hasGrandFinal = isDoubleElim && aMatches.some((m) => isGrandFinalLabel(m.roundLabel));
      let shouldNotifyEliminated = false;
      if (isDoubleElim) {
        if (bracketPrefix === "B ") {
          shouldNotifyEliminated = Boolean(loserPairingId);
        } else if (isGrandFinalReset) {
          shouldNotifyEliminated = Boolean(loserPairingId);
        } else if (isGrandFinal) {
          shouldNotifyEliminated = Boolean(loserPairingId) && gfResetNeeded === false;
        } else if (!hasGrandFinal && isFinal && isMainBracket) {
          shouldNotifyEliminated = Boolean(loserPairingId);
        }
      } else {
        shouldNotifyEliminated =
          Boolean(loserPairingId) && (config?.format !== "QUADRO_AB" || bracketPrefix === "B " || !isFirstRound);
      }
      if (shouldNotifyEliminated && loserPairingId) {
        const loserPairing =
          loserPairingId === updated.pairingAId
            ? updated.pairingA
            : loserPairingId === updated.pairingBId
              ? updated.pairingB
              : null;
        const loserUserIds = Array.from(
          new Set((loserPairing?.slots ?? []).map((slot) => slot.profileId).filter(Boolean) as string[]),
        );
        if (loserUserIds.length > 0) {
          await queueEliminated(loserUserIds, updated.eventId);
        }
      }

      let shouldNotifyChampion = false;
      if (isDoubleElim) {
        if (isGrandFinalReset && resolvedWinnerPairingId) {
          shouldNotifyChampion = true;
        } else if (isGrandFinal && resolvedWinnerPairingId && gfResetNeeded === false) {
          shouldNotifyChampion = true;
        } else if (!hasGrandFinal && isFinal && isMainBracket && resolvedWinnerPairingId) {
          shouldNotifyChampion = true;
        }
      } else {
        shouldNotifyChampion = Boolean(resolvedWinnerPairingId) && isFinal && isMainBracket;
      }
      if (shouldNotifyChampion && resolvedWinnerPairingId) {
        const winnerPairing =
          resolvedWinnerPairingId === updated.pairingAId
            ? updated.pairingA
            : resolvedWinnerPairingId === updated.pairingBId
              ? updated.pairingB
              : null;
        const winnerUserIds = (winnerPairing?.slots ?? [])
          .map((slot) => slot.profileId)
          .filter(Boolean) as string[];
        if (winnerUserIds.length > 0) {
          await queueChampion(winnerUserIds, updated.eventId);
        }
      }
    }
  }

  const matchCompleted = updated.status === "DONE" && payload.beforeStatus !== "DONE";
  const pairingLabel = (pairing: typeof updated.pairingA | null) => {
    if (!pairing) return "Dupla";
    const names = (pairing.slots || [])
      .map((slot) => slot.playerProfile?.displayName || slot.playerProfile?.fullName)
      .filter(Boolean) as string[];
    return names.length > 0 ? names.join(" / ") : `Dupla #${pairing.id}`;
  };

  const notifyNextMatch = async (pairingId: number) => {
    const nextMatch = await prisma.eventMatchSlot.findFirst({
      where: {
        eventId: updated.eventId,
        status: "PENDING",
        AND: [
          { OR: [{ pairingAId: pairingId }, { pairingBId: pairingId }] },
          { OR: [{ plannedStartAt: { not: null } }, { startTime: { not: null } }] },
        ],
      },
      orderBy: [{ plannedStartAt: "asc" }, { startTime: "asc" }, { id: "asc" }],
      include: {
        court: { select: { name: true } },
        pairingA: { include: { slots: { include: { playerProfile: true } } } },
        pairingB: { include: { slots: { include: { playerProfile: true } } } },
      },
    });
    if (!nextMatch) return;

    const startAt = nextMatch.plannedStartAt ?? nextMatch.startTime;
    if (!startAt) return;

    const targetPairing =
      nextMatch.pairingAId === pairingId ? nextMatch.pairingA : nextMatch.pairingB;
    const opponentPairing =
      nextMatch.pairingAId === pairingId ? nextMatch.pairingB : nextMatch.pairingA;
    const pairingUsers = (targetPairing?.slots ?? [])
      .map((slot) => slot.profileId)
      .filter(Boolean) as string[];

    const timeLabel = new Intl.DateTimeFormat("pt-PT", {
      timeZone: updated.event?.timezone || "Europe/Lisbon",
      hour: "2-digit",
      minute: "2-digit",
    }).format(startAt);
    const courtLabel = nextMatch.court?.name || nextMatch.courtName || nextMatch.courtNumber || nextMatch.courtId || "Quadra";
    const opponentLabel = pairingLabel(opponentPairing);

    for (const userId of pairingUsers) {
      const allow = await shouldNotify(userId, "EVENT_REMINDER");
      if (!allow) continue;
      const dedupeKey = `NEXT_MATCH:${nextMatch.id}:${userId}`;
      try {
        await prisma.matchNotification["create"]({
          data: {
            matchId: nextMatch.id,
            dedupeKey,
            payload: { type: "NEXT_MATCH", startAt: startAt.toISOString() },
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
        throw err;
      }

      await createNotification({
        userId,
        type: "EVENT_REMINDER",
        title: "Próximo jogo definido",
        body: `Contra ${opponentLabel} · ${timeLabel} · ${courtLabel}`,
        eventId: updated.event?.id ?? null,
        organizationId: updated.event?.organizationId ?? null,
        ctaUrl: updated.event?.slug ? `/eventos/${updated.event.slug}` : null,
        ctaLabel: "Ver torneio",
        payload: {
          matchId: nextMatch.id,
          eventId: updated.event?.id ?? null,
          startAt: startAt.toISOString(),
        },
      });
    }
  };

  if (matchCompleted && updated.pairingAId) {
    await notifyNextMatch(updated.pairingAId);
  }
  if (matchCompleted && updated.pairingBId) {
    await notifyNextMatch(updated.pairingBId);
  }

  if (matchCompleted && updated.roundType === "GROUPS" && updated.groupLabel) {
    const [config, groupMatches] = await Promise.all([
      prisma.padelTournamentConfig.findUnique({
        where: { eventId: updated.eventId },
        select: { ruleSetId: true, ruleSetVersionId: true, advancedSettings: true, format: true },
      }),
      prisma.eventMatchSlot.findMany({
        where: {
          eventId: updated.eventId,
          roundType: "GROUPS",
          groupLabel: updated.groupLabel,
          ...(updated.categoryId ? { categoryId: updated.categoryId } : {}),
        },
        select: {
          id: true,
          pairingAId: true,
          pairingBId: true,
          scoreSets: true,
          score: true,
          status: true,
        },
      }),
    ]);

    const allClosed = groupMatches.every(
      (m) => m.status === "DONE" || m.status === "CANCELLED",
    );
    if (allClosed) {
      const ruleSnapshot = await getPadelRuleSetSnapshot({
        ruleSetId: config?.ruleSetId ?? null,
        ruleSetVersionId: config?.ruleSetVersionId ?? null,
      });
      const pointsTable = normalizePadelPointsTable(ruleSnapshot.pointsTable);
      const tieBreakRules = normalizePadelTieBreakRules(ruleSnapshot.tieBreakRules);
      const standingsByGroup = computePadelStandingsByGroup(groupMatches, pointsTable, tieBreakRules);
      const standings = standingsByGroup[updated.groupLabel] ?? [];
      const groupsConfig = (config?.advancedSettings as { groupsConfig?: { qualifyPerGroup?: number | null } } | null)
        ?.groupsConfig;
      const qualifyPerGroup =
        typeof groupsConfig?.qualifyPerGroup === "number" && Number.isFinite(groupsConfig.qualifyPerGroup)
          ? Math.max(1, Math.floor(groupsConfig.qualifyPerGroup))
          : 2;
      const pairingIds = standings.map((row) => row.pairingId);
      const pairings = await prisma.padelPairing.findMany({
        where: { id: { in: pairingIds } },
        select: { id: true, slots: { select: { profileId: true } } },
      });
      const pairingUsers = new Map<number, string[]>();
      pairings.forEach((pairing) => {
        pairingUsers.set(
          pairing.id,
          (pairing.slots ?? []).map((slot) => slot.profileId).filter(Boolean) as string[],
        );
      });

      for (let idx = 0; idx < standings.length; idx += 1) {
        const row = standings[idx];
        const qualified = idx < qualifyPerGroup;
        const users = pairingUsers.get(row.pairingId) ?? [];
        for (const userId of users) {
          const allow = await shouldNotify(userId, "EVENT_REMINDER");
          if (!allow) continue;
          const dedupeKey = `GROUP_CLOSED:${updated.eventId}:${updated.groupLabel}:${row.pairingId}:${userId}`;
          try {
            await prisma.matchNotification["create"]({
              data: {
                matchId: updated.id,
                dedupeKey,
                payload: { type: "GROUP_CLOSED", group: updated.groupLabel },
              },
            });
          } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
            throw err;
          }
          await createNotification({
            userId,
            type: "EVENT_REMINDER",
            title: `Grupo ${updated.groupLabel} fechado`,
            body: qualified
              ? `Terminaste em ${idx + 1}º · Qualificado para a próxima fase.`
              : `Terminaste em ${idx + 1}º · Grupo concluído.`,
            eventId: updated.event?.id ?? null,
            organizationId: updated.event?.organizationId ?? null,
            ctaUrl: updated.event?.slug ? `/eventos/${updated.event.slug}` : null,
            ctaLabel: "Ver torneio",
            payload: {
              group: updated.groupLabel,
              position: idx + 1,
              qualified,
              eventId: updated.event?.id ?? null,
            },
          });
        }
      }
    }

    if (allClosed) {
      const [allGroupMatches, existingKo, categoryLink] = await Promise.all([
        prisma.eventMatchSlot.findMany({
          where: {
            eventId: updated.eventId,
            roundType: "GROUPS",
            ...(updated.categoryId ? { categoryId: updated.categoryId } : {}),
          },
          select: { id: true, status: true },
        }),
        prisma.eventMatchSlot.findFirst({
          where: {
            eventId: updated.eventId,
            roundType: "KNOCKOUT",
            ...(updated.categoryId ? { categoryId: updated.categoryId } : {}),
          },
          select: { id: true },
        }),
        updated.categoryId
          ? prisma.padelEventCategoryLink.findFirst({
              where: { eventId: updated.eventId, padelCategoryId: updated.categoryId, isEnabled: true },
              select: { format: true },
            })
          : Promise.resolve(null),
      ]);

      const allGroupsClosed =
        allGroupMatches.length > 0 &&
        allGroupMatches.every((m) => m.status === "DONE" || m.status === "CANCELLED");
      const formatToUse = categoryLink?.format ?? updated.event?.padelTournamentConfig?.format ?? null;
      if (allGroupsClosed && !existingKo && formatToUse === "GRUPOS_ELIMINATORIAS") {
        try {
          await autoGeneratePadelMatches({
            eventId: updated.eventId,
            categoryId: updated.categoryId ?? null,
            format: formatToUse,
            phase: "KNOCKOUT",
            actorUserId: payload.actorUserId,
            auditAction: "PADEL_MATCHES_AUTO_GENERATED",
          });
        } catch (err) {
          console.warn("[padel][auto-generate-ko] falhou", err);
        }
      }
    }
  }

  return { ok: true } as const;
}
