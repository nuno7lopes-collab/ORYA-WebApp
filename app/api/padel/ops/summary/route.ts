export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { OrganizationModule, PadelRegistrationStatus } from "@prisma/client";
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
        refundPendingCount,
        invalidStateCount: integritySummary.counts.total,
        updatedAt: now.toISOString(),
      },
    },
    { status: 200 },
  );
}

export const GET = withApiEnvelope(_GET);
