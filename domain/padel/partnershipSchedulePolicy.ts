import {
  PadelPartnershipPriorityMode,
  PadelPartnershipStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

type DbClient = Prisma.TransactionClient | typeof prisma;

export type PartnershipCourtInput = {
  id: number;
  padelClubId: number | null;
};

export type PartnershipSchedulePolicy = {
  agreementIds: number[];
  priorityMode: PadelPartnershipPriorityMode;
  ownerOverrideAllowed: boolean;
  autoCompensationOnOverride: boolean;
  protectExternalReservations: boolean;
  hardStopMinutesBeforeBooking: number;
};

export type PartnershipScheduleConstraintsResult = {
  ok: boolean;
  errors: string[];
  additionalCourtBlocks: Array<{
    courtId: number;
    startAt: Date;
    endAt: Date;
    reason: string;
    partnerClubId: number;
    agreementIds: number[];
  }>;
  policyByPartnerClubId: Map<number, PartnershipSchedulePolicy>;
};

type Interval = { startAt: Date; endAt: Date };
type PartnershipWindowRow = {
  id: number;
  agreementId: number;
  ownerClubId: number;
  ownerCourtId: number | null;
  weekdayMask: number;
  startMinute: number;
  endMinute: number;
  startsAt: Date | null;
  endsAt: Date | null;
};
type PartnershipPolicyRow = {
  agreementId: number;
  priorityMode: PadelPartnershipPriorityMode;
  ownerOverrideAllowed: boolean;
  autoCompensationOnOverride: boolean;
  protectExternalReservations: boolean;
  hardStopMinutesBeforeBooking: number;
};
type PartnershipSnapshotRow = {
  partnerClubId: number;
  localCourtId: number | null;
  sourceCourtId: number;
};

function overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && startB < endA;
}

function clipInterval(interval: Interval, windowStart: Date, windowEnd: Date): Interval | null {
  const startAt = interval.startAt > windowStart ? interval.startAt : windowStart;
  const endAt = interval.endAt < windowEnd ? interval.endAt : windowEnd;
  if (endAt <= startAt) return null;
  return { startAt, endAt };
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push({ startAt: interval.startAt, endAt: interval.endAt });
      continue;
    }
    if (interval.startAt <= last.endAt) {
      if (interval.endAt > last.endAt) {
        last.endAt = interval.endAt;
      }
      continue;
    }
    merged.push({ startAt: interval.startAt, endAt: interval.endAt });
  }
  return merged;
}

