import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { computeDedupeKey } from "@/domain/notifications/matchChangeDedupe";
import { canNotify } from "@/domain/tournaments/schedulePolicy";
import { readNumericParam } from "@/lib/routeParams";
import { ensureGroupMemberRole } from "@/lib/organizationGroupAccess";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function ensureOrganizationAccess(userId: string, eventId: number) {
  const evt = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      organizationId: true,
      organization: { select: { officialEmail: true, officialEmailVerifiedAt: true } },
    },
  });
  if (!evt?.organizationId) return false;
  const emailGate = ensureOrganizationEmailVerified(evt.organization ?? {});
  if (!emailGate.ok) return false;
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { onboardingDone: true, fullName: true, username: true },
  });
  const hasUserOnboarding =
    profile?.onboardingDone ||
    (Boolean(profile?.fullName?.trim()) && Boolean(profile?.username?.trim()));
  if (!hasUserOnboarding) return false;
  const access = await ensureGroupMemberRole({
    organizationId: evt.organizationId,
    userId,
    ROLE_ALLOWLIST: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
  });
  return access.ok;
}

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string; matchId: string }> }) {
  const resolved = await params;
  const tournamentId = readNumericParam(resolved?.id, req, "tournaments");
  const matchId = readNumericParam(resolved?.matchId, req, "matches");
  if (tournamentId === null || matchId === null) {
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

  const authorized = await ensureOrganizationAccess(data.user.id, match.stage.tournament.eventId);
  if (!authorized) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const notifyAllowed = canNotify(match.status);
  if (!notifyAllowed) {
    return jsonWrap({ ok: false, error: "NOTIFY_BLOCKED" }, { status: 409 });
  }

  const dedupeKey = computeDedupeKey(match.id, match.startAt, match.courtId);
  try {
    await prisma.matchNotification["create"]({
      data: {
        matchId: match.id,
        dedupeKey,
        payload: { matchId: match.id, startAt: match.startAt, courtId: match.courtId },
      },
    });
  } catch (err) {
    // UNIQUE violation => já notificado
    return jsonWrap({ ok: true, deduped: true }, { status: 200 });
  }

  // Aqui seria o envio real (push/email). Guardamos só registo.
  return jsonWrap({ ok: true, deduped: false }, { status: 200 });
}
export const POST = withApiEnvelope(_POST);