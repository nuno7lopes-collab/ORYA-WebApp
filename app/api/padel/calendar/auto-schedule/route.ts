export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { OrganizationMemberRole, OrganizationModule, Prisma, SourceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromParams } from "@/lib/organizationId";
import { computeSchedulerV2Plan } from "@/domain/padel/schedulerV2/planner";
import type {
  PadelExecutionMode,
  PadelPartialMode,
  PadelScheduleStrategy,
} from "@/domain/padel/schedulerV2/types";
import { resolvePartnershipScheduleConstraints } from "@/domain/padel/partnershipSchedulePolicy";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { appendEventLog } from "@/domain/eventLog/append";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import {
  evaluateCandidate,
  type AgendaCandidate,
  type AgendaCandidateType,
  type ConflictDecision,
} from "@/domain/agenda/conflictEngine";
import { buildAgendaConflictPayload } from "@/domain/agenda/conflictResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { resolvePadelCourtSelection } from "@/domain/padel/courtSelection";
import { dailyWindowsToIntervals, normalizePadelDailyWindows } from "@/lib/padel/scheduleWindows";
import { resolveAllowPlaceholderMatches } from "@/domain/padel/schedulerV2/formatAdapters";
import { handlePadelOutboxEvent } from "@/domain/padel/outbox";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];
const DEFAULT_DURATION_MINUTES = 60;
const DEFAULT_SLOT_MINUTES = 15;
const DEFAULT_BUFFER_MINUTES = 5;
const DEFAULT_REST_MINUTES = 10;

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalize(obj[key]);
        return acc;
      }, {});
  }
  return value;
};

const hashPayload = (payload: Record<string, unknown>) =>
  crypto.createHash("sha256").update(JSON.stringify(canonicalize(payload))).digest("hex");

const parseDate = (value: unknown) => {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const parseNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
};

type MatchParticipantSideRow = {
  side: string;
  participant: {
    playerProfileId: number;
    playerProfile: {
      email: string | null;
    } | null;
  } | null;
};

const resolveSideProfileIds = (participants: MatchParticipantSideRow[], side: "A" | "B") =>
  participants
    .filter((row) => row.side === side)
    .map((row) => row.participant?.playerProfileId)
    .filter((id): id is number => typeof id === "number" && Number.isFinite(id));

const resolveSideEmails = (participants: MatchParticipantSideRow[], side: "A" | "B") =>
  participants
    .filter((row) => row.side === side)
    .map((row) => row.participant?.playerProfile?.email?.trim().toLowerCase() ?? null)
    .filter((email): email is string => typeof email === "string" && email.length > 0);

