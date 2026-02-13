import { padel_match_status, type Prisma } from "@prisma/client";
import { buildWalkoverSets, type PadelScoreRules } from "@/domain/padel/score";

type MatchSide = "A" | "B";

export type KnockoutMatchSnapshot = {
  id: number;
  roundLabel: string | null;
  pairingAId: number | null;
  pairingBId: number | null;
  winnerPairingId?: number | null;
  winnerParticipantId?: number | null;
  winnerSide?: MatchSide | null;
  sideAParticipantIds?: number[];
  sideBParticipantIds?: number[];
};

export type KnockoutUpdateData = {
  pairingAId?: number | null;
  pairingBId?: number | null;
  winnerPairingId?: number | null;
  winnerParticipantId?: number | null;
  winnerSide?: MatchSide | null;
  sideAParticipantIds?: number[];
  sideBParticipantIds?: number[];
  status?: padel_match_status;
  score?: Prisma.InputJsonValue;
  scoreSets?: Prisma.InputJsonValue;
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
  winnerParticipantId?: number | null;
  winnerSide?: MatchSide | null;
  sideAParticipantIds?: number[];
  sideBParticipantIds?: number[];
}>;

function normalizeRoundLabel(label: string | null | undefined) {
  const trimmed = (label ?? "?").trim();
  return trimmed.length > 0 ? trimmed : "?";
}

const uniqueIds = (values: number[] | null | undefined) =>
  Array.from(
    new Set(
      (values ?? [])
        .map((entry) => (typeof entry === "number" ? entry : Number(entry)))
        .filter((entry): entry is number => Number.isFinite(entry) && entry > 0),
    ),
  );

const resolveSideParticipants = (match: KnockoutMatchSnapshot, side: MatchSide) =>
  side === "A" ? uniqueIds(match.sideAParticipantIds) : uniqueIds(match.sideBParticipantIds);

export function extractBracketPrefix(label: string | null): "" | "A " | "B " {
  if (!label) return "";
  const trimmed = label.trim();
  if (trimmed.startsWith("A ")) return "A ";
  if (trimmed.startsWith("B ")) return "B ";
  return "";
}

export function sortRoundsBySize(matches: Array<{ roundLabel: string | null }>) {
  const counts = matches.reduce<Record<string, number>>((acc, m) => {
    const key = normalizeRoundLabel(m.roundLabel);
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
      bracketMatches.filter((m) => normalizeRoundLabel(m.roundLabel) === label),
    );
  });

  const advance = async (
    fromMatchId: number,
    winner: {
      pairingId?: number | null;
      participantIds?: number[];
      winnerParticipantId?: number | null;
      winnerSide?: MatchSide | null;
    },
  ) => {
    const fromMatch = bracketMatches.find((m) => m.id === fromMatchId);
    if (!fromMatch) return;
    const currentRound = normalizeRoundLabel(fromMatch.roundLabel);
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

    const targetSide: MatchSide = currentPos % 2 === 0 ? "A" : "B";
    const updateTarget: KnockoutUpdateData = {};

    const participantIds = uniqueIds(winner.participantIds);
    if (participantIds.length > 0) {
      if (targetSide === "A" && resolveSideParticipants(target, "A").length === 0) {
        updateTarget.sideAParticipantIds = participantIds;
      } else if (targetSide === "B" && resolveSideParticipants(target, "B").length === 0) {
        updateTarget.sideBParticipantIds = participantIds;
      }
    }

    const winnerPairingId = typeof winner.pairingId === "number" ? winner.pairingId : null;
    if (typeof winnerPairingId === "number") {
      if (targetSide === "A" && !target.pairingAId) updateTarget.pairingAId = winnerPairingId;
      else if (targetSide === "B" && !target.pairingBId) updateTarget.pairingBId = winnerPairingId;
    }

    if (Object.keys(updateTarget).length === 0) return;

    const targetUpdated = await updateMatch(target.id, updateTarget);
    target.pairingAId = targetUpdated.pairingAId;
    target.pairingBId = targetUpdated.pairingBId;
    target.winnerPairingId = targetUpdated.winnerPairingId ?? target.winnerPairingId ?? null;
    target.winnerParticipantId = targetUpdated.winnerParticipantId ?? target.winnerParticipantId ?? null;
    target.winnerSide = targetUpdated.winnerSide ?? target.winnerSide ?? null;
    target.sideAParticipantIds = uniqueIds(targetUpdated.sideAParticipantIds ?? target.sideAParticipantIds ?? []);
    target.sideBParticipantIds = uniqueIds(targetUpdated.sideBParticipantIds ?? target.sideBParticipantIds ?? []);
  };

  return { bracketMatches, roundOrder, advance };
}

