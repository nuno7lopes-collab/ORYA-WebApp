export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { OrganizationMemberRole, Prisma, SourceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromParams } from "@/lib/organizationId";
import { computeAutoSchedulePlan } from "@/domain/padel/autoSchedule";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { appendEventLog } from "@/domain/eventLog/append";
import { evaluateCandidate, type AgendaCandidate } from "@/domain/agenda/conflictEngine";
import { buildAgendaConflictPayload } from "@/domain/agenda/conflictResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

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

async function ensureOrganization(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "UNAUTHENTICATED" as const, status: 401 };

  const parsedOrgId = resolveOrganizationIdFromParams(req.nextUrl.searchParams);
  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: Number.isFinite(parsedOrgId) ? parsedOrgId : undefined,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization) return { error: "NO_ORGANIZATION" as const, status: 403 };
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
  const matchIds = Array.isArray(body.matchIds)
    ? body.matchIds.filter((id) => typeof id === "number" && Number.isFinite(id)).map((id) => Math.floor(id))
    : [];
  const targetMatchIds = matchIds.length > 0 ? matchIds : null;

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
        },
      },
    },
  });
  if (!event) {
    return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const advanced = (event.padelTournamentConfig?.advancedSettings || {}) as {
    courtIds?: number[];
    gameDurationMinutes?: number | null;
    scheduleDefaults?: {
      windowStart?: string | null;
      windowEnd?: string | null;
      durationMinutes?: number | null;
      slotMinutes?: number | null;
      bufferMinutes?: number | null;
      minRestMinutes?: number | null;
      priority?: "GROUPS_FIRST" | "KNOCKOUT_FIRST";
    };
  };

  const scheduleDefaults = advanced.scheduleDefaults ?? {};
  const rawWindowStart =
    parseDate(body.startAt) ??
    (typeof scheduleDefaults.windowStart === "string" ? parseDate(scheduleDefaults.windowStart) : null) ??
    event.startsAt;
  const windowEnd =
    parseDate(body.endAt) ??
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
    ? body.courtIds.filter((id) => typeof id === "number" && Number.isFinite(id))
    : [];
  const configuredCourtIds = Array.isArray(advanced.courtIds)
    ? advanced.courtIds.filter((id) => typeof id === "number" && Number.isFinite(id))
    : [];
  const selectedCourtIds = requestedCourtIds.length > 0 ? requestedCourtIds : configuredCourtIds;

  let courts = selectedCourtIds.length
    ? await prisma.padelClubCourt.findMany({
        where: { id: { in: selectedCourtIds }, club: { organizationId: organization.id }, isActive: true },
        select: { id: true, name: true, displayOrder: true },
        orderBy: [{ displayOrder: "asc" }],
      })
    : [];
  if (courts.length === 0) {
    const clubIds = [
      event.padelTournamentConfig?.padelClubId ?? null,
      ...(event.padelTournamentConfig?.partnerClubIds ?? []),
    ].filter((id): id is number => typeof id === "number" && Number.isFinite(id));
    if (clubIds.length > 0) {
      courts = await prisma.padelClubCourt.findMany({
        where: { padelClubId: { in: clubIds }, isActive: true },
        select: { id: true, name: true, displayOrder: true },
        orderBy: [{ displayOrder: "asc" }],
      });
    }
  }

  if (courts.length === 0) {
    return jsonWrap({ ok: false, error: "NO_COURTS_CONFIGURED" }, { status: 400 });
  }

  {
    const unscheduledMatchesRaw = await prisma.eventMatchSlot.findMany({
      where: {
        eventId: event.id,
        status: "PENDING",
        ...(targetMatchIds
          ? { id: { in: targetMatchIds } }
          : {
              plannedStartAt: null,
              startTime: null,
            }),
      },
      select: {
        id: true,
        plannedDurationMinutes: true,
        courtId: true,
        pairingAId: true,
        pairingBId: true,
        roundLabel: true,
        roundType: true,
        groupLabel: true,
        score: true,
      },
      orderBy: [{ roundLabel: "asc" }, { id: "asc" }],
    });

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
        { ok: true, scheduledCount: 0, skippedCount: 0, skipped: [] },
        { status: 200 },
      );
    }

    const roundTypeOrder = (roundType?: string | null) => {
      if (priority === "KNOCKOUT_FIRST") {
        if (roundType === "KNOCKOUT") return 0;
        if (roundType === "GROUPS") return 1;
        return 2;
      }
      if (roundType === "GROUPS") return 0;
      if (roundType === "KNOCKOUT") return 1;
      return 2;
    };
    const parseRoundLabel = (label?: string | null) => {
      if (!label) return { prefix: "", size: null, label: "" };
      const trimmed = label.trim();
      const prefix = trimmed.startsWith("A ") ? "A" : trimmed.startsWith("B ") ? "B" : "";
      const base = prefix ? trimmed.slice(2).trim() : trimmed;
      let size: number | null = null;
      if (base.startsWith("R")) {
        const parsed = Number(base.slice(1));
        size = Number.isFinite(parsed) ? parsed : null;
      } else if (base === "QUARTERFINAL") size = 8;
      else if (base === "SEMIFINAL") size = 4;
      else if (base === "FINAL") size = 2;
      return { prefix, size, label: base };
    };
    const prefixOrder = (prefix: string) => (prefix === "A" ? 0 : prefix === "B" ? 1 : 2);

    const unscheduledMatches = [...unscheduledMatchesRaw].sort((a, b) => {
      const typeDiff = roundTypeOrder(a.roundType) - roundTypeOrder(b.roundType);
      if (typeDiff !== 0) return typeDiff;
      if (a.roundType === "KNOCKOUT" || b.roundType === "KNOCKOUT") {
        const aMeta = parseRoundLabel(a.roundLabel);
        const bMeta = parseRoundLabel(b.roundLabel);
        if (prefixOrder(aMeta.prefix) !== prefixOrder(bMeta.prefix)) {
          return prefixOrder(aMeta.prefix) - prefixOrder(bMeta.prefix);
        }
        if (aMeta.size !== null && bMeta.size !== null && aMeta.size !== bMeta.size) {
          return bMeta.size - aMeta.size;
        }
      }
      if (a.groupLabel && b.groupLabel && a.groupLabel !== b.groupLabel) {
        return a.groupLabel.localeCompare(b.groupLabel);
      }
      if (a.roundLabel && b.roundLabel && a.roundLabel !== b.roundLabel) {
        return a.roundLabel.localeCompare(b.roundLabel);
      }
      return a.id - b.id;
    });

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
        pairingAId: true,
        pairingBId: true,
      },
    });

    const pairingIds = new Set<number>();
    unscheduledMatches.forEach((m) => {
      if (m.pairingAId) pairingIds.add(m.pairingAId);
      if (m.pairingBId) pairingIds.add(m.pairingBId);
    });
    scheduledMatches.forEach((m) => {
      if (m.pairingAId) pairingIds.add(m.pairingAId);
      if (m.pairingBId) pairingIds.add(m.pairingBId);
    });

    const pairings = pairingIds.size
      ? await prisma.padelPairing.findMany({
          where: { id: { in: Array.from(pairingIds) } },
          select: {
            id: true,
            slots: {
              select: {
                playerProfileId: true,
                playerProfile: { select: { email: true } },
              },
            },
          },
        })
      : [];

    const pairingPlayers = new Map<number, { profileIds: number[]; emails: string[] }>();
    pairings.forEach((pairing) => {
      const profileIds = new Set<number>();
      const emails = new Set<string>();
      pairing.slots.forEach((slot) => {
        if (slot.playerProfileId) profileIds.add(slot.playerProfileId);
        const email = slot.playerProfile?.email?.trim().toLowerCase();
        if (email) emails.add(email);
      });
      pairingPlayers.set(pairing.id, {
        profileIds: Array.from(profileIds),
        emails: Array.from(emails),
      });
    });

    const availabilities = await prisma.calendarAvailability.findMany({
      where: { eventId: event.id, organizationId: organization.id },
      select: { playerProfileId: true, playerEmail: true, startAt: true, endAt: true },
    });

    const courtBlocks = await prisma.calendarBlock.findMany({
      where: { eventId: event.id, organizationId: organization.id },
      select: { id: true, courtId: true, startAt: true, endAt: true },
    });

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

    const scheduleResult = computeAutoSchedulePlan({
      unscheduledMatches,
      scheduledMatches,
      courts,
      pairingPlayers,
      availabilities,
      courtBlocks,
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

    courtBlocks.forEach((block) => {
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
        type: "MATCH_SLOT",
        sourceId: String(match.id),
        startsAt: start,
        endsAt: end,
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

    for (const update of sortedUpdates) {
      const bucket = existingByCourt.get(update.courtId);
      if (!bucket) {
        return jsonWrap(agendaConflictResponse(), { status: 503 });
      }
      const candidate: AgendaCandidate = {
        type: "MATCH_SLOT",
        sourceId: String(update.matchId),
        startsAt: update.start,
        endsAt: update.end,
      };
      const decision = evaluateCandidate({ candidate, existing: bucket });
      if (!decision.allowed) {
        return jsonWrap(agendaConflictResponse(decision), { status: 409 });
      }
      bucket.push(candidate);
    }

    let outboxEventId: string | null = null;
    if (!dryRun && scheduledUpdates.length > 0) {
      const outbox = await prisma.$transaction(async (tx) => {
        const payload = {
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
          matchIds: targetMatchIds ?? null,
          requestedAt: new Date().toISOString(),
          requestMeta: getRequestMeta(req),
        } as Prisma.InputJsonValue;

        const dedupeSnapshot = {
          eventId: event.id,
          scheduledUpdates,
          skipped,
          matchIds: targetMatchIds ?? null,
          priority,
          minRestMinutes,
        } as Record<string, unknown>;
        const dedupeKey = `padel_auto_schedule:${event.id}:${hashPayload(dedupeSnapshot)}`;

        const outbox = await recordOutboxEvent(
          {
            eventType: "PADEL_AUTO_SCHEDULE_REQUESTED",
            dedupeKey,
            payload,
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
              eventId: event.id,
              scheduledCount: scheduledUpdates.length,
              skippedCount: skipped.length,
              matchIds: targetMatchIds ?? null,
            },
          },
          tx,
        );
        return outbox;
      });
      outboxEventId = outbox.eventId;
    }

    return jsonWrap(
      {
        ok: true,
        scheduledCount: scheduledUpdates.length,
        skippedCount: skipped.length,
        skipped,
        dryRun,
        priority,
        minRestMinutes,
        queued: !dryRun && scheduledUpdates.length > 0,
        eventId: outboxEventId,
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
