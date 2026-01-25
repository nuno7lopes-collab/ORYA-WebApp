import { prisma } from "@/lib/prisma";
import { Prisma, TournamentFormat, TournamentMatchStatus, TournamentStageType, PadelRegistrationStatus } from "@prisma/client";
import {
  generateDrawAB,
  generateRoundRobin,
  generateSingleElimination,
  type ABBracket,
  type EliminationBracket,
  type EliminationMatch,
  type RoundRobinMatch,
  type RoundRobinSchedule,
} from "@/domain/tournaments/generationCore";

type PairingId = number | null;

export type { RoundRobinMatch, RoundRobinSchedule, EliminationMatch, EliminationBracket, ABBracket };
export { generateRoundRobin, generateSingleElimination, generateDrawAB };

export async function getConfirmedPairings(eventId: number) {
  const pairings = await prisma.padelPairing.findMany({
    where: {
      eventId,
      pairingStatus: "COMPLETE",
      registration: { status: PadelRegistrationStatus.CONFIRMED },
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
    // Deadline: se ainda não expirou e não foi forçado, bloqueia
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
      await tx.tournamentAuditLog["create"]({
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