export async function advancePadelKnockoutWinner({
  matches,
  updateMatch,
  winnerMatchId,
  winnerPairingId,
  winnerParticipantId,
  winnerParticipantIds,
  winnerSide,
}: {
  matches: KnockoutMatchSnapshot[];
  updateMatch: KnockoutUpdateFn;
  winnerMatchId: number;
  winnerPairingId?: number | null;
  winnerParticipantId?: number | null;
  winnerParticipantIds?: number[];
  winnerSide?: MatchSide | null;
}) {
  const winnerMatch = matches.find((m) => m.id === winnerMatchId);
  if (!winnerMatch) return;
  const bracketPrefix = extractBracketPrefix(winnerMatch.roundLabel);
  const { advance } = createBracketAdvancer(matches, updateMatch, bracketPrefix);
  const participantIds = uniqueIds(
    winnerParticipantIds ?? (typeof winnerParticipantId === "number" ? [winnerParticipantId] : []),
  );
  await advance(winnerMatchId, {
    pairingId: winnerPairingId ?? null,
    participantIds,
    winnerParticipantId: typeof winnerParticipantId === "number" ? winnerParticipantId : participantIds[0] ?? null,
    winnerSide: winnerSide ?? null,
  });
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
      const roundMatches = bracketMatches.filter((m) => normalizeRoundLabel(m.roundLabel) === roundLabel);
      for (const match of roundMatches) {
        if (match.winnerPairingId || match.winnerParticipantId) continue;
        const sideAParticipants = resolveSideParticipants(match, "A");
        const sideBParticipants = resolveSideParticipants(match, "B");
        const hasA = sideAParticipants.length > 0 || Boolean(match.pairingAId);
        const hasB = sideBParticipants.length > 0 || Boolean(match.pairingBId);
        if (hasA === hasB) continue;
        const winnerSide: MatchSide = hasA ? "A" : "B";
        const autoWinnerParticipantIds = winnerSide === "A" ? sideAParticipants : sideBParticipants;
        const autoWinnerParticipantId = autoWinnerParticipantIds[0] ?? null;
        const autoWinnerPairingId = winnerSide === "A" ? match.pairingAId ?? null : match.pairingBId ?? null;
        const score = { resultType: "WALKOVER", winnerSide, walkover: true };
        const scoreSets = buildWalkoverSets(winnerSide, scoreRules ?? undefined);
        const updated = await updateMatch(match.id, {
          winnerPairingId: autoWinnerPairingId,
          winnerParticipantId: autoWinnerParticipantId,
          winnerSide,
          status: padel_match_status.DONE,
          score,
          scoreSets,
        });
        match.winnerPairingId = updated.winnerPairingId ?? autoWinnerPairingId ?? null;
        match.winnerParticipantId = updated.winnerParticipantId ?? autoWinnerParticipantId ?? null;
        match.winnerSide = updated.winnerSide ?? winnerSide;
        match.pairingAId = updated.pairingAId;
        match.pairingBId = updated.pairingBId;
        match.sideAParticipantIds = uniqueIds(updated.sideAParticipantIds ?? match.sideAParticipantIds ?? []);
        match.sideBParticipantIds = uniqueIds(updated.sideBParticipantIds ?? match.sideBParticipantIds ?? []);
        await advance(match.id, {
          pairingId: autoWinnerPairingId,
          participantIds: autoWinnerParticipantIds,
          winnerParticipantId: autoWinnerParticipantId,
          winnerSide,
        });
      }
    }
  }
}
