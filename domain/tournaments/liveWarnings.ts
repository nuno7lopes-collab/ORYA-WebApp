import { validateScore } from "@/domain/tournaments/matchRules";

type Warning =
  | { type: "REQUIRES_ACTION"; pairingId: number }
  | { type: "INVALID_SCORE"; matchId: number }
  | { type: "MISSING_COURT"; matchId: number }
  | { type: "MISSING_START"; matchId: number };

export function computeLiveWarnings(opts: {
  matches: Array<{ id: number; courtId: number | null; startAt: Date | null; score: any; status: string }>;
  pairings: Array<{ id: number; guaranteeStatus?: string | null }>;
  startThresholdMinutes?: number;
}): Warning[] {
  const { matches, pairings, startThresholdMinutes = 60 } = opts;
  const warnings: Warning[] = [];

  // guarantee REQUIRES_ACTION
  pairings.forEach((p) => {
    if ((p.guaranteeStatus || "").toUpperCase() === "REQUIRES_ACTION") {
      warnings.push({ type: "REQUIRES_ACTION", pairingId: p.id });
    }
  });

  // matches: missing court/start + score inválido
  const threshold = new Date(Date.now() + startThresholdMinutes * 60 * 1000);
  matches.forEach((m) => {
    if (!m.courtId) warnings.push({ type: "MISSING_COURT", matchId: m.id });
    if (!m.startAt || m.startAt < threshold) warnings.push({ type: "MISSING_START", matchId: m.id });
    if ((m.status || "").toUpperCase() === "DONE") {
      const sets = Array.isArray(m.score?.sets) ? m.score.sets : [];
      if (sets.length === 0) return;
      const res = validateScore({ sets } as any);
      if (!res.ok) warnings.push({ type: "INVALID_SCORE", matchId: m.id });
    }
  });

  return warnings;
}
