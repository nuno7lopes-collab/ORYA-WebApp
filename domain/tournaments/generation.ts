import seedrandom from "seedrandom";
import { prisma } from "@/lib/prisma";
import { Prisma, TournamentFormat, TournamentMatchStatus, TournamentStageType, PadelPairingLifecycleStatus } from "@prisma/client";

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
        // shuffle home/away to vary
        const swap = rng() > 0.5;
        matches.push({ a: swap ? away : home, b: swap ? home : away });
      }
    }
    rounds.push(matches);
    // rotate array except first element
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
    current = matches.map((_m, idx) => idx as unknown as PairingId); // placeholders for next round seeds
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
  // main bracket normal; consolation fed by losers (handled by engine later)
  const main = generateSingleElimination(pairings, seed, targetSize, preserveOrder);
  const consolation: EliminationBracket = [];
  return { main, consolation };
}

const CONFIRMED_PAIRING_STATUSES: PadelPairingLifecycleStatus[] = [
  PadelPairingLifecycleStatus.CONFIRMED_BOTH_PAID,
  PadelPairingLifecycleStatus.CONFIRMED_CAPTAIN_FULL,
];

export async function getConfirmedPairings(eventId: number) {
  const pairings = await prisma.padelPairing.findMany({
    where: {
      eventId,
      lifecycleStatus: { in: CONFIRMED_PAIRING_STATUSES },
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  return pairings.map((p) => p.id);
}

type PersistOptions = {
  tournamentId: number;
  format: TournamentFormat;
  pairings: Array<number | null>;
  seed?: string | null;
  inscriptionDeadlineAt?: Date | null;
  forceGenerate?: boolean;
  userId?: string;
  targetSize?: number | null;
  preserveOrder?: boolean;
};

export async function generateAndPersistTournamentStructure(opts: PersistOptions) {
  const { tournamentId, format, pairings, seed, inscriptionDeadlineAt, forceGenerate, userId, targetSize, preserveOrder } =
    opts;
  const rngSeed = seed || `${Date.now()}`;
  const participantCount = pairings.filter((id) => typeof id === "number").length;
  const hasParticipants = participantCount > 0;
  const confirmed = preserveOrder ? pairings : pairings.filter((id) => typeof id === "number");

  return prisma.$transaction(async (tx) => {
    // Deadline: se ainda não passou e não foi forçado, bloqueia
    if (inscriptionDeadlineAt && new Date() < new Date(inscriptionDeadlineAt) && !forceGenerate) {
      throw new Error("INSCRIPTION_NOT_CLOSED");
    }

    const started = await tx.tournamentMatch.count({
      where: { stage: { tournamentId }, status: { in: ["IN_PROGRESS", "DONE", "SCHEDULED"] as TournamentMatchStatus[] } },
    });
    if (started > 0 && !forceGenerate) throw new Error("TOURNAMENT_ALREADY_STARTED");

    await tx.tournamentMatch.deleteMany({ where: { stage: { tournamentId } } });
    await tx.tournamentGroup.deleteMany({ where: { stage: { tournamentId } } });
    await tx.tournamentStage.deleteMany({ where: { tournamentId } });

    if (!hasParticipants) return { stagesCreated: 0, matchesCreated: 0, seed: rngSeed };

    let stagesCreated = 0;
    let matchesCreated = 0;

    const createRoundRobin = async (stageName: string, groupName: string, order: number) => {
      const stage = await tx.tournamentStage.create({
        data: { tournamentId, name: stageName, stageType: TournamentStageType.GROUPS, order },
      });
      stagesCreated += 1;
      const group = await tx.tournamentGroup.create({
        data: { stageId: stage.id, name: groupName, order: 1 },
      });
      const rr = generateRoundRobin(confirmed, rngSeed);
      for (let r = 0; r < rr.length; r += 1) {
        for (const m of rr[r]) {
          await tx.tournamentMatch.create({
            data: {
              stageId: stage.id,
              groupId: group.id,
              pairing1Id: m.a,
              pairing2Id: m.b,
              round: r + 1,
              status: TournamentMatchStatus.PENDING,
            },
          });
          matchesCreated += 1;
        }
      }
    };

    const createBracket = async (stageName: string, bracket: EliminationBracket, order: number) => {
      const stage = await tx.tournamentStage.create({
        data: { tournamentId, name: stageName, stageType: TournamentStageType.PLAYOFF, order },
      });
      stagesCreated += 1;
      const roundMatchIds: number[][] = [];
      for (let r = 0; r < bracket.length; r += 1) {
        const roundIds: number[] = [];
        for (const m of bracket[r]) {
          const created = await tx.tournamentMatch.create({
            data: {
              stageId: stage.id,
              pairing1Id: m.a,
              pairing2Id: m.b,
              round: r + 1,
              status: TournamentMatchStatus.PENDING,
            },
          });
          roundIds.push(created.id);
          matchesCreated += 1;
        }
        roundMatchIds.push(roundIds);
      }
      for (let r = 0; r < roundMatchIds.length - 1; r += 1) {
        const currentRound = roundMatchIds[r];
        const nextRound = roundMatchIds[r + 1];
        for (let i = 0; i < currentRound.length; i += 1) {
          const nextMatchId = nextRound[Math.floor(i / 2)];
          const nextSlot = i % 2 === 0 ? 1 : 2;
          await tx.tournamentMatch.update({
            where: { id: currentRound[i] },
            data: { nextMatchId, nextSlot },
          });
        }
      }
      return stage.id;
    };

    const createClassificationFromBracket = async (sourceBracket: EliminationBracket, order: number) => {
      const stage = await tx.tournamentStage.create({
        data: { tournamentId, name: "Classificação", stageType: TournamentStageType.CONSOLATION, order },
      });
      stagesCreated += 1;
      // Cria jogos de classificação por round (exceto final), placeholders a preencher após resultados
      for (let r = 0; r < sourceBracket.length; r += 1) {
        const matchesInRound = sourceBracket[r];
        if (matchesInRound.length < 2) continue;
        const classificationCount = Math.floor(matchesInRound.length / 2);
        for (let i = 0; i < classificationCount; i += 1) {
          await tx.tournamentMatch.create({
            data: {
              stageId: stage.id,
              round: r + 1,
              roundLabel: `Classificação R${r + 1}`,
              status: TournamentMatchStatus.PENDING,
            },
          });
          matchesCreated += 1;
        }
      }
    };

    // Consolation placeholder: cria stage e matches entre perdedores de primeira ronda
    const createConsolationFromBracket = async (sourceStageId: number, order: number) => {
      const stage = await tx.tournamentStage.create({
        data: { tournamentId, name: "Consolação", stageType: TournamentStageType.CONSOLATION, order },
      });
      stagesCreated += 1;
      // Busca jogos da primeira ronda do stage fonte
      const firstRound = await tx.tournamentMatch.findMany({
        where: { stageId: sourceStageId, round: 1 },
        orderBy: { id: "asc" },
      });
      // Pares de derrotados (placeholder: pairing1/2 losers → um jogo)
      let roundNum = 1;
      for (let i = 0; i < firstRound.length; i += 2) {
        const m1 = firstRound[i];
        const m2 = firstRound[i + 1];
        if (!m1 || !m2) continue;
        await tx.tournamentMatch.create({
          data: {
            stageId: stage.id,
            pairing1Id: m1.pairing1Id ?? m1.pairing2Id ?? null,
            pairing2Id: m2.pairing1Id ?? m2.pairing2Id ?? null,
            round: roundNum,
            status: TournamentMatchStatus.PENDING,
          },
        });
        matchesCreated += 1;
        roundNum += 1;
      }
    };

    if (format === "GROUPS_PLUS_PLAYOFF" || format === "CHAMPIONSHIP_ROUND_ROBIN" || format === "NONSTOP_ROUND_ROBIN") {
      await createRoundRobin("Fase de Grupos", "Grupo Único", 1);
      if (format === "GROUPS_PLUS_PLAYOFF" && participantCount > 2) {
        const bracket = generateSingleElimination(confirmed, rngSeed, targetSize, preserveOrder);
        const playoffStageId = await createBracket("Playoff", bracket, 2);
        // Consolação automática dos derrotados da ronda 1
        await createConsolationFromBracket(playoffStageId, 3);
      }
    } else if (format === "DRAW_A_B") {
      const bracket = generateSingleElimination(confirmed, rngSeed, targetSize, preserveOrder);
      const mainStageId = await createBracket("Quadro Principal", bracket, 1);
      // Consolação (Quadro B) a partir dos derrotados da ronda 1
      await createConsolationFromBracket(mainStageId, 2);
    } else if (format === "GROUPS_PLUS_FINALS_ALL_PLACES") {
      await createRoundRobin("Fase de Grupos", "Grupo Único", 1);
      const finalsBracket = generateSingleElimination(confirmed, rngSeed, targetSize, preserveOrder);
      await createBracket("Finais por posições", finalsBracket, 2);
      await createClassificationFromBracket(finalsBracket, 3);
    } else if (format === "MANUAL") {
      await tx.tournamentStage.create({
        data: { tournamentId, name: "Manual", stageType: TournamentStageType.PLAYOFF, order: 1 },
      });
      stagesCreated += 1;
    }

    await tx.tournament.update({
      where: { id: tournamentId },
      data: { generationSeed: rngSeed, updatedAt: new Date(), generatedAt: new Date(), generatedByUserId: userId || null },
    });

    // Audit log da geração
    if (userId) {
      await tx.tournamentAuditLog.create({
        data: {
          tournamentId,
          userId,
          action: "GENERATE_BRACKET",
          payloadBefore: Prisma.DbNull,
          payloadAfter: { format, seed: rngSeed, pairings: confirmed },
        },
      });
    }

    return { stagesCreated, matchesCreated, seed: rngSeed };
  });
}
