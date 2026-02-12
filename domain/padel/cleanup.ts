import { prisma } from "@/lib/prisma";
import { getLatestPolicyVersionForEvent } from "@/lib/checkin/accessPolicy";
import {
  INACTIVE_REGISTRATION_STATUSES,
  resolveRegistrationStatusFromSlots,
  upsertPadelRegistrationForPairing,
} from "@/domain/padelRegistration";
import {
  EntitlementType,
  PadelPairingJoinMode,
  PadelPairingStatus,
  PadelRegistrationStatus,
} from "@prisma/client";

export type PadelCleanupParams = {
  limit?: number;
  cursor?: number | null;
  eventId?: number | null;
  apply?: boolean;
  fixMissingRegistrations?: boolean;
  fixStatusMismatches?: boolean;
  fixPolicyVersions?: boolean;
  removeOrphanRegistrations?: boolean;
  orphanGraceHours?: number;
};

export type PadelCleanupSummary = {
  ok: true;
  apply: boolean;
  limit: number;
  nextCursor: number | null;
  pairingsProcessed: number;
  registrationsCreated: number;
  registrationsUpdated: number;
  mismatchesFound: number;
  cancelledRepaired: number;
  entitlementsUpdated: number;
  orphanRegistrationsDeleted: number;
  missingConfigs: Array<{ id: number; slug: string | null; title: string | null }>;
};

const clampLimit = (value?: number | null) => {
  const limit = typeof value === "number" && Number.isFinite(value) ? value : 200;
  return Math.min(Math.max(10, Math.floor(limit)), 500);
};

