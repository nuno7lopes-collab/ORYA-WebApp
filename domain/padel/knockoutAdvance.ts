import { padel_match_status } from "@prisma/client";
import { buildWalkoverSets, type PadelScoreRules } from "@/domain/padel/score";

export type KnockoutMatchSnapshot = {
  id: number;
  roundLabel: string | null;
  pairingAId: number | null;
  pairingBId: number | null;
  winnerPairingId?: number | null;
};

export type KnockoutUpdateData = {
  pairingAId?: number | null;
  pairingBId?: number | null;
  winnerPairingId?: number | null;
  status?: padel_match_status;
  score?: Record<string, unknown>;
  scoreSets?: Array<{ teamA: number; teamB: number }>;
};

export type KnockoutUpdateFn = (
  matchId: number,
  data: KnockoutUpdateData,
) => Promise<{
  id: number;
  roundLabel: string | null;
  pairingAId: number | null;
  pairingBId: number | null;
  winnerPairingId: number | null;
}>;

export function extractBracketPrefix(label: string | null): "" | "A " | "B " {
  if (!label) return "";
  if (label.startsWith("A ")) return "A ";
  if (label.startsWith("B ")) return "B ";
  return "";
}

export function sortRoundsBySize(matches: Array<{ roundLabel: string | null }>) {
  const counts = matches.reduce<Record<string, number>>((acc, m) => {
    const key = (m.roundLabel || "?").trim();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const resolveOrder = (label: string) => {
    const trimmed = label.trim();
    const base = trimmed.startsWith("A ") || trimmed.startsWith("B ") ? trimmed.slice(2).trim() : trimmed;
    if (/^L\d+$/i.test(base)) {
      return Number(base.slice(1));
    }
    if (/^GF2$|^GRAND_FINAL_RESET$|^GRAND FINAL 2$/i.test(base)) {
      return Number.MAX_SAFE_INTEGER;
    }
    if (/^GF$|^GRAND_FINAL$|^GRAND FINAL$/i.test(base)) {
      return Number.MAX_SAFE_INTEGER - 1;
    }
    let size: number | null = null;
    if (base.startsWith("R")) {
      const parsed = Number(base.slice(1));
      size = Number.isFinite(parsed) ? parsed : null;
    } else if (base === "QUARTERFINAL") size = 8;
    else if (base === "SEMIFINAL") size = 4;
    else if (base === "FINAL") size = 2;
    return size !== null ? -size : Number.MAX_SAFE_INTEGER - 1;
  };

  return Object.keys(counts)
    .map((label) => ({ label, order: resolveOrder(label) }))
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
    .map((entry) => entry.label);
}

function createBracketAdvancer(
  matches: KnockoutMatchSnapshot[],
  updateMatch: KnockoutUpdateFn,
  bracketPrefix: "" | "A " | "B ",
) {
  const bracketMatches = matches.filter((m) => extractBracketPrefix(m.roundLabel) === bracketPrefix);
  const roundOrder = sortRoundsBySize(bracketMatches);
  const roundsMap = new Map<string, KnockoutMatchSnapshot[]>();
  roundOrder.forEach((label) => {
    roundsMap.set(
      label,
      bracketMatches.filter((m) => (m.roundLabel || "?") === label),
    );
  });

  const advance = async (fromMatchId: number, winner: number) => {
    const fromMatch = bracketMatches.find((m) => m.id === fromMatchId);
    if (!fromMatch) return;
    const currentRound = fromMatch.roundLabel || roundOrder[0] || null;
    if (!currentRound) return;
    const currentIdx = roundOrder.findIndex((label) => label === currentRound);
    if (currentIdx === -1 || currentIdx >= roundOrder.length - 1) return;

    const currentMatches = roundsMap.get(currentRound) || [];
    const nextRoundLabel = roundOrder[currentIdx + 1];
    const nextMatches = roundsMap.get(nextRoundLabel) || [];
    const currentPos = currentMatches.findIndex((m) => m.id === fromMatchId);
    if (currentPos === -1) return;
    const targetIdx = currentMatches.length === nextMatches.length ? currentPos : Math.floor(currentPos / 2);
    const target = nextMatches[targetIdx];
    if (!target) return;

    const updateTarget: KnockoutUpdateData = {};
    if (currentPos % 2 === 0) {
      if (!target.pairingAId) updateTarget.pairingAId = winner;
      else if (!target.pairingBId) updateTarget.pairingBId = winner;
    } else {
      if (!target.pairingBId) updateTarget.pairingBId = winner;
      else if (!target.pairingAId) updateTarget.pairingAId = winner;
    }
    if (Object.keys(updateTarget).length === 0) return;

    const targetUpdated = await updateMatch(target.id, updateTarget);
    target.pairingAId = targetUpdated.pairingAId;
    target.pairingBId = targetUpdated.pairingBId;
    target.winnerPairingId = targetUpdated.winnerPairingId ?? target.winnerPairingId ?? null;

  };

  return { bracketMatches, roundOrder, advance };
}

export async function advancePadelKnockoutWinner({
  matches,
  updateMatch,
  winnerMatchId,
  winnerPairingId,
}: {
  matches: KnockoutMatchSnapshot[];
  updateMatch: KnockoutUpdateFn;
  winnerMatchId: number;
  winnerPairingId: number;
}) {
  const winnerMatch = matches.find((m) => m.id === winnerMatchId);
  if (!winnerMatch) return;
  const bracketPrefix = extractBracketPrefix(winnerMatch.roundLabel);
  const { advance } = createBracketAdvancer(matches, updateMatch, bracketPrefix);
  await advance(winnerMatchId, winnerPairingId);
}

export async function autoAdvancePadelByes({
  matches,
  updateMatch,
  scoreRules,
}: {
  matches: KnockoutMatchSnapshot[];
  updateMatch: KnockoutUpdateFn;
  scoreRules?: PadelScoreRules | null;
}) {
  const prefixes = new Set(matches.map((m) => extractBracketPrefix(m.roundLabel)));
  const prefixesList = (prefixes.size > 0 ? Array.from(prefixes) : [""]) as Array<"" | "A " | "B ">;

  for (const prefix of prefixesList) {
    const { bracketMatches, roundOrder, advance } = createBracketAdvancer(matches, updateMatch, prefix);
    if (bracketMatches.length === 0 || roundOrder.length === 0) continue;

    for (const roundLabel of roundOrder) {
      const roundMatches = bracketMatches.filter((m) => (m.roundLabel || "?") === roundLabel);
      for (const match of roundMatches) {
        if (match.winnerPairingId) continue;
        const hasA = Boolean(match.pairingAId);
        const hasB = Boolean(match.pairingBId);
        if (hasA === hasB) continue;
        const autoWinner = match.pairingAId ?? match.pairingBId!;
        const winnerSide = match.pairingAId ? "A" : "B";
        const score = { resultType: "WALKOVER", winnerSide, walkover: true };
        const scoreSets = buildWalkoverSets(winnerSide, scoreRules ?? undefined);
        const updated = await updateMatch(match.id, {
          winnerPairingId: autoWinner,
          status: padel_match_status.DONE,
          score,
          scoreSets,
        });
        match.winnerPairingId = updated.winnerPairingId ?? autoWinner;
        match.pairingAId = updated.pairingAId;
        match.pairingBId = updated.pairingBId;
        await advance(match.id, autoWinner);
      }
    }
  }
}
