export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { OrganizationModule, PadelRegistrationStatus, Prisma } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { computePadelIntegritySummary } from "@/domain/padel/integrity";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";

function parseReasonCount(value: Prisma.JsonValue | null | undefined, reason: string): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  const record = value as Record<string, unknown>;
  const numeric = Number(record[reason]);
  return Number.isFinite(numeric) ? numeric : 0;
}

async function _GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });
  if (error || !user) {
    return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const eventId = Number(req.nextUrl.searchParams.get("eventId"));
  if (!Number.isFinite(eventId)) {
    return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: { id: true, organizationId: true, templateType: true, startsAt: true, endsAt: true },
  });
  if (!event?.organizationId || event.templateType !== "PADEL") {
    return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: event.organizationId,
    allowFallback: true,
  });
  if (!organization || !membership) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const access = await ensureMemberModuleAccess({
    organizationId: event.organizationId,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "VIEW",
  });
  if (!access.ok) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const now = new Date();
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const classWindowStart = event.startsAt ?? sevenDaysAgo;
  const classWindowEnd = event.endsAt ?? now;
  const pendingStatuses = [
    PadelRegistrationStatus.PENDING_PARTNER,
    PadelRegistrationStatus.PENDING_PAYMENT,
    PadelRegistrationStatus.MATCHMAKING,
  ];
  const [
    pendingSplitCount,
    confirmedCount,
    waitlistCount,
    inProgressMatchesCount,
    delayedMatchesCount,
    refundPendingCount,
    pairings,
    overrideCount,
    pendingCompensationCount,
    activeSanctions,
    delayPolicyRows,
    conflictingClaimRows,
    delayedOverrunCount,
    conflictsClaimsLast5mCount,
    overridesLastHourCount,
    overridesLast7dCount,
    classSessionsCapacityAgg,
    classConfirmedBookings,
    classPendingBookings,
    classNoShowBookings,
    autoScheduleRunsLastHour,
    autoScheduleInfeasibleBaselineCount,
    matchStartingSoonRows,
    streamCoverageRows,
    arbitrationLatencyRows,
    preflightMismatchRows,
  ] = await Promise.all([
    prisma.padelRegistration.count({
      where: {
        eventId,
        status: {
          in: pendingStatuses,
        },
      },
    }),
    prisma.padelRegistration.count({
      where: {
        eventId,
        status: PadelRegistrationStatus.CONFIRMED,
      },
    }),
    prisma.padelWaitlistEntry.count({ where: { eventId, status: "PENDING" } }),
    prisma.eventMatchSlot.count({ where: { eventId, status: "IN_PROGRESS" } }),
    prisma.eventMatchSlot.count({
      where: {
        eventId,
        status: "PENDING",
        OR: [{ plannedStartAt: { lt: now } }, { startTime: { lt: now } }],
      },
    }),
    prisma.padelRegistration.count({
      where: {
        eventId,
        status: { in: [PadelRegistrationStatus.CANCELLED, PadelRegistrationStatus.EXPIRED] },
      },
    }),
    prisma.padelPairing.findMany({
      where: { eventId },
      select: {
        id: true,
        eventId: true,
        categoryId: true,
        pairingStatus: true,
        pairingJoinMode: true,
        createdAt: true,
        partnerAcceptedAt: true,
        registration: { select: { status: true } },
        slots: { select: { slotStatus: true, paymentStatus: true } },
      },
    }),
    prisma.padelPartnershipOverride.count({
      where: { eventId },
    }),
    prisma.padelPartnershipCompensationCase.count({
      where: { eventId, status: "OPEN" },
    }),
    prisma.padelRatingSanction.groupBy({
      by: ["type"],
      where: { organizationId: event.organizationId, status: "ACTIVE" },
      _count: { _all: true },
    }),
    prisma.$queryRaw<Array<{ policy: string | null; count: bigint }>>(Prisma.sql`
      SELECT COALESCE(score->>'delayPolicy', 'UNSPECIFIED') AS policy, COUNT(*)::bigint AS count
      FROM app_v3.padel_matches
      WHERE event_id = ${eventId}
        AND score IS NOT NULL
        AND COALESCE(score->>'delayStatus', '') IN ('DELAYED', 'RESCHEDULED')
      GROUP BY COALESCE(score->>'delayPolicy', 'UNSPECIFIED')
    `),
    prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM app_v3.agenda_resource_claims a
      JOIN app_v3.agenda_resource_claims b
        ON a.id < b.id
       AND a.event_id = b.event_id
       AND a.resource_key = b.resource_key
       AND tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(b.starts_at, b.ends_at, '[)')
      WHERE a.event_id = ${eventId}
        AND a.status = 'CLAIMED'::app_v3."AgendaResourceClaimStatus"
        AND b.status = 'CLAIMED'::app_v3."AgendaResourceClaimStatus"
    `),
    prisma.eventMatchSlot.count({
      where: {
        eventId,
        status: "PENDING",
        OR: [{ plannedStartAt: { lt: tenMinutesAgo } }, { startTime: { lt: tenMinutesAgo } }],
      },
    }),
    prisma.agendaResourceClaim.count({
      where: {
        eventId,
        status: "CLAIMED",
        createdAt: { gte: fiveMinutesAgo },
      },
    }),
    prisma.padelPartnershipOverride.count({
      where: {
        eventId,
        createdAt: { gte: oneHourAgo },
      },
    }),
    prisma.padelPartnershipOverride.count({
      where: {
        eventId,
        createdAt: { gte: sevenDaysAgo },
      },
    }),
    prisma.classSession.aggregate({
      where: {
        organizationId: event.organizationId,
        status: "SCHEDULED",
        startsAt: { gte: classWindowStart, lte: classWindowEnd },
      },
      _sum: { capacity: true },
      _count: { _all: true },
    }),
    prisma.booking.count({
      where: {
        organizationId: event.organizationId,
        startsAt: { gte: classWindowStart, lte: classWindowEnd },
        service: { kind: "CLASS" },
        status: { in: ["CONFIRMED", "COMPLETED"] },
      },
    }),
    prisma.booking.count({
      where: {
        organizationId: event.organizationId,
        startsAt: { gte: classWindowStart, lte: classWindowEnd },
        service: { kind: "CLASS" },
        status: { in: ["PENDING_CONFIRMATION", "PENDING"] },
      },
    }),
    prisma.booking.count({
      where: {
        organizationId: event.organizationId,
        startsAt: { gte: classWindowStart, lte: classWindowEnd },
        service: { kind: "CLASS" },
        status: "NO_SHOW",
      },
    }),
    prisma.padelScheduleRun.findMany({
      where: {
        eventId,
        requestedAt: { gte: oneHourAgo },
      },
      select: {
        unscheduledByReason: true,
        errorCode: true,
      },
    }),
    prisma.padelScheduleRun.count({
      where: {
        eventId,
        errorCode: "AUTO_SCHEDULE_INFEASIBLE",
        requestedAt: { gte: oneDayAgo, lt: oneHourAgo },
      },
    }),
    prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM app_v3.notification_outbox outbox
      JOIN app_v3.padel_matches match_slot
        ON match_slot.id = CASE
          WHEN COALESCE(outbox.payload->>'matchId', '') ~ '^[0-9]+$'
          THEN (outbox.payload->>'matchId')::int
          ELSE NULL
        END
      WHERE match_slot.event_id = ${eventId}
        AND outbox.notification_type = 'MATCH_CHANGED'
        AND COALESCE(outbox.payload->>'eventType', '') = 'MATCH_STARTING_SOON'
        AND outbox.created_at >= ${oneHourAgo}
    `),
    prisma.$queryRaw<Array<{ total_count: bigint; stream_live_count: bigint }>>(Prisma.sql`
      SELECT
        COUNT(*)::bigint AS total_count,
        SUM(
          CASE
            WHEN COALESCE(pm.score->'liveStream'->>'isLive', 'false') IN ('true', 'TRUE', '1') THEN 1
            ELSE 0
          END
        )::bigint AS stream_live_count
      FROM app_v3.padel_matches pm
      WHERE pm.event_id = ${eventId}
    `),
    prisma.$queryRaw<Array<{ avg_latency_ms: number | null }>>(Prisma.sql`
      SELECT AVG(
        CASE
          WHEN COALESCE(d.metadata->>'decisionLatencyMs', '') ~ '^[0-9]+(\\.[0-9]+)?$'
          THEN (d.metadata->>'decisionLatencyMs')::numeric
          ELSE NULL
        END
      )::float8 AS avg_latency_ms
      FROM app_v3.agenda_arbitration_decisions d
      WHERE d.actor_organization_id = ${event.organizationId}
        AND d.created_at >= ${oneHourAgo}
        AND COALESCE(d.metadata->>'eventId', '') = ${String(eventId)}
    `),
    prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM app_v3.organization_audit_logs audit
      WHERE audit.organization_id = ${event.organizationId}
        AND audit.action = 'PADEL_CALENDAR_PREFLIGHT_MISMATCH'
        AND audit.created_at >= ${oneHourAgo}
        AND COALESCE(audit.metadata->>'eventId', '') = ${String(eventId)}
    `),
  ]);

  const integritySummary = computePadelIntegritySummary(
    pairings.map((pairing) => ({
      id: pairing.id,
      eventId: pairing.eventId,
      categoryId: pairing.categoryId ?? null,
      pairingStatus: pairing.pairingStatus,
      pairingJoinMode: pairing.pairingJoinMode,
      registrationStatus: pairing.registration?.status ?? null,
      slots: pairing.slots.map((slot) => ({
        slotStatus: slot.slotStatus,
        paymentStatus: slot.paymentStatus,
      })),
    })),
  );
  const matchmakingDurations = pairings
    .filter((pairing) => pairing.pairingJoinMode === "LOOKING_FOR_PARTNER" && pairing.partnerAcceptedAt)
    .map((pairing) => {
      if (!pairing.partnerAcceptedAt) return null;
      const diffMs = pairing.partnerAcceptedAt.getTime() - pairing.createdAt.getTime();
      return diffMs > 0 ? diffMs : null;
    })
    .filter((value): value is number => typeof value === "number");
  const avgMatchmakingMinutes =
    matchmakingDurations.length > 0
      ? Math.round(matchmakingDurations.reduce((acc, ms) => acc + ms, 0) / matchmakingDurations.length / 60000)
      : null;
  const pendingCount = pendingSplitCount;
  const activeTotal = pendingCount + confirmedCount;
  const conversionRate = activeTotal > 0 ? confirmedCount / activeTotal : null;
  const sanctionsByType = activeSanctions.reduce<Record<string, number>>((acc, row) => {
    acc[row.type] = row._count._all;
    return acc;
  }, {});
  const delayPolicyBreakdown = delayPolicyRows.reduce<Record<string, number>>((acc, row) => {
    const key = row.policy || "UNSPECIFIED";
    acc[key] = Number(row.count);
    return acc;
  }, {});
  const conflictingClaimsCount = Number(conflictingClaimRows[0]?.count ?? 0);
  const liveMatchesCount = inProgressMatchesCount;
  const classCapacityTotal = classSessionsCapacityAgg._sum.capacity ?? 0;
  const classBookingsTotal = classConfirmedBookings + classPendingBookings + classNoShowBookings;
  const coachOccupancyRate = classCapacityTotal > 0 ? classConfirmedBookings / classCapacityTotal : null;
  const coachNoShowRate = classBookingsTotal > 0 ? classNoShowBookings / classBookingsTotal : null;
  const classConversionRate =
    classConfirmedBookings + classPendingBookings > 0
      ? classConfirmedBookings / (classConfirmedBookings + classPendingBookings)
      : null;
  const autoScheduleBlockedByClassSessionCount = autoScheduleRunsLastHour.reduce((acc, run) => {
    return acc + parseReasonCount(run.unscheduledByReason as Prisma.JsonValue | null, "CLASS_SESSION_CONFLICT");
  }, 0);
  const autoScheduleSkippedByBookingCount = autoScheduleRunsLastHour.reduce((acc, run) => {
    return acc + parseReasonCount(run.unscheduledByReason as Prisma.JsonValue | null, "BOOKING_CONFLICT");
  }, 0);
  const autoScheduleInfeasibleLastHourCount = autoScheduleRunsLastHour.reduce((acc, run) => {
    return run.errorCode === "AUTO_SCHEDULE_INFEASIBLE" ? acc + 1 : acc;
  }, 0);
  const autoScheduleInfeasibleBaselinePerHour = autoScheduleInfeasibleBaselineCount / 23;
  const autoScheduleInfeasibleSpikeThreshold = Math.max(
    3,
    Math.ceil(autoScheduleInfeasibleBaselinePerHour * 3),
  );
  const matchStartingSoonSentCount = Number(matchStartingSoonRows[0]?.count ?? 0);
  const streamCoverageTotal = Number(streamCoverageRows[0]?.total_count ?? 0);
  const streamCoverageLive = Number(streamCoverageRows[0]?.stream_live_count ?? 0);
  const publicLivePayloadStreamCoverage =
    streamCoverageTotal > 0 ? streamCoverageLive / streamCoverageTotal : 0;
  const scheduleWriteGatewayDecisionLatencyMs = Number(arbitrationLatencyRows[0]?.avg_latency_ms ?? 0);
  const calendarConflictPreflightMismatchCount = Number(preflightMismatchRows[0]?.count ?? 0);
  const overrideSpikeThreshold = Math.max(5, Math.ceil((overridesLast7dCount / 168) * 3));
  const alerts: Array<{ code: string; level: "warn" | "critical"; message: string; value: number; threshold: number }> = [];

  const delayedLiveRatio = liveMatchesCount > 0 ? delayedMatchesCount / liveMatchesCount : 0;
  if (
    delayedOverrunCount > 0 &&
    (delayedMatchesCount >= 8 || (liveMatchesCount > 0 && delayedLiveRatio > 0.25))
  ) {
    alerts.push({
      code: "SLOT_OVERRUN_ALERT",
      level: delayedMatchesCount >= 12 || delayedLiveRatio > 0.4 ? "critical" : "warn",
      message: "Atraso operacional acima do limiar em janela >=10 minutos.",
      value: delayedMatchesCount,
      threshold: 8,
    });
  }
  if (conflictsClaimsLast5mCount >= 10) {
    alerts.push({
      code: "MASS_CONFLICT_ALERT",
      level: conflictsClaimsLast5mCount >= 20 ? "critical" : "warn",
      message: "Subida massiva de conflitos de claims em 5 minutos.",
      value: conflictsClaimsLast5mCount,
      threshold: 10,
    });
  }
  if (overridesLastHourCount >= overrideSpikeThreshold) {
    alerts.push({
      code: "OVERRIDE_SPIKE_ALERT",
      level: overridesLastHourCount >= overrideSpikeThreshold * 2 ? "critical" : "warn",
      message: "Pico de overrides na última hora acima da baseline de 7 dias.",
      value: overridesLastHourCount,
      threshold: overrideSpikeThreshold,
    });
  }
  if (autoScheduleInfeasibleLastHourCount >= autoScheduleInfeasibleSpikeThreshold) {
    alerts.push({
      code: "AUTO_SCHEDULE_INFEASIBLE_SPIKE",
      level:
        autoScheduleInfeasibleLastHourCount >= autoScheduleInfeasibleSpikeThreshold * 2
          ? "critical"
          : "warn",
      message: "Subida de runs inviáveis no auto-agendamento acima da baseline de 24 horas.",
      value: autoScheduleInfeasibleLastHourCount,
      threshold: autoScheduleInfeasibleSpikeThreshold,
    });
  }

  return jsonWrap(
    {
      ok: true,
      summary: {
        pendingSplitCount,
        pendingCount,
        confirmedCount,
        conversionRate,
        avgMatchmakingMinutes,
        waitlistCount,
        inProgressMatchesCount,
        liveMatchesCount,
        delayedMatchesCount,
        delaysByPolicy: delayPolicyBreakdown,
        refundPendingCount,
        conflictsClaimsCount: conflictingClaimsCount,
        overridesCount: overrideCount,
        pendingCompensationCount,
        rankingSanctionsActive: sanctionsByType,
        coachOccupancyRate,
        coachNoShowRate,
        classConversionRate,
        autoScheduleBlockedByClassSessionCount,
        autoScheduleSkippedByBookingCount,
        autoScheduleInfeasibleLastHourCount,
        autoScheduleInfeasibleBaselinePerHour,
        matchStartingSoonSentCount,
        publicLivePayloadStreamCoverage,
        scheduleWriteGatewayDecisionLatencyMs,
        calendarConflictPreflightMismatchCount,
        alerts,
        invalidStateCount: integritySummary.counts.total,
        updatedAt: now.toISOString(),
      },
    },
    { status: 200 },
  );
}

export const GET = withApiEnvelope(_GET);
