export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { OrganizerMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { PadelPointsTable, isValidScore } from "@/lib/padel/validation";

const allowedRoles: OrganizerMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

export async function GET(req: NextRequest) {
  const organizerId = req.nextUrl.searchParams.get("organizerId");
  const eventId = req.nextUrl.searchParams.get("eventId");

  if (eventId) {
    const eId = Number(eventId);
    if (!Number.isFinite(eId)) return NextResponse.json({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

    const entries = await prisma.padelRankingEntry.findMany({
      where: { eventId: eId },
      include: { player: true },
      orderBy: [{ points: "desc" }],
    });
    const items = entries.map((row, idx) => ({
      position: idx + 1,
      points: row.points,
      player: {
        id: row.player.id,
        fullName: row.player.fullName,
        level: row.player.level,
      },
    }));
    return NextResponse.json({ ok: true, items }, { status: 200 });
  }

  if (!organizerId) {
    return NextResponse.json({ ok: false, error: "MISSING_ORGANIZER" }, { status: 400 });
  }
  const oId = Number(organizerId);
  if (!Number.isFinite(oId)) {
    return NextResponse.json({ ok: false, error: "INVALID_ORGANIZER" }, { status: 400 });
  }

  const entries = await prisma.padelRankingEntry.findMany({
    where: { organizerId: oId },
    include: { player: true },
  });

  const aggregated = Object.values(
    entries.reduce<Record<number, { player: any; points: number }>>((acc, row) => {
      const key = row.playerId;
      if (!acc[key]) acc[key] = { player: row.player, points: 0 };
      acc[key].points += row.points;
      return acc;
    }, {}),
  ).sort((a, b) => b.points - a.points);

  const items = aggregated.map((item, idx) => ({
    position: idx + 1,
    points: item.points,
    player: {
      id: item.player.id,
      fullName: item.player.fullName,
      level: item.player.level,
    },
  }));

  return NextResponse.json({ ok: true, items }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const eventId = typeof body.eventId === "number" ? body.eventId : Number(body.eventId);
  if (!Number.isFinite(eventId)) return NextResponse.json({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: { id: true, organizerId: true },
  });
  if (!event || !event.organizerId) return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  const { organizer } = await getActiveOrganizerForUser(user.id, {
    organizerId: event.organizerId,
    roles: allowedRoles,
  });
  if (!organizer) return NextResponse.json({ ok: false, error: "NO_ORGANIZER" }, { status: 403 });

  const config = await prisma.padelTournamentConfig.findUnique({
    where: { eventId },
    select: { ruleSetId: true },
  });
  const ruleSet = config?.ruleSetId
    ? await prisma.padelRuleSet.findUnique({ where: { id: config.ruleSetId } })
    : null;
  const pointsTable: PadelPointsTable = (ruleSet?.pointsTable as any) || { WIN: 3, LOSS: 0 };

  const matches = await prisma.padelMatch.findMany({
    where: { eventId, status: "DONE" },
    include: {
      teamA: { include: { player1: true, player2: true } },
      teamB: { include: { player1: true, player2: true } },
    },
  });

  const playerPoints: Record<number, number> = {};
  const winPts = pointsTable.WIN ?? 3;
  const lossPts = pointsTable.LOSS ?? 0;

  matches.forEach((m) => {
    if (!isValidScore(m.score) || !m.teamA || !m.teamB) return;
    const sets = m.score.sets || [];
    let aSets = 0;
    let bSets = 0;
    sets.forEach((s) => {
      if ((s as any).teamA > (s as any).teamB) aSets += 1;
      else if ((s as any).teamB > (s as any).teamA) bSets += 1;
    });
    if (aSets === bSets) return;
    const winner = aSets > bSets ? "A" : "B";
    const losers = winner === "A" ? "B" : "A";
    const winnerTeam = winner === "A" ? m.teamA : m.teamB;
    const loserTeam = losers === "A" ? m.teamA : m.teamB;

    const award = (team: typeof m.teamA, pts: number) => {
      if (team?.player1) playerPoints[team.player1.id] = (playerPoints[team.player1.id] ?? 0) + pts;
      if (team?.player2) playerPoints[team.player2.id] = (playerPoints[team.player2.id] ?? 0) + pts;
    };
    award(winnerTeam, winPts);
    award(loserTeam, lossPts);
  });

  await prisma.$transaction(async (tx) => {
    await tx.padelRankingEntry.deleteMany({ where: { eventId } });
    const entries = Object.entries(playerPoints).map(([playerIdStr, points]) => ({
      organizerId: event.organizerId!,
      eventId,
      playerId: Number(playerIdStr),
      points,
      position: null,
    }));
    if (entries.length > 0) {
      await tx.padelRankingEntry.createMany({ data: entries });
    }
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
