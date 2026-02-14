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

async function _GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const eventId = Number(req.nextUrl.searchParams.get("eventId"));
  if (!Number.isFinite(eventId)) {
    return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: { id: true, organizationId: true, templateType: true },
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
  const pendingStatuses = [
    PadelRegistrationStatus.PENDING_PARTNER,
    PadelRegistrationStatus.PENDING_PAYMENT,
    PadelRegistrationStatus.MATCHMAKING,
  ];
  const [
    pendingSplitCount,
    confirmedCount,
    waitlistCount,
    liveMatchesCount,
    delayedMatchesCount,
    refundPendingCount,
    pairings,
    overrideCount,
    pendingCompensationCount,
    activeSanctions,
    delayPolicyRows,
    conflictingClaimRows,
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
       AND a.resource_type = b.resource_type
       AND a.resource_id = b.resource_id
       AND tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(b.starts_at, b.ends_at, '[)')
      WHERE a.event_id = ${eventId}
        AND a.status = 'CLAIMED'::app_v3."AgendaResourceClaimStatus"
        AND b.status = 'CLAIMED'::app_v3."AgendaResourceClaimStatus"
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
        liveMatchesCount,
        delayedMatchesCount,
        delaysByPolicy: delayPolicyBreakdown,
        refundPendingCount,
        conflictsClaimsCount: conflictingClaimsCount,
        overridesCount: overrideCount,
        pendingCompensationCount,
        rankingSanctionsActive: sanctionsByType,
        invalidStateCount: integritySummary.counts.total,
        updatedAt: now.toISOString(),
      },
    },
    { status: 200 },
  );
}

export const GET = withApiEnvelope(_GET);
