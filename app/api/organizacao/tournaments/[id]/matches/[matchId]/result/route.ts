import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { OrganizationMemberRole, SourceType, TournamentMatchStatus } from "@prisma/client";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { appendEventLog } from "@/domain/eventLog/append";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function getOrganizationRole(userId: string, eventId: number) {
  const evt = await prisma.event.findUnique({ where: { id: eventId }, select: { organizationId: true } });
  if (!evt?.organizationId) return null;
  const organization = await prisma.organization.findUnique({
    where: { id: evt.organizationId },
    select: { officialEmail: true, officialEmailVerifiedAt: true },
  });
  if (!organization) return null;
  const emailGate = ensureOrganizationEmailVerified(organization, { reasonCode: "TOURNAMENTS_MATCH_RESULT" });
  if (!emailGate.ok) return { ...emailGate, status: 403 };
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { onboardingDone: true, fullName: true, username: true },
  });
  const hasUserOnboarding =
    profile?.onboardingDone ||
    (Boolean(profile?.fullName?.trim()) && Boolean(profile?.username?.trim()));
  if (!hasUserOnboarding) return null;
  const member = await resolveGroupMemberForOrg({ organizationId: evt.organizationId, userId });
  return member?.role ?? null;
}

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string; matchId: string }> }) {
  const resolved = await params;
  const tournamentId = Number(resolved?.id);
  const matchId = Number(resolved?.matchId);
  if (!Number.isFinite(tournamentId) || !Number.isFinite(matchId)) {
    return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const match = await prisma.tournamentMatch.findUnique({
    where: { id: matchId },
    include: { stage: { select: { tournamentId: true, tournament: { select: { eventId: true } } } } },
  });
  if (!match || match.stage.tournamentId !== tournamentId) {
    return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }
  const event = await prisma.event.findUnique({
    where: { id: match.stage.tournament.eventId },
    select: { organizationId: true },
  });
  const organizationId = event?.organizationId ?? null;
  if (!organizationId) {
    return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const organizationRole = await getOrganizationRole(data.user.id, match.stage.tournament.eventId);
  if (organizationRole && typeof organizationRole === "object" && "error" in organizationRole) {
    return jsonWrap(organizationRole, { status: organizationRole.status ?? 403 });
  }
  const liveOperatorRoles: OrganizationMemberRole[] = [
    OrganizationMemberRole.OWNER,
    OrganizationMemberRole.CO_OWNER,
    OrganizationMemberRole.ADMIN,
    OrganizationMemberRole.STAFF,
  ];
  if (!organizationRole || !liveOperatorRoles.includes(organizationRole)) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }
  const isAdmin =
    organizationRole === OrganizationMemberRole.OWNER ||
    organizationRole === OrganizationMemberRole.CO_OWNER ||
    organizationRole === OrganizationMemberRole.ADMIN;
  if (match.status === "DISPUTED" && !isAdmin) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { score, status, winnerPairingId, expectedUpdatedAt, force } = body ?? {};
  const nextStatus =
    status && Object.values(TournamentMatchStatus).includes(status) ? (status as TournamentMatchStatus) : undefined;

  try {
    const outbox = await prisma.$transaction(async (tx) => {
      const outbox = await recordOutboxEvent(
        {
          eventType: "TOURNAMENT_MATCH_RESULT_REQUESTED",
          payload: {
            matchId,
            score,
            status: nextStatus ?? null,
            winnerPairingId: winnerPairingId ?? null,
            expectedUpdatedAt: expectedUpdatedAt ?? null,
            userId: data.user.id,
            force: force === true,
          },
        },
        tx,
      );

      await appendEventLog(
        {
          eventId: outbox.eventId,
          organizationId,
          eventType: "TOURNAMENT_MATCH_RESULT_REQUESTED",
          idempotencyKey: outbox.eventId,
          actorUserId: data.user.id,
          sourceType: SourceType.MATCH,
          sourceId: String(matchId),
          correlationId: outbox.eventId,
          payload: {
            matchId,
            tournamentId,
            eventId: match.stage.tournament.eventId,
          },
        },
        tx,
      );
      return outbox;
    });

    return jsonWrap({ ok: true, queued: true, eventId: outbox.eventId }, { status: 202 });
  } catch (err) {
    if (err instanceof Error && err.message === "MATCH_CONFLICT") {
      return jsonWrap({ ok: false, error: "MATCH_CONFLICT", code: "VERSION_CONFLICT" }, { status: 409 });
    }
    if (
      err instanceof Error &&
      ["INVALID_SCORE", "INVALID_LIMIT", "LIMIT_EXCEEDED", "TIE_NOT_ALLOWED", "NO_WINNER"].includes(err.message)
    ) {
      return jsonWrap({ ok: false, error: err.message }, { status: 400 });
    }
    if (err instanceof Error && err.message === "MATCH_LOCKED") {
      return jsonWrap({ ok: false, error: "MATCH_LOCKED" }, { status: 409 });
    }
    if (err instanceof Error && err.message === "MISSING_VERSION") {
      return jsonWrap({ ok: false, error: "MISSING_VERSION" }, { status: 400 });
    }
    if (err instanceof Error && err.message === "MATCH_NOT_FOUND") {
      return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }
    console.error("[match_result] erro", err);
    return jsonWrap({ ok: false, error: "UPDATE_FAILED" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
