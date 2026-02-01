import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type PadelRuleSetSnapshot = {
  source: "VERSION" | "RULESET" | "DEFAULT";
  ruleSetId: number | null;
  ruleSetVersionId: number | null;
  name: string;
  tieBreakRules: unknown;
  pointsTable: unknown;
  enabledFormats: string[];
  season: string | null;
  year: number | null;
};

const DEFAULT_SNAPSHOT: PadelRuleSetSnapshot = {
  source: "DEFAULT",
  ruleSetId: null,
  ruleSetVersionId: null,
  name: "Regras padrão",
  tieBreakRules: {},
  pointsTable: {},
  enabledFormats: ["TODOS_CONTRA_TODOS", "QUADRO_ELIMINATORIO"],
  season: null,
  year: null,
};

export async function ensurePadelRuleSetVersion(params: {
  tx: Prisma.TransactionClient;
  tournamentConfigId: number;
  ruleSetId: number;
  actorUserId?: string | null;
}) {
  const { tx, tournamentConfigId, ruleSetId, actorUserId } = params;
  const ruleSet = await tx.padelRuleSet.findUnique({
    where: { id: ruleSetId },
    select: {
      id: true,
      name: true,
      tieBreakRules: true,
      pointsTable: true,
      enabledFormats: true,
      season: true,
      year: true,
    },
  });
  if (!ruleSet) {
    throw new Error("PADEL_RULESET_NOT_FOUND");
  }

  const last = await tx.padelRuleSetVersion.findFirst({
    where: { tournamentConfigId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (last?.version ?? 0) + 1;

  return tx.padelRuleSetVersion.create({
    data: {
      tournamentConfigId,
      version: nextVersion,
      sourceRuleSetId: ruleSet.id,
      name: ruleSet.name,
      tieBreakRules: ruleSet.tieBreakRules ?? {},
      pointsTable: ruleSet.pointsTable ?? {},
      enabledFormats: ruleSet.enabledFormats ?? ["TODOS_CONTRA_TODOS", "QUADRO_ELIMINATORIO"],
      season: ruleSet.season ?? null,
      year: ruleSet.year ?? null,
      createdByUserId: actorUserId ?? null,
    },
  });
}

export async function getPadelRuleSetSnapshot(params: {
  tx?: Prisma.TransactionClient;
  ruleSetId?: number | null;
  ruleSetVersionId?: number | null;
}): Promise<PadelRuleSetSnapshot> {
  const tx = params.tx ?? prisma;
  if (params.ruleSetVersionId) {
    const version = await tx.padelRuleSetVersion.findUnique({
      where: { id: params.ruleSetVersionId },
      select: {
        id: true,
        sourceRuleSetId: true,
        name: true,
        tieBreakRules: true,
        pointsTable: true,
        enabledFormats: true,
        season: true,
        year: true,
      },
    });
    if (version) {
      return {
        source: "VERSION",
        ruleSetId: version.sourceRuleSetId ?? null,
        ruleSetVersionId: version.id,
        name: version.name,
        tieBreakRules: version.tieBreakRules ?? {},
        pointsTable: version.pointsTable ?? {},
        enabledFormats: version.enabledFormats ?? ["TODOS_CONTRA_TODOS", "QUADRO_ELIMINATORIO"],
        season: version.season ?? null,
        year: version.year ?? null,
      };
    }
  }

  if (params.ruleSetId) {
    const ruleSet = await tx.padelRuleSet.findUnique({
      where: { id: params.ruleSetId },
      select: {
        id: true,
        name: true,
        tieBreakRules: true,
        pointsTable: true,
        enabledFormats: true,
        season: true,
        year: true,
      },
    });
    if (ruleSet) {
      return {
        source: "RULESET",
        ruleSetId: ruleSet.id,
        ruleSetVersionId: null,
        name: ruleSet.name,
        tieBreakRules: ruleSet.tieBreakRules ?? {},
        pointsTable: ruleSet.pointsTable ?? {},
        enabledFormats: ruleSet.enabledFormats ?? ["TODOS_CONTRA_TODOS", "QUADRO_ELIMINATORIO"],
        season: ruleSet.season ?? null,
        year: ruleSet.year ?? null,
      };
    }
  }

  return DEFAULT_SNAPSHOT;
}

export async function resolvePadelRuleSetSnapshotForEvent(params: {
  eventId: number;
  tx?: Prisma.TransactionClient;
}): Promise<PadelRuleSetSnapshot> {
  const tx = params.tx ?? prisma;
  const config = await tx.padelTournamentConfig.findUnique({
    where: { eventId: params.eventId },
    select: { ruleSetId: true, ruleSetVersionId: true },
  });
  return getPadelRuleSetSnapshot({
    tx,
    ruleSetId: config?.ruleSetId ?? null,
    ruleSetVersionId: config?.ruleSetVersionId ?? null,
  });
}
