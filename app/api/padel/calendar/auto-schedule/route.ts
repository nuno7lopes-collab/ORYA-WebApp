export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest } from "next/server";
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
import { buildAgendaConflictPayload } from "@/domain/agenda/conflictResponse";
import {
  buildExistingByCourt,
  evaluateMatchBatchAgainstAgenda,
} from "@/domain/agenda/scheduleWriteGateway";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { resolvePadelCourtSelection } from "@/domain/padel/courtSelection";
import { dailyWindowsToIntervals, normalizePadelDailyWindows } from "@/lib/padel/scheduleWindows";
import {
  resolveAllowPlaceholderMatches,
  resolveMinParticipantsPerSide,
} from "@/domain/padel/schedulerV2/formatAdapters";
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

const parsePositiveInt = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isInteger(value) && value > 0 ? value : null;
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
};

const parsePositiveIntArray = (value: unknown) => {
  if (typeof value === "undefined" || value === null) return { values: [] as number[], invalid: false };
  if (!Array.isArray(value)) return { values: [] as number[], invalid: true };
  const values: number[] = [];
  for (const item of value) {
    const parsed = parsePositiveInt(item);
    if (parsed == null) return { values: [] as number[], invalid: true };
    values.push(parsed);
  }
  return { values, invalid: false };
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

type PairingSlotFallbackRow = {
  playerProfileId: number | null;
  playerProfile: {
    email: string | null;
  } | null;
};

type MatchSideFallbackRow = {
  participants: MatchParticipantSideRow[];
  pairingA?: { slots: PairingSlotFallbackRow[] } | null;
  pairingB?: { slots: PairingSlotFallbackRow[] } | null;
};

const uniqueNumbers = (values: Array<number | null | undefined>) =>
  Array.from(new Set(values.filter((value): value is number => typeof value === "number" && Number.isFinite(value))));

const uniqueStrings = (values: Array<string | null | undefined>) =>
  Array.from(
    new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)),
  );

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

const resolveSideProfileIdsWithFallback = (match: MatchSideFallbackRow, side: "A" | "B") => {
  const fromParticipants = resolveSideProfileIds(match.participants, side);
  if (fromParticipants.length > 0) return fromParticipants;
  const sideSlots = (side === "A" ? match.pairingA?.slots : match.pairingB?.slots) ?? [];
  return uniqueNumbers(sideSlots.map((slot) => slot.playerProfileId));
};

const resolveSideEmailsWithFallback = (match: MatchSideFallbackRow, side: "A" | "B") => {
  const fromParticipants = resolveSideEmails(match.participants, side);
  if (fromParticipants.length > 0) return fromParticipants;
  const sideSlots = (side === "A" ? match.pairingA?.slots : match.pairingB?.slots) ?? [];
  return uniqueStrings(sideSlots.map((slot) => slot.playerProfile?.email?.trim().toLowerCase() ?? null));
};

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

const isActiveBooking = (booking: { status: string; pendingExpiresAt: Date | null; startsAt: Date }) => {
  if (["CONFIRMED", "DISPUTED", "NO_SHOW"].includes(booking.status)) return true;
  if (["PENDING_CONFIRMATION", "PENDING"].includes(booking.status)) {
    const now = new Date();
    if (booking.startsAt <= now) return false;
    return booking.pendingExpiresAt ? booking.pendingExpiresAt > now : false;
  }
  return false;
};

function agendaConflictResponse(decision?: Parameters<typeof buildAgendaConflictPayload>[0]["decision"]) {
  return {
    ok: false,
    ...buildAgendaConflictPayload({ decision: decision ?? null, fallbackReason: "MISSING_EXISTING_DATA" }),
  };
}

