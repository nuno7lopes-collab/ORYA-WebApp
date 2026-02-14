import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { computePadelIntegritySummary } from "@/domain/padel/integrity";
import { Prisma } from "@prisma/client";

async function _GET(req: NextRequest) {
  if (!requireInternalSecret(req)) {
    return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const eventId = Number(req.nextUrl.searchParams.get("eventId"));
  if (!Number.isFinite(eventId)) {
    return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });
  }

  const pairings = await prisma.padelPairing.findMany({
    where: { eventId },
    select: {
      id: true,
      eventId: true,
      categoryId: true,
      pairingStatus: true,
      pairingJoinMode: true,
      registration: { select: { status: true } },
      slots: { select: { slotStatus: true, paymentStatus: true } },
    },
  });

  const summary = computePadelIntegritySummary(
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

  const [overrideCount, pendingCompensationCount, activeSanctions, delayPolicyRows, conflictingClaimRows] =
    await Promise.all([
      prisma.padelPartnershipOverride.count({ where: { eventId } }),
      prisma.padelPartnershipCompensationCase.count({ where: { eventId, status: "OPEN" } }),
      prisma.padelRatingSanction.groupBy({
        by: ["type"],
        where: {
          status: "ACTIVE",
        },
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
  const delayPolicyBreakdown = delayPolicyRows.reduce<Record<string, number>>((acc, row) => {
    const key = row.policy || "UNSPECIFIED";
    acc[key] = Number(row.count);
    return acc;
  }, {});
  const sanctionsByType = activeSanctions.reduce<Record<string, number>>((acc, row) => {
    acc[row.type] = row._count._all;
    return acc;
  }, {});

  return jsonWrap(
    {
      ok: true,
      total: summary.counts.total,
      byReason: summary.counts.byReason,
      issues: summary.issues.slice(0, 50),
      observability: {
        overridesCount: overrideCount,
        pendingCompensationCount,
        delaysByPolicy: delayPolicyBreakdown,
        activeSanctionsByType: sanctionsByType,
        conflictsClaimsCount: Number(conflictingClaimRows[0]?.count ?? 0),
      },
    },
    { status: 200 },
  );
}

export const GET = withApiEnvelope(_GET);
