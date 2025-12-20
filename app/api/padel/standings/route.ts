import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
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

    // Standings por grupos (roundType=GROUPS) com desempates
    const matches = await prisma.padelMatch.findMany({
      where: { eventId, roundType: "GROUPS", status: "DONE" },
      select: {
        id: true,
        pairingAId: true,
        pairingBId: true,
        scoreSets: true,
        groupLabel: true,
      },
    });
    const pairings = await prisma.padelPairing.findMany({
      where: { eventId },
      select: { id: true, categoryId: true },
    });

    type StandingRow = {
      pairingId: number;
      points: number;
      wins: number;
      losses: number;
      setDiff: number;
      gameDiff: number;
      setsFor: number;
    };
    const groups = new Map<string, Record<number, StandingRow>>();

    const ensure = (group: string, pid: number) => {
      if (!groups.has(group)) groups.set(group, {});
      const map = groups.get(group)!;
      if (!map[pid]) {
        map[pid] = { pairingId: pid, points: 0, wins: 0, losses: 0, setDiff: 0, gameDiff: 0, setsFor: 0 };
      }
      return map[pid];
    };

    // Pré-criar linhas para parings existentes
    pairings.forEach((p) => ensure("A", p.id)); // fallback group if none

    // head-to-head quick map: group+pair => winner (1 for A, -1 for B, 0 tie)
    const headToHead = new Map<string, number>();

    matches.forEach((m) => {
      if (!m.pairingAId || !m.pairingBId) return;
      const group = m.groupLabel || "A";
      const aRow = ensure(group, m.pairingAId);
      const bRow = ensure(group, m.pairingBId);
      const sets = Array.isArray(m.scoreSets) ? m.scoreSets : [];
      let aSets = 0;
      let bSets = 0;
      let aGames = 0;
      let bGames = 0;
      sets.forEach((s: any) => {
        if (Number.isFinite(s.teamA) && Number.isFinite(s.teamB)) {
          const a = Number(s.teamA);
          const b = Number(s.teamB);
          aGames += a;
          bGames += b;
          if (a > b) aSets += 1;
          else if (b > a) bSets += 1;
        }
      });
      if (aSets === bSets) return;
      const winnerIsA = aSets > bSets;
      const key = `${group}:${Math.min(m.pairingAId, m.pairingBId)}:${Math.max(m.pairingAId, m.pairingBId)}`;
      headToHead.set(key, winnerIsA ? 1 : -1);
      const winRow = winnerIsA ? aRow : bRow;
      const loseRow = winnerIsA ? bRow : aRow;
      winRow.points += 2;
      winRow.wins += 1;
      winRow.setDiff += (winnerIsA ? aSets : bSets) - (winnerIsA ? bSets : aSets);
      winRow.gameDiff += (winnerIsA ? aGames : bGames) - (winnerIsA ? bGames : aGames);
      winRow.setsFor += winnerIsA ? aSets : bSets;

      loseRow.losses += 1;
      loseRow.points += 0;
      loseRow.setDiff += (winnerIsA ? bSets : aSets) - (winnerIsA ? aSets : bSets);
      loseRow.gameDiff += (winnerIsA ? bGames : aGames) - (winnerIsA ? aGames : bGames);
      loseRow.setsFor += winnerIsA ? bSets : aSets;
    });

    const standings: Record<string, Array<{ pairingId: number; points: number; wins: number; losses: number; setsFor: number; setsAgainst: number }>> = {};
    groups.forEach((rows, label) => {
      const list = Object.values(rows);

      const sortWithMiniLeague = (entries: StandingRow[]) => {
        return entries.sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          if (b.points === a.points) {
            const key = `${label}:${Math.min(a.pairingId, b.pairingId)}:${Math.max(a.pairingId, b.pairingId)}`;
            const h2h = headToHead.get(key);
            if (h2h === 1) return -1; // a venceu b
            if (h2h === -1) return 1; // b venceu a
          }
          if (b.setDiff !== a.setDiff) return b.setDiff - a.setDiff;
          if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
          if (b.setsFor !== a.setsFor) return b.setsFor - a.setsFor;
          return a.pairingId - b.pairingId;
        });
      };

      // mini-liga para empates a 3+
      const groupedByPoints = list.reduce<Record<number, StandingRow[]>>((acc, row) => {
        acc[row.points] = acc[row.points] || [];
        acc[row.points].push(row);
        return acc;
      }, {});

      const resolved: StandingRow[] = [];
      const pointKeys = Object.keys(groupedByPoints)
        .map(Number)
        .sort((a, b) => b - a);

      pointKeys.forEach((pts) => {
        const cluster = groupedByPoints[pts];
        if (cluster.length <= 1) {
          resolved.push(...cluster);
        } else {
          // mini-liga stats
          const mini: StandingRow[] = cluster.map((r) => ({ ...r, points: 0, setDiff: 0, gameDiff: 0, setsFor: 0 }));
          const miniMap = new Map<number, StandingRow>();
          mini.forEach((m) => miniMap.set(m.pairingId, m));

          matches
            .filter((m) => m.groupLabel === label && cluster.some((c) => c.pairingId === m.pairingAId || c.pairingId === m.pairingBId))
            .forEach((m) => {
              if (!m.pairingAId || !m.pairingBId) return;
              if (!miniMap.has(m.pairingAId) || !miniMap.has(m.pairingBId)) return;
              const sets = Array.isArray(m.scoreSets) ? m.scoreSets : [];
              let aSets = 0;
              let bSets = 0;
              let aGames = 0;
              let bGames = 0;
              sets.forEach((s: any) => {
                if (Number.isFinite(s.teamA) && Number.isFinite(s.teamB)) {
                  const a = Number(s.teamA);
                  const b = Number(s.teamB);
                  aGames += a;
                  bGames += b;
                  if (a > b) aSets += 1;
                  else if (b > a) bSets += 1;
                }
              });
              if (aSets === bSets) return;
              const winA = aSets > bSets;
              const winRow = miniMap.get(winA ? m.pairingAId : m.pairingBId)!;
              const loseRow = miniMap.get(winA ? m.pairingBId : m.pairingAId)!;
              winRow.points += 2;
              winRow.setDiff += (winA ? aSets : bSets) - (winA ? bSets : aSets);
              winRow.gameDiff += (winA ? aGames : bGames) - (winA ? bGames : aGames);
              winRow.setsFor += winA ? aSets : bSets;
              loseRow.points += 0;
              loseRow.setDiff += (winA ? bSets : aSets) - (winA ? aSets : bSets);
              loseRow.gameDiff += (winA ? bGames : aGames) - (winA ? aGames : bGames);
              loseRow.setsFor += winA ? bSets : aSets;
            });

          const sortedCluster = sortWithMiniLeague(mini);
          resolved.push(...sortedCluster.map((m) => rows[m.pairingId]));
        }
      });

      const finalSorted = sortWithMiniLeague(resolved);
      standings[label] = finalSorted.map((r) => ({
        pairingId: r.pairingId,
        points: r.points,
        wins: r.wins,
        losses: r.losses,
        setsFor: r.setsFor,
        setsAgainst: r.setsFor - r.setDiff,
      }));
    });

    return NextResponse.json({ ok: true, standings });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("[padel/standings] error", err);
    return NextResponse.json({ ok: false, error: "Erro ao gerar standings." }, { status: 500 });
  }
}
