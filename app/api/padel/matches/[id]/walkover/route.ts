import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { OrganizationMemberRole, padel_match_status } from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { canMarkWalkover } from "@/domain/padel/pairingPolicy";
import { mapRegistrationToPairingLifecycle } from "@/domain/padelRegistration";
import { PadelRegistrationStatus } from "@prisma/client";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { readNumericParam } from "@/lib/routeParams";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { buildWalkoverSets, normalizePadelScoreRules } from "@/domain/padel/score";
import { updatePadelMatch } from "@/domain/padel/matches/commands";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const matchId = readNumericParam(resolved?.id, req, "matches");
  if (matchId === null) return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const match = await prisma.eventMatchSlot.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      pairingAId: true,
      pairingBId: true,
      eventId: true,
      status: true,
      event: { select: { organizationId: true } },
    },
  });
  if (!match) return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (!match.event?.organizationId) {
    return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }
  const organizationId = match.event.organizationId;
  if (match.status === padel_match_status.DONE) {
    return jsonWrap({ ok: false, error: "ALREADY_DONE" }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const winner = body?.winner as "A" | "B";
  if (winner !== "A" && winner !== "B") {
    return jsonWrap({ ok: false, error: "INVALID_WINNER" }, { status: 400 });
  }

  const winnerPairingId = winner === "A" ? match.pairingAId : match.pairingBId;
  if (!winnerPairingId) {
    return jsonWrap({ ok: false, error: "MISSING_PAIRINGS" }, { status: 400 });
  }

  const { organization } = await getActiveOrganizationForUser(authData.user.id, {
    organizationId,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const winnerPairing = await prisma.padelPairing.findUnique({
    where: { id: winnerPairingId },
    select: { payment_mode: true, registration: { select: { status: true } } },
  });
  const lifecycleStatus = winnerPairing
    ? mapRegistrationToPairingLifecycle(
        winnerPairing.registration?.status ?? PadelRegistrationStatus.PENDING_PARTNER,
        winnerPairing.payment_mode,
      )
    : null;
  if (!winnerPairing || !canMarkWalkover(lifecycleStatus)) {
    return jsonWrap({ ok: false, error: "PAIRING_NOT_CONFIRMED" }, { status: 409 });
  }

  const config = await prisma.padelTournamentConfig.findUnique({
    where: { eventId: match.eventId },
    select: { advancedSettings: true },
  });
  const scoreRules = normalizePadelScoreRules(
    (config?.advancedSettings as Record<string, unknown> | null)?.scoreRules,
  );

  const updated = await prisma.$transaction(async (tx) => {
    const { match: updatedMatch } = await updatePadelMatch({
      tx,
      matchId,
      eventId: match.eventId,
      organizationId,
      actorUserId: authData.user.id,
      beforeStatus: match.status ?? null,
      data: {
        status: padel_match_status.DONE,
        winnerPairingId,
        score: { walkover: true, resultType: "WALKOVER", winnerSide: winner },
        scoreSets: buildWalkoverSets(winner, scoreRules ?? undefined),
      },
    });
    return updatedMatch;
  });

  await recordOrganizationAuditSafe({
    organizationId: match.event.organizationId,
    actorUserId: authData.user.id,
    action: "PADEL_MATCH_WALKOVER",
    metadata: {
      matchId,
      eventId: match.eventId,
      winnerPairingId,
    },
  });

  return jsonWrap({ ok: true, match: updated }, { status: 200 });
}
export const POST = withApiEnvelope(_POST);
