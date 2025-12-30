import { TournamentMatchStatus } from "@prisma/client";
import { computeGroupStandings, TieBreakRule } from "@/domain/tournaments/standings";

export function summarizeMatchStatus(status: TournamentMatchStatus) {
  if (status === "IN_PROGRESS") return "Em jogo";
  if (status === "DONE") return "Terminado";
  if (status === "DISPUTED") return "Em disputa";
  if (status === "SCHEDULED") return "Agendado";
  if (status === "CANCELLED") return "Cancelado";
  return "Pendente";
}

export function computeStandingsForGroup(
  matches: { pairing1Id: number | null; pairing2Id: number | null; status: TournamentMatchStatus; score: unknown }[],
  rules: TieBreakRule[],
  seed?: string,
) {
  const pairings = Array.from(
    new Set(
      matches
        .flatMap((m) => [m.pairing1Id, m.pairing2Id])
        .filter((v): v is number => typeof v === "number"),
    ),
  );
  if (pairings.length === 0) return [];
  return computeGroupStandings(
    pairings,
    matches
      .filter((m) => m.pairing1Id && m.pairing2Id)
      .map((m) => ({
        pairing1Id: m.pairing1Id as number,
        pairing2Id: m.pairing2Id as number,
        status: m.status,
        score: m.score as unknown,
      })),
    rules,
    seed,
  );
}
