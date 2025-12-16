import { TournamentMatchStatus } from "@prisma/client";

export type SetScore = { a: number; b: number };
export type ScorePayload = { sets: SetScore[] };

export type ValidationResult =
  | { ok: true; winner: "A" | "B"; normalized: ScorePayload }
  | { ok: false; code: string; message: string };

const WIN_BY = 2;
const MAX_SETS = 3; // BO3
const MIN_GAMES_TO_WIN = 6;
const TIEBREAK_GAMES = 7;

function isValidSet(set: SetScore) {
  const a = Number(set.a);
  const b = Number(set.b);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0) return false;
  const max = Math.max(a, b);
  const diff = Math.abs(a - b);
  // tiebreak 7-6 é aceite
  if (max === TIEBREAK_GAMES && diff === 1) return true;
  if (max >= MIN_GAMES_TO_WIN) return diff >= WIN_BY;
  return false;
}

export function validateScore(score: ScorePayload): ValidationResult {
  if (!score || !Array.isArray(score.sets) || score.sets.length === 0) {
    return { ok: false, code: "INVALID_SCORE", message: "Score vazio ou inválido." };
  }
  if (score.sets.length > MAX_SETS) {
    return { ok: false, code: "TOO_MANY_SETS", message: "Máximo de 3 sets (BO3)." };
  }

  let winsA = 0;
  let winsB = 0;
  for (const s of score.sets) {
    if (!isValidSet(s)) return { ok: false, code: "INVALID_SET", message: "Set inválido." };
    if (s.a > s.b) winsA += 1;
    else winsB += 1;
  }

  if (winsA === winsB) return { ok: false, code: "NO_WINNER", message: "Empate não permitido no BO3." };
  if (winsA > MAX_SETS || winsB > MAX_SETS) {
    return { ok: false, code: "TOO_MANY_WINS", message: "Vitórias a mais para BO3." };
  }
  if (winsA > winsB && winsA > MAX_SETS - 1) {
    return { ok: true, winner: "A", normalized: score };
  }
  if (winsB > winsA && winsB > MAX_SETS - 1) {
    return { ok: true, winner: "B", normalized: score };
  }
  return { ok: false, code: "NO_WINNER", message: "Score não determina vencedor." };
}

export function canEditMatch(status: TournamentMatchStatus, force?: boolean) {
  if (force) return true;
  // não permite editar DONE se não for force
  return status !== "DONE";
}
