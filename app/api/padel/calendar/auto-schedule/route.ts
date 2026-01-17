export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { OrganizationMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromParams } from "@/lib/organizationId";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { computeAutoSchedulePlan } from "@/domain/padel/autoSchedule";

const allowedRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];
const DEFAULT_DURATION_MINUTES = 60;
const DEFAULT_SLOT_MINUTES = 15;
const DEFAULT_BUFFER_MINUTES = 5;
const DEFAULT_REST_MINUTES = 10;
const LOCK_TTL_SECONDS = 75;

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
    roles: allowedRoles,
  });
  if (!organization) return { error: "NO_ORGANIZATION" as const, status: 403 };
  return { organization, userId: user.id };
}

const getRequestMeta = (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = req.headers.get("user-agent") || null;
  return { ip, userAgent };
};

export async function POST(req: NextRequest) {
  const check = await ensureOrganization(req);
  if ("error" in check) {
    return NextResponse.json({ ok: false, error: check.error }, { status: check.status });
  }
  const { organization } = check;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const eventId = typeof body.eventId === "number" ? body.eventId : Number(body.eventId);
  if (!Number.isFinite(eventId)) {
    return NextResponse.json({ ok: false, error: "EVENT_ID_REQUIRED" }, { status: 400 });
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
    return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
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
    return NextResponse.json({ ok: false, error: "EVENT_WINDOW_REQUIRED" }, { status: 400 });
  }
  if (windowEnd <= windowStart) {
    return NextResponse.json({ ok: false, error: "INVALID_DATE_RANGE" }, { status: 400 });
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
    return NextResponse.json({ ok: false, error: "NO_COURTS_CONFIGURED" }, { status: 400 });
  }

  const lockKey = `padel_auto_schedule_${event.id}`;
  const lock = await acquireLock(lockKey);
  if (!lock) {
    return NextResponse.json({ ok: false, error: "LOCKED" }, { status: 423 });
  }

  try {
    const unscheduledMatchesRaw = await prisma.padelMatch.findMany({
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
        return NextResponse.json(
          { ok: false, error: "MATCH_NOT_AVAILABLE", missing },
          { status: 409 },
        );
      }
    }

    if (unscheduledMatchesRaw.length === 0) {
      return NextResponse.json(
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

    const scheduledMatches = await prisma.padelMatch.findMany({
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

    const availabilities = await prisma.padelAvailability.findMany({
      where: { eventId: event.id, organizationId: organization.id },
      select: { playerProfileId: true, playerEmail: true, startAt: true, endAt: true },
    });

    const courtBlocks = await prisma.padelCourtBlock.findMany({
      where: { eventId: event.id, organizationId: organization.id },
      select: { courtId: true, startAt: true, endAt: true },
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

    const nowIso = new Date().toISOString();
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

    if (!dryRun && scheduledUpdates.length > 0) {
      await prisma.$transaction(
        scheduledUpdates.map((update) =>
          prisma.padelMatch.update({
            where: { id: update.matchId },
            data: {
              plannedStartAt: update.start,
              plannedEndAt: update.end,
              plannedDurationMinutes: update.durationMinutes,
              courtId: update.courtId,
              ...(update.score ? { score: update.score } : {}),
            },
          }),
        ),
      );
      await recordOrganizationAuditSafe({
        organizationId: organization.id,
        actorUserId: check.userId,
        action: "PADEL_CALENDAR_AUTO_SCHEDULE",
        metadata: {
          eventId: event.id,
          scheduledCount: scheduledUpdates.length,
          skippedCount: skipped.length,
          matchIds: targetMatchIds ?? null,
        },
        ...getRequestMeta(req),
      });
    }

    return NextResponse.json(
      {
        ok: true,
        scheduledCount: scheduledUpdates.length,
        skippedCount: skipped.length,
        skipped,
        dryRun,
        priority,
        minRestMinutes,
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
  } finally {
    await releaseLock(lockKey);
  }
}

async function acquireLock(key: string, ttlSeconds = LOCK_TTL_SECONDS) {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  try {
    const lock = await prisma.lock.create({
      data: { key, expiresAt },
    });
    return lock;
  } catch {
    const existing = await prisma.lock.findUnique({ where: { key }, select: { expiresAt: true } });
    if (!existing) return null;
    if (existing.expiresAt && existing.expiresAt < new Date()) {
      await prisma.lock.delete({ where: { key } }).catch(() => null);
      try {
        return await prisma.lock.create({ data: { key, expiresAt } });
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function releaseLock(key: string) {
  await prisma.lock.delete({ where: { key } }).catch(() => null);
}
