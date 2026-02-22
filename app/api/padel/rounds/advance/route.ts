export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { OrganizationMemberRole, OrganizationModule, Prisma, padel_format } from "@prisma/client";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { resolvePadelCourtSelection } from "@/domain/padel/courtSelection";
import { isPadelOfficialStatus } from "@/domain/padel/liveStatus";
import { parsePadelFormat } from "@/domain/padel/formatCatalog";
import { computeSchedulerV2Plan } from "@/domain/padel/schedulerV2/planner";
import type { PadelExecutionMode, PadelPartialMode, PadelScheduleStrategy } from "@/domain/padel/schedulerV2/types";
import { resolveAllowPlaceholderMatches } from "@/domain/padel/schedulerV2/formatAdapters";
import { buildExistingByCourt, evaluateMatchBatchAgainstAgenda } from "@/domain/agenda/scheduleWriteGateway";
import {
  buildMexicanoRoundRelations,
  deriveMexicanoRoundEntries,
  type MexicanoRoundEntry,
} from "@/domain/padel/mexicanoRecomposition";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

const parseNumber = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.floor(parsed);
};

const parseDate = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isActiveBooking = (booking: { status: string; pendingExpiresAt: Date | null }) => {
  const status = booking["status"];
  if (["CONFIRMED", "DISPUTED", "NO_SHOW"].includes(status)) return true;
  if (["PENDING_CONFIRMATION", "PENDING"].includes(status)) {
    return booking.pendingExpiresAt ? booking.pendingExpiresAt > new Date() : false;
  }
  return false;
};

const roundLabelFor = (round: number, court: number) => `R${round}.C${court}`;

const scoreGames = (scoreRaw: unknown, winnerSide: "A" | "B" | null) => {
  if (scoreRaw && typeof scoreRaw === "object" && !Array.isArray(scoreRaw)) {
    const score = scoreRaw as Record<string, unknown>;
    const gamesA = parseNumber(score.gamesA);
    const gamesB = parseNumber(score.gamesB);
    if (gamesA !== null && gamesB !== null) return { gamesA, gamesB };
  }
  if (winnerSide === "A") return { gamesA: 1, gamesB: 0 };
  if (winnerSide === "B") return { gamesA: 0, gamesB: 1 };
  return { gamesA: 0, gamesB: 0 };
};

type PlayerStats = {
  playerProfileId: number;
  points: number;
  gameDiff: number;
  gamesWon: number;
  stableSeed: number;
};