export async function runPadelCleanup(params: PadelCleanupParams = {}): Promise<PadelCleanupSummary> {
  const apply = Boolean(params.apply);
  const limit = clampLimit(params.limit);
  const cursor = Number.isFinite(params.cursor) ? Number(params.cursor) : null;
  const eventId = Number.isFinite(params.eventId) ? Number(params.eventId) : null;
  const fixMissingRegistrations = params.fixMissingRegistrations !== false;
  const fixStatusMismatches = params.fixStatusMismatches !== false;
  const fixPolicyVersions = params.fixPolicyVersions !== false;
  const removeOrphanRegistrations = Boolean(params.removeOrphanRegistrations);
  const orphanGraceHours = typeof params.orphanGraceHours === "number" ? params.orphanGraceHours : 24;

  let registrationsCreated = 0;
  let registrationsUpdated = 0;
  let mismatchesFound = 0;
  let cancelledRepaired = 0;
  let entitlementsUpdated = 0;
  let orphanRegistrationsDeleted = 0;

  const pairings = await prisma.padelPairing.findMany({
    where: {
      ...(eventId ? { eventId } : {}),
      ...(cursor ? { id: { gt: cursor } } : {}),
    },
    select: {
      id: true,
      eventId: true,
      organizationId: true,
      pairingStatus: true,
      pairingJoinMode: true,
      payment_mode: true,
      registration: { select: { status: true } },
      slots: { select: { slotStatus: true, paymentStatus: true, slot_role: true } },
    },
    orderBy: { id: "asc" },
    take: limit,
  });

  for (const pairing of pairings) {
    const expected = resolveRegistrationStatusFromSlots({
      pairingJoinMode: pairing.pairingJoinMode as PadelPairingJoinMode,
      slots: pairing.slots.map((slot) => ({
        slotStatus: slot.slotStatus,
        paymentStatus: slot.paymentStatus,
      })),
    });

    const existingStatus = pairing.registration?.status ?? null;
    const isTerminal = existingStatus ? INACTIVE_REGISTRATION_STATUSES.includes(existingStatus) : false;

    if (!existingStatus && fixMissingRegistrations) {
      mismatchesFound += 1;
      if (apply) {
        await prisma.$transaction((tx) =>
          upsertPadelRegistrationForPairing(tx, {
            pairingId: pairing.id,
            organizationId: pairing.organizationId,
            eventId: pairing.eventId,
            status: expected,
            paymentMode: pairing.payment_mode,
            reason: "MISSING_REGISTRATION",
          }),
        );
        registrationsCreated += 1;
      }
      continue;
    }

    if (!existingStatus) continue;

    if (pairing.pairingStatus === PadelPairingStatus.CANCELLED && existingStatus !== PadelRegistrationStatus.CANCELLED) {
      mismatchesFound += 1;
      if (apply) {
        await prisma.$transaction((tx) =>
          upsertPadelRegistrationForPairing(tx, {
            pairingId: pairing.id,
            organizationId: pairing.organizationId,
            eventId: pairing.eventId,
            status: PadelRegistrationStatus.CANCELLED,
            paymentMode: pairing.payment_mode,
            reason: "PAIRING_CANCELLED",
          }),
        );
        cancelledRepaired += 1;
        registrationsUpdated += 1;
      }
      continue;
    }

    if (!fixStatusMismatches) continue;
    if (isTerminal) continue;
    if (existingStatus !== expected) {
      mismatchesFound += 1;
      if (apply) {
        await prisma.$transaction((tx) =>
          upsertPadelRegistrationForPairing(tx, {
            pairingId: pairing.id,
            organizationId: pairing.organizationId,
            eventId: pairing.eventId,
            status: expected,
            paymentMode: pairing.payment_mode,
            reason: "STATUS_MISMATCH",
          }),
        );
        registrationsUpdated += 1;
      }
    }
  }

  if (fixPolicyVersions) {
    const entitlements = await prisma.entitlement.findMany({
      where: {
        type: EntitlementType.PADEL_ENTRY,
        eventId: { not: null },
        OR: [{ policyVersionApplied: null }, { policyVersionApplied: { lte: 0 } }],
      },
      select: { id: true, eventId: true },
      take: limit,
    });
    const eventIds = Array.from(new Set(entitlements.map((row) => row.eventId).filter(Boolean))) as number[];
    for (const eId of eventIds) {
      const policyVersion = await getLatestPolicyVersionForEvent(eId, prisma);
      if (!policyVersion) continue;
      if (apply) {
        const updated = await prisma.entitlement.updateMany({
          where: {
            eventId: eId,
            type: EntitlementType.PADEL_ENTRY,
            OR: [{ policyVersionApplied: null }, { policyVersionApplied: { lte: 0 } }],
          },
          data: { policyVersionApplied: policyVersion },
        });
        entitlementsUpdated += updated.count ?? 0;
      } else {
        entitlementsUpdated += entitlements.filter((row) => row.eventId === eId).length;
      }
    }
  }

  if (removeOrphanRegistrations) {
    const cutoff = new Date(Date.now() - orphanGraceHours * 60 * 60 * 1000);
    const orphans = await prisma.padelRegistration.findMany({
      where: { pairingId: null, createdAt: { lt: cutoff } },
      select: { id: true },
      take: limit,
    });
    if (apply && orphans.length > 0) {
      const deleted = await prisma.padelRegistration.deleteMany({
        where: { id: { in: orphans.map((row) => row.id) } },
      });
      orphanRegistrationsDeleted += deleted.count ?? 0;
    } else {
      orphanRegistrationsDeleted += orphans.length;
    }
  }

  const missingConfigs = await prisma.event.findMany({
    where: {
      templateType: "PADEL",
      isDeleted: false,
      padelTournamentConfig: { is: null },
    },
    select: { id: true, slug: true, title: true },
    take: 50,
  });

  return {
    ok: true,
    apply,
    limit,
    nextCursor: pairings.length ? pairings[pairings.length - 1].id : null,
    pairingsProcessed: pairings.length,
    registrationsCreated,
    registrationsUpdated,
    mismatchesFound,
    cancelledRepaired,
    entitlementsUpdated,
    orphanRegistrationsDeleted,
    missingConfigs,
  };
}
