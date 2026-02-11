import { resolvePadelMatchStats } from "@/domain/padel/score";

export type UserPadelMatchInput = {
  pairingSide: "A" | "B" | null;
  status?: string | null;
  scoreSets?: unknown;
  score?: unknown;
};

export type UserPadelStats = {
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
};

export function computeUserPadelStats(matches: UserPadelMatchInput[]): UserPadelStats {
  let matchesPlayed = 0;
  let wins = 0;
  let losses = 0;

  matches.forEach((match) => {
    if (!match || !match.pairingSide) return;
    const status = typeof match.status === "string" ? match.status.toUpperCase() : "";
    if (status && status !== "DONE") return;
    const stats = resolvePadelMatchStats(match.scoreSets, match.score);
    if (!stats || !stats.winner) return;
    matchesPlayed += 1;
    if (stats.winner === match.pairingSide) {
      wins += 1;
    } else {
      losses += 1;
    }
  });

  const winRate = matchesPlayed > 0 ? wins / matchesPlayed : 0;
  return { matchesPlayed, wins, losses, winRate };
}
