import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { ensureGroupMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { OrganizationModule } from "@prisma/client";
import { updateTournament } from "@/domain/tournaments/commands";
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

function normalizeLimit(value: unknown) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const rounded = Math.floor(num);
  if (rounded < 1) return null;
  return Math.min(rounded, 99);
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

  const authorized = await ensureOrganizationAccess(authData.user.id, tournament.eventId);
  if (!authorized) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const defaultLimit = normalizeLimit(body?.defaultLimit);
  const rawRoundLimits = body?.roundLimits;
  const roundLimits: Record<string, number> = {};
  if (rawRoundLimits && typeof rawRoundLimits === "object") {
    Object.entries(rawRoundLimits as Record<string, unknown>).forEach(([key, value]) => {
      const round = Number(key);
      if (!Number.isFinite(round) || round <= 0) return;
      const limit = normalizeLimit(value);
      if (limit === null) return;
      roundLimits[String(round)] = limit;
    });
  }

  const config = (tournament.config as Record<string, unknown> | null) ?? {};
  const nextConfig = {
    ...config,
    goalLimits: {
      defaultLimit,
      roundLimits: Object.keys(roundLimits).length ? roundLimits : null,
    },
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

  const res = jsonWrap(
    {
      ok: true,
      goalLimits: {
        defaultLimit,
        roundLimits: Object.keys(roundLimits).length ? roundLimits : null,
      },
    },
    { status: 200 },
  );
  res.headers.set("Cache-Control", "no-store");
  return res;
}
export const POST = withApiEnvelope(_POST);
