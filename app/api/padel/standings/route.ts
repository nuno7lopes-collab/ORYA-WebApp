import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated } from "@/lib/security";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const eventId = Number(req.nextUrl.searchParams.get("eventId"));
    if (!Number.isFinite(eventId)) {
      return NextResponse.json({ ok: false, error: "INVALID_EVENT" }, { status: 400 });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId, isDeleted: false },
      select: { organizerId: true },
    });
    if (!event?.organizerId) {
      return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
    }

    const { organizer } = await getActiveOrganizerForUser(user.id, {
      organizerId: event.organizerId,
      roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
    });
    if (!organizer) return NextResponse.json({ ok: false, error: "NO_ORGANIZER" }, { status: 403 });

    const matches = await prisma.padelMatch.findMany({
      where: { eventId },
      select: {
        id: true,
        categoryId: true,
        pairingAId: true,
        pairingBId: true,
        winnerPairingId: true,
        status: true,
        scoreSets: true,
        groupLabel: true,
      },
    });

    const pairings = await prisma.padelPairing.findMany({
      where: { eventId },
      select: { id: true, categoryId: true },
    });

    type Standing = {
      pairingId: number;
      played: number;
      wins: number;
      losses: number;
      points: number;
      setsFor: number;
      setsAgainst: number;
      groupLabel: string | null;
      categoryId: number | null;
    };

    const standings = new Map<number, Standing>();
    const add = (pid: number, catId: number | null, group: string | null) => {
      if (!standings.has(pid)) {
        standings.set(pid, {
          pairingId: pid,
          played: 0,
          wins: 0,
          losses: 0,
          points: 0,
          setsFor: 0,
          setsAgainst: 0,
          groupLabel: group,
          categoryId: catId,
        });
      }
    };

    pairings.forEach((p) => add(p.id, p.categoryId ?? null, null));

    matches.forEach((m) => {
      if (!m.pairingAId || !m.pairingBId) return;
      add(m.pairingAId, m.categoryId ?? null, m.groupLabel ?? null);
      add(m.pairingBId, m.categoryId ?? null, m.groupLabel ?? null);
      const sa = standings.get(m.pairingAId)!;
      const sb = standings.get(m.pairingBId)!;

      if (m.status !== "DONE" && m.status !== "FINISHED") return;
      sa.played += 1;
      sb.played += 1;

      const sets = Array.isArray(m.scoreSets) ? m.scoreSets : [];
      let winsA = 0;
      let winsB = 0;
      sets.forEach((s: any) => {
        if (Number.isFinite(s.teamA) && Number.isFinite(s.teamB)) {
          sa.setsFor += s.teamA;
          sa.setsAgainst += s.teamB;
          sb.setsFor += s.teamB;
          sb.setsAgainst += s.teamA;
          if (s.teamA > s.teamB) winsA += 1;
          else if (s.teamB > s.teamA) winsB += 1;
        }
      });
      if (m.winnerPairingId) {
        if (m.winnerPairingId === m.pairingAId) {
          sa.wins += 1;
          sa.points += 2;
          sb.losses += 1;
          sb.points += 1;
        } else if (m.winnerPairingId === m.pairingBId) {
          sb.wins += 1;
          sb.points += 2;
          sa.losses += 1;
          sa.points += 1;
        }
      } else {
        if (winsA > winsB) {
          sa.wins += 1;
          sa.points += 2;
          sb.losses += 1;
          sb.points += 1;
        } else if (winsB > winsA) {
          sb.wins += 1;
          sb.points += 2;
          sa.losses += 1;
          sa.points += 1;
        }
      }
    });

    const grouped: Record<string, Standing[]> = {};
    standings.forEach((st) => {
      const key = `${st.categoryId ?? "none"}::${st.groupLabel ?? "default"}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(st);
    });

    Object.values(grouped).forEach((arr) => {
      arr.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const setDiffA = a.setsFor - a.setsAgainst;
        const setDiffB = b.setsFor - b.setsAgainst;
        if (setDiffB !== setDiffA) return setDiffB - setDiffA;
        return b.wins - a.wins;
      });
    });

    return NextResponse.json({ ok: true, standings: grouped });
  } catch (err) {
    console.error("[padel/standings] error", err);
    return NextResponse.json({ ok: false, error: "Erro ao gerar standings." }, { status: 500 });
  }
}
