import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { getTournamentStructure } from "@/domain/tournaments/structureData";
import { summarizeMatchStatus, computeStandingsForGroup } from "@/domain/tournaments/structure";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { type TieBreakRule } from "@/domain/tournaments/standings";
import { readNumericParam } from "@/lib/routeParams";
import { ensureGroupMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { OrganizationModule } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function ensureOrganizationAccess(userId: string, eventId: number) {
  const evt = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organizationId: true },
  });
  if (!evt?.organizationId) return false;
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

async function _GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const id = readNumericParam(resolved?.id, req, "tournaments");
  if (id === null) return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const tournament = await getTournamentStructure(id);
  if (!tournament) return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const authorized = await ensureOrganizationAccess(data.user.id, tournament.event.id);
  if (!authorized) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const tieBreakRules: TieBreakRule[] = Array.isArray(tournament.tieBreakRules)
    ? (tournament.tieBreakRules as TieBreakRule[])
    : (["WINS", "SET_DIFF", "GAME_DIFF", "HEAD_TO_HEAD", "RANDOM"] as TieBreakRule[]);

  const payload = {
    id: tournament.id,
    event: tournament.event,
    format: tournament.format,
    stages: tournament.stages.map((s) => ({
      id: s.id,
      name: s.name,
      stageType: s.stageType,
      groups: s.groups.map((g) => ({
        id: g.id,
        name: g.name,
        standings: computeStandingsForGroup(g.matches, tieBreakRules, tournament.generationSeed || undefined),
        matches: g.matches.map((m) => ({
          id: m.id,
          pairing1Id: m.pairing1Id,
          pairing2Id: m.pairing2Id,
          round: m.round,
          roundLabel: m.roundLabel,
          startAt: m.startAt,
          courtId: m.courtId,
          status: m.status,
          statusLabel: summarizeMatchStatus(m.status),
          score: m.score,
          nextMatchId: m.nextMatchId,
          nextSlot: m.nextSlot,
        })),
      })),
      matches: s.matches
        .filter((m) => !m.groupId)
        .map((m) => ({
          id: m.id,
          pairing1Id: m.pairing1Id,
          pairing2Id: m.pairing2Id,
          round: m.round,
          roundLabel: m.roundLabel,
          startAt: m.startAt,
          courtId: m.courtId,
          status: m.status,
          statusLabel: summarizeMatchStatus(m.status),
          score: m.score,
          nextMatchId: m.nextMatchId,
          nextSlot: m.nextSlot,
        })),
    })),
  };

  const res = jsonWrap({ ok: true, tournament: payload }, { status: 200 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
export const GET = withApiEnvelope(_GET);
