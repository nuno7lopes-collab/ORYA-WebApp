type MexicanoPattern = readonly [number, number, number, number];

const MEXICANO_PATTERNS: MexicanoPattern[] = [
  [0, 3, 1, 2],
  [0, 2, 1, 3],
  [0, 1, 2, 3],
];

export type MexicanoRoundEntry =
  | { kind: "MATCH"; sideA: [number, number]; sideB: [number, number] }
  | { kind: "BYE"; playerId: number };

export type MexicanoRoundRelations = {
  teammatePairs: Set<string>;
  opponentPairs: Set<string>;
};

function pairKey(a: number, b: number) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function scorePattern(
  quartet: [number, number, number, number],
  pattern: MexicanoPattern,
  relations: MexicanoRoundRelations | null,
) {
  if (!relations) return 0;

  const sideA: [number, number] = [quartet[pattern[0]], quartet[pattern[1]]];
  const sideB: [number, number] = [quartet[pattern[2]], quartet[pattern[3]]];

  let penalty = 0;

  if (relations.teammatePairs.has(pairKey(sideA[0], sideA[1]))) penalty += 100;
  if (relations.teammatePairs.has(pairKey(sideB[0], sideB[1]))) penalty += 100;

  for (const a of sideA) {
    for (const b of sideB) {
      if (relations.opponentPairs.has(pairKey(a, b))) penalty += 10;
    }
  }

  return penalty;
}

export function buildMexicanoRoundRelations(matches: Array<{ sideA: number[]; sideB: number[] }>): MexicanoRoundRelations {
  const teammatePairs = new Set<string>();
  const opponentPairs = new Set<string>();

  for (const match of matches) {
    if (match.sideA.length !== 2 || match.sideB.length !== 2) continue;
    teammatePairs.add(pairKey(match.sideA[0], match.sideA[1]));
    teammatePairs.add(pairKey(match.sideB[0], match.sideB[1]));
    for (const a of match.sideA) {
      for (const b of match.sideB) {
        opponentPairs.add(pairKey(a, b));
      }
    }
  }

  return { teammatePairs, opponentPairs };
}

export function deriveMexicanoRoundEntries(
  orderedPlayerIds: number[],
  options?: { previousRoundRelations?: MexicanoRoundRelations | null },
): MexicanoRoundEntry[] {
  const entries: MexicanoRoundEntry[] = [];
  const relations = options?.previousRoundRelations ?? null;

  for (let idx = 0; idx < orderedPlayerIds.length; idx += 4) {
    const chunk = orderedPlayerIds.slice(idx, idx + 4);
    if (chunk.length < 4) {
      for (const playerId of chunk) {
        entries.push({ kind: "BYE", playerId });
      }
      continue;
    }

    const quartet = chunk as [number, number, number, number];
    let bestPattern = MEXICANO_PATTERNS[0];
    let bestPenalty = Number.POSITIVE_INFINITY;
    for (const pattern of MEXICANO_PATTERNS) {
      const penalty = scorePattern(quartet, pattern, relations);
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        bestPattern = pattern;
      }
    }

    entries.push({
      kind: "MATCH",
      sideA: [quartet[bestPattern[0]], quartet[bestPattern[1]]],
      sideB: [quartet[bestPattern[2]], quartet[bestPattern[3]]],
    });
  }

  return entries;
}