async function ensureOrganization(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });
  if (!user) return { error: "UNAUTHENTICATED" as const, status: 401 };

  const parsedOrgId = resolveOrganizationIdFromParams(req.nextUrl.searchParams);
  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: Number.isFinite(parsedOrgId) ? parsedOrgId : undefined,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization || !membership) return { error: "NO_ORGANIZATION" as const, status: 403 };
  const permission = await ensureMemberModuleAccess({
    organizationId: organization.id,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  if (!permission.ok) return { error: "FORBIDDEN" as const, status: 403 };
  return { organization, userId: user.id };
}

const getRequestMeta = (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = req.headers.get("user-agent") || null;
  return { ip, userAgent };
};

const isActiveBooking = (booking: { status: string; pendingExpiresAt: Date | null }) => {
  if (["CONFIRMED", "DISPUTED", "NO_SHOW"].includes(booking.status)) return true;
  if (["PENDING_CONFIRMATION", "PENDING"].includes(booking.status)) {
    return booking.pendingExpiresAt ? booking.pendingExpiresAt > new Date() : false;
  }
  return false;
};

const buildMatchWindow = (match: {
  plannedStartAt: Date | null;
  plannedEndAt: Date | null;
  plannedDurationMinutes: number | null;
  startTime: Date | null;
}) => {
  const start = match.plannedStartAt ?? match.startTime;
  const end =
    match.plannedEndAt ||
    (start && match.plannedDurationMinutes
      ? new Date(start.getTime() + Number(match.plannedDurationMinutes) * 60 * 1000)
      : match.startTime);
  return { start, end: end ?? start };
};

function agendaConflictResponse(decision?: Parameters<typeof buildAgendaConflictPayload>[0]["decision"]) {
  return {
    ok: false,
    ...buildAgendaConflictPayload({ decision: decision ?? null, fallbackReason: "MISSING_EXISTING_DATA" }),
  };
}

const AGENDA_TYPE_LABEL: Record<AgendaCandidateType, string> = {
  HARD_BLOCK: "bloqueio",
  MATCH: "jogo",
  BOOKING: "reserva",
  SOFT_BLOCK: "bloqueio suave",
};

function resolveAgendaTypeLabel(type: AgendaCandidateType | string, fallback: string) {
  if (type in AGENDA_TYPE_LABEL) {
    return AGENDA_TYPE_LABEL[type as AgendaCandidateType];
  }
  return fallback;
}

function buildAgendaWarning(decision: ConflictDecision, candidateType: AgendaCandidateType) {
  if (!decision.allowed || decision.conflicts.length === 0) return null;
  const primary = decision.conflicts[0];
  const candidateLabel = resolveAgendaTypeLabel(candidateType, "agendamento");
  const conflictLabel = resolveAgendaTypeLabel(primary.withType, "registo");
  return {
    message: `Aviso: ${candidateLabel} sobrepõe-se a ${conflictLabel}.`,
    details: {
      blockedByType: primary.withType,
      blockedBySourceId: primary.withSourceId,
      reason: decision.reason,
    },
  };
}

async function _POST(req: NextRequest) {
  const check = await ensureOrganization(req);
  if ("error" in check) {
    return jsonWrap({ ok: false, error: check.error }, { status: check.status });
  }
  const { organization } = check;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const eventId = typeof body.eventId === "number" ? body.eventId : Number(body.eventId);
  if (!Number.isFinite(eventId)) {
    return jsonWrap({ ok: false, error: "EVENT_ID_REQUIRED" }, { status: 400 });
  }
  const dryRun = body.dryRun === true;
  const startFromNow = body.startFromNow === true;
  const partialMode: PadelPartialMode = body.partialMode === "REQUIRE_FULL" ? "REQUIRE_FULL" : "ALLOW_PARTIAL";
  const executionMode: PadelExecutionMode = body.executionMode === "ASYNC" ? "ASYNC" : "SYNC";
  const strategy: PadelScheduleStrategy =
    body.strategy === "GROUPS_FIRST" || body.strategy === "KNOCKOUT_FIRST" || body.strategy === "BALANCED_BY_CATEGORY"
      ? body.strategy
      : "BALANCED_BY_CATEGORY";
  const matchIds = Array.isArray(body.matchIds)
    ? body.matchIds.filter((id) => typeof id === "number" && Number.isFinite(id)).map((id) => Math.floor(id))
    : [];
  const targetMatchIds = matchIds.length > 0 ? matchIds : null;
  const categoryIds = Array.isArray(body.categoryIds)
    ? body.categoryIds
        .map((id) => (typeof id === "number" ? id : Number(id)))
        .filter((id): id is number => Number.isFinite(id) && id > 0)
        .map((id) => Math.floor(id))
    : [];
  const targetCategoryIds = categoryIds.length > 0 ? Array.from(new Set(categoryIds)) : null;

  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: organization.id },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      padelTournamentConfig: {
        select: {
          padelClubId: true,
          partnerClubIds: true,
          advancedSettings: true,
          format: true,
        },
      },
    },
  });
  if (!event) {
    return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  if (targetCategoryIds && targetCategoryIds.length > 0) {
    const available = await prisma.padelEventCategoryLink.findMany({
      where: {
        eventId: event.id,
        isEnabled: true,
        padelCategoryId: { in: targetCategoryIds },
      },
      select: { padelCategoryId: true },
    });
    const found = new Set(available.map((row) => row.padelCategoryId));
    const missing = targetCategoryIds.filter((id) => !found.has(id));
    if (missing.length > 0) {
      return jsonWrap({ ok: false, error: "CATEGORY_NOT_AVAILABLE", missing }, { status: 409 });
    }
  }

  const advanced = (event.padelTournamentConfig?.advancedSettings || {}) as {
    courtIds?: number[];
    courtPriorityOrder?: number[];
    courtSelectionDefaults?: {
      useAllCourts?: boolean;
      courtIds?: number[];
    };
    capacityPolicy?: {
      hardBlockAutoSchedule?: boolean;
    };
    gameDurationMinutes?: number | null;
    scheduleDefaults?: {
      windowStart?: string | null;
      windowEnd?: string | null;
      dailyWindows?: Array<{ date?: string; startTime?: string; endTime?: string }> | null;
      durationMinutes?: number | null;
      slotMinutes?: number | null;
      bufferMinutes?: number | null;
      minRestMinutes?: number | null;
      priority?: "GROUPS_FIRST" | "KNOCKOUT_FIRST";
    };
  };

  const scheduleDefaults = advanced.scheduleDefaults ?? {};
  const bodyDailyWindows = normalizePadelDailyWindows(body.dailyWindows);
  const defaultsDailyWindows = normalizePadelDailyWindows(scheduleDefaults.dailyWindows);
  const resolvedDailyWindows = bodyDailyWindows.length > 0 ? bodyDailyWindows : defaultsDailyWindows;
  const resolvedTimeWindows = dailyWindowsToIntervals(resolvedDailyWindows);
  const dailyEnvelopeStart = resolvedTimeWindows[0]?.start ?? null;
  const dailyEnvelopeEnd =
    resolvedTimeWindows.length > 0 ? resolvedTimeWindows[resolvedTimeWindows.length - 1]?.end ?? null : null;
  const rawWindowStart =
    parseDate(body.startAt) ??
    dailyEnvelopeStart ??
    (typeof scheduleDefaults.windowStart === "string" ? parseDate(scheduleDefaults.windowStart) : null) ??
    event.startsAt;
  const windowEnd =
    parseDate(body.endAt) ??
    dailyEnvelopeEnd ??
    (typeof scheduleDefaults.windowEnd === "string" ? parseDate(scheduleDefaults.windowEnd) : null) ??
    event.endsAt;
  const windowStart = rawWindowStart
    ? startFromNow
      ? new Date(Math.max(rawWindowStart.getTime(), Date.now()))
      : rawWindowStart
    : null;
  if (!windowStart || !windowEnd) {
    return jsonWrap({ ok: false, error: "EVENT_WINDOW_REQUIRED" }, { status: 400 });
  }
  if (windowEnd <= windowStart) {
    return jsonWrap({ ok: false, error: "INVALID_DATE_RANGE" }, { status: 400 });
  }
  const timeWindows =
    resolvedTimeWindows.length > 0
      ? resolvedTimeWindows
          .map((window) => {
            if (!startFromNow) return window;
            const start = new Date(Math.max(window.start.getTime(), Date.now()));
            return { start, end: window.end };
          })
          .filter((window) => window.end > window.start)
      : undefined;

  const durationFromBody = parseNumber(body.durationMinutes);
  const durationFromSettings =
    typeof advanced.gameDurationMinutes === "number" && Number.isFinite(advanced.gameDurationMinutes)
      ? advanced.gameDurationMinutes
      : null;
  const durationFromDefaults =
    typeof scheduleDefaults.durationMinutes === "number" && Number.isFinite(scheduleDefaults.durationMinutes)
      ? scheduleDefaults.durationMinutes
      : null;
  const durationMinutes = Math.max(
    1,
    Math.round(
      durationFromBody && durationFromBody > 0
        ? durationFromBody
        : durationFromDefaults ?? durationFromSettings ?? DEFAULT_DURATION_MINUTES,
    ),
  );

  const slotFromDefaults =
    typeof scheduleDefaults.slotMinutes === "number" && Number.isFinite(scheduleDefaults.slotMinutes)
      ? scheduleDefaults.slotMinutes
      : null;
  const bufferFromDefaults =
    typeof scheduleDefaults.bufferMinutes === "number" && Number.isFinite(scheduleDefaults.bufferMinutes)
      ? scheduleDefaults.bufferMinutes
      : null;
  const restFromDefaults =
    typeof scheduleDefaults.minRestMinutes === "number" && Number.isFinite(scheduleDefaults.minRestMinutes)
      ? scheduleDefaults.minRestMinutes
      : null;
  const slotMinutes = Math.max(
    5,
    Math.round(parseNumber(body.slotMinutes) ?? slotFromDefaults ?? DEFAULT_SLOT_MINUTES),
  );
  const bufferMinutes = Math.max(
    0,
    Math.round(parseNumber(body.bufferMinutes) ?? bufferFromDefaults ?? DEFAULT_BUFFER_MINUTES),
  );
  const minRestMinutes = Math.max(
    0,
    Math.round(parseNumber(body.minRestMinutes) ?? restFromDefaults ?? DEFAULT_REST_MINUTES),
  );
  const priority =
    body.priority === "KNOCKOUT_FIRST" || body.priority === "GROUPS_FIRST"
      ? (body.priority as "GROUPS_FIRST" | "KNOCKOUT_FIRST")
      : scheduleDefaults.priority === "KNOCKOUT_FIRST"
        ? "KNOCKOUT_FIRST"
        : "GROUPS_FIRST";

  const requestedCourtIds = Array.isArray(body.courtIds)
    ? body.courtIds
        .map((id) => (typeof id === "number" ? id : Number(id)))
        .filter((id): id is number => Number.isFinite(id) && id > 0)
        .map((id) => Math.floor(id))
    : [];
  const requestedCourtPriorityOrder = Array.isArray(body.courtPriorityOrder)
    ? body.courtPriorityOrder
        .map((id) => (typeof id === "number" ? id : Number(id)))
        .filter((id): id is number => Number.isFinite(id) && id > 0)
        .map((id) => Math.floor(id))
    : [];
  const courtSelection = await resolvePadelCourtSelection({
    db: prisma,
    organizationId: organization.id,
    padelClubId: event.padelTournamentConfig?.padelClubId ?? null,
    partnerClubIds: event.padelTournamentConfig?.partnerClubIds ?? [],
    advancedSettings: advanced as unknown as Record<string, unknown>,
    requestedCourtIds,
    requestedCourtPriorityOrder,
  });
  const courts = courtSelection.courts;

  if (courts.length === 0) {
    return jsonWrap({ ok: false, error: "NO_COURTS_CONFIGURED" }, { status: 400 });
  }

  const priorityOrder = courtSelection.courtPriorityOrder;

  {
    const unscheduledMatchesRaw = await prisma.eventMatchSlot.findMany({
      where: {
        eventId: event.id,
        status: "PENDING",
        ...(targetCategoryIds ? { categoryId: { in: targetCategoryIds } } : {}),
        ...(targetMatchIds
          ? { id: { in: targetMatchIds } }
          : {
              plannedStartAt: null,
              startTime: null,
            }),
      },
      select: {
        id: true,
        categoryId: true,
        plannedDurationMinutes: true,
        courtId: true,
        roundLabel: true,
        roundType: true,
        groupLabel: true,
        score: true,
        participants: {
          select: {
            side: true,
            participant: {
              select: {
                playerProfileId: true,
                playerProfile: {
                  select: {
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ roundLabel: "asc" }, { id: "asc" }],
    });
    const unscheduledMatches = unscheduledMatchesRaw.map((match) => ({
      ...match,
      sideAProfileIds: resolveSideProfileIds(match.participants, "A"),
      sideBProfileIds: resolveSideProfileIds(match.participants, "B"),
      sideAEmails: resolveSideEmails(match.participants, "A"),
      sideBEmails: resolveSideEmails(match.participants, "B"),
    }));
    const hasNonStopRows = unscheduledMatchesRaw.some((match) => match.groupLabel === "NS");

    if (targetMatchIds) {
      const foundIds = new Set(unscheduledMatchesRaw.map((m) => m.id));
      const missing = targetMatchIds.filter((id) => !foundIds.has(id));
      if (missing.length > 0) {
        return jsonWrap(
          { ok: false, error: "MATCH_NOT_AVAILABLE", missing },
          { status: 409 },
        );
      }
    }

    if (unscheduledMatchesRaw.length === 0) {
      return jsonWrap(
        {
          ok: true,
          runId: null,
          scheduledCount: 0,
          skippedCount: 0,
          skipped: [],
          unscheduledByReason: {},
          byCategory: [],
          dryRun,
          strategy,
          partialMode,
          executionMode,
          queued: false,
          applied: false,
          warnings: [],
        },
        { status: 200 },
      );
    }

    const scheduledMatches = await prisma.eventMatchSlot.findMany({
      where: {
        eventId: event.id,
        OR: [{ plannedStartAt: { not: null } }, { startTime: { not: null } }],
        ...(targetMatchIds ? { id: { notIn: targetMatchIds } } : {}),
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
            participant: {
              select: {
                playerProfileId: true,
                playerProfile: {
                  select: {
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    const normalizedScheduledMatches = scheduledMatches.map((match) => ({
      ...match,
      sideAProfileIds: resolveSideProfileIds(match.participants, "A"),
      sideBProfileIds: resolveSideProfileIds(match.participants, "B"),
      sideAEmails: resolveSideEmails(match.participants, "A"),
      sideBEmails: resolveSideEmails(match.participants, "B"),
    }));

    const availabilities = await prisma.calendarAvailability.findMany({
      where: { eventId: event.id, organizationId: organization.id },
      select: { playerProfileId: true, playerEmail: true, startAt: true, endAt: true },
    });

    const courtBlocks = await prisma.calendarBlock.findMany({
      where: { eventId: event.id, organizationId: organization.id },
      select: { id: true, courtId: true, startAt: true, endAt: true },
    });

    const partnershipConstraints = await resolvePartnershipScheduleConstraints({
      organizationId: organization.id,
      windowStart,
      windowEnd,
      courts: courts.map((court) => ({
        id: court.id,
        padelClubId: court.padelClubId ?? null,
      })),
    });
    if (!partnershipConstraints.ok) {
      return jsonWrap(
        {
          ok: false,
          error: "PARTNERSHIP_CONSTRAINTS_BLOCKED",
          details: partnershipConstraints.errors,
        },
        { status: 409 },
      );
    }
    const partnershipBlocks = partnershipConstraints.additionalCourtBlocks.map((block, index) => ({
      id: `partnership:${block.courtId}:${index}`,
      courtId: block.courtId,
      startAt: block.startAt,
      endAt: block.endAt,
    }));
    const effectiveCourtBlocks = [...courtBlocks, ...partnershipBlocks];

    const now = new Date();
    const bookings = await prisma.booking.findMany({
      where: {
        courtId: { in: courts.map((court) => court.id) },
        startsAt: { lt: windowEnd },
        OR: [
          { status: { in: ["CONFIRMED", "DISPUTED", "NO_SHOW"] } },
          { status: { in: ["PENDING_CONFIRMATION", "PENDING"] }, pendingExpiresAt: { gt: now } },
        ],
      },
      select: { id: true, courtId: true, startsAt: true, durationMinutes: true, status: true, pendingExpiresAt: true },
    });

    const softBlocks = await prisma.softBlock.findMany({
      where: {
        organizationId: organization.id,
        startsAt: { lt: windowEnd },
        endsAt: { gt: windowStart },
        OR: [
          { scopeType: "ORGANIZATION" },
          { scopeType: "COURT", scopeId: { in: courts.map((court) => court.id) } },
        ],
      },
      select: { id: true, scopeType: true, scopeId: true, startsAt: true, endsAt: true },
    });

    const allowPlaceholderMatches = resolveAllowPlaceholderMatches({
      tournamentFormat: event.padelTournamentConfig?.format ?? null,
      unscheduledMatches,
    });

    const scheduleResult = computeSchedulerV2Plan({
      strategy,
      unscheduledMatches,
      scheduledMatches: normalizedScheduledMatches,
      courts,
      availabilities,
      courtBlocks: effectiveCourtBlocks,
      config: {
        windowStart,
        windowEnd,
        ...(timeWindows ? { timeWindows } : {}),
        ...(priorityOrder.length > 0 ? { courtPriorityOrder: priorityOrder } : {}),
        durationMinutes,
        slotMinutes,
        bufferMinutes,
        minRestMinutes,
        priority,
        allowPlaceholderMatches,
      },
    });
    const unscheduledByReason = scheduleResult.unscheduledByReason;
    if (partialMode === "REQUIRE_FULL" && !dryRun && scheduleResult.skipped.length > 0) {
      return jsonWrap(
        {
          ok: false,
          error: "AUTO_SCHEDULE_INFEASIBLE",
          scheduledCount: scheduleResult.scheduled.length,
          skippedCount: scheduleResult.skipped.length,
          skipped: scheduleResult.skipped,
          unscheduledByReason,
          suggestions: {
            addWindowHours: courts.length > 0 ? Math.ceil((scheduleResult.skipped.length * (durationMinutes + bufferMinutes)) / (courts.length * 60)) : null,
            addCourts:
              Math.max(
                1,
                Math.ceil(
                  scheduleResult.skipped.length /
                    Math.max(
                      1,
                      Math.floor(
                        Math.max(1, (windowEnd.getTime() - windowStart.getTime()) / 60000) /
                          Math.max(1, durationMinutes + bufferMinutes),
                      ),
                    ),
                ),
              ),
          },
        },
        { status: 409 },
      );
    }

    const nowIso = now.toISOString();
    const scoreByMatchId = new Map<number, Record<string, unknown>>();
    unscheduledMatches.forEach((match) => {
      const score = match.score && typeof match.score === "object" ? (match.score as Record<string, unknown>) : {};
      scoreByMatchId.set(match.id, score);
    });

    const scheduledUpdates: Array<{
      matchId: number;
      courtId: number;
      start: Date;
      end: Date;
      durationMinutes: number;
      score?: Record<string, unknown> | null;
    }> = scheduleResult.scheduled.map((update) => {
      const score = scoreByMatchId.get(update.matchId) ?? {};
      const delayStatusRaw = typeof score.delayStatus === "string" ? score.delayStatus : null;
      const shouldMarkRescheduled = delayStatusRaw === "DELAYED";
      return {
        ...update,
        ...(shouldMarkRescheduled
          ? {
              score: {
                ...score,
                delayStatus: "RESCHEDULED",
                rescheduledAt: nowIso,
                rescheduledBy: check.userId,
              },
            }
          : {}),
      };
    });
    const skipped = scheduleResult.skipped;

    const existingByCourt = new Map<number, AgendaCandidate[]>();
    courts.forEach((court) => {
      existingByCourt.set(court.id, []);
    });

    let missingExisting = false;
    const addExisting = (courtId: number, candidate: AgendaCandidate) => {
      const bucket = existingByCourt.get(courtId);
      if (!bucket) {
        missingExisting = true;
        return;
      }
      bucket.push(candidate);
    };

    effectiveCourtBlocks.forEach((block) => {
      if (!block.courtId) return;
      addExisting(block.courtId, {
        type: "HARD_BLOCK",
        sourceId: String(block.id),
        startsAt: block.startAt,
        endsAt: block.endAt,
      });
    });

    scheduledMatches.forEach((match) => {
      if (!match.courtId) return;
      const { start, end } = buildMatchWindow(match);
      if (!start || !end) {
        missingExisting = true;
        return;
      }
      addExisting(match.courtId, {
        type: "MATCH",
        sourceId: String(match.id),
        startsAt: start,
        endsAt: end,
        reasonCode: "MATCH_SLOT",
      });
    });

    bookings.forEach((booking) => {
      if (!booking.courtId || !isActiveBooking(booking)) return;
      const end = new Date(booking.startsAt.getTime() + booking.durationMinutes * 60 * 1000);
      addExisting(booking.courtId, {
        type: "BOOKING",
        sourceId: String(booking.id),
        startsAt: booking.startsAt,
        endsAt: end,
      });
    });

    softBlocks.forEach((block) => {
      if (block.scopeType === "ORGANIZATION") {
        courts.forEach((court) => {
          addExisting(court.id, {
            type: "SOFT_BLOCK",
            sourceId: String(block.id),
            startsAt: block.startsAt,
            endsAt: block.endsAt,
          });
        });
        return;
      }
      if (block.scopeType !== "COURT" || !block.scopeId) return;
      addExisting(block.scopeId, {
        type: "SOFT_BLOCK",
        sourceId: String(block.id),
        startsAt: block.startsAt,
        endsAt: block.endsAt,
      });
    });

    if (missingExisting) {
      return jsonWrap(agendaConflictResponse(), { status: 503 });
    }

    const sortedUpdates = [...scheduledUpdates].sort((a, b) => {
      if (a.courtId !== b.courtId) return a.courtId - b.courtId;
      const startDiff = a.start.getTime() - b.start.getTime();
      if (startDiff !== 0) return startDiff;
      return a.matchId - b.matchId;
    });

    const warnings: Array<{ matchId: number; message: string; details?: Record<string, unknown> }> = [];
    for (const update of sortedUpdates) {
      const bucket = existingByCourt.get(update.courtId);
      if (!bucket) {
        return jsonWrap(agendaConflictResponse(), { status: 503 });
      }
      const candidateType: AgendaCandidateType = "MATCH";
      const candidate: AgendaCandidate = {
        type: candidateType,
        sourceId: String(update.matchId),
        startsAt: update.start,
        endsAt: update.end,
        reasonCode: "MATCH_SLOT",
      };
      const decision = evaluateCandidate({ candidate, existing: bucket });
      if (!decision.allowed) {
        return jsonWrap(agendaConflictResponse(decision), { status: 409 });
      }
      const agendaWarning = buildAgendaWarning(decision, candidateType);
      if (agendaWarning) {
        warnings.push({
          matchId: update.matchId,
          message: agendaWarning.message,
          details: agendaWarning.details,
        });
      }
      bucket.push(candidate);
    }

    const runId = crypto.randomUUID();
    const requestMeta = {
      ...getRequestMeta(req),
      hasNonStopRows,
    };
    const queued = !dryRun && executionMode === "ASYNC" && scheduledUpdates.length > 0;
    const nowTs = new Date();
    const initialRunStatus =
      dryRun || scheduledUpdates.length === 0 ? "DONE" : queued ? "QUEUED" : "RUNNING";

    const categoryByMatchId = new Map(unscheduledMatches.map((match) => [match.id, match.categoryId ?? null]));

    await prisma.padelScheduleRun.create({
      data: {
        id: runId,
        eventId: event.id,
        organizationId: organization.id,
        status: initialRunStatus,
        strategy,
        partialMode,
        executionMode,
        dryRun,
        requestedByUserId: check.userId,
        requestedAt: nowTs,
        startedAt: initialRunStatus === "RUNNING" ? nowTs : null,
        finishedAt: initialRunStatus === "DONE" ? nowTs : null,
        scheduledCount: scheduledUpdates.length,
        skippedCount: skipped.length,
        unscheduledByReason: unscheduledByReason as Prisma.InputJsonValue,
        byCategory: scheduleResult.byCategory as Prisma.InputJsonValue,
        warnings: warnings as Prisma.InputJsonValue,
        categoryIds: (targetCategoryIds ?? []) as Prisma.InputJsonValue,
        matchIds: (targetMatchIds ?? []) as Prisma.InputJsonValue,
        requestMeta: requestMeta as Prisma.InputJsonValue,
        applied: dryRun || scheduledUpdates.length === 0 ? false : executionMode === "SYNC",
        queued,
      },
    });

    const decisions: Prisma.PadelScheduleRunDecisionCreateManyInput[] = [
      ...scheduledUpdates.map((update) => ({
        runId,
        eventId: event.id,
        organizationId: organization.id,
        matchId: update.matchId,
        categoryId: categoryByMatchId.get(update.matchId) ?? null,
        decisionType: "SCHEDULED",
        reason: null,
        courtId: update.courtId,
        startsAt: update.start,
        endsAt: update.end,
        details: {
          durationMinutes: update.durationMinutes,
        } as Prisma.InputJsonValue,
      })),
      ...skipped.map((item) => ({
        runId,
        eventId: event.id,
        organizationId: organization.id,
        matchId: item.matchId,
        categoryId: categoryByMatchId.get(item.matchId) ?? null,
        decisionType: "SKIPPED",
        reason: item.reason,
        courtId: null,
        startsAt: null,
        endsAt: null,
        details: Prisma.JsonNull,
      })),
      ...warnings.map((warning) => ({
        runId,
        eventId: event.id,
        organizationId: organization.id,
        matchId: warning.matchId,
        categoryId: categoryByMatchId.get(warning.matchId) ?? null,
        decisionType: "WARNING",
        reason: "AGENDA_WARNING",
        courtId: null,
        startsAt: null,
        endsAt: null,
        details: (warning.details ?? { message: warning.message }) as Prisma.InputJsonValue,
      })),
    ];
    if (decisions.length > 0) {
      await prisma.padelScheduleRunDecision.createMany({ data: decisions });
    }

    let outboxEventId: string | null = null;
    const schedulePayloadObject = {
      runId,
      eventId: event.id,
      organizationId: organization.id,
      actorUserId: check.userId,
      scheduledUpdates: scheduledUpdates.map((update) => ({
        matchId: update.matchId,
        courtId: update.courtId,
        start: update.start.toISOString(),
        end: update.end.toISOString(),
        durationMinutes: update.durationMinutes,
        score: (update.score ?? null) as Prisma.InputJsonValue,
      })),
      skipped,
      unscheduledByReason,
      byCategory: scheduleResult.byCategory,
      matchIds: targetMatchIds ?? null,
      categoryIds: targetCategoryIds ?? null,
      strategy,
      partialMode,
      executionMode,
      requestedAt: nowTs.toISOString(),
      requestMeta,
    };
    const schedulePayloadForOutbox = schedulePayloadObject as Prisma.InputJsonValue;
    const schedulePayloadForHandler = schedulePayloadObject as Prisma.JsonValue;

    if (!dryRun && scheduledUpdates.length > 0 && executionMode === "ASYNC") {
      const outbox = await prisma.$transaction(async (tx) => {
        const dedupeSnapshot = {
          eventId: event.id,
          runId,
          scheduledUpdates,
          skipped,
          unscheduledByReason,
          matchIds: targetMatchIds ?? null,
          categoryIds: targetCategoryIds ?? null,
          priority,
          minRestMinutes,
          strategy,
          partialMode,
        } as Record<string, unknown>;
        const dedupeKey = `padel_auto_schedule:${event.id}:${hashPayload(dedupeSnapshot)}`;

        const outbox = await recordOutboxEvent(
          {
            eventType: "PADEL_AUTO_SCHEDULE_REQUESTED",
            dedupeKey,
            payload: schedulePayloadForOutbox,
          },
          tx,
        );
        await appendEventLog(
          {
            eventId: outbox.eventId,
            organizationId: organization.id,
            eventType: "PADEL_AUTO_SCHEDULE_REQUESTED",
            idempotencyKey: outbox.eventId,
            actorUserId: check.userId,
            sourceType: SourceType.EVENT,
            sourceId: String(event.id),
            correlationId: outbox.eventId,
            payload: {
              runId,
              eventId: event.id,
              scheduledCount: scheduledUpdates.length,
              skippedCount: skipped.length,
              unscheduledByReason,
              byCategory: scheduleResult.byCategory,
              matchIds: targetMatchIds ?? null,
              categoryIds: targetCategoryIds ?? null,
              strategy,
              partialMode,
            },
          },
          tx,
        );
        return outbox;
      });
      outboxEventId = outbox.eventId;
      await prisma.padelScheduleRun.update({
        where: { id: runId },
        data: {
          outboxEventId,
          queued: true,
          applied: false,
          status: "QUEUED",
        },
      });
    } else if (!dryRun && scheduledUpdates.length > 0 && executionMode === "SYNC") {
      await handlePadelOutboxEvent({
        eventType: "PADEL_AUTO_SCHEDULE_REQUESTED",
        payload: schedulePayloadForHandler,
      });
    }

    await recordOrganizationAuditSafe({
      organizationId: organization.id,
      actorUserId: check.userId,
      action: "PADEL_AUTO_SCHEDULE",
      metadata: {
        runId,
        eventId: event.id,
        scheduledCount: scheduledUpdates.length,
        skippedCount: skipped.length,
        unscheduledByReason,
        byCategory: scheduleResult.byCategory,
        matchIds: targetMatchIds ?? null,
        categoryIds: targetCategoryIds ?? null,
        priority,
        minRestMinutes,
        strategy,
        partialMode,
        executionMode,
        courtIds: courts.map((court) => court.id),
        courtPriorityOrder: priorityOrder,
      },
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: req.headers.get("user-agent") || null,
    });

    return jsonWrap(
      {
        ok: true,
        runId,
        scheduledCount: scheduledUpdates.length,
        skippedCount: skipped.length,
        skipped,
        unscheduledByReason,
        byCategory: scheduleResult.byCategory,
        dryRun,
        priority,
        strategy,
        partialMode,
        executionMode,
        minRestMinutes,
        courtIds: courts.map((court) => court.id),
        courtPriorityOrder: priorityOrder,
        queued: !dryRun && executionMode === "ASYNC" && scheduledUpdates.length > 0,
        applied: !dryRun && executionMode === "SYNC",
        eventId: event.id,
        outboxEventId,
        warnings,
        scheduled: dryRun
          ? scheduledUpdates.map((update) => ({
              matchId: update.matchId,
              courtId: update.courtId,
              start: update.start.toISOString(),
              end: update.end.toISOString(),
            }))
          : undefined,
      },
      { status: 200 },
    );
  }
}
export const POST = withApiEnvelope(_POST);
