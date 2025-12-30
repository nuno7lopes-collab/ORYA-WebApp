import seedrandom from "seedrandom";
import { TournamentMatchStatus } from "@prisma/client";

export type TieBreakRule = "WINS" | "SET_DIFF" | "GAME_DIFF" | "HEAD_TO_HEAD" | "RANDOM";

export type MatchResult = {
  pairing1Id: number;
  pairing2Id: number;
  status: TournamentMatchStatus;
  score?: { sets?: Array<{ a: number; b: number }>; games?: Array<{ a: number; b: number }> };
};

export type Standing = {
  pairingId: number;
  wins: number;
  losses: number;
  setDiff: number;
  gameDiff: number;
  headToHead: Record<number, number>; // pairingId -> wins against
};

export function computeGroupStandings(
  pairings: number[],
  matches: MatchResult[],
  rules: TieBreakRule[],
  seed?: string,
): Standing[] {
  const rng = seedrandom(seed || `${Date.now()}`);
  const map = new Map<number, Standing>();
  pairings.forEach((p) =>
    map.set(p, { pairingId: p, wins: 0, losses: 0, setDiff: 0, gameDiff: 0, headToHead: {} }),
  );

  const finished = matches.filter((m) => m.status === "DONE");
  for (const m of finished) {
    const s1 = map.get(m.pairing1Id);
    const s2 = map.get(m.pairing2Id);
    if (!s1 || !s2) continue;
    const sets = m.score?.sets ?? [];
    let aSets = 0;
    let bSets = 0;
    let aGames = 0;
    let bGames = 0;
    for (const set of sets) {
      aSets += set.a;
      bSets += set.b;
      aGames += set.a;
      bGames += set.b;
    }
    if (aSets > bSets) {
      s1.wins += 1;
      s2.losses += 1;
      s1.headToHead[m.pairing2Id] = (s1.headToHead[m.pairing2Id] ?? 0) + 1;
    } else if (bSets > aSets) {
      s2.wins += 1;
      s1.losses += 1;
      s2.headToHead[m.pairing1Id] = (s2.headToHead[m.pairing1Id] ?? 0) + 1;
    }
    s1.setDiff += aSets - bSets;
    s2.setDiff += bSets - aSets;
    s1.gameDiff += aGames - bGames;
    s2.gameDiff += bGames - aGames;
  }

  const standings = Array.from(map.values());

  const comparator = (a: Standing, b: Standing) => {
    for (const rule of rules) {
      if (rule === "WINS") {
        if (a.wins !== b.wins) return b.wins - a.wins;
      } else if (rule === "SET_DIFF") {
        if (a.setDiff !== b.setDiff) return b.setDiff - a.setDiff;
      } else if (rule === "GAME_DIFF") {
        if (a.gameDiff !== b.gameDiff) return b.gameDiff - a.gameDiff;
      } else if (rule === "HEAD_TO_HEAD") {
        const aHH = a.headToHead[b.pairingId] ?? 0;
        const bHH = b.headToHead[a.pairingId] ?? 0;
        if (aHH !== bHH) return bHH - aHH;
      } else if (rule === "RANDOM") {
        const r = rng() - 0.5;
        if (r !== 0) return r > 0 ? 1 : -1;
      }
    }
    return 0;
  };

  return standings.sort(comparator);
}
