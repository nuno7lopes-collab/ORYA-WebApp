export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { PadelPartnershipStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readNumericParam } from "@/lib/routeParams";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { ensurePartnershipOrganization } from "@/app/api/padel/partnerships/_shared";
import { resolvePartnershipScheduleConstraints } from "@/domain/padel/partnershipSchedulePolicy";
import { updatePadelMatch } from "@/domain/padel/matches/commands";

type Interval = {
  courtId: number;
  startsAt: Date;
  endsAt: Date;
};

type CandidateCourt = {
  id: number;
  padelClubId: number | null;
};

const SLOT_STEP_MINUTES = 15;
const COMPENSATION_WINDOW_HOURS = 48;

function overlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

function toWindow(match: {
  plannedStartAt: Date | null;
  plannedEndAt: Date | null;
  plannedDurationMinutes: number | null;
  startTime: Date | null;
}) {
  const start = match.plannedStartAt ?? match.startTime;
  if (!start) return null;
  const end =
    match.plannedEndAt ??
    (match.plannedDurationMinutes
      ? new Date(start.getTime() + Number(match.plannedDurationMinutes) * 60 * 1000)
      : new Date(start.getTime() + 60 * 60 * 1000));
  return { start, end };
}

function isActiveBooking(status: string, pendingExpiresAt: Date | null) {
  if (["CONFIRMED", "DISPUTED", "NO_SHOW"].includes(status)) return true;
  if (["PENDING_CONFIRMATION", "PENDING"].includes(status)) {
    return pendingExpiresAt ? pendingExpiresAt > new Date() : false;
  }
  return false;
}

function isSlotFree(params: {
  courtId: number;
  startsAt: Date;
  endsAt: Date;
  matches: Interval[];
  bookings: Interval[];
  blocks: Interval[];
  tentative: Interval[];
}) {
  const { courtId, startsAt, endsAt, matches, bookings, blocks, tentative } = params;
  const conflicts = [...matches, ...bookings, ...blocks, ...tentative];
  return !conflicts.some((item) => item.courtId === courtId && overlap(startsAt, endsAt, item.startsAt, item.endsAt));
}

function alignToStep(date: Date) {
  const stepMs = SLOT_STEP_MINUTES * 60 * 1000;
  return new Date(Math.ceil(date.getTime() / stepMs) * stepMs);
}

function findCompensationSlot(params: {
  originalStart: Date;
  durationMinutes: number;
  primaryCourts: CandidateCourt[];
  allCourts: CandidateCourt[];
  searchWindowStart: Date;
  searchWindowEnd: Date;
  matches: Interval[];
  bookings: Interval[];
  blocks: Interval[];
  tentative: Interval[];
}) {
  const {
    originalStart,
    durationMinutes,
    primaryCourts,
    allCourts,
    searchWindowStart,
    searchWindowEnd,
    matches,
    bookings,
    blocks,
    tentative,
  } = params;

  const durationMs = Math.max(1, durationMinutes) * 60 * 1000;

  const tryAt = (courts: CandidateCourt[], startsAt: Date) => {
    const endsAt = new Date(startsAt.getTime() + durationMs);
    if (endsAt > searchWindowEnd || startsAt < searchWindowStart) return null;
    for (const court of courts) {
      if (
        isSlotFree({
          courtId: court.id,
          startsAt,
          endsAt,
          matches,
          bookings,
          blocks,
          tentative,
        })
      ) {
        return { courtId: court.id, startsAt, endsAt };
      }
    }
    return null;
  };

  const alignedOriginal = alignToStep(originalStart);
  const firstTry = tryAt(primaryCourts, alignedOriginal);
  if (firstTry) return firstTry;

  const stepMs = SLOT_STEP_MINUTES * 60 * 1000;
  for (let cursor = alignedOriginal.getTime(); cursor <= searchWindowEnd.getTime(); cursor += stepMs) {
    const slot = tryAt(allCourts, new Date(cursor));
    if (slot) return slot;
  }

  return null;
}

