import seedrandom from "seedrandom";

type PairingId = number | null;

export type RoundRobinMatch = { a: PairingId; b: PairingId };
export type RoundRobinSchedule = RoundRobinMatch[][];

export function generateRoundRobin(pairings: PairingId[], seed?: string): RoundRobinSchedule {
  const rng = seedrandom(seed || `${Date.now()}`);
  const players = [...pairings];
  if (players.length % 2 !== 0) players.push(-1); // bye = -1
  const n = players.length;
  const rounds: RoundRobinSchedule = [];

  const arr = [...players];
  for (let round = 0; round < n - 1; round += 1) {
    const matches: RoundRobinMatch[] = [];
    for (let i = 0; i < n / 2; i += 1) {
      const home = arr[i];
      const away = arr[n - 1 - i];
      if (home !== -1 && away !== -1) {
        const swap = rng() > 0.5;
        matches.push({ a: swap ? away : home, b: swap ? home : away });
      }
    }
    rounds.push(matches);
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop() as number);
    arr.splice(0, arr.length, fixed, ...rest);
  }
  return rounds;
}

export type EliminationMatch = { a?: PairingId; b?: PairingId };
export type EliminationBracket = EliminationMatch[][];

function nextPowerOfTwo(value: number) {
  let size = 1;
  while (size < value) size *= 2;
  return size;
}

function resolveBracketSize(total: number, targetSize?: number | null) {
  if (targetSize === null || typeof targetSize === "undefined") {
    return nextPowerOfTwo(Math.max(1, total));
  }
  const size = Math.trunc(targetSize);
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error("INVALID_BRACKET_SIZE");
  }
  if ((size & (size - 1)) !== 0) {
    throw new Error("INVALID_BRACKET_SIZE");
  }
  if (total > size) {
    throw new Error("BRACKET_TOO_SMALL");
  }
  return size;
}

export function generateSingleElimination(
  pairings: PairingId[],
  seed?: string,
  targetSize?: number | null,
  preserveOrder?: boolean,
): EliminationBracket {
  const rng = seedrandom(seed || `${Date.now()}`);
  const ordered = preserveOrder ? [...pairings] : [...pairings].sort(() => (rng() > 0.5 ? 1 : -1));
  const size = resolveBracketSize(ordered.length || 1, targetSize);
  while (ordered.length < size) ordered.push(undefined as unknown as PairingId);

  const rounds: EliminationBracket = [];
  let current = ordered;
  while (current.length > 1) {
    const matches: EliminationMatch[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const a = current[i];
      const b = current[i + 1];
      matches.push({ a, b });
    }
    rounds.push(matches);
    current = matches.map((_m, idx) => idx as unknown as PairingId);
  }
  return rounds;
}

export type ABBracket = {
  main: EliminationBracket;
  consolation: EliminationBracket;
};

export function generateDrawAB(
  pairings: PairingId[],
  seed?: string,
  targetSize?: number | null,
  preserveOrder?: boolean,
): ABBracket {
  const main = generateSingleElimination(pairings, seed, targetSize, preserveOrder);
  const consolation: EliminationBracket = [];
  return { main, consolation };
}
