import crypto from "crypto";
import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { prisma } from "@/lib/prisma";
import { createSoftBlock } from "@/domain/softBlocks/commands";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { OrganizationModule, SoftBlockScope, SourceType } from "@prisma/client";

const DEFAULT_CONFLICT_POLICY = "CASCADE_SAME_COURT" as const;
const SUPPORTED_CONFLICT_POLICIES = [DEFAULT_CONFLICT_POLICY, "REJECT_ON_CONFLICT"] as const;
type TournamentBlockConflictPolicy = (typeof SUPPORTED_CONFLICT_POLICIES)[number];
const REASON_CODE_PATTERN = /^[A-Z0-9_]{3,64}$/;

function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 410) return "GONE";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}

function fail(
  ctx: ReturnType<typeof getRequestContext>,
  status: number,
  message: string,
  errorCode = errorCodeForStatus(status),
  retryable = status >= 500,
  details?: Record<string, unknown>,
) {
  const resolvedMessage = typeof message === "string" ? message : String(message);
  const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
  return respondError(
    ctx,
    { errorCode: resolvedCode, message: resolvedMessage, retryable, ...(details ? { details } : {}) },
    { status },
  );
}

function parseDate(value: unknown) {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parsePositiveInt(value: unknown) {
  const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function parseCourtIds(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return null;
  const ids = Array.from(
    new Set(value.map((entry) => parsePositiveInt(entry)).filter((entry): entry is number => !!entry)),
  );
  if (ids.length !== value.length) return null;
  return ids;
}

function parseConflictPolicy(value: unknown): TournamentBlockConflictPolicy {
  if (typeof value !== "string") return DEFAULT_CONFLICT_POLICY;
  const normalized = value.trim().toUpperCase();
  if (SUPPORTED_CONFLICT_POLICIES.includes(normalized as TournamentBlockConflictPolicy)) {
    return normalized as TournamentBlockConflictPolicy;
  }
  return DEFAULT_CONFLICT_POLICY;
}

function validateReasonCode(reasonCode: unknown) {
  if (typeof reasonCode !== "string") return null;
  const normalized = reasonCode.trim().toUpperCase();
  if (!REASON_CODE_PATTERN.test(normalized)) return null;
  return normalized;
}

function overlaps(startsAt: Date, endsAt: Date, otherStart: Date, otherEnd: Date) {
  return startsAt < otherEnd && endsAt > otherStart;
}

function buildMatchWindow(match: {
  startTime: Date | null;
  plannedStartAt: Date | null;
  plannedEndAt: Date | null;
  plannedDurationMinutes: number | null;
}) {
  const start = match.plannedStartAt ?? match.startTime;
  const end =
    match.plannedEndAt ??
    (start && match.plannedDurationMinutes
      ? new Date(start.getTime() + match.plannedDurationMinutes * 60 * 1000)
      : start);
  if (!start || !end) return null;
  return { start, end };
}

function isReservationStateActive(status: string, pendingExpiresAt: Date | null, now: Date) {
  if (["CONFIRMED", "DISPUTED", "NO_SHOW"].includes(status)) return true;
  if (["PENDING_CONFIRMATION", "PENDING"].includes(status)) {
    return pendingExpiresAt ? pendingExpiresAt > now : false;
  }
  return false;
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const profile = await prisma.profile.findUnique({ where: { id: user.id }, select: { id: true } });
    if (!profile) return fail(ctx, 403, "FORBIDDEN");

    const payload = (await req.json().catch(() => null)) as
      | {
          eventId?: unknown;
          courtIds?: unknown;
          startAt?: unknown;
          endAt?: unknown;
          conflictPolicy?: unknown;
          reasonCode?: unknown;
          reason?: unknown;
          force?: unknown;
        }
      | null;
    if (!payload) return fail(ctx, 400, "INVALID_PAYLOAD");

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
    });
    if (!organization || !membership) {
      return fail(ctx, 403, "FORBIDDEN");
    }

    const moduleAccess = await ensureMemberModuleAccess({
      organizationId: organization.id,
      userId: user.id,
      role: membership.role,
      rolePack: membership.rolePack,
      moduleKey: OrganizationModule.TORNEIOS,
      required: "EDIT",
    });
    if (!moduleAccess.ok) {
      return fail(ctx, 403, "FORBIDDEN");
    }

    const reservasAccess = await ensureReservasModuleAccess(organization);
    if (!reservasAccess.ok) {
      return fail(ctx, 403, reservasAccess.error ?? "RESERVAS_UNAVAILABLE", "RESERVAS_UNAVAILABLE");
    }

    const emailGate = ensureOrganizationEmailVerified(organization, { reasonCode: "TOURNAMENT_BLOCKS" });
    if (!emailGate.ok) {
      return fail(ctx, 403, emailGate.errorCode ?? "FORBIDDEN", emailGate.errorCode ?? "FORBIDDEN", false, {
        reason: emailGate.message,
      });
    }

    const eventId = parsePositiveInt(payload.eventId);
    const courtIds = parseCourtIds(payload.courtIds);
    const startsAt = parseDate(payload.startAt);
    const endsAt = parseDate(payload.endAt);
    const force = payload.force === true;
    const conflictPolicy = parseConflictPolicy(payload.conflictPolicy);
    const reasonCode = validateReasonCode(payload.reasonCode);
    const reasonText = typeof payload.reason === "string" ? payload.reason.trim() : "";

    if (!eventId || !courtIds || !startsAt || !endsAt || endsAt <= startsAt) {
      return fail(ctx, 400, "INVALID_PAYLOAD");
    }

    if ((conflictPolicy !== DEFAULT_CONFLICT_POLICY || force) && !reasonCode) {
      return fail(ctx, 400, "INVALID_REASON_CODE", "INVALID_REASON_CODE", false, {
        pattern: REASON_CODE_PATTERN.source,
      });
    }

    const event = await prisma.event.findFirst({
      where: { id: eventId, organizationId: organization.id, isDeleted: false, templateType: "PADEL" },
      select: { id: true, organizationId: true, startsAt: true, endsAt: true },
    });
    if (!event) {
      return fail(ctx, 404, "EVENT_NOT_FOUND");
    }

    const courts = await prisma.padelClubCourt.findMany({
      where: { id: { in: courtIds }, deletedAt: null, club: { organizationId: organization.id, deletedAt: null } },
      select: { id: true, name: true, padelClubId: true },
    });
    if (courts.length !== courtIds.length) {
      return fail(ctx, 400, "INVALID_COURTS");
    }

    const now = new Date();
    const [softBlocks, hardBlocks, bookings, classSessions, matches] = await Promise.all([
      prisma.softBlock.findMany({
        where: {
          organizationId: organization.id,
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
          OR: [
            { scopeType: SoftBlockScope.ORGANIZATION, scopeId: 0 },
            { scopeType: SoftBlockScope.COURT, scopeId: { in: courtIds } },
          ],
        },
        select: { id: true, scopeType: true, scopeId: true, startsAt: true, endsAt: true, reason: true },
      }),
      prisma.calendarBlock.findMany({
        where: {
          organizationId: organization.id,
          courtId: { in: courtIds },
          startAt: { lt: endsAt },
          endAt: { gt: startsAt },
        },
        select: { id: true, courtId: true, startAt: true, endAt: true, kind: true, label: true },
      }),
      prisma.booking.findMany({
        where: {
          organizationId: organization.id,
          courtId: { in: courtIds },
          startsAt: { lt: endsAt },
          OR: [
            { status: { in: ["CONFIRMED", "DISPUTED", "NO_SHOW"] } },
            { status: { in: ["PENDING_CONFIRMATION", "PENDING"] } },
          ],
        },
        select: { id: true, courtId: true, startsAt: true, durationMinutes: true, status: true, pendingExpiresAt: true },
      }),
      prisma.classSession.findMany({
        where: {
          organizationId: organization.id,
          courtId: { in: courtIds },
          status: "SCHEDULED",
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
        select: { id: true, courtId: true, startsAt: true, endsAt: true },
      }),
      prisma.eventMatchSlot.findMany({
        where: {
          event: { organizationId: organization.id },
          courtId: { in: courtIds },
          status: { not: "CANCELLED" },
          OR: [{ plannedStartAt: { not: null } }, { startTime: { not: null } }],
        },
        select: {
          id: true,
          eventId: true,
          courtId: true,
          status: true,
          plannedStartAt: true,
          plannedEndAt: true,
          plannedDurationMinutes: true,
          startTime: true,
        },
      }),
    ]);

    const softBlocksByCourt = new Map<number, typeof softBlocks>();
    const hardBlocksByCourt = new Map<number, typeof hardBlocks>();
    const bookingsByCourt = new Map<number, typeof bookings>();
    const classSessionsByCourt = new Map<number, typeof classSessions>();
    const matchesByCourt = new Map<number, typeof matches>();

    courtIds.forEach((courtId) => {
      softBlocksByCourt.set(courtId, []);
      hardBlocksByCourt.set(courtId, []);
      bookingsByCourt.set(courtId, []);
      classSessionsByCourt.set(courtId, []);
      matchesByCourt.set(courtId, []);
    });

    softBlocks.forEach((block) => {
      if (block.scopeType === SoftBlockScope.ORGANIZATION) {
        courtIds.forEach((courtId) => {
          softBlocksByCourt.get(courtId)?.push(block);
        });
        return;
      }
      if (block.scopeType === SoftBlockScope.COURT && courtIds.includes(block.scopeId)) {
        softBlocksByCourt.get(block.scopeId)?.push(block);
      }
    });

    hardBlocks.forEach((block) => {
      if (!block.courtId) return;
      hardBlocksByCourt.get(block.courtId)?.push(block);
    });

    bookings.forEach((booking) => {
      if (!booking.courtId) return;
      if (!isReservationStateActive(booking["status"], booking.pendingExpiresAt, now)) return;
      bookingsByCourt.get(booking.courtId)?.push(booking);
    });

    classSessions.forEach((session) => {
      if (!session.courtId) return;
      classSessionsByCourt.get(session.courtId)?.push(session);
    });

    matches.forEach((match) => {
      if (!match.courtId) return;
      const window = buildMatchWindow(match);
      if (!window) return;
      if (!overlaps(startsAt, endsAt, window.start, window.end)) return;
      matchesByCourt.get(match.courtId)?.push(match);
    });

    const operationId = crypto.randomUUID();
    const createdBlocks: Array<{ courtId: number; softBlockId: number; reused: boolean }> = [];
    const conflicts: Array<{
      courtId: number;
      hardBlockCount: number;
      softBlockCount: number;
      bookingCount: number;
      classSessionCount: number;
      matchCount: number;
      rejected: boolean;
    }> = [];
    const cascades: Array<{
      courtId: number;
      bookings: number[];
      classSessions: number[];
      matches: number[];
    }> = [];

    for (const courtId of courtIds) {
      const courtSoftBlocks = softBlocksByCourt.get(courtId) ?? [];
      const courtHardBlocks = hardBlocksByCourt.get(courtId) ?? [];
      const courtBookings = bookingsByCourt.get(courtId) ?? [];
      const courtClassSessions = classSessionsByCourt.get(courtId) ?? [];
      const courtMatches = matchesByCourt.get(courtId) ?? [];

      const exactSoftBlock = courtSoftBlocks.find((block) => {
        if (block.scopeType !== SoftBlockScope.COURT || block.scopeId !== courtId) return false;
        return block.startsAt.getTime() === startsAt.getTime() && block.endsAt.getTime() === endsAt.getTime();
      });

      const overlappingSoftBlocks = courtSoftBlocks.filter((block) => {
        if (exactSoftBlock && block.id === exactSoftBlock.id) return false;
        return overlaps(startsAt, endsAt, block.startsAt, block.endsAt);
      });

      const conflictSummary = {
        courtId,
        hardBlockCount: courtHardBlocks.length,
        softBlockCount: overlappingSoftBlocks.length,
        bookingCount: courtBookings.length,
        classSessionCount: courtClassSessions.length,
        matchCount: courtMatches.length,
      };

      const rejectForPolicy =
        conflictPolicy === "REJECT_ON_CONFLICT"
          ? conflictSummary.hardBlockCount +
              conflictSummary.softBlockCount +
              conflictSummary.bookingCount +
              conflictSummary.classSessionCount +
              conflictSummary.matchCount >
            0
          : conflictSummary.hardBlockCount + conflictSummary.softBlockCount > 0;

      if (rejectForPolicy && !force) {
        conflicts.push({ ...conflictSummary, rejected: true });
        continue;
      }

      if (conflictPolicy === DEFAULT_CONFLICT_POLICY && (courtBookings.length || courtClassSessions.length || courtMatches.length)) {
        cascades.push({
          courtId,
          bookings: courtBookings.map((entry) => entry.id),
          classSessions: courtClassSessions.map((entry) => entry.id),
          matches: courtMatches.map((entry) => entry.id),
        });
      }

      if (exactSoftBlock) {
        createdBlocks.push({ courtId, softBlockId: exactSoftBlock.id, reused: true });
        continue;
      }

      const reason = reasonCode
        ? `TOURNAMENT_${reasonCode}${reasonText ? ` ${reasonText}` : ""}`
        : `TOURNAMENT_BLOCK_EVENT_${event.id}`;
      const createResult = await createSoftBlock({
        organizationId: organization.id,
        actorUserId: user.id,
        startsAt,
        endsAt,
        scopeType: SoftBlockScope.COURT,
        scopeId: courtId,
        reason,
        correlationId: operationId,
      });
      if (!createResult.ok) {
        conflicts.push({ ...conflictSummary, rejected: true });
        continue;
      }
      createdBlocks.push({ courtId, softBlockId: createResult.data.softBlockId, reused: false });
      conflicts.push({ ...conflictSummary, rejected: false });
    }

    await recordOrganizationAudit(prisma, {
      organizationId: organization.id,
      actorUserId: user.id,
      action: "tournament.blocks.bulk.created",
      entityType: "TOURNAMENT_BLOCK_BULK",
      entityId: operationId,
      correlationId: operationId,
      metadata: {
        operationId,
        eventId: event.id,
        courtIds,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        conflictPolicy,
        reasonCode: reasonCode ?? null,
        force,
        createdCount: createdBlocks.length,
        createdBlocks,
        conflicts,
        cascades,
      },
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: req.headers.get("user-agent") ?? null,
    });

    if (createdBlocks.length === 0) {
      return fail(ctx, 409, "TOURNAMENT_BLOCK_CONFLICT", "TOURNAMENT_BLOCK_CONFLICT", false, {
        operationId,
        conflictPolicy,
        conflicts,
      });
    }

    return respondOk(
      ctx,
      {
        data: {
          operationId,
          eventId: event.id,
          conflictPolicy,
          reasonCode: reasonCode ?? null,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          createdBlocks,
          conflicts,
          cascades,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    if (isUnauthenticatedError(err)) return fail(ctx, 401, "UNAUTHENTICATED");
    console.error("POST /api/org/[orgId]/tournaments/blocks/bulk error:", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}

export const POST = withApiEnvelope(_POST);
