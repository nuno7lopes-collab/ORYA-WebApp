export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { OrganizerMemberRole, PadelMatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { isValidScore } from "@/lib/padel/validation";
import {
  queueMatchChanged,
  queueMatchResult,
  queueNextOpponent,
} from "@/domain/notifications/tournament";
import { isPadelStaff } from "@/lib/padel/staff";

const allowedRoles: OrganizerMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const eventId = Number(req.nextUrl.searchParams.get("eventId"));
  if (!Number.isFinite(eventId)) return NextResponse.json({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  const matches = await prisma.padelMatch.findMany({
    where: { eventId },
    include: {
      pairingA: { include: { slots: { include: { playerProfile: true } } } },
      pairingB: { include: { slots: { include: { playerProfile: true } } } },
    },
    orderBy: [
      { roundType: "asc" },
      { groupLabel: "asc" },
      { startTime: "asc" },
      { id: "asc" },
    ],
  });

  return NextResponse.json({ ok: true, items: matches }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const matchId = typeof body.id === "number" ? body.id : Number(body.id);
  const statusRaw = typeof body.status === "string" ? (body.status as PadelMatchStatus) : undefined;
  const scoreRaw = body.score;
  const startAtRaw = body.startAt ? new Date(body.startAt as string) : undefined;
  const courtIdRaw = typeof body.courtId === "number" ? body.courtId : undefined;

  if (!Number.isFinite(matchId)) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const match = await prisma.padelMatch.findUnique({
    where: { id: matchId },
    include: { event: { select: { organizerId: true } } },
  });
  if (!match || !match.event?.organizerId) return NextResponse.json({ ok: false, error: "MATCH_NOT_FOUND" }, { status: 404 });

  const { organizer, membership } = await getActiveOrganizerForUser(user.id, {
    organizerId: match.event.organizerId,
    roles: allowedRoles,
  });
  const isStaff = await isPadelStaff(user.id, match.event.organizerId);
  if (!organizer && !isStaff) return NextResponse.json({ ok: false, error: "NO_ORGANIZER" }, { status: 403 });

  if (scoreRaw && !isValidScore(scoreRaw)) {
    return NextResponse.json({ ok: false, error: "INVALID_SCORE" }, { status: 400 });
  }

  let winnerPairingId: number | null = null;
  if (scoreRaw && typeof scoreRaw === "object" && "sets" in (scoreRaw as { sets?: unknown })) {
    const rawSets = (scoreRaw as { sets?: unknown }).sets;
    const sets = Array.isArray(rawSets) ? rawSets : [];
    let winsA = 0;
    let winsB = 0;
    sets.forEach((s) => {
      const set = s as { teamA?: number; teamB?: number };
      if (Number.isFinite(set.teamA) && Number.isFinite(set.teamB)) {
        const a = Number(set.teamA);
        const b = Number(set.teamB);
        if (a > b) winsA += 1;
        else if (b > a) winsB += 1;
      }
    });
    if (winsA > winsB && match.pairingAId) winnerPairingId = match.pairingAId;
    if (winsB > winsA && match.pairingBId) winnerPairingId = match.pairingBId;
  }

  const updated = await prisma.padelMatch.update({
    where: { id: matchId },
    data: {
      status: statusRaw ?? match.status,
      score: scoreRaw ?? match.score,
      scoreSets: typeof scoreRaw === "object" && scoreRaw && "sets" in (scoreRaw as { sets?: unknown })
        ? (scoreRaw as { sets?: unknown }).sets
        : match.scoreSets,
      winnerPairingId: winnerPairingId ?? match.winnerPairingId,
      startTime: startAtRaw ?? match.startTime,
      courtNumber: courtIdRaw ?? match.courtNumber,
    },
    include: {
      pairingA: { include: { slots: { include: { playerProfile: true } } } },
      pairingB: { include: { slots: { include: { playerProfile: true } } } },
    },
  });

  const involvedUserIds = [
    ...((updated.pairingA?.slots ?? []).map((s) => s.profileId).filter(Boolean) as string[]),
    ...((updated.pairingB?.slots ?? []).map((s) => s.profileId).filter(Boolean) as string[]),
  ];

  // Notificações: mudança de horário/court
  await queueMatchChanged({
    userIds: involvedUserIds,
    matchId: updated.id,
    startAt: updated.startTime ?? null,
    courtId: updated.courtNumber ?? null,
  });

  // Notificações de resultado + próximo adversário
  if (winnerPairingId) {
    await queueMatchResult(involvedUserIds, updated.id, updated.eventId);
    await queueNextOpponent(involvedUserIds, updated.id, updated.eventId);
  }

  return NextResponse.json({ ok: true, match: updated }, { status: 200 });
}
