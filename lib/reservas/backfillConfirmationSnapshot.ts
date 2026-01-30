import { Prisma, type PrismaClient } from "@prisma/client";
import {
  BOOKING_CONFIRMATION_SNAPSHOT_VERSION,
  buildBookingConfirmationSnapshot,
} from "@/lib/reservas/confirmationSnapshot";

type PrismaLike = Pick<PrismaClient, "booking" | "organizationPolicy"> | Prisma.TransactionClient;

export const BACKFILL_STATUSES = [
  "CONFIRMED",
  "COMPLETED",
  "NO_SHOW",
  "DISPUTED",
  "CANCELLED",
  "CANCELLED_BY_CLIENT",
  "CANCELLED_BY_ORG",
] as const;

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

const toPositiveLimit = (value: number | null | undefined) => {
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.min(Math.max(1, Math.floor(value as number)), MAX_LIMIT);
};

const safeDate = (value: Date | null | undefined, fallback: Date) => {
  if (!value) return fallback;
  return Number.isNaN(value.getTime()) ? fallback : value;
};

export type BackfillBookingConfirmationOptions = {
  dryRun?: boolean;
  limit?: number | null;
  afterId?: number | null;
  logger?: (message: string) => void;
};

export type BackfillBookingConfirmationSummary = {
  dryRun: boolean;
  limit: number;
  lastId: number | null;
  scanned: number;
  updated: number;
  skipped: number;
  errors: number;
  missingPolicy: number;
  missingPricing: number;
  missingService: number;
  policyHintMissing: number;
  byStatus: Record<string, number>;
};

export async function backfillBookingConfirmationSnapshots(
  prisma: PrismaLike,
  options?: BackfillBookingConfirmationOptions,
): Promise<BackfillBookingConfirmationSummary> {
  const dryRun = Boolean(options?.dryRun);
  const limit = toPositiveLimit(options?.limit ?? null);
  const afterId = Number.isFinite(options?.afterId) ? Number(options?.afterId) : null;
  const logger = options?.logger ?? (() => {});

  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: [...BACKFILL_STATUSES] },
      confirmationSnapshot: { equals: Prisma.DbNull },
      ...(afterId ? { id: { gt: afterId } } : {}),
    },
    orderBy: [{ id: "asc" }],
    take: limit,
    select: {
      id: true,
      status: true,
      organizationId: true,
      price: true,
      currency: true,
      createdAt: true,
      updatedAt: true,
      policyRef: { select: { policyId: true } },
      service: {
        select: {
          policyId: true,
          unitPriceCents: true,
          currency: true,
          organization: {
            select: {
              feeMode: true,
              platformFeeBps: true,
              platformFeeFixedCents: true,
              orgType: true,
            },
          },
        },
      },
    },
  });

  const lastId = bookings.length > 0 ? bookings[bookings.length - 1]?.id ?? null : null;

  logger(
    `[booking_confirmation_backfill] Found ${bookings.length} bookings without confirmationSnapshot (limit=${limit}, afterId=${afterId ?? "none"}).`,
  );

  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let missingPolicy = 0;
  let missingPricing = 0;
  let missingService = 0;
  let policyHintMissing = 0;
  const byStatus: Record<string, number> = {};

  for (const booking of bookings) {
    byStatus[booking.status] = (byStatus[booking.status] ?? 0) + 1;

    if (!booking.service) {
      missingService += 1;
      skipped += 1;
      logger(
        `[booking_confirmation_backfill] SKIP booking ${booking.id}: missing service relation.`,
      );
      continue;
    }

    if (!booking.policyRef?.policyId && !booking.service.policyId) {
      policyHintMissing += 1;
    }

    const now = safeDate(booking.updatedAt, safeDate(booking.createdAt, new Date()));
    const result = await buildBookingConfirmationSnapshot({
      tx: prisma as Prisma.TransactionClient,
      booking,
      now,
      policyIdHint: booking.policyRef?.policyId ?? null,
      paymentMeta: null,
    });

    if (!result.ok) {
      skipped += 1;
      if (result.code === "POLICY_SNAPSHOT_MISSING") missingPolicy += 1;
      if (result.code === "PRICING_SNAPSHOT_MISSING") missingPricing += 1;
      logger(
        `[booking_confirmation_backfill] SKIP booking ${booking.id}: ${result.code}.`,
      );
      continue;
    }

    const snapshotCreatedAt = safeDate(new Date(result.snapshot.createdAt), now);
    const snapshotVersion =
      typeof result.snapshot.version === "number"
        ? result.snapshot.version
        : BOOKING_CONFIRMATION_SNAPSHOT_VERSION;

    if (dryRun) {
      skipped += 1;
      logger(
        `[booking_confirmation_backfill] DRY RUN booking ${booking.id}: snapshotVersion=${snapshotVersion} policyId=${result.policyId}.`,
      );
      continue;
    }

    try {
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          confirmationSnapshot: result.snapshot,
          confirmationSnapshotVersion: snapshotVersion,
          confirmationSnapshotCreatedAt: snapshotCreatedAt,
        },
      });
      updated += 1;
      logger(
        `[booking_confirmation_backfill] Updated booking ${booking.id}: snapshotVersion=${snapshotVersion} policyId=${result.policyId}.`,
      );
    } catch (err) {
      errors += 1;
      logger(
        `[booking_confirmation_backfill] ERROR booking ${booking.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  logger("[booking_confirmation_backfill] Summary:");
  logger(
    `- scanned=${bookings.length} updated=${updated} skipped=${skipped} errors=${errors}`,
  );
  logger(`- missingPolicy=${missingPolicy} missingPricing=${missingPricing} missingService=${missingService}`);
  logger(`- policyHintMissing=${policyHintMissing}`);
  logger(`- byStatus=${JSON.stringify(byStatus)}`);

  return {
    dryRun,
    limit,
    lastId,
    scanned: bookings.length,
    updated,
    skipped,
    errors,
    missingPolicy,
    missingPricing,
    missingService,
    policyHintMissing,
    byStatus,
  };
}
