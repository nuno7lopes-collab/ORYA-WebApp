import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { OrganizationModule, Prisma, TournamentMatchStatus } from "@prisma/client";
import { ensureGroupMemberModuleAccess } from "@/lib/organizationMemberAccess";
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
  const access = await ensureGroupMemberModuleAccess({
    organizationId: evt.organizationId,
    userId,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  return access.ok;
}

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string; matchId: string }> }) {
  const resolved = await params;
  const tournamentId = Number(resolved?.id);
  const matchId = Number(resolved?.matchId);
  if (!Number.isFinite(tournamentId) || !Number.isFinite(matchId)) {
    return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const match = await prisma.tournamentMatch.findUnique({
    where: { id: matchId },
    include: {
      stage: { select: { tournamentId: true, tournament: { select: { eventId: true, generationSeed: true } } } },
    },
  });
  if (!match || match.stage.tournamentId !== tournamentId) {
    return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const authorized = await ensureOrganizationAccess(authData.user.id, match.stage.tournament.eventId);
  if (!authorized) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { startAt, courtId, status, score, roundLabel } = body ?? {};

  const updates: Record<string, unknown> = {};
  if (startAt) updates.startAt = new Date(startAt);
  if (typeof courtId === "number") updates.courtId = courtId;
  if (roundLabel) updates.roundLabel = roundLabel;
  if (status && Object.values(TournamentMatchStatus).includes(status)) updates.status = status as TournamentMatchStatus;
  if (score) updates.score = score;

  if (Object.keys(updates).length === 0) {
    return jsonWrap({ ok: false, error: "NO_CHANGES" }, { status: 400 });
  }

  const before = {
    startAt: match.startAt,
    courtId: match.courtId,
    status: match.status,
    score: match.score,
    roundLabel: match.roundLabel,
  };

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.tournamentMatch.update({
      where: { id: matchId },
      data: updates,
    });

    await tx.tournamentAuditLog["create"]({
      data: {
        tournamentId,
        userId: authData.user.id,
        action: "EDIT_MATCH",
        payloadBefore: before as Prisma.InputJsonValue,
        payloadAfter: updates as Prisma.InputJsonValue,
      },
    });

    return res;
  });

  return jsonWrap({ ok: true, match: updated }, { status: 200 });
}
export const POST = withApiEnvelope(_POST);
