import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { OrganizationMemberRole } from "@prisma/client";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";
import { updateTournament } from "@/domain/tournaments/commands";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function getOrganizationRole(userId: string, eventId: number) {
  const evt = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organizationId: true },
  });
  if (!evt?.organizationId) return null;
  const organization = await prisma.organization.findUnique({
    where: { id: evt.organizationId },
    select: { officialEmail: true, officialEmailVerifiedAt: true },
  });
  if (!organization) return null;
  const emailGate = ensureOrganizationEmailVerified(organization, {
    reasonCode: "TOURNAMENTS_FEATURED_MATCH",
    organizationId: evt.organizationId,
  });
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

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const tournamentId = Number(resolved?.id);
  if (!Number.isFinite(tournamentId)) {
    return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, eventId: true, config: true },
  });
  if (!tournament) return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const organizationRole = await getOrganizationRole(authData.user.id, tournament.eventId);
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

  const body = await req.json().catch(() => ({}));
  const matchId = Number.isFinite(body?.matchId) ? Number(body.matchId) : null;

  if (matchId !== null) {
    const match = await prisma.tournamentMatch.findUnique({
      where: { id: matchId },
      select: { id: true, stage: { select: { tournamentId: true } } },
    });
    if (!match || match.stage.tournamentId !== tournamentId) {
      return jsonWrap({ ok: false, error: "MATCH_NOT_FOUND" }, { status: 404 });
    }
  }

  const config = (tournament.config as Record<string, unknown> | null) ?? {};
  const nextConfig = {
    ...config,
    featuredMatchId: matchId,
    featuredMatchUpdatedAt: new Date().toISOString(),
  };

  const result = await updateTournament({
    tournamentId,
    data: { config: nextConfig },
    actorUserId: authData.user.id,
  });
  if (!result.ok) {
    if (result.error === "EVENT_NOT_PADEL") {
      return jsonWrap({ ok: false, error: "EVENT_NOT_PADEL" }, { status: 400 });
    }
    return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const res = jsonWrap({ ok: true, featuredMatchId: matchId }, { status: 200 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
export const POST = withApiEnvelope(_POST);
