import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type DbClient = Prisma.TransactionClient | typeof prisma;

const DEFAULT_COURT_RESOURCE_CAPACITY = 4;

function dedupePositiveInts(values: number[]) {
  const set = new Set<number>();
  values.forEach((value) => {
    if (Number.isFinite(value) && value > 0) set.add(Math.trunc(value));
  });
  return Array.from(set);
}

export async function syncReservationResourceForCourt(params: {
  courtId: number;
  db?: DbClient;
}) {
  const db = params.db ?? prisma;
  const court = await db.padelClubCourt.findFirst({
    where: { id: params.courtId },
    select: {
      id: true,
      name: true,
      isActive: true,
      displayOrder: true,
      deletedAt: true,
      club: { select: { organizationId: true, deletedAt: true } },
    },
  });

  if (!court || court.deletedAt || court.club.deletedAt) return null;

  return db.reservationResource.upsert({
    where: { courtId: court.id },
    create: {
      organizationId: court.club.organizationId,
      label: court.name,
      capacity: DEFAULT_COURT_RESOURCE_CAPACITY,
      isActive: court.isActive,
      priority: court.displayOrder ?? 0,
      courtId: court.id,
    },
    update: {
      label: court.name,
      capacity: DEFAULT_COURT_RESOURCE_CAPACITY,
      isActive: court.isActive,
      priority: court.displayOrder ?? 0,
    },
    select: { id: true, courtId: true },
  });
}

export async function deactivateReservationResourcesForCourts(params: {
  courtIds: number[];
  db?: DbClient;
}) {
  const db = params.db ?? prisma;
  const courtIds = dedupePositiveInts(params.courtIds);
  if (courtIds.length === 0) return;
  await db.reservationResource.updateMany({
    where: { courtId: { in: courtIds } },
    data: { isActive: false },
  });
}

