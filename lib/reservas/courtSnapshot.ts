import type { Prisma, PrismaClient } from "@prisma/client";

export type CourtSnapshot = {
  courtId: number;
  name: string | null;
  coverImageUrl: string | null;
};

type PrismaLike =
  | Pick<PrismaClient, "courtBookingConfig" | "padelClubCourt">
  | Prisma.TransactionClient;

function normalizeText(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function resolveCourtSnapshot(
  tx: PrismaLike,
  params: { organizationId: number; courtId: number | null | undefined },
): Promise<CourtSnapshot | null> {
  if (!params.courtId || !Number.isFinite(params.courtId) || params.courtId <= 0) {
    return null;
  }
  const courtId = Math.trunc(params.courtId);

  const config = await tx.courtBookingConfig.findFirst({
    where: {
      organizationId: params.organizationId,
      courtId,
    },
    select: {
      courtId: true,
      displayName: true,
      coverImageUrl: true,
      court: { select: { name: true } },
      backingService: {
        select: {
          title: true,
          coverImageUrl: true,
        },
      },
    },
  });

  if (config) {
    return {
      courtId,
      name:
        normalizeText(config.displayName) ||
        normalizeText(config.court?.name) ||
        normalizeText(config.backingService?.title) ||
        null,
      coverImageUrl:
        normalizeText(config.coverImageUrl) ||
        normalizeText(config.backingService?.coverImageUrl) ||
        null,
    };
  }

  const court = await tx.padelClubCourt.findFirst({
    where: {
      id: courtId,
      club: {
        organizationId: params.organizationId,
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!court) return null;

  return {
    courtId,
    name: normalizeText(court.name) || null,
    coverImageUrl: null,
  };
}
