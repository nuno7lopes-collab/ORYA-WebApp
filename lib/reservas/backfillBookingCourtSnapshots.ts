import { Prisma, type PrismaClient } from "@prisma/client";
import { resolveCourtSnapshot } from "@/lib/reservas/courtSnapshot";

type PrismaLike = Pick<PrismaClient, "booking" | "courtBookingConfig" | "padelClubCourt"> | Prisma.TransactionClient;

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

const toPositiveLimit = (value: number | null | undefined) => {
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.min(Math.max(1, Math.floor(value as number)), MAX_LIMIT);
};

export type BackfillBookingCourtSnapshotOptions = {
  dryRun?: boolean;
  limit?: number | null;
  afterId?: number | null;
  logger?: (message: string) => void;
};

export type BackfillBookingCourtSnapshotSummary = {
  dryRun: boolean;
  limit: number;
  lastId: number | null;
  scanned: number;
  updated: number;
  skipped: number;
  errors: number;
  missingCourtSnapshot: number;
};

export async function backfillBookingCourtSnapshots(
  prisma: PrismaLike,
  options?: BackfillBookingCourtSnapshotOptions,
): Promise<BackfillBookingCourtSnapshotSummary> {
  const dryRun = Boolean(options?.dryRun);
  const limit = toPositiveLimit(options?.limit ?? null);
  const afterId = Number.isFinite(options?.afterId) ? Number(options?.afterId) : null;
  const logger = options?.logger ?? (() => {});

  const bookings = await prisma.booking.findMany({
    where: {
      courtId: { not: null },
      OR: [
        { courtSnapshotName: null },
        { courtSnapshotCoverImageUrl: null },
      ],
      ...(afterId ? { id: { gt: afterId } } : {}),
    },
    orderBy: [{ id: "asc" }],
    take: limit,
    select: {
      id: true,
      organizationId: true,
      courtId: true,
      courtSnapshotName: true,
      courtSnapshotCoverImageUrl: true,
    },
  });

  const lastId = bookings.length > 0 ? bookings[bookings.length - 1]?.id ?? null : null;

  logger(
    `[booking_court_snapshot_backfill] found=${bookings.length} limit=${limit} afterId=${afterId ?? "none"} mode=${
      dryRun ? "dry-run" : "execute"
    }`,
  );

  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let missingCourtSnapshot = 0;

  for (const booking of bookings) {
    const snapshot = await resolveCourtSnapshot(prisma, {
      organizationId: booking.organizationId,
      courtId: booking.courtId,
    });

    if (!snapshot) {
      missingCourtSnapshot += 1;
      skipped += 1;
      logger(
        `[booking_court_snapshot_backfill] SKIP booking=${booking.id} reason=COURT_SNAPSHOT_NOT_FOUND courtId=${booking.courtId ?? "null"}`,
      );
      continue;
    }

    const nextName = snapshot.name ?? booking.courtSnapshotName ?? null;
    const nextCover = snapshot.coverImageUrl ?? booking.courtSnapshotCoverImageUrl ?? null;

    if (nextName === booking.courtSnapshotName && nextCover === booking.courtSnapshotCoverImageUrl) {
      skipped += 1;
      continue;
    }

    if (dryRun) {
      skipped += 1;
      logger(
        `[booking_court_snapshot_backfill] DRY booking=${booking.id} courtId=${snapshot.courtId} name=${nextName ?? "null"}`,
      );
      continue;
    }

    try {
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          courtSnapshotName: nextName,
          courtSnapshotCoverImageUrl: nextCover,
        },
      });
      updated += 1;
      logger(
        `[booking_court_snapshot_backfill] UPDATED booking=${booking.id} courtId=${snapshot.courtId} name=${nextName ?? "null"}`,
      );
    } catch (err) {
      errors += 1;
      logger(
        `[booking_court_snapshot_backfill] ERROR booking=${booking.id} message=${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  logger(
    `[booking_court_snapshot_backfill] summary scanned=${bookings.length} updated=${updated} skipped=${skipped} errors=${errors} missingCourtSnapshot=${missingCourtSnapshot}`,
  );

  return {
    dryRun,
    limit,
    lastId,
    scanned: bookings.length,
    updated,
    skipped,
    errors,
    missingCourtSnapshot,
  };
}