function complementIntervals(rangeStart: Date, rangeEnd: Date, allowed: Interval[]): Interval[] {
  const normalized = mergeIntervals(
    allowed
      .map((interval) => clipInterval(interval, rangeStart, rangeEnd))
      .filter((interval): interval is Interval => Boolean(interval)),
  );
  if (normalized.length === 0) return [{ startAt: rangeStart, endAt: rangeEnd }];

  const blocked: Interval[] = [];
  let cursor = rangeStart;
  for (const interval of normalized) {
    if (cursor < interval.startAt) {
      blocked.push({ startAt: cursor, endAt: interval.startAt });
    }
    if (interval.endAt > cursor) cursor = interval.endAt;
  }
  if (cursor < rangeEnd) {
    blocked.push({ startAt: cursor, endAt: rangeEnd });
  }
  return blocked.filter((interval) => interval.endAt > interval.startAt);
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function toUtcMinuteWindow(dayStartUtc: Date, startMinute: number, endMinute: number) {
  const startAt = new Date(dayStartUtc.getTime() + Math.max(0, startMinute) * 60 * 1000);
  const endAt = new Date(dayStartUtc.getTime() + Math.min(1440, endMinute) * 60 * 1000);
  return { startAt, endAt };
}

function weekdayAllowed(weekdayMask: number, date: Date) {
  const weekday = date.getUTCDay();
  const bit = 1 << weekday;
  return (weekdayMask & bit) !== 0;
}

function buildAllowedIntervalsForCourt(params: {
  windowStart: Date;
  windowEnd: Date;
  windows: Array<{
    startMinute: number;
    endMinute: number;
    weekdayMask: number;
    startsAt: Date | null;
    endsAt: Date | null;
  }>;
}) {
  const { windowStart, windowEnd, windows } = params;
  const allowed: Interval[] = [];
  if (windows.length === 0) return allowed;

  const dayCursor = startOfUtcDay(windowStart);
  const dayEnd = startOfUtcDay(windowEnd);
  for (
    let cursor = new Date(dayCursor.getTime());
    cursor <= dayEnd;
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  ) {
    for (const window of windows) {
      if (!weekdayAllowed(window.weekdayMask, cursor)) continue;
      const { startAt, endAt } = toUtcMinuteWindow(cursor, window.startMinute, window.endMinute);
      if (endAt <= startAt) continue;
      if (window.startsAt && endAt <= window.startsAt) continue;
      if (window.endsAt && startAt >= window.endsAt) continue;
      if (!overlaps(startAt, endAt, windowStart, windowEnd)) continue;

      const clipped = clipInterval(
        {
          startAt: window.startsAt && startAt < window.startsAt ? window.startsAt : startAt,
          endAt: window.endsAt && endAt > window.endsAt ? window.endsAt : endAt,
        },
        windowStart,
        windowEnd,
      );
      if (clipped) allowed.push(clipped);
    }
  }

  return mergeIntervals(allowed);
}

function dateRangesOverlap(
  startsAt: Date | null,
  endsAt: Date | null,
  windowStart: Date,
  windowEnd: Date,
) {
  const aStart = startsAt ?? new Date(-8640000000000000);
  const aEnd = endsAt ?? new Date(8640000000000000);
  return aStart < windowEnd && windowStart < aEnd;
}

export async function resolvePartnershipScheduleConstraints(params: {
  organizationId: number;
  windowStart: Date;
  windowEnd: Date;
  courts: PartnershipCourtInput[];
  db?: DbClient;
}): Promise<PartnershipScheduleConstraintsResult> {
  const { organizationId, windowStart, windowEnd, courts, db: client } = params;
  const db = client ?? prisma;

  const clubIds = Array.from(
    new Set(courts.map((court) => court.padelClubId).filter((id): id is number => typeof id === "number" && Number.isFinite(id))),
  );
  if (clubIds.length === 0) {
    return { ok: true, errors: [], additionalCourtBlocks: [], policyByPartnerClubId: new Map() };
  }

  const clubs = await db.padelClub.findMany({
    where: {
      id: { in: clubIds },
      organizationId,
      deletedAt: null,
      isActive: true,
    },
    select: {
      id: true,
      kind: true,
      sourceClubId: true,
    },
  });
  const partnerClubs = clubs.filter((club) => club.kind === "PARTNER");
  if (partnerClubs.length === 0) {
    return { ok: true, errors: [], additionalCourtBlocks: [], policyByPartnerClubId: new Map() };
  }

  const errors: string[] = [];
  const policyByPartnerClubId = new Map<number, PartnershipSchedulePolicy>();
  const additionalCourtBlocks: PartnershipScheduleConstraintsResult["additionalCourtBlocks"] = [];

  const sourceClubIds = Array.from(
    new Set(partnerClubs.map((club) => club.sourceClubId).filter((id): id is number => typeof id === "number")),
  );
  const agreements = await db.padelPartnershipAgreement.findMany({
    where: {
      ownerClubId: { in: sourceClubIds },
      partnerOrganizationId: organizationId,
      status: PadelPartnershipStatus.APPROVED,
      revokedAt: null,
      OR: [{ partnerClubId: null }, { partnerClubId: { in: partnerClubs.map((club) => club.id) } }],
      AND: [
        {
          OR: [{ startsAt: null }, { startsAt: { lte: windowEnd } }],
        },
        {
          OR: [{ endsAt: null }, { endsAt: { gte: windowStart } }],
        },
      ],
    },
    select: {
      id: true,
      ownerClubId: true,
      partnerClubId: true,
      startsAt: true,
      endsAt: true,
    },
    orderBy: [{ approvedAt: "desc" }, { id: "desc" }],
  });

  const agreementsByPartnerClubId = new Map<number, typeof agreements>();
  for (const partnerClub of partnerClubs) {
    const scoped = agreements.filter((agreement) => {
      if (agreement.ownerClubId !== partnerClub.sourceClubId) return false;
      if (agreement.partnerClubId && agreement.partnerClubId !== partnerClub.id) return false;
      return dateRangesOverlap(agreement.startsAt, agreement.endsAt, windowStart, windowEnd);
    });
    agreementsByPartnerClubId.set(partnerClub.id, scoped);
    if (scoped.length === 0) {
      errors.push(`PARTNERSHIP_AGREEMENT_REQUIRED:club:${partnerClub.id}`);
    }
  }

  const agreementIds = Array.from(new Set(agreements.map((agreement) => agreement.id)));
  const windows: PartnershipWindowRow[] = agreementIds.length
    ? await db.padelPartnershipWindow.findMany({
        where: {
          agreementId: { in: agreementIds },
          isActive: true,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: windowEnd } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: windowStart } }] },
          ],
        },
        select: {
          id: true,
          agreementId: true,
          ownerClubId: true,
          ownerCourtId: true,
          weekdayMask: true,
          startMinute: true,
          endMinute: true,
          startsAt: true,
          endsAt: true,
        },
      })
    : [];
  const policies: PartnershipPolicyRow[] = agreementIds.length
    ? await db.padelPartnershipBookingPolicy.findMany({
        where: { agreementId: { in: agreementIds } },
        select: {
          agreementId: true,
          priorityMode: true,
          ownerOverrideAllowed: true,
          autoCompensationOnOverride: true,
          protectExternalReservations: true,
          hardStopMinutesBeforeBooking: true,
        },
      })
    : [];
  const snapshots: PartnershipSnapshotRow[] = await db.padelPartnerCourtSnapshot.findMany({
    where: {
      partnerOrganizationId: organizationId,
      partnerClubId: { in: partnerClubs.map((club) => club.id) },
      localCourtId: { in: courts.map((court) => court.id) },
      isActive: true,
    },
    select: {
      partnerClubId: true,
      localCourtId: true,
      sourceCourtId: true,
    },
  });

  const policyByAgreementId = new Map<number, PartnershipPolicyRow>(
    policies.map((policy) => [policy.agreementId, policy] as [number, PartnershipPolicyRow]),
  );
  const snapshotByLocalCourtId = new Map<number, PartnershipSnapshotRow>(
    snapshots
      .filter((snapshot) => typeof snapshot.localCourtId === "number")
      .map((snapshot) => [snapshot.localCourtId as number, snapshot] as [number, PartnershipSnapshotRow]),
  );

  for (const partnerClub of partnerClubs) {
    const scopedAgreements = agreementsByPartnerClubId.get(partnerClub.id) ?? [];
    if (scopedAgreements.length === 0) continue;

    const agreementIdsForClub = scopedAgreements.map((agreement) => agreement.id);
    const scopedPolicies = agreementIdsForClub
      .map((agreementId) => policyByAgreementId.get(agreementId))
      .filter((policy): policy is PartnershipPolicyRow => Boolean(policy));
    const primaryPolicy = scopedPolicies[0];
    policyByPartnerClubId.set(partnerClub.id, {
      agreementIds: agreementIdsForClub,
      priorityMode: primaryPolicy?.priorityMode ?? "FIRST_CONFIRMED_WITH_OWNER_OVERRIDE",
      ownerOverrideAllowed: primaryPolicy?.ownerOverrideAllowed ?? true,
      autoCompensationOnOverride: primaryPolicy?.autoCompensationOnOverride ?? true,
      protectExternalReservations: primaryPolicy?.protectExternalReservations ?? true,
      hardStopMinutesBeforeBooking: primaryPolicy?.hardStopMinutesBeforeBooking ?? 30,
    });

    const clubCourts = courts.filter((court) => court.padelClubId === partnerClub.id);
    for (const court of clubCourts) {
      const snapshot = snapshotByLocalCourtId.get(court.id);
      if (!snapshot) {
        additionalCourtBlocks.push({
          courtId: court.id,
          startAt: windowStart,
          endAt: windowEnd,
          reason: "PARTNERSHIP_SNAPSHOT_REQUIRED",
          partnerClubId: partnerClub.id,
          agreementIds: agreementIdsForClub,
        });
        errors.push(`PARTNERSHIP_SNAPSHOT_REQUIRED:court:${court.id}`);
        continue;
      }

      const courtWindows = windows.filter((window) => {
        if (!agreementIdsForClub.includes(window.agreementId)) return false;
        if (window.ownerClubId !== partnerClub.sourceClubId) return false;
        if (window.ownerCourtId && window.ownerCourtId !== snapshot.sourceCourtId) return false;
        return dateRangesOverlap(window.startsAt, window.endsAt, windowStart, windowEnd);
      });

      if (courtWindows.length === 0) {
        additionalCourtBlocks.push({
          courtId: court.id,
          startAt: windowStart,
          endAt: windowEnd,
          reason: "PARTNERSHIP_WINDOW_REQUIRED",
          partnerClubId: partnerClub.id,
          agreementIds: agreementIdsForClub,
        });
        errors.push(`PARTNERSHIP_WINDOW_REQUIRED:court:${court.id}`);
        continue;
      }

      const allowedIntervals = buildAllowedIntervalsForCourt({
        windowStart,
        windowEnd,
        windows: courtWindows.map((window) => ({
          startMinute: window.startMinute,
          endMinute: window.endMinute,
          weekdayMask: window.weekdayMask,
          startsAt: window.startsAt,
          endsAt: window.endsAt,
        })),
      });

      const blockedIntervals = complementIntervals(windowStart, windowEnd, allowedIntervals);
      for (const blocked of blockedIntervals) {
        additionalCourtBlocks.push({
          courtId: court.id,
          startAt: blocked.startAt,
          endAt: blocked.endAt,
          reason: "PARTNERSHIP_WINDOW_BLOCK",
          partnerClubId: partnerClub.id,
          agreementIds: agreementIdsForClub,
        });
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    additionalCourtBlocks,
    policyByPartnerClubId,
  };
}