async function ensureTournamentParticipant(params: {
  eventId: number;
  categoryId: number | null;
  organizationId: number;
  playerProfileId: number;
  participantMap: Map<number, number>;
}) {
  const { eventId, categoryId, organizationId, playerProfileId, participantMap } = params;
  const cached = participantMap.get(playerProfileId);
  if (typeof cached === "number") return cached;

  try {
    const created = await prisma.padelTournamentParticipant.create({
      data: {
        eventId,
        categoryId,
        organizationId,
        playerProfileId,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    participantMap.set(playerProfileId, created.id);
    return created.id;
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const recovered = await prisma.padelTournamentParticipant.findFirst({
      where: { eventId, categoryId, playerProfileId },
      select: { id: true },
    });
    if (!recovered?.id) throw error;
    participantMap.set(playerProfileId, recovered.id);
    return recovered.id;
  }
}

async function tryAutoScheduleGenerated(params: {
  event: {
    id: number;
    startsAt: Date | null;
    endsAt: Date | null;
    organizationId: number;
    padelTournamentConfig: {
      padelClubId: number | null;
      partnerClubIds: number[];
      advancedSettings: Record<string, unknown>;
      format: padel_format;
    } | null;
  };
  categoryId: number | null;
  createdMatchIds: number[];
  dryRun: boolean;
  strategy: PadelScheduleStrategy;
  partialMode: PadelPartialMode;
  executionMode: PadelExecutionMode;
}) {
  const { event, categoryId, createdMatchIds, dryRun, strategy, partialMode, executionMode } = params;
  if (createdMatchIds.length === 0) {
    return {
      scheduled: 0,
      skippedByMatch: [] as Array<{ matchId: number; reason: string }>,
      unscheduledByReason: {} as Record<string, number>,
      byCategory: [] as Array<Record<string, unknown>>,
      executionMode,
    };
  }

  const advanced = (event.padelTournamentConfig?.advancedSettings ?? {}) as Record<string, unknown>;
  const scheduleDefaults =
    advanced.scheduleDefaults && typeof advanced.scheduleDefaults === "object"
      ? (advanced.scheduleDefaults as Record<string, unknown>)
      : {};
  const durationMinutes =
    parseNumber(scheduleDefaults.durationMinutes) ??
    parseNumber(advanced.gameDurationMinutes) ??
    60;
  const slotMinutes = parseNumber(scheduleDefaults.slotMinutes) ?? 15;
  const bufferMinutes = parseNumber(scheduleDefaults.bufferMinutes) ?? 5;
  const minRestMinutes = parseNumber(scheduleDefaults.minRestMinutes) ?? 10;
  const priority =
    scheduleDefaults.priority === "KNOCKOUT_FIRST"
      ? "KNOCKOUT_FIRST"
      : ("GROUPS_FIRST" as "GROUPS_FIRST" | "KNOCKOUT_FIRST");

  const windowStart = parseDate(scheduleDefaults.windowStart) ?? event.startsAt ?? null;
  const windowEnd = parseDate(scheduleDefaults.windowEnd) ?? event.endsAt ?? null;
  if (!windowStart || !windowEnd || windowEnd <= windowStart) {
    return {
      scheduled: 0,
      skippedByMatch: [] as Array<{ matchId: number; reason: string }>,
      unscheduledByReason: { INVALID_WINDOW: createdMatchIds.length },
      byCategory: [],
      executionMode,
    };
  }

  const courtSelection = await resolvePadelCourtSelection({
    db: prisma,
    organizationId: event.organizationId,
    padelClubId: event.padelTournamentConfig?.padelClubId ?? null,
    partnerClubIds: event.padelTournamentConfig?.partnerClubIds ?? [],
    advancedSettings: advanced,
  });
  const courts = courtSelection.courts.map((court) => ({
    id: court.id,
    name: court.name,
  }));
  if (courts.length === 0) {
    return {
      scheduled: 0,
      skippedByMatch: [] as Array<{ matchId: number; reason: string }>,
      unscheduledByReason: { NO_COURTS_CONFIGURED: createdMatchIds.length },
      byCategory: [],
      executionMode,
    };
  }

  const unscheduledMatchesRaw = await prisma.eventMatchSlot.findMany({
    where: {
      eventId: event.id,
      id: { in: createdMatchIds },
      status: "PENDING",
      plannedStartAt: null,
      startTime: null,
      ...(categoryId ? { categoryId } : {}),
    },
    select: {
      id: true,
      categoryId: true,
      plannedDurationMinutes: true,
      courtId: true,
      roundLabel: true,
      roundType: true,
      groupLabel: true,
      participants: {
        select: {
          side: true,
          participant: { select: { playerProfileId: true, playerProfile: { select: { email: true } } } },
        },
      },
    },
    orderBy: [{ roundLabel: "asc" }, { id: "asc" }],
  });

  if (unscheduledMatchesRaw.length === 0) {
    return { scheduled: 0, skippedByMatch: [], unscheduledByReason: {}, byCategory: [], executionMode };
  }

  const normalizeParticipantSide = (side: "A" | "B", rows: typeof unscheduledMatchesRaw[number]["participants"]) =>
    rows
      .filter((row) => row.side === side)
      .map((row) => row.participant?.playerProfileId)
      .filter((id): id is number => typeof id === "number");
  const normalizeParticipantEmails = (side: "A" | "B", rows: typeof unscheduledMatchesRaw[number]["participants"]) =>
    rows
      .filter((row) => row.side === side)
      .map((row) => row.participant?.playerProfile?.email?.trim().toLowerCase() ?? null)
      .filter((email): email is string => Boolean(email));

  const unscheduledMatches = unscheduledMatchesRaw.map((match) => ({
    id: match.id,
    categoryId: match.categoryId ?? null,
    plannedDurationMinutes: match.plannedDurationMinutes,
    courtId: match.courtId,
    roundLabel: match.roundLabel,
    roundType: match.roundType,
    groupLabel: match.groupLabel,
    sideAProfileIds: normalizeParticipantSide("A", match.participants),
    sideBProfileIds: normalizeParticipantSide("B", match.participants),
    sideAEmails: normalizeParticipantEmails("A", match.participants),
    sideBEmails: normalizeParticipantEmails("B", match.participants),
  }));

  const scheduledMatchesRaw = await prisma.eventMatchSlot.findMany({
    where: {
      eventId: event.id,
      id: { notIn: createdMatchIds },
      OR: [{ plannedStartAt: { not: null } }, { startTime: { not: null } }],
      ...(categoryId ? { categoryId } : {}),
    },
    select: {
      id: true,
      plannedStartAt: true,
      plannedEndAt: true,
      plannedDurationMinutes: true,
      startTime: true,
      courtId: true,
      participants: {
        select: {
          side: true,
          participant: { select: { playerProfileId: true, playerProfile: { select: { email: true } } } },
        },
      },
    },
  });
  const scheduledMatches = scheduledMatchesRaw.map((match) => ({
    id: match.id,
    plannedStartAt: match.plannedStartAt,
    plannedEndAt: match.plannedEndAt,
    plannedDurationMinutes: match.plannedDurationMinutes,
    startTime: match.startTime,
    courtId: match.courtId,
    sideAProfileIds: normalizeParticipantSide("A", match.participants),
    sideBProfileIds: normalizeParticipantSide("B", match.participants),
    sideAEmails: normalizeParticipantEmails("A", match.participants),
    sideBEmails: normalizeParticipantEmails("B", match.participants),
  }));

  const now = new Date();
  const [availabilities, blocks, bookings, softBlocks, classSessions] = await Promise.all([
    prisma.calendarAvailability.findMany({
      where: { eventId: event.id, organizationId: event.organizationId },
      select: { playerProfileId: true, playerEmail: true, startAt: true, endAt: true },
    }),
    prisma.calendarBlock.findMany({
      where: { eventId: event.id, organizationId: event.organizationId },
      select: { id: true, courtId: true, startAt: true, endAt: true },
    }),
    prisma.booking.findMany({
      where: {
        organizationId: event.organizationId,
        courtId: { in: courts.map((court) => court.id) },
        startsAt: { lt: windowEnd },
        OR: [
          { status: { in: ["CONFIRMED", "DISPUTED", "NO_SHOW"] } },
          { status: { in: ["PENDING_CONFIRMATION", "PENDING"] }, pendingExpiresAt: { gt: now } },
        ],
      },
      select: {
        id: true,
        courtId: true,
        startsAt: true,
        durationMinutes: true,
        status: true,
        pendingExpiresAt: true,
        updatedAt: true,
      },
    }),
    prisma.softBlock.findMany({
      where: {
        organizationId: event.organizationId,
        startsAt: { lt: windowEnd },
        endsAt: { gt: windowStart },
        OR: [
          { scopeType: "ORGANIZATION" },
          { scopeType: "COURT", scopeId: { in: courts.map((court) => court.id) } },
        ],
      },
      select: { id: true, scopeType: true, scopeId: true, startsAt: true, endsAt: true },
    }),
    prisma.classSession.findMany({
      where: {
        organizationId: event.organizationId,
        courtId: { in: courts.map((court) => court.id) },
        startsAt: { lt: windowEnd },
        endsAt: { gt: windowStart },
        status: { not: "CANCELLED" },
      },
      select: { id: true, courtId: true, startsAt: true, endsAt: true },
    }),
  ]);

  const bookingPlannerBlocks = bookings
    .filter((booking) => booking.courtId && isActiveBooking(booking))
    .map((booking) => ({
      id: `booking:${booking.id}`,
      courtId: booking.courtId,
      startAt: booking.startsAt,
      endAt: new Date(booking.startsAt.getTime() + booking.durationMinutes * 60 * 1000),
      sourceType: "BOOKING" as const,
    }));

  const classSessionPlannerBlocks = classSessions
    .filter((session) => session.courtId)
    .map((session) => ({
      id: `class:${session.id}`,
      courtId: session.courtId,
      startAt: session.startsAt,
      endAt: session.endsAt,
      sourceType: "CLASS_SESSION" as const,
    }));

  const allowPlaceholderMatches = resolveAllowPlaceholderMatches({
    tournamentFormat: event.padelTournamentConfig?.format ?? null,
    unscheduledMatches,
  });

  const scheduleResult = computeSchedulerV2Plan({
    strategy,
    unscheduledMatches,
    scheduledMatches,
    courts,
    availabilities,
    courtBlocks: [...blocks, ...bookingPlannerBlocks, ...classSessionPlannerBlocks],
    config: {
      windowStart,
      windowEnd,
      ...(courtSelection.courtPriorityOrder.length > 0
        ? { courtPriorityOrder: courtSelection.courtPriorityOrder }
        : {}),
      durationMinutes,
      slotMinutes,
      bufferMinutes,
      minRestMinutes,
      priority,
      allowPlaceholderMatches,
    },
  });

  const unscheduledByReason: Record<string, number> = { ...scheduleResult.unscheduledByReason };
  const { existingByCourt, missingExisting } = buildExistingByCourt({
    courtIds: courts.map((court) => court.id),
    hardBlocks: blocks,
    scheduledMatches: scheduledMatchesRaw,
    bookings,
    softBlocks,
    classSessions,
  });
  if (missingExisting) {
    unscheduledByReason.AGENDA_CONFLICT = (unscheduledByReason.AGENDA_CONFLICT ?? 0) + createdMatchIds.length;
    return {
      scheduled: 0,
      skipped: createdMatchIds.length,
      skippedByMatch: createdMatchIds.map((matchId) => ({ matchId, reason: "AGENDA_CONFLICT" })),
      unscheduledByReason,
      byCategory: scheduleResult.byCategory,
      executionMode,
      error: "AUTO_SCHEDULE_INFEASIBLE",
    };
  }

  const arbitration = evaluateMatchBatchAgainstAgenda({
    updates: scheduleResult.scheduled.map((update) => ({
      matchId: update.matchId,
      courtId: update.courtId,
      start: update.start,
      end: update.end,
    })),
    existingByCourt,
    partialMode,
  });
  arbitration.rejectedUpdates.forEach((item) => {
    unscheduledByReason[item.reason] = (unscheduledByReason[item.reason] ?? 0) + 1;
  });
  const skippedByMatch = [
    ...scheduleResult.skipped.map((item) => ({ matchId: item.matchId, reason: item.reason })),
    ...arbitration.rejectedUpdates.map((item) => ({
      matchId: item.matchId,
      reason: item.reason,
      blockedByType: item.blockedByType ?? null,
      blockedBySourceId: item.blockedBySourceId ?? null,
    })),
  ];
  const acceptedMatchIds = new Set(arbitration.acceptedUpdates.map((update) => update.matchId));
  const scheduledAccepted = scheduleResult.scheduled.filter((update) => acceptedMatchIds.has(update.matchId));

  if (partialMode === "REQUIRE_FULL" && !dryRun && skippedByMatch.length > 0) {
    return {
      scheduled: scheduledAccepted.length,
      skipped: skippedByMatch.length,
      skippedByMatch,
      unscheduledByReason,
      byCategory: scheduleResult.byCategory,
      executionMode,
      error: "AUTO_SCHEDULE_INFEASIBLE",
    };
  }

  if (!dryRun) {
    const courtById = new Map(courtSelection.courts.map((court) => [court.id, court]));
    for (const scheduled of scheduledAccepted) {
      const court = courtById.get(scheduled.courtId);
      await prisma.eventMatchSlot.update({
        where: { id: scheduled.matchId },
        data: {
          courtId: scheduled.courtId,
          courtNumber: court ? courtSelection.courtPriorityOrder.indexOf(court.id) + 1 : null,
          courtName: court?.name ?? null,
          plannedStartAt: scheduled.start,
          plannedEndAt: scheduled.end,
          plannedDurationMinutes: scheduled.durationMinutes,
        },
      });
    }
  }

  return {
    scheduled: scheduledAccepted.length,
    skippedByMatch,
    unscheduledByReason,
    byCategory: scheduleResult.byCategory,
    executionMode,
  };
}

async function _POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const eventId = parseNumber(body.eventId);
  const categoryIdRaw = parseNumber(body.categoryId);
  const categoryId = categoryIdRaw && categoryIdRaw > 0 ? categoryIdRaw : null;
  const dryRun = body.dryRun === true;
  const autoScheduleInput =
    body.autoSchedule && typeof body.autoSchedule === "object" ? (body.autoSchedule as Record<string, unknown>) : {};
  const autoScheduleStrategy: PadelScheduleStrategy =
    autoScheduleInput.strategy === "GROUPS_FIRST" ||
    autoScheduleInput.strategy === "KNOCKOUT_FIRST" ||
    autoScheduleInput.strategy === "BALANCED_BY_CATEGORY"
      ? (autoScheduleInput.strategy as PadelScheduleStrategy)
      : "BALANCED_BY_CATEGORY";
  const autoSchedulePartialMode: PadelPartialMode =
    autoScheduleInput.partialMode === "REQUIRE_FULL" ? "REQUIRE_FULL" : "ALLOW_PARTIAL";
  const autoScheduleExecutionMode: PadelExecutionMode =
    autoScheduleInput.executionMode === "ASYNC" ? "ASYNC" : "SYNC";
  if (!eventId || eventId <= 0) return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: {
      id: true,
      organizationId: true,
      startsAt: true,
      endsAt: true,
      padelTournamentConfig: {
        select: {
          format: true,
          advancedSettings: true,
          padelClubId: true,
          partnerClubIds: true,
        },
      },
    },
  });
  if (!event?.organizationId || !event.padelTournamentConfig) {
    return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  if (categoryId) {
    const link = await prisma.padelEventCategoryLink.findFirst({
      where: { eventId, padelCategoryId: categoryId, isEnabled: true },
      select: { id: true },
    });
    if (!link) return jsonWrap({ ok: false, error: "CATEGORY_NOT_AVAILABLE" }, { status: 400 });
  }

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: event.organizationId,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });
  const permission = await ensureMemberModuleAccess({
    organizationId: event.organizationId,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  if (!permission.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const advanced = (event.padelTournamentConfig.advancedSettings ?? {}) as Record<string, unknown>;
  const profilesByCategory =
    advanced.formatProfilesByCategory && typeof advanced.formatProfilesByCategory === "object"
      ? (advanced.formatProfilesByCategory as Record<string, unknown>)
      : null;
  const categoryKey = categoryId != null ? String(categoryId) : "global";
  const categoryProfile =
    profilesByCategory &&
    profilesByCategory[categoryKey] &&
    typeof profilesByCategory[categoryKey] === "object"
      ? (profilesByCategory[categoryKey] as Record<string, unknown>)
      : profilesByCategory && profilesByCategory.global && typeof profilesByCategory.global === "object"
        ? (profilesByCategory.global as Record<string, unknown>)
        : null;
  const formatOverride =
    categoryProfile && typeof categoryProfile.format === "string" ? parsePadelFormat(categoryProfile.format) : null;
  const formatEffective = formatOverride ?? event.padelTournamentConfig.format;

  const createdMatches: Array<{
    data: Prisma.EventMatchSlotCreateInput;
    participants?: { sideA: number[]; sideB: number[] };
  }> = [];
  const runtimePatch: Record<string, unknown> = {};

  if (formatEffective === padel_format.NON_STOP) {
    const nonStopRuntimeByCategory =
      advanced.nonStopRuntimeByCategory && typeof advanced.nonStopRuntimeByCategory === "object"
        ? (advanced.nonStopRuntimeByCategory as Record<string, unknown>)
        : {};
    const runtimeRaw =
      nonStopRuntimeByCategory[categoryKey] && typeof nonStopRuntimeByCategory[categoryKey] === "object"
        ? (nonStopRuntimeByCategory[categoryKey] as Record<string, unknown>)
        : null;
    if (!runtimeRaw) {
      return jsonWrap({ ok: false, error: "ROUND_STATE_NOT_FOUND" }, { status: 409 });
    }
    const profileNonStopMode =
      categoryProfile?.nonStopMode === "ACTIVE_QUEUE" || categoryProfile?.nonStopMode === "HARD_CAP_WAITLIST"
        ? categoryProfile.nonStopMode
        : null;
    const runtimeNonStopMode =
      runtimeRaw.mode === "ACTIVE_QUEUE" || runtimeRaw.mode === "HARD_CAP_WAITLIST"
        ? (runtimeRaw.mode as "ACTIVE_QUEUE" | "HARD_CAP_WAITLIST")
        : null;
    const nonStopMode = runtimeNonStopMode ?? profileNonStopMode ?? "HARD_CAP_WAITLIST";

    const currentRound = Math.max(1, parseNumber(runtimeRaw.round) ?? 1);
    const roundsTotal = Math.max(currentRound, parseNumber(runtimeRaw.roundsTotal) ?? currentRound);
    const activeCourtsCount = Math.max(1, parseNumber(runtimeRaw.activeCourtsCount) ?? 1);
    if (currentRound >= roundsTotal) {
      return jsonWrap({ ok: false, error: "ROUND_LIMIT_REACHED" }, { status: 409 });
    }

    const labels = Array.from({ length: activeCourtsCount }, (_, idx) => roundLabelFor(currentRound, idx + 1));
    const currentRoundMatchesRaw = await prisma.eventMatchSlot.findMany({
      where: {
        eventId,
        roundType: "GROUPS",
        groupLabel: "NS",
        roundLabel: { in: labels },
        ...(categoryId ? { categoryId } : {}),
      },
      select: {
        id: true,
        roundLabel: true,
        groupLabel: true,
        status: true,
        pairingAId: true,
        pairingBId: true,
        winnerPairingId: true,
        courtId: true,
        courtNumber: true,
        courtName: true,
      },
    });
    const currentRoundMatches = currentRoundMatchesRaw.filter(
      (match) => match.groupLabel === "NS" || match.groupLabel == null,
    );
    const matchByLabel = new Map(
      currentRoundMatches
        .filter((match) => typeof match.roundLabel === "string")
        .map((match) => [match.roundLabel as string, match]),
    );
    for (const label of labels) {
      const match = matchByLabel.get(label);
      if (!match) return jsonWrap({ ok: false, error: "ROUND_NOT_READY" }, { status: 409 });
      if (!isPadelOfficialStatus(match.status)) {
        return jsonWrap({ ok: false, error: "ROUND_NOT_FINISHED" }, { status: 409 });
      }
    }

    const queue = Array.isArray(runtimeRaw.queue)
      ? runtimeRaw.queue
          .map((value) => parseNumber(value))
          .filter((value): value is number => typeof value === "number" && value > 0)
      : [];
    const nextCourts: number[][] = Array.from({ length: activeCourtsCount }, () => []);

    for (let court = 1; court <= activeCourtsCount; court += 1) {
      const label = roundLabelFor(currentRound, court);
      const match = matchByLabel.get(label);
      if (!match) continue;

      const winnerPairingId =
        match.winnerPairingId ??
        (match.pairingAId && !match.pairingBId ? match.pairingAId : !match.pairingAId && match.pairingBId ? match.pairingBId : null);
      const loserPairingId =
        winnerPairingId && match.pairingAId && match.pairingBId
          ? winnerPairingId === match.pairingAId
            ? match.pairingBId
            : match.pairingAId
          : null;

      if (winnerPairingId) {
        const winnerTargetCourt = court === 1 ? 1 : court - 1;
        nextCourts[winnerTargetCourt - 1]?.push(winnerPairingId);
      }
      if (loserPairingId) {
        if (court === activeCourtsCount) {
          if (nonStopMode === "ACTIVE_QUEUE") {
            queue.push(loserPairingId);
          } else {
            nextCourts[activeCourtsCount - 1]?.push(loserPairingId);
          }
        } else {
          nextCourts[court]?.push(loserPairingId);
        }
      }
    }

    if (nonStopMode === "ACTIVE_QUEUE") {
      while ((nextCourts[activeCourtsCount - 1]?.length ?? 0) < 2 && queue.length > 0) {
        const nextFromQueue = queue.shift();
        if (typeof nextFromQueue === "number") {
          nextCourts[activeCourtsCount - 1]?.push(nextFromQueue);
        }
      }
    }

    const nextRound = currentRound + 1;
    for (let courtIdx = 0; courtIdx < activeCourtsCount; courtIdx += 1) {
      const pairings = nextCourts[courtIdx] ?? [];
      if (pairings.length < 2) {
        return jsonWrap(
          {
            ok: false,
            error: "ROUND_ADVANCE_INCOMPLETE",
            details: { court: courtIdx + 1, required: 2, available: pairings.length },
          },
          { status: 409 },
        );
      }
      const pairingAId = pairings[0] ?? null;
      const pairingBId = pairings[1] ?? null;
      const label = roundLabelFor(nextRound, courtIdx + 1);
      createdMatches.push({
        data: {
          event: { connect: { id: event.id } },
          ...(categoryId ? { category: { connect: { id: categoryId } } } : {}),
          pairingA: pairingAId ? { connect: { id: pairingAId } } : undefined,
          pairingB: pairingBId ? { connect: { id: pairingBId } } : undefined,
          status: "PENDING",
          roundType: "GROUPS",
          roundLabel: label,
          groupLabel: "NS",
          score: {
            mode: "TIMED_GAMES",
              nonStop: {
                mode: nonStopMode,
                round: nextRound,
                court: courtIdx + 1,
                totalCourts: activeCourtsCount,
              roundsTotal,
            },
          } as Prisma.InputJsonValue,
        },
      });
    }

    runtimePatch.nonStopRuntimeByCategory = {
      ...nonStopRuntimeByCategory,
      [categoryKey]: {
        ...runtimeRaw,
        mode: nonStopMode,
        round: nextRound,
        queue: nonStopMode === "ACTIVE_QUEUE" ? queue : [],
        activePairs: nextCourts.map((pairings) => [pairings[0] ?? null, pairings[1] ?? null]),
        updatedAt: new Date().toISOString(),
      },
    };
  } else if (
    (formatEffective === padel_format.AMERICANO || formatEffective === padel_format.MEXICANO) &&
    (categoryProfile?.amMxMode === "FIXED_PAIR" ? "FIXED_PAIR" : "INDIVIDUAL_ROTATION") === "INDIVIDUAL_ROTATION" &&
    categoryProfile?.amMxProgressionMode === "ROUND_BY_ROUND"
  ) {
    const amMxRuntimeByCategory =
      advanced.amMxRuntimeByCategory && typeof advanced.amMxRuntimeByCategory === "object"
        ? (advanced.amMxRuntimeByCategory as Record<string, unknown>)
        : {};
    const runtimeRaw =
      amMxRuntimeByCategory[categoryKey] && typeof amMxRuntimeByCategory[categoryKey] === "object"
        ? (amMxRuntimeByCategory[categoryKey] as Record<string, unknown>)
        : null;
    if (!runtimeRaw) return jsonWrap({ ok: false, error: "ROUND_STATE_NOT_FOUND" }, { status: 409 });

    const roundsGenerated = Math.max(1, parseNumber(runtimeRaw.roundsGenerated) ?? 1);
    const roundsTotal = Math.max(roundsGenerated, parseNumber(runtimeRaw.roundsTotal) ?? roundsGenerated);
    if (roundsGenerated >= roundsTotal) {
      return jsonWrap({ ok: false, error: "ROUND_LIMIT_REACHED" }, { status: 409 });
    }
    const seedOrder = Array.isArray(runtimeRaw.seedOrder)
      ? runtimeRaw.seedOrder
          .map((value) => parseNumber(value))
          .filter((value): value is number => typeof value === "number" && value > 0)
      : [];
    if (seedOrder.length < 4) return jsonWrap({ ok: false, error: "ROUND_STATE_INVALID" }, { status: 409 });

    const roundMatches = await prisma.eventMatchSlot.findMany({
      where: {
        eventId,
        roundType: "GROUPS",
        groupLabel: formatEffective === padel_format.AMERICANO ? "AM" : "MX",
        ...(categoryId ? { categoryId } : {}),
      },
      select: {
        id: true,
        roundLabel: true,
        status: true,
        winnerSide: true,
        score: true,
        participants: {
          orderBy: [{ side: "asc" }, { slotOrder: "asc" }, { id: "asc" }],
          select: {
            side: true,
            participant: { select: { playerProfileId: true } },
          },
        },
      },
      orderBy: [{ roundLabel: "asc" }, { id: "asc" }],
    });

    const currentRoundLabel = `Ronda ${roundsGenerated}`;
    const currentRoundMatches = roundMatches.filter((match) => match.roundLabel === currentRoundLabel);
    if (currentRoundMatches.length === 0) {
      return jsonWrap({ ok: false, error: "ROUND_NOT_READY" }, { status: 409 });
    }
    const hasPendingCurrentRound = currentRoundMatches.some((match) => !isPadelOfficialStatus(match.status));
    if (hasPendingCurrentRound) return jsonWrap({ ok: false, error: "ROUND_NOT_FINISHED" }, { status: 409 });

    const stableSeed = new Map(seedOrder.map((playerId, idx) => [playerId, idx]));
    const stats = new Map<number, PlayerStats>();
    for (const playerProfileId of seedOrder) {
      stats.set(playerProfileId, {
        playerProfileId,
        points: 0,
        gameDiff: 0,
        gamesWon: 0,
        stableSeed: stableSeed.get(playerProfileId) ?? Number.MAX_SAFE_INTEGER,
      });
    }

    for (const match of roundMatches.filter((item) => isPadelOfficialStatus(item.status))) {
      const sideAPlayers = match.participants
        .filter((participant) => participant.side === "A")
        .map((participant) => participant.participant?.playerProfileId)
        .filter((playerId): playerId is number => typeof playerId === "number");
      const sideBPlayers = match.participants
        .filter((participant) => participant.side === "B")
        .map((participant) => participant.participant?.playerProfileId)
        .filter((playerId): playerId is number => typeof playerId === "number");
      if (sideAPlayers.length === 0 || sideBPlayers.length === 0) continue;

      const winnerSide = match.winnerSide === "A" || match.winnerSide === "B" ? match.winnerSide : null;
      const games = scoreGames(match.score, winnerSide);
      const sideAWon = games.gamesA > games.gamesB;
      const sideBWon = games.gamesB > games.gamesA;

      for (const playerId of sideAPlayers) {
        const row = stats.get(playerId) ?? {
          playerProfileId: playerId,
          points: 0,
          gameDiff: 0,
          gamesWon: 0,
          stableSeed: stableSeed.get(playerId) ?? Number.MAX_SAFE_INTEGER,
        };
        row.gamesWon += games.gamesA;
        row.gameDiff += games.gamesA - games.gamesB;
        row.points += sideAWon ? 3 : sideBWon ? 0 : 1;
        stats.set(playerId, row);
      }
      for (const playerId of sideBPlayers) {
        const row = stats.get(playerId) ?? {
          playerProfileId: playerId,
          points: 0,
          gameDiff: 0,
          gamesWon: 0,
          stableSeed: stableSeed.get(playerId) ?? Number.MAX_SAFE_INTEGER,
        };
        row.gamesWon += games.gamesB;
        row.gameDiff += games.gamesB - games.gamesA;
        row.points += sideBWon ? 3 : sideAWon ? 0 : 1;
        stats.set(playerId, row);
      }
    }

    const orderedPlayerIds = [...stats.values()]
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
        if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
        return a.stableSeed - b.stableSeed;
      })
      .map((row) => row.playerProfileId);

    const participantRows = await prisma.padelTournamentParticipant.findMany({
      where: { eventId, categoryId: categoryId ?? null },
      select: { id: true, playerProfileId: true },
    });
    const participantMap = new Map(participantRows.map((participant) => [participant.playerProfileId, participant.id]));

    const previousRoundRelations = buildMexicanoRoundRelations(
      currentRoundMatches.map((match) => {
        const sideA = match.participants
          .filter((participant) => participant.side === "A")
          .map((participant) => participant.participant?.playerProfileId)
          .filter((playerId): playerId is number => typeof playerId === "number");
        const sideB = match.participants
          .filter((participant) => participant.side === "B")
          .map((participant) => participant.participant?.playerProfileId)
          .filter((playerId): playerId is number => typeof playerId === "number");
        return { sideA, sideB };
      }),
    );

    const nextRound = roundsGenerated + 1;
    const roundEntries: MexicanoRoundEntry[] =
      formatEffective === padel_format.MEXICANO
        ? deriveMexicanoRoundEntries(orderedPlayerIds, { previousRoundRelations })
        : (() => {
            const entries: MexicanoRoundEntry[] = [];
            for (let idx = 0; idx < orderedPlayerIds.length; idx += 4) {
              const quartet = orderedPlayerIds.slice(idx, idx + 4);
              if (quartet.length < 4) {
                for (const playerId of quartet) entries.push({ kind: "BYE", playerId });
                continue;
              }
              entries.push({
                kind: "MATCH",
                sideA: [quartet[0]!, quartet[1]!],
                sideB: [quartet[2]!, quartet[3]!],
              });
            }
            return entries;
          })();

    let matchCounter = 0;
    for (const entry of roundEntries) {
      if (entry.kind === "BYE") {
        const participantId = await ensureTournamentParticipant({
          eventId,
          categoryId,
          organizationId: organization.id,
          playerProfileId: entry.playerId,
          participantMap,
        });
        createdMatches.push({
          data: {
            event: { connect: { id: event.id } },
            ...(categoryId ? { category: { connect: { id: categoryId } } } : {}),
            status: "OFFICIAL",
            roundType: "GROUPS",
            roundLabel: `Ronda ${nextRound}`,
            groupLabel: formatEffective === padel_format.AMERICANO ? "AM" : "MX",
            score: {
              mode: "TIMED_GAMES",
              resultType: "BYE_NEUTRAL",
              gamesA: 0,
              gamesB: 0,
              endedByBuzzer: false,
              endedAt: new Date().toISOString(),
            } as Prisma.InputJsonValue,
            scoreSets: [] as Prisma.InputJsonValue,
          },
          participants: { sideA: [participantId], sideB: [] },
        });
        continue;
      }

      const sideAParticipants = await Promise.all(
        entry.sideA.map((playerProfileId) =>
          ensureTournamentParticipant({
            eventId,
            categoryId,
            organizationId: organization.id,
            playerProfileId,
            participantMap,
          }),
        ),
      );
      const sideBParticipants = await Promise.all(
        entry.sideB.map((playerProfileId) =>
          ensureTournamentParticipant({
            eventId,
            categoryId,
            organizationId: organization.id,
            playerProfileId,
            participantMap,
          }),
        ),
      );
      matchCounter += 1;
      createdMatches.push({
        data: {
          event: { connect: { id: event.id } },
          ...(categoryId ? { category: { connect: { id: categoryId } } } : {}),
          status: "PENDING",
          roundType: "GROUPS",
          roundLabel: `Ronda ${nextRound}`,
          groupLabel: formatEffective === padel_format.AMERICANO ? "AM" : "MX",
          score: {
            mode: "TIMED_GAMES",
            sourceTag: `AUTO_ROTATION:${eventId}:${categoryId ?? 0}:${formatEffective}`,
          } as Prisma.InputJsonValue,
        },
        participants: { sideA: sideAParticipants, sideB: sideBParticipants },
      });
    }

    runtimePatch.amMxRuntimeByCategory = {
      ...amMxRuntimeByCategory,
      [categoryKey]: {
        ...runtimeRaw,
        roundsGenerated: nextRound,
        lastOrder: orderedPlayerIds,
        updatedAt: new Date().toISOString(),
      },
    };
  } else {
    return jsonWrap({ ok: false, error: "ROUND_ADVANCE_NOT_SUPPORTED" }, { status: 409 });
  }

  if (dryRun) {
    return jsonWrap(
      {
        ok: true,
        generated: createdMatches.length,
        scheduled: 0,
        unscheduledByReason: {},
        autoSchedule: {
          strategy: autoScheduleStrategy,
          partialMode: autoSchedulePartialMode,
          executionMode: autoScheduleExecutionMode,
        },
        roundState: {
          format: formatEffective,
          categoryId,
          mode: formatEffective === padel_format.NON_STOP ? (runtimePatch.nonStopRuntimeByCategory as Record<string, any>)?.[categoryKey]?.mode ?? null : null,
          dryRun: true,
        },
      },
      { status: 200 },
    );
  }

  const createdMatchIds: number[] = [];
  for (const created of createdMatches) {
    const match = await prisma.eventMatchSlot.create({
      data: created.data,
      select: { id: true },
    });
    createdMatchIds.push(match.id);
    if (created.participants && (created.participants.sideA.length > 0 || created.participants.sideB.length > 0)) {
      await prisma.padelMatchParticipant.createMany({
        data: [
          ...created.participants.sideA.map((participantId, idx) => ({
            matchId: match.id,
            participantId,
            side: "A" as const,
            slotOrder: idx + 1,
          })),
          ...created.participants.sideB.map((participantId, idx) => ({
            matchId: match.id,
            participantId,
            side: "B" as const,
            slotOrder: idx + 1,
          })),
        ],
      });
    }
  }

  if (Object.keys(runtimePatch).length > 0) {
    await prisma.padelTournamentConfig.update({
      where: { eventId },
      data: {
        advancedSettings: {
          ...advanced,
          ...runtimePatch,
        } as Prisma.InputJsonValue,
      },
    });
  }

  const scheduled = await tryAutoScheduleGenerated({
    event: {
      id: event.id,
      organizationId: event.organizationId,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      padelTournamentConfig: {
        format: event.padelTournamentConfig.format,
        advancedSettings: (event.padelTournamentConfig.advancedSettings as Record<string, unknown>) ?? {},
        padelClubId: event.padelTournamentConfig.padelClubId ?? null,
        partnerClubIds: event.padelTournamentConfig.partnerClubIds ?? [],
      },
    },
    categoryId,
    createdMatchIds,
    dryRun: false,
    strategy: autoScheduleStrategy,
    partialMode: autoSchedulePartialMode,
    executionMode: autoScheduleExecutionMode,
  });

  if (scheduled.error === "AUTO_SCHEDULE_INFEASIBLE") {
    return jsonWrap(
      {
        ok: false,
        error: "AUTO_SCHEDULE_INFEASIBLE",
        generated: createdMatchIds.length,
        scheduled: scheduled.scheduled,
        skipped: typeof scheduled.skipped === "number" ? scheduled.skipped : null,
        skippedByMatch: Array.isArray((scheduled as { skippedByMatch?: unknown }).skippedByMatch)
          ? (scheduled as { skippedByMatch: unknown[] }).skippedByMatch
          : [],
        unscheduledByReason: scheduled.unscheduledByReason,
        byCategory: scheduled.byCategory ?? [],
      },
      { status: 409 },
    );
  }

  await recordOrganizationAuditSafe({
    organizationId: event.organizationId,
    actorUserId: user.id,
    action: "PADEL_ROUND_ADVANCED",
    metadata: {
      eventId,
      categoryId,
      format: formatEffective,
      generated: createdMatchIds.length,
      scheduled: scheduled.scheduled,
      skippedByMatch: Array.isArray((scheduled as { skippedByMatch?: unknown }).skippedByMatch)
        ? (scheduled as { skippedByMatch: unknown[] }).skippedByMatch
        : [],
      unscheduledByReason: scheduled.unscheduledByReason,
      byCategory: scheduled.byCategory ?? [],
      autoSchedule: {
        strategy: autoScheduleStrategy,
        partialMode: autoSchedulePartialMode,
        executionMode: autoScheduleExecutionMode,
      },
    },
  });

  return jsonWrap(
    {
      ok: true,
      generated: createdMatchIds.length,
      scheduled: scheduled.scheduled,
      unscheduledByReason: scheduled.unscheduledByReason,
      byCategory: scheduled.byCategory ?? [],
      autoSchedule: {
        strategy: autoScheduleStrategy,
        partialMode: autoSchedulePartialMode,
        executionMode: scheduled.executionMode ?? autoScheduleExecutionMode,
      },
      roundState: {
        format: formatEffective,
        categoryId,
        mode: formatEffective === padel_format.NON_STOP ? (runtimePatch.nonStopRuntimeByCategory as Record<string, any>)?.[categoryKey]?.mode ?? null : null,
        updatedAt: new Date().toISOString(),
      },
    },
    { status: 200 },
  );
}

export const POST = withApiEnvelope(_POST);