function emitPadelMetric(metric: string, payload: Record<string, unknown>) {
  console.log(JSON.stringify({ kind: "padel_metric", metric, ...payload }));
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
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return jsonWrap({ ok: false, error: "EVENT_ID_REQUIRED" }, { status: 400 });
  }
  const dryRun = body.dryRun === true;
  const startFromNow = body.startFromNow === true;
  const hasPartialMode = Object.prototype.hasOwnProperty.call(body, "partialMode");
  const partialModeRaw = typeof body.partialMode === "string" ? body.partialMode.trim().toUpperCase() : "";
  if (hasPartialMode && partialModeRaw !== "REQUIRE_FULL" && partialModeRaw !== "ALLOW_PARTIAL") {
    return jsonWrap({ ok: false, error: "INVALID_PARTIAL_MODE" }, { status: 400 });
  }
  const partialMode: PadelPartialMode = partialModeRaw === "REQUIRE_FULL" ? "REQUIRE_FULL" : "ALLOW_PARTIAL";

  const hasExecutionMode = Object.prototype.hasOwnProperty.call(body, "executionMode");
  const executionModeRaw = typeof body.executionMode === "string" ? body.executionMode.trim().toUpperCase() : "";
  if (hasExecutionMode && executionModeRaw !== "ASYNC" && executionModeRaw !== "SYNC") {
    return jsonWrap({ ok: false, error: "INVALID_EXECUTION_MODE" }, { status: 400 });
  }
  const executionMode: PadelExecutionMode = executionModeRaw === "ASYNC" ? "ASYNC" : "SYNC";

  const hasStrategy = Object.prototype.hasOwnProperty.call(body, "strategy");
  const strategyRaw = typeof body.strategy === "string" ? body.strategy.trim().toUpperCase() : "";
  if (
    hasStrategy &&
    strategyRaw !== "GROUPS_FIRST" &&
    strategyRaw !== "KNOCKOUT_FIRST" &&
    strategyRaw !== "BALANCED_BY_CATEGORY"
  ) {
    return jsonWrap({ ok: false, error: "INVALID_STRATEGY" }, { status: 400 });
  }
  const strategy: PadelScheduleStrategy =
    strategyRaw === "GROUPS_FIRST" || strategyRaw === "KNOCKOUT_FIRST" || strategyRaw === "BALANCED_BY_CATEGORY"
      ? strategyRaw
      : "BALANCED_BY_CATEGORY";
  const matchIdsParsed = parsePositiveIntArray(body.matchIds);
  if (matchIdsParsed.invalid) {
    return jsonWrap({ ok: false, error: "INVALID_MATCH_IDS" }, { status: 400 });
  }
  const targetMatchIds = matchIdsParsed.values.length > 0 ? matchIdsParsed.values : null;
  const categoryIdsParsed = parsePositiveIntArray(body.categoryIds);
  if (categoryIdsParsed.invalid) {
    return jsonWrap({ ok: false, error: "INVALID_CATEGORY_IDS" }, { status: 400 });
  }
  const targetCategoryIds = categoryIdsParsed.values.length > 0 ? Array.from(new Set(categoryIdsParsed.values)) : null;

  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: organization.id, isDeleted: false },
    select: {
      id: true,
      templateType: true,
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
  if (!event || event.templateType !== "PADEL") {
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
  const hasPriority = Object.prototype.hasOwnProperty.call(body, "priority");
  const priorityRaw = typeof body.priority === "string" ? body.priority.trim().toUpperCase() : "";
  if (hasPriority && priorityRaw !== "KNOCKOUT_FIRST" && priorityRaw !== "GROUPS_FIRST") {
    return jsonWrap({ ok: false, error: "INVALID_PRIORITY" }, { status: 400 });
  }
  const priority =
    priorityRaw === "KNOCKOUT_FIRST" || priorityRaw === "GROUPS_FIRST"
      ? priorityRaw
      : scheduleDefaults.priority === "KNOCKOUT_FIRST"
        ? "KNOCKOUT_FIRST"
        : "GROUPS_FIRST";

  const requestedCourtIdsParsed = parsePositiveIntArray(body.courtIds);
  if (requestedCourtIdsParsed.invalid) {
    return jsonWrap({ ok: false, error: "INVALID_COURT_IDS" }, { status: 400 });
  }
  const requestedCourtPriorityOrderParsed = parsePositiveIntArray(body.courtPriorityOrder);
  if (requestedCourtPriorityOrderParsed.invalid) {
    return jsonWrap({ ok: false, error: "INVALID_COURT_PRIORITY" }, { status: 400 });
  }
  const requestedCourtIds = requestedCourtIdsParsed.values;
  const requestedCourtPriorityOrder = requestedCourtPriorityOrderParsed.values;
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
        updatedAt: true,
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
        pairingA: {
          select: {
            slots: {
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
        pairingB: {
          select: {
            slots: {
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
      sideAProfileIds: resolveSideProfileIdsWithFallback(match, "A"),
      sideBProfileIds: resolveSideProfileIdsWithFallback(match, "B"),
      sideAEmails: resolveSideEmailsWithFallback(match, "A"),
      sideBEmails: resolveSideEmailsWithFallback(match, "B"),
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
          skippedByMatch: [],
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
        pairingA: {
          select: {
            slots: {
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
        pairingB: {
          select: {
            slots: {
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
      sideAProfileIds: resolveSideProfileIdsWithFallback(match, "A"),
      sideBProfileIds: resolveSideProfileIdsWithFallback(match, "B"),
      sideAEmails: resolveSideEmailsWithFallback(match, "A"),
      sideBEmails: resolveSideEmailsWithFallback(match, "B"),
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
        organizationId: organization.id,
        courtId: { in: courts.map((court) => court.id) },
        startsAt: { lt: windowEnd },
        OR: [
          { status: { in: ["CONFIRMED", "DISPUTED", "NO_SHOW"] } },
          { status: { in: ["PENDING_CONFIRMATION", "PENDING"] }, pendingExpiresAt: { gt: now }, startsAt: { gt: now } },
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

    const classSessions = await prisma.classSession.findMany({
      where: {
        organizationId: organization.id,
        courtId: { in: courts.map((court) => court.id) },
        startsAt: { lt: windowEnd },
        endsAt: { gt: windowStart },
        status: { not: "CANCELLED" },
      },
      select: { id: true, courtId: true, startsAt: true, endsAt: true },
    });

    const allowPlaceholderMatches = resolveAllowPlaceholderMatches({
      tournamentFormat: event.padelTournamentConfig?.format ?? null,
      unscheduledMatches,
    });
    const minParticipantsPerSide = resolveMinParticipantsPerSide({
      tournamentFormat: event.padelTournamentConfig?.format ?? null,
      allowPlaceholderMatches,
    });

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

    const scheduleResult = computeSchedulerV2Plan({
      strategy,
      unscheduledMatches,
      scheduledMatches: normalizedScheduledMatches,
      courts,
      availabilities,
      courtBlocks: [...effectiveCourtBlocks, ...bookingPlannerBlocks, ...classSessionPlannerBlocks],
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
        minParticipantsPerSide,
      },
    });
    const unscheduledByReason: Record<string, number> = { ...scheduleResult.unscheduledByReason };

    const nowIso = now.toISOString();
    const scoreByMatchId = new Map<number, Record<string, unknown>>();
    unscheduledMatches.forEach((match) => {
      const score = match.score && typeof match.score === "object" ? (match.score as Record<string, unknown>) : {};
      scoreByMatchId.set(match.id, score);
    });
    const expectedUpdatedAtByMatchId = new Map<number, Date | null>();
    unscheduledMatches.forEach((match) => {
      expectedUpdatedAtByMatchId.set(match.id, match.updatedAt ?? null);
    });

    const scheduledUpdates: Array<{
      matchId: number;
      courtId: number;
      start: Date;
      end: Date;
      durationMinutes: number;
      expectedUpdatedAt: Date | null;
      score?: Record<string, unknown> | null;
    }> = scheduleResult.scheduled.map((update) => {
      const score = scoreByMatchId.get(update.matchId) ?? {};
      const delayStatusRaw = typeof score.delayStatus === "string" ? score.delayStatus : null;
      const shouldMarkRescheduled = delayStatusRaw === "DELAYED";
      return {
        ...update,
        expectedUpdatedAt: expectedUpdatedAtByMatchId.get(update.matchId) ?? null,
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
    const { existingByCourt, missingExisting } = buildExistingByCourt({
      courtIds: courts.map((court) => court.id),
      hardBlocks: effectiveCourtBlocks,
      scheduledMatches,
      bookings,
      softBlocks,
      classSessions,
    });
    if (missingExisting) {
      return jsonWrap(agendaConflictResponse(), { status: 503 });
    }

    const arbitration = evaluateMatchBatchAgainstAgenda({
      updates: scheduledUpdates.map((update) => ({
        matchId: update.matchId,
        courtId: update.courtId,
        start: update.start,
        end: update.end,
      })),
      existingByCourt,
      partialMode,
    });
    if (arbitration.missingExisting) {
      return jsonWrap(agendaConflictResponse(), { status: 503 });
    }

    arbitration.rejectedUpdates.forEach((item) => {
      unscheduledByReason[item.reason] = (unscheduledByReason[item.reason] ?? 0) + 1;
    });

    const skippedByMatch = [
      ...scheduleResult.skipped.map((item) => ({
        matchId: item.matchId,
        reason: item.reason,
      })),
      ...arbitration.rejectedUpdates.map((item) => ({
        matchId: item.matchId,
        reason: item.reason,
        blockedByType: item.blockedByType ?? null,
        blockedBySourceId: item.blockedBySourceId ?? null,
      })),
    ];
    const skipped = skippedByMatch.map((item) => ({
      matchId: item.matchId,
      reason: item.reason,
    }));
    const warnings = arbitration.warnings;
    const acceptedMatchIds = new Set(arbitration.acceptedUpdates.map((update) => update.matchId));
    const scheduledUpdatesFiltered = scheduledUpdates.filter((update) => acceptedMatchIds.has(update.matchId));

    if (partialMode === "REQUIRE_FULL" && !dryRun && skippedByMatch.length > 0) {
      const classSessionConflicts = Number(unscheduledByReason.CLASS_SESSION_CONFLICT ?? 0);
      const bookingConflicts = Number(unscheduledByReason.BOOKING_CONFLICT ?? 0);
      emitPadelMetric("autoScheduleBlockedByClassSessionCount", {
        eventId: event.id,
        organizationId: organization.id,
        value: classSessionConflicts,
        partialMode,
        executionMode,
        strategy,
      });
      emitPadelMetric("autoScheduleSkippedByBookingCount", {
        eventId: event.id,
        organizationId: organization.id,
        value: bookingConflicts,
        partialMode,
        executionMode,
        strategy,
      });
      return jsonWrap(
        {
          ok: false,
          error: "AUTO_SCHEDULE_INFEASIBLE",
          scheduledCount: scheduledUpdatesFiltered.length,
          skippedCount: skippedByMatch.length,
          skipped,
          skippedByMatch,
          unscheduledByReason,
          conflict:
            arbitration.blockedDecision || arbitration.rejectedUpdates[0]
              ? {
                  blockedMatchId:
                    arbitration.blockedDecision?.matchId ??
                    arbitration.rejectedUpdates[0]?.matchId ??
                    null,
                  ...(arbitration.blockedDecision
                    ? buildAgendaConflictPayload({ decision: arbitration.blockedDecision.decision })
                    : {}),
                }
              : null,
          suggestions: {
            addWindowHours:
              courts.length > 0
                ? Math.ceil((skippedByMatch.length * (durationMinutes + bufferMinutes)) / (courts.length * 60))
                : null,
            addCourts:
              Math.max(
                1,
                Math.ceil(
                  skippedByMatch.length /
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

    const runId = crypto.randomUUID();
    const requestMeta = {
      ...getRequestMeta(req),
      hasNonStopRows,
    };
    const queued = !dryRun && executionMode === "ASYNC" && scheduledUpdatesFiltered.length > 0;
    const nowTs = new Date();
    const initialRunStatus =
      dryRun || scheduledUpdatesFiltered.length === 0 ? "DONE" : queued ? "QUEUED" : "RUNNING";

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
        scheduledCount: scheduledUpdatesFiltered.length,
        skippedCount: skipped.length,
        unscheduledByReason: unscheduledByReason as Prisma.InputJsonValue,
        byCategory: scheduleResult.byCategory as Prisma.InputJsonValue,
        warnings: warnings as Prisma.InputJsonValue,
        categoryIds: (targetCategoryIds ?? []) as Prisma.InputJsonValue,
        matchIds: (targetMatchIds ?? []) as Prisma.InputJsonValue,
        requestMeta: requestMeta as Prisma.InputJsonValue,
        applied: dryRun || scheduledUpdatesFiltered.length === 0 ? false : executionMode === "SYNC",
        queued,
      },
    });

    const decisions: Prisma.PadelScheduleRunDecisionCreateManyInput[] = [
      ...scheduledUpdatesFiltered.map((update) => ({
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
          expectedUpdatedAt: update.expectedUpdatedAt?.toISOString?.() ?? null,
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
      scheduledUpdates: scheduledUpdatesFiltered.map((update) => ({
        matchId: update.matchId,
        courtId: update.courtId,
        start: update.start.toISOString(),
        end: update.end.toISOString(),
        durationMinutes: update.durationMinutes,
        expectedUpdatedAt: update.expectedUpdatedAt?.toISOString?.() ?? null,
        score: (update.score ?? null) as Prisma.InputJsonValue,
      })),
      skipped,
      skippedByMatch,
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

    if (!dryRun && scheduledUpdatesFiltered.length > 0 && executionMode === "ASYNC") {
      const outbox = await prisma.$transaction(async (tx) => {
        const dedupeSnapshot = {
          eventId: event.id,
          runId,
          scheduledUpdates: scheduledUpdatesFiltered,
          skipped,
          skippedByMatch,
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
              scheduledCount: scheduledUpdatesFiltered.length,
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
    } else if (!dryRun && scheduledUpdatesFiltered.length > 0 && executionMode === "SYNC") {
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
        scheduledCount: scheduledUpdatesFiltered.length,
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

    const classSessionConflicts = Number(unscheduledByReason.CLASS_SESSION_CONFLICT ?? 0);
    const bookingConflicts = Number(unscheduledByReason.BOOKING_CONFLICT ?? 0);
    emitPadelMetric("autoScheduleBlockedByClassSessionCount", {
      eventId: event.id,
      organizationId: organization.id,
      runId,
      value: classSessionConflicts,
      partialMode,
      executionMode,
      strategy,
      dryRun,
    });
    emitPadelMetric("autoScheduleSkippedByBookingCount", {
      eventId: event.id,
      organizationId: organization.id,
      runId,
      value: bookingConflicts,
      partialMode,
      executionMode,
      strategy,
      dryRun,
    });

    return jsonWrap(
      {
        ok: true,
        runId,
        scheduledCount: scheduledUpdatesFiltered.length,
        skippedCount: skipped.length,
        skipped,
        skippedByMatch,
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
        queued: !dryRun && executionMode === "ASYNC" && scheduledUpdatesFiltered.length > 0,
        applied: !dryRun && executionMode === "SYNC",
        eventId: event.id,
        outboxEventId,
        warnings,
        scheduled: dryRun
          ? scheduledUpdatesFiltered.map((update) => ({
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
