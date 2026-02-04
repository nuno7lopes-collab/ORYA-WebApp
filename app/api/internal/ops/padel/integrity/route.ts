import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { computePadelIntegritySummary } from "@/domain/padel/integrity";

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

  return jsonWrap(
    {
      ok: true,
      total: summary.counts.total,
      byReason: summary.counts.byReason,
      issues: summary.issues.slice(0, 50),
    },
    { status: 200 },
  );
}

export const GET = withApiEnvelope(_GET);