async function _POST(req: NextRequest) {
  const overrideId = readNumericParam(undefined, req, "overrides");
  if (overrideId === null) return jsonWrap({ ok: false, error: "INVALID_OVERRIDE_ID" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const check = await ensurePartnershipOrganization({ req, required: "EDIT", body });
  if (!check.ok) return jsonWrap({ ok: false, error: check.error }, { status: check.status });

  const override = await prisma.padelPartnershipOverride.findUnique({
    where: { id: overrideId },
    select: {
      id: true,
      agreementId: true,
      ownerOrganizationId: true,
      partnerOrganizationId: true,
      eventId: true,
      courtId: true,
      startsAt: true,
      endsAt: true,
      reasonCode: true,
      reason: true,
      createdAt: true,
      executedAt: true,
    },
  });
  if (!override) return jsonWrap({ ok: false, error: "OVERRIDE_NOT_FOUND" }, { status: 404 });
  if (check.organization.id !== override.ownerOrganizationId) {
    return jsonWrap({ ok: false, error: "FORBIDDEN_OWNER_ONLY" }, { status: 403 });
  }
  if (override.executedAt) {
    return jsonWrap({ ok: false, error: "OVERRIDE_ALREADY_EXECUTED" }, { status: 409 });
  }
  if (!override.eventId || !override.startsAt || !override.endsAt) {
    return jsonWrap({ ok: false, error: "OVERRIDE_NOT_EXECUTABLE" }, { status: 409 });
  }

  const agreement = await prisma.padelPartnershipAgreement.findUnique({
    where: { id: override.agreementId },
    select: {
      id: true,
      ownerClubId: true,
      ownerOrganizationId: true,
      partnerOrganizationId: true,
      status: true,
    },
  });
  if (!agreement) return jsonWrap({ ok: false, error: "AGREEMENT_NOT_FOUND" }, { status: 404 });
  if (
    agreement.status !== PadelPartnershipStatus.APPROVED &&
    agreement.status !== PadelPartnershipStatus.PAUSED
  ) {
    return jsonWrap({ ok: false, error: "AGREEMENT_NOT_ACTIVE" }, { status: 409 });
  }
  const bookingPolicy = await prisma.padelPartnershipBookingPolicy.findUnique({
    where: { agreementId: agreement.id },
    select: {
      autoCompensationOnOverride: true,
      protectExternalReservations: true,
      hardStopMinutesBeforeBooking: true,
    },
  });

  const event = await prisma.event.findUnique({
    where: { id: override.eventId, isDeleted: false },
    select: {
      id: true,
      organizationId: true,
      startsAt: true,
      endsAt: true,
      templateType: true,
    },
  });
  if (!event || !event.organizationId || event.templateType !== "PADEL") {
    return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const partnerCourtMappings = await prisma.padelPartnerCourtSnapshot.findMany({
    where: {
      partnerOrganizationId: event.organizationId,
      sourceCourtId: override.courtId ?? -1,
      isActive: true,
    },
    select: { localCourtId: true },
  });

  const targetCourtIds = Array.from(
    new Set(
      [override.courtId, ...partnerCourtMappings.map((item) => item.localCourtId)]
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
    ),
  );

  const impactedMatchesRaw = await prisma.eventMatchSlot.findMany({
    where: {
      eventId: event.id,
      status: "PENDING",
      OR: [{ plannedStartAt: { not: null } }, { startTime: { not: null } }],
      ...(targetCourtIds.length > 0 ? { courtId: { in: targetCourtIds } } : {}),
    },
    select: {
      id: true,
      courtId: true,
      plannedStartAt: true,
      plannedEndAt: true,
      plannedDurationMinutes: true,
      startTime: true,
      pairingAId: true,
      pairingBId: true,
      score: true,
    },
    orderBy: [{ plannedStartAt: "asc" }, { startTime: "asc" }, { id: "asc" }],
  });

  const impactedMatches = impactedMatchesRaw.filter((match) => {
    const window = toWindow(match);
    if (!window) return false;
    return overlap(window.start, window.end, override.startsAt!, override.endsAt!);
  });

  const candidateCourtsRaw = await prisma.padelClubCourt.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      OR: [{ padelClubId: agreement.ownerClubId }, { id: { in: targetCourtIds } }],
    },
    select: { id: true, padelClubId: true, displayOrder: true },
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
  });

  const candidateCourts: CandidateCourt[] = candidateCourtsRaw.map((court) => ({
    id: court.id,
    padelClubId: court.padelClubId ?? null,
  }));

  if (candidateCourts.length === 0) {
    return jsonWrap({ ok: false, error: "NO_COMPENSATION_COURTS" }, { status: 409 });
  }

  const primaryCourts = candidateCourts.filter((court) => court.id !== override.courtId);
  const allCourts = candidateCourts;

  const compensationWindowStart = override.startsAt;
  const compensationWindowEnd = new Date(override.startsAt.getTime() + COMPENSATION_WINDOW_HOURS * 60 * 60 * 1000);

  const [scheduledMatches, blocks, bookingsRaw] = await Promise.all([
    prisma.eventMatchSlot.findMany({
      where: {
        eventId: event.id,
        status: "PENDING",
        OR: [{ plannedStartAt: { not: null } }, { startTime: { not: null } }],
      },
      select: {
        id: true,
        courtId: true,
        plannedStartAt: true,
        plannedEndAt: true,
        plannedDurationMinutes: true,
        startTime: true,
      },
    }),
    prisma.calendarBlock.findMany({
      where: {
        eventId: event.id,
        courtId: { in: allCourts.map((court) => court.id) },
        startAt: { lt: compensationWindowEnd },
        endAt: { gt: compensationWindowStart },
      },
      select: { courtId: true, startAt: true, endAt: true },
    }),
    prisma.booking.findMany({
      where: {
        courtId: { in: allCourts.map((court) => court.id) },
        startsAt: { lt: compensationWindowEnd },
      },
      select: {
        courtId: true,
        startsAt: true,
        durationMinutes: true,
        status: true,
        pendingExpiresAt: true,
      },
    }),
  ]);

  const constraints = await resolvePartnershipScheduleConstraints({
    organizationId: event.organizationId,
    windowStart: compensationWindowStart,
    windowEnd: compensationWindowEnd,
    courts: allCourts,
  });

  const additionalBlocks: Interval[] = constraints.additionalCourtBlocks.map((block) => ({
    courtId: block.courtId,
    startsAt: block.startAt,
    endsAt: block.endAt,
  }));

  const scheduledIntervals: Interval[] = scheduledMatches
    .filter((match) => !impactedMatches.some((target) => target.id === match.id))
    .map((match) => {
      const window = toWindow(match);
      return window && typeof match.courtId === "number"
        ? { courtId: match.courtId, startsAt: window.start, endsAt: window.end }
        : null;
    })
    .filter((item): item is Interval => Boolean(item));

  const blockIntervals: Interval[] = [
    ...blocks
      .filter((block) => typeof block.courtId === "number")
      .map((block) => ({ courtId: block.courtId as number, startsAt: block.startAt, endsAt: block.endAt })),
    ...additionalBlocks,
  ];

  const bookingIntervals: Interval[] = bookingsRaw
    .filter((booking) => typeof booking.courtId === "number")
    .filter(({ status, pendingExpiresAt }) =>
      bookingPolicy?.protectExternalReservations ?? true ? isActiveBooking(status, pendingExpiresAt) : false,
    )
    .map((booking) => ({
      courtId: booking.courtId as number,
      startsAt: booking.startsAt,
      endsAt: new Date(booking.startsAt.getTime() + booking.durationMinutes * 60 * 1000),
    }));

  const tentative: Interval[] = [];
  const assigned: Array<{ matchId: number; courtId: number; startsAt: Date; endsAt: Date; durationMinutes: number }> = [];
  const pendingMatchIds: number[] = [];

  for (const match of impactedMatches) {
    const window = toWindow(match);
    const originalStart = window?.start ?? override.startsAt;
    const durationMinutes = Math.max(15, match.plannedDurationMinutes ?? 60);

    const slot =
      bookingPolicy?.autoCompensationOnOverride === false
        ? null
        : findCompensationSlot({
            originalStart,
            durationMinutes,
            primaryCourts,
            allCourts,
            searchWindowStart: compensationWindowStart,
            searchWindowEnd: compensationWindowEnd,
            matches: scheduledIntervals,
            bookings: bookingIntervals,
            blocks: blockIntervals,
            tentative,
          });

    if (!slot) {
      pendingMatchIds.push(match.id);
      continue;
    }

    tentative.push({ courtId: slot.courtId, startsAt: slot.startsAt, endsAt: slot.endsAt });
    assigned.push({
      matchId: match.id,
      courtId: slot.courtId,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      durationMinutes,
    });
  }

  const now = new Date();
  const weeklyOverrideCount = await prisma.padelPartnershipOverride.count({
    where: {
      agreementId: agreement.id,
      createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
    },
  });
  const complianceFlag = weeklyOverrideCount > 3;
  const executionStatus = pendingMatchIds.length > 0 ? "PENDING_COMPENSATION" : "AUTO_RESOLVED";

  const result = await prisma.$transaction(async (tx) => {
    for (const match of impactedMatches) {
      await updatePadelMatch({
        tx,
        matchId: match.id,
        eventId: event.id,
        organizationId: event.organizationId!,
        actorUserId: check.userId,
        eventType: "PADEL_PARTNERSHIP_OVERRIDE_EXECUTED",
        data: {
          plannedStartAt: null,
          plannedEndAt: null,
          plannedDurationMinutes: null,
          courtId: null,
          startTime: null,
          score:
            match.score && typeof match.score === "object"
              ? ({
                  ...(match.score as Prisma.JsonObject),
                  overrideExecution: {
                    at: now.toISOString(),
                    overrideId: override.id,
                    reasonCode: override.reasonCode,
                  },
                } as Prisma.InputJsonValue)
              : ({
                  overrideExecution: {
                    at: now.toISOString(),
                    overrideId: override.id,
                    reasonCode: override.reasonCode,
                  },
                } as Prisma.InputJsonValue),
        },
      });
    }

    for (const item of assigned) {
      await updatePadelMatch({
        tx,
        matchId: item.matchId,
        eventId: event.id,
        organizationId: event.organizationId!,
        actorUserId: check.userId,
        eventType: "PADEL_PARTNERSHIP_OVERRIDE_COMPENSATED",
        data: {
          courtId: item.courtId,
          plannedStartAt: item.startsAt,
          plannedEndAt: item.endsAt,
          plannedDurationMinutes: item.durationMinutes,
          startTime: item.startsAt,
        },
      });
    }

    const compensationCase = await tx.padelPartnershipCompensationCase.create({
      data: {
        agreementId: agreement.id,
        overrideId: override.id,
        ownerOrganizationId: agreement.ownerOrganizationId,
        partnerOrganizationId: agreement.partnerOrganizationId,
        eventId: event.id,
        status: pendingMatchIds.length > 0 ? "PENDING_COMPENSATION" : "AUTO_RESOLVED",
        reasonCode: override.reasonCode,
        windowStart: compensationWindowStart,
        windowEnd: compensationWindowEnd,
        createdByUserId: check.userId,
        ...(pendingMatchIds.length === 0 ? { resolvedAt: now, resolvedByUserId: check.userId } : {}),
        metadata: {
          assigned,
          pendingMatchIds,
          targetCourtIds,
          constraintsErrors: constraints.errors,
          complianceFlag,
          algorithm: ["SAME_CLUB_OTHER_COURT", "NEXT_AVAILABLE_WINDOW"],
        },
      },
    });

    const updatedOverride = await tx.padelPartnershipOverride.update({
      where: { id: override.id },
      data: {
        executedByUserId: check.userId,
        executedAt: now,
        executionStatus,
        impact: {
          assignedCount: assigned.length,
          pendingCompensationCount: pendingMatchIds.length,
          compensationCaseId: compensationCase.id,
          complianceFlag,
          reasonCode: override.reasonCode,
          windowStart: compensationWindowStart.toISOString(),
          windowEnd: compensationWindowEnd.toISOString(),
        },
      },
    });

    return { updatedOverride, compensationCase };
  });

  await recordOrganizationAuditSafe({
    organizationId: agreement.ownerOrganizationId,
    actorUserId: check.userId,
    action: "PADEL_PARTNERSHIP_OVERRIDE_EXECUTED",
    entityType: "padel_partnership_override",
    entityId: String(override.id),
    metadata: {
      overrideId: override.id,
      agreementId: agreement.id,
      executionStatus,
      assignedCount: assigned.length,
      pendingCompensationCount: pendingMatchIds.length,
      pendingMatchIds,
      compensationCaseId: result.compensationCase.id,
      complianceFlag,
      reasonCode: override.reasonCode,
    },
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: req.headers.get("user-agent") || null,
  });

  return jsonWrap(
    {
      ok: true,
      override: result.updatedOverride,
      compensationCase: result.compensationCase,
      assigned,
      pendingMatchIds,
      complianceFlag,
    },
    { status: 200 },
  );
}

export const POST = withApiEnvelope(_POST);
