import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { OrganizationMemberRole, OrganizationModule, Prisma, padel_match_status } from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { readNumericParam } from "@/lib/routeParams";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { buildWalkoverSets, normalizePadelScoreRules } from "@/domain/padel/score";
import { updatePadelMatch } from "@/domain/padel/matches/commands";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { listTournamentDirectorUserIds, resolveIncidentAuthority } from "@/domain/padel/incidentGovernance";
import { createNotification, shouldNotify } from "@/lib/notifications";
import { isPadelOfficialStatus } from "@/domain/padel/liveStatus";
import { buildIdempotencyScope, readIdempotencyReplay, writeIdempotencyRecord } from "@/domain/padel/resultWorkflow";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];
const SPECIAL_RESULT_TYPES = new Set(["WALKOVER", "RETIREMENT", "INJURY"]);

function asScoreObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {} as Record<string, unknown>;
  return value as Record<string, unknown>;
}

function resolveClientRequestId(req: NextRequest, body: Record<string, unknown>) {
  const fromBody = typeof body.clientRequestId === "string" ? body.clientRequestId.trim() : "";
  if (fromBody) return fromBody;
  const fromHeader = req.headers.get("x-idempotency-key")?.trim() ?? "";
  if (fromHeader) return fromHeader;
  return null;
}

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const matchId = readNumericParam(resolved?.id, req, "matches");
  if (matchId === null) return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { data: authData, error: authError } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });
  if (authError || !authData?.user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  const authUser = authData.user;

  const match = await prisma.eventMatchSlot.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      winnerSide: true,
      winnerParticipantId: true,
      eventId: true,
      status: true,
      score: true,
      scoreSets: true,
      roundType: true,
      roundLabel: true,
      participants: {
        orderBy: [{ side: "asc" }, { slotOrder: "asc" }, { id: "asc" }],
        select: {
          participantId: true,
          side: true,
          slotOrder: true,
          participant: {
            select: {
              id: true,
              playerProfileId: true,
            },
          },
        },
      },
      event: { select: { organizationId: true } },
    },
  });
  if (!match) return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (!match.event?.organizationId) {
    return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }
  const organizationId = match.event.organizationId;
  if (isPadelOfficialStatus(match.status)) {
    return jsonWrap({ ok: false, error: "ALREADY_DONE" }, { status: 409 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const winner = body?.winner as "A" | "B";
  if (winner !== "A" && winner !== "B") {
    return jsonWrap({ ok: false, error: "INVALID_WINNER" }, { status: 400 });
  }
  if (body?.confirmedByRole === undefined || body?.confirmedByRole === null) {
    return jsonWrap({ ok: false, error: "MISSING_CONFIRMED_BY_ROLE" }, { status: 400 });
  }
  if (body?.confirmationSource === undefined || body?.confirmationSource === null) {
    return jsonWrap({ ok: false, error: "MISSING_CONFIRMATION_SOURCE" }, { status: 400 });
  }
  const resultTypeRaw = typeof body?.resultType === "string" ? body.resultType.trim().toUpperCase() : "WALKOVER";
  const resultType =
    SPECIAL_RESULT_TYPES.has(resultTypeRaw) ? (resultTypeRaw as "WALKOVER" | "RETIREMENT" | "INJURY") : null;
  if (!resultType) {
    return jsonWrap({ ok: false, error: "INVALID_RESULT_TYPE" }, { status: 400 });
  }
  const clientRequestId = resolveClientRequestId(req, body);
  if (!clientRequestId) {
    return jsonWrap({ ok: false, error: "MISSING_CLIENT_REQUEST_ID" }, { status: 400 });
  }

  const action = resultType === "WALKOVER" ? "walkover" : "retired";
  const scopeKey = buildIdempotencyScope({
    tournamentId: match.eventId,
    matchId,
    action,
    actorId: authUser.id,
    clientRequestId,
  });

  const currentScore = asScoreObject(match.score);
  const idempotencyReplay = readIdempotencyReplay({ score: currentScore, scopeKey });
  if (idempotencyReplay) {
    return jsonWrap(
      {
        ok: true,
        idempotentReplay: true,
        match: {
          id: match.id,
          eventId: match.eventId,
          status: match.status,
          score: currentScore,
          scoreSets: match.scoreSets ?? null,
          winnerSide: match.winnerSide,
          winnerParticipantId: match.winnerParticipantId,
        },
      },
      { status: 200 },
    );
  }

  const { organization, membership } = await getActiveOrganizationForUser(authUser.id, {
    organizationId,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization || !membership) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }
  const permission = await ensureMemberModuleAccess({
    organizationId,
    userId: authUser.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  if (!permission.ok) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }
  const authority = await resolveIncidentAuthority({
    eventId: match.eventId,
    organizationId,
    actorUserId: authUser.id,
    membershipRole: membership.role,
    roundType: match.roundType,
    roundLabel: match.roundLabel,
    requestedConfirmedByRole: body?.confirmedByRole,
    requestedConfirmationSource: body?.confirmationSource,
  });
  if (!authority.ok) {
    return jsonWrap({ ok: false, error: authority.error }, { status: authority.status });
  }

  const matchParticipants = Array.isArray(match.participants) ? match.participants : [];
  const winnerSideParticipants = matchParticipants
    .filter((row) => row.side === winner)
    .sort((a, b) => a.slotOrder - b.slotOrder || a.participantId - b.participantId);
  let winnerParticipantId: number | null = winnerSideParticipants[0]?.participantId ?? null;
  if (!winnerParticipantId && typeof match.winnerParticipantId === "number") {
    winnerParticipantId = match.winnerParticipantId;
  }
  if (!winnerParticipantId) {
    return jsonWrap({ ok: false, error: "MISSING_PARTICIPANTS" }, { status: 400 });
  }

  const config = await prisma.padelTournamentConfig.findUnique({
    where: { eventId: match.eventId },
    select: { advancedSettings: true, ruleSetId: true, ruleSetVersionId: true },
  });
  const scoreRules = normalizePadelScoreRules(
    (config?.advancedSettings as Record<string, unknown> | null)?.scoreRules,
  );
  const ruleSnapshot = {
    source:
      config?.ruleSetVersionId != null
        ? "VERSION"
        : config?.ruleSetId != null
          ? "RULESET"
          : "DEFAULT",
    ruleSetId: config?.ruleSetId ?? null,
    ruleSetVersionId: config?.ruleSetVersionId ?? null,
    capturedAt: new Date().toISOString(),
  };
  const nowIso = new Date().toISOString();

  const terminalStatus =
    resultType === "WALKOVER" ? padel_match_status.WALKOVER : padel_match_status.RETIRED;

  const scoreWithIncident = {
    ...currentScore,
    walkover: resultType === "WALKOVER",
    resultType,
    winnerSide: winner,
    ruleSnapshot,
    incidentType: resultType,
    incidentConfirmedByRole: authority.confirmedByRole,
    incidentConfirmationSource: authority.confirmationSource,
    incidentConfirmedAt: nowIso,
    incidentConfirmedBy: authUser.id,
  } as Record<string, unknown>;
  const persistedScore = writeIdempotencyRecord({
    score: scoreWithIncident,
    scopeKey,
    action,
    actorId: authUser.id,
    status: terminalStatus,
  });

  const updated = await prisma.$transaction(async (tx) => {
    const { match: updatedMatch } = await updatePadelMatch({
      tx,
      matchId,
      eventId: match.eventId,
      organizationId,
      actorUserId: authUser.id,
      beforeStatus: match.status ?? null,
      data: {
        status: terminalStatus,
        winnerSide: winner,
        winnerParticipantId,
        score: persistedScore as Prisma.InputJsonValue,
        scoreSets: buildWalkoverSets(winner, scoreRules ?? undefined),
      },
    });
    return updatedMatch;
  });

  await recordOrganizationAuditSafe({
    organizationId: match.event.organizationId,
    actorUserId: authUser.id,
    action: "PADEL_MATCH_WALKOVER",
    metadata: {
      matchId,
      eventId: match.eventId,
      winnerParticipantId,
      winnerSide: winner,
      resultType,
      confirmedByRole: authority.confirmedByRole,
      confirmationSource: authority.confirmationSource,
    },
  });

  if (authority.confirmedByRole === "REFEREE") {
    const directorUserIds = await listTournamentDirectorUserIds({
      eventId: match.eventId,
      organizationId,
      excludeUserId: authUser.id,
    });
    for (const directorUserId of directorUserIds) {
      const allow = await shouldNotify(directorUserId, "SYSTEM_ANNOUNCE");
      if (!allow) continue;
      await createNotification({
        userId: directorUserId,
        type: "SYSTEM_ANNOUNCE",
        title: "Incidente confirmado por árbitro",
        body: `Jogo #${matchId}: ${resultType} confirmado por REFEREE.`,
        organizationId,
        eventId: match.eventId,
        ctaUrl: `/org/${organizationId}/events/${match.eventId}`,
        dedupeKey: `padel_incident_referee_notify:${matchId}:${resultType}:${authority.confirmedByRole}`,
        payload: {
          kind: "PADEL_INCIDENT_REFEREE_CONFIRMED",
          matchId,
          eventId: match.eventId,
          resultType,
          confirmedByRole: authority.confirmedByRole,
          confirmationSource: authority.confirmationSource,
        },
      });
    }
  }

  return jsonWrap({ ok: true, match: updated }, { status: 200 });
}
export const POST = withApiEnvelope(_POST);
