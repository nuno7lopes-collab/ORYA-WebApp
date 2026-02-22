import type { Prisma, PrismaClient } from "@prisma/client";

type PrismaLike = Pick<PrismaClient, "trainerProfile" | "reservationProfessional"> | Prisma.TransactionClient;

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

const toPositiveLimit = (value: number | null | undefined) => {
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.min(Math.max(1, Math.floor(value as number)), MAX_LIMIT);
};

const resolveDisplayName = (value: {
  user: { fullName: string | null; username: string | null } | null;
}) => {
  const fullName = value.user?.fullName?.trim();
  if (fullName) return fullName;
  const username = value.user?.username?.trim();
  if (username) return username;
  return "Treinador";
};

const selectCanonicalProfessional = <T extends { id: number; isActive: boolean; updatedAt: Date; createdAt: Date }>(
  professionals: T[],
) => {
  if (professionals.length === 0) return null;
  const sorted = [...professionals].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    const aUpdated = a.updatedAt.getTime();
    const bUpdated = b.updatedAt.getTime();
    if (aUpdated !== bUpdated) return bUpdated - aUpdated;
    const aCreated = a.createdAt.getTime();
    const bCreated = b.createdAt.getTime();
    if (aCreated !== bCreated) return aCreated - bCreated;
    return a.id - b.id;
  });
  return sorted[0] ?? null;
};

export type BackfillTrainerProfessionalLinksOptions = {
  dryRun?: boolean;
  limit?: number | null;
  afterId?: number | null;
  logger?: (message: string) => void;
};

export type BackfillTrainerProfessionalLinksSummary = {
  dryRun: boolean;
  limit: number;
  lastId: number | null;
  scanned: number;
  createdProfessionals: number;
  reactivatedProfessionals: number;
  linkedTrainerProfiles: number;
  duplicateProfessionalGroups: number;
  unchanged: number;
  errors: number;
};

export async function backfillTrainerProfessionalLinks(
  prisma: PrismaLike,
  options?: BackfillTrainerProfessionalLinksOptions,
): Promise<BackfillTrainerProfessionalLinksSummary> {
  const dryRun = Boolean(options?.dryRun);
  const limit = toPositiveLimit(options?.limit ?? null);
  const afterId = Number.isFinite(options?.afterId) ? Number(options?.afterId) : null;
  const logger = options?.logger ?? (() => {});

  const trainers = await prisma.trainerProfile.findMany({
    where: {
      ...(afterId ? { id: { gt: afterId } } : {}),
    },
    orderBy: [{ id: "asc" }],
    take: limit,
    select: {
      id: true,
      organizationId: true,
      userId: true,
      reservationProfessionalId: true,
      user: {
        select: {
          fullName: true,
          username: true,
        },
      },
    },
  });

  const lastId = trainers.length > 0 ? trainers[trainers.length - 1]?.id ?? null : null;

  logger(
    `[trainer_prof_backfill] found=${trainers.length} limit=${limit} afterId=${afterId ?? "none"} mode=${
      dryRun ? "dry-run" : "apply"
    }`,
  );

  let createdProfessionals = 0;
  let reactivatedProfessionals = 0;
  let linkedTrainerProfiles = 0;
  let duplicateProfessionalGroups = 0;
  let unchanged = 0;
  let errors = 0;

  for (const trainer of trainers) {
    try {
      const existingProfessionals = await prisma.reservationProfessional.findMany({
        where: {
          organizationId: trainer.organizationId,
          userId: trainer.userId,
        },
        select: {
          id: true,
          isActive: true,
          updatedAt: true,
          createdAt: true,
        },
      });

      const canonical = selectCanonicalProfessional(existingProfessionals);
      if (existingProfessionals.length > 1) {
        duplicateProfessionalGroups += 1;
      }

      let professionalId = canonical?.id ?? null;
      let reactivated = false;
      const createdInThisIteration = !canonical;

      if (!canonical) {
        if (!dryRun) {
          const created = await prisma.reservationProfessional.create({
            data: {
              organizationId: trainer.organizationId,
              userId: trainer.userId,
              name: resolveDisplayName(trainer),
              roleTitle: "Treinador",
              isActive: true,
              priority: 0,
            },
            select: { id: true },
          });
          professionalId = created.id;
        }
        createdProfessionals += 1;
      } else if (!canonical.isActive) {
        reactivated = true;
        if (!dryRun) {
          await prisma.reservationProfessional.update({
            where: { id: canonical.id },
            data: { isActive: true },
          });
        }
        reactivatedProfessionals += 1;
      }

      const nextProfessionalId = professionalId ?? canonical?.id ?? null;
      const needsLinkUpdate = createdInThisIteration && dryRun
        ? true
        : typeof nextProfessionalId === "number" && trainer.reservationProfessionalId !== nextProfessionalId;

      if (needsLinkUpdate) {
        if (!dryRun) {
          await prisma.trainerProfile.update({
            where: { id: trainer.id },
            data: {
              reservationProfessionalId: nextProfessionalId,
            },
          });
        }
        linkedTrainerProfiles += 1;
      } else if (!reactivated && !canonical && !needsLinkUpdate) {
        unchanged += 1;
      } else if (!needsLinkUpdate && !reactivated && canonical) {
        unchanged += 1;
      }

      logger(
        `[trainer_prof_backfill] trainer=${trainer.id} org=${trainer.organizationId} user=${trainer.userId} canonicalProfessional=${
          nextProfessionalId ?? "none"
        } created=${!canonical} reactivated=${reactivated} linked=${needsLinkUpdate}`,
      );
    } catch (err) {
      errors += 1;
      logger(
        `[trainer_prof_backfill] ERROR trainer=${trainer.id} message=${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  return {
    dryRun,
    limit,
    lastId,
    scanned: trainers.length,
    createdProfessionals,
    reactivatedProfessionals,
    linkedTrainerProfiles,
    duplicateProfessionalGroups,
    unchanged,
    errors,
  };
}
