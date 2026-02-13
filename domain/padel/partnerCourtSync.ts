import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type DbClient = Prisma.TransactionClient | typeof prisma;

type SyncPartnerClubCourtsParams = {
  partnerOrganizationId: number;
  partnerClubId: number;
  sourceClubId: number;
  fallbackCount?: number;
  ttlHours?: number;
  db?: DbClient;
};

type SyncPartnerClubCourtsResult = {
  localCourtIds: number[];
  created: number;
  updated: number;
  deactivated: number;
  sourceCount: number;
};

export async function syncPartnerClubCourts(
  params: SyncPartnerClubCourtsParams,
): Promise<SyncPartnerClubCourtsResult> {
  const {
    partnerOrganizationId,
    partnerClubId,
    sourceClubId,
    fallbackCount = 0,
    ttlHours = 24,
    db: client,
  } = params;
  const db = client ?? prisma;
  const now = new Date();
  const ttlAt = new Date(now.getTime() + Math.max(1, ttlHours) * 60 * 60 * 1000);

  const [sourceCourts, partnerCourts, snapshots] = await Promise.all([
    db.padelClubCourt.findMany({
      where: {
        padelClubId: sourceClubId,
        isActive: true,
        deletedAt: null,
      },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        surface: true,
        indoor: true,
        displayOrder: true,
        updatedAt: true,
      },
    }),
    db.padelClubCourt.findMany({
      where: {
        padelClubId: partnerClubId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        surface: true,
        indoor: true,
        displayOrder: true,
        isActive: true,
      },
    }),
    db.padelPartnerCourtSnapshot.findMany({
      where: {
        partnerClubId,
        sourceClubId,
      },
      select: {
        id: true,
        sourceCourtId: true,
        localCourtId: true,
        isActive: true,
      },
    }),
  ]);

  const localById = new Map(partnerCourts.map((court) => [court.id, court]));
  const snapshotBySourceCourtId = new Map(snapshots.map((snapshot) => [snapshot.sourceCourtId, snapshot]));

  let created = 0;
  let updated = 0;
  let deactivated = 0;
  const localCourtIds: number[] = [];
  const activeSourceCourtIds = new Set<number>();

  for (const sourceCourt of sourceCourts) {
    activeSourceCourtIds.add(sourceCourt.id);

    const snapshot = snapshotBySourceCourtId.get(sourceCourt.id);
    const localCourt =
      snapshot?.localCourtId && localById.has(snapshot.localCourtId)
        ? localById.get(snapshot.localCourtId)!
        : null;

    let resolvedLocalCourtId: number;
    if (localCourt) {
      await db.padelClubCourt.update({
        where: { id: localCourt.id },
        data: {
          name: sourceCourt.name,
          surface: sourceCourt.surface,
          indoor: sourceCourt.indoor,
          displayOrder: sourceCourt.displayOrder,
          isActive: true,
          deletedAt: null,
        },
      });
      resolvedLocalCourtId = localCourt.id;
      updated += 1;
    } else {
      const createdCourt = await db.padelClubCourt.create({
        data: {
          padelClubId: partnerClubId,
          name: sourceCourt.name,
          surface: sourceCourt.surface,
          indoor: sourceCourt.indoor,
          displayOrder: sourceCourt.displayOrder,
          isActive: true,
        },
        select: { id: true },
      });
      resolvedLocalCourtId = createdCourt.id;
      created += 1;
    }

    localCourtIds.push(resolvedLocalCourtId);

    await db.padelPartnerCourtSnapshot.upsert({
      where: {
        partnerClubId_sourceCourtId: {
          partnerClubId,
          sourceCourtId: sourceCourt.id,
        },
      },
      create: {
        partnerOrganizationId,
        partnerClubId,
        sourceClubId,
        sourceCourtId: sourceCourt.id,
        localCourtId: resolvedLocalCourtId,
        name: sourceCourt.name,
        surface: sourceCourt.surface,
        indoor: sourceCourt.indoor,
        displayOrder: sourceCourt.displayOrder,
        sourceUpdatedAt: sourceCourt.updatedAt,
        syncedAt: now,
        ttlAt,
        version: 1,
        isActive: true,
      },
      update: {
        localCourtId: resolvedLocalCourtId,
        name: sourceCourt.name,
        surface: sourceCourt.surface,
        indoor: sourceCourt.indoor,
        displayOrder: sourceCourt.displayOrder,
        sourceUpdatedAt: sourceCourt.updatedAt,
        syncedAt: now,
        ttlAt,
        isActive: true,
        version: { increment: 1 },
      },
    });
  }

  if (sourceCourts.length > 0) {
    const staleSnapshots = snapshots.filter((snapshot) => !activeSourceCourtIds.has(snapshot.sourceCourtId));
    if (staleSnapshots.length > 0) {
      await db.padelPartnerCourtSnapshot.updateMany({
        where: {
          id: { in: staleSnapshots.map((snapshot) => snapshot.id) },
          isActive: true,
        },
        data: {
          isActive: false,
          ttlAt,
          syncedAt: now,
          version: { increment: 1 },
        },
      });

      const staleLocalCourtIds = staleSnapshots
        .map((snapshot) => snapshot.localCourtId)
        .filter((courtId): courtId is number => Number.isFinite(courtId));
      if (staleLocalCourtIds.length > 0) {
        await db.padelClubCourt.updateMany({
          where: {
            id: { in: staleLocalCourtIds },
            padelClubId: partnerClubId,
            isActive: true,
            deletedAt: null,
          },
          data: {
            isActive: false,
            deletedAt: now,
          },
        });
      }
      deactivated += staleSnapshots.length;
    }
  }

  if (sourceCourts.length === 0) {
    const existingActive = partnerCourts.filter((court) => court.isActive).map((court) => court.id);
    if (existingActive.length > 0) {
      return {
        localCourtIds: existingActive,
        created,
        updated,
        deactivated,
        sourceCount: 0,
      };
    }

    const fallbackTotal = Math.max(0, Math.floor(fallbackCount));
    if (fallbackTotal > 0) {
      for (let i = 0; i < fallbackTotal; i += 1) {
        const createdCourt = await db.padelClubCourt.create({
          data: {
            padelClubId: partnerClubId,
            name: `Court ${i + 1}`,
            indoor: false,
            displayOrder: i + 1,
            isActive: true,
          },
          select: { id: true },
        });
        localCourtIds.push(createdCourt.id);
        created += 1;
      }
    }
  }

  return {
    localCourtIds,
    created,
    updated,
    deactivated,
    sourceCount: sourceCourts.length,
  };
}
