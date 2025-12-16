import seedrandom from "seedrandom";
import { prisma } from "@/lib/prisma";
import { Prisma, TournamentFormat, TournamentMatchStatus, TournamentStageType } from "@prisma/client";

type PairingId = number;

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

export function generateSingleElimination(pairings: PairingId[], seed?: string): EliminationBracket {
  const rng = seedrandom(seed || `${Date.now()}`);
  const shuffled = [...pairings].sort(() => (rng() > 0.5 ? 1 : -1));
  // next power of two
  const size = 1 << Math.ceil(Math.log2(shuffled.length || 1));
  while (shuffled.length < size) shuffled.push(undefined as unknown as PairingId);

  const rounds: EliminationBracket = [];
  let current = shuffled;
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

export function generateDrawAB(pairings: PairingId[], seed?: string): ABBracket {
  // main bracket normal; consolation fed by losers (handled by engine later)
  const main = generateSingleElimination(pairings, seed);
  const consolation: EliminationBracket = [];
  return { main, consolation };
}

const CONFIRMED_PAIRING_STATUSES = ["CONFIRMED_BOTH_PAID", "CONFIRMED_CAPTAIN_FULL"] as const;

export async function getConfirmedPairings(eventId: number) {
  const pairings = await prisma.padelPairing.findMany({
    where: {
      eventId,
      lifecycleStatus: { in: CONFIRMED_PAIRING_STATUSES as unknown as Prisma.PadelPairingWhereInput["lifecycleStatus"] },
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  return pairings.map((p) => p.id);
}

type PersistOptions = {
  tournamentId: number;
  format: TournamentFormat;
  pairings: number[];
  seed?: string | null;
  inscriptionDeadlineAt?: Date | null;
  forceGenerate?: boolean;
  userId?: string;
};

export async function generateAndPersistTournamentStructure(opts: PersistOptions) {
  const { tournamentId, format, pairings, seed, inscriptionDeadlineAt, forceGenerate, userId } = opts;
  const rngSeed = seed || `${Date.now()}`;
  const confirmed = pairings.filter((id) => typeof id === "number");

  return prisma.$transaction(async (tx) => {
    // Deadline: se ainda não passou e não foi forçado, bloqueia
    if (inscriptionDeadlineAt && new Date() < new Date(inscriptionDeadlineAt) && !forceGenerate) {
      throw new Error("INSCRIPTION_NOT_CLOSED");
    }

    const started = await tx.tournamentMatch.count({
      where: { stage: { tournamentId }, status: { in: ["IN_PROGRESS", "DONE", "SCHEDULED"] as TournamentMatchStatus[] } },
    });
    if (started > 0) throw new Error("TOURNAMENT_ALREADY_STARTED");

    await tx.tournamentMatch.deleteMany({ where: { stage: { tournamentId } } });
    await tx.tournamentGroup.deleteMany({ where: { stage: { tournamentId } } });
    await tx.tournamentStage.deleteMany({ where: { tournamentId } });

    if (confirmed.length === 0) return { stagesCreated: 0, matchesCreated: 0, seed: rngSeed };

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
      for (let r = 0; r < bracket.length; r += 1) {
        for (const m of bracket[r]) {
          await tx.tournamentMatch.create({
            data: {
              stageId: stage.id,
              pairing1Id: m.a,
              pairing2Id: m.b,
              round: r + 1,
              status: TournamentMatchStatus.PENDING,
            },
          });
          matchesCreated += 1;
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
      if (format === "GROUPS_PLUS_PLAYOFF" && confirmed.length > 2) {
        const bracket = generateSingleElimination(confirmed, rngSeed);
        const playoffStageId = await createBracket("Playoff", bracket, 2);
        // Consolação automática dos derrotados da ronda 1
        await createConsolationFromBracket(playoffStageId, 3);
      }
    } else if (format === "DRAW_A_B") {
      const bracket = generateSingleElimination(confirmed, rngSeed);
      const mainStageId = await createBracket("Quadro Principal", bracket, 1);
      // Consolação (Quadro B) a partir dos derrotados da ronda 1
      await createConsolationFromBracket(mainStageId, 2);
    } else if (format === "GROUPS_PLUS_FINALS_ALL_PLACES") {
      await createRoundRobin("Fase de Grupos", "Grupo Único", 1);
      const finalsBracket = generateSingleElimination(confirmed, rngSeed);
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
