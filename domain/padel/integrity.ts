import {
  PadelPairingJoinMode,
  PadelPairingPaymentStatus,
  PadelPairingSlotStatus,
  PadelPairingStatus,
  PadelRegistrationStatus,
} from "@prisma/client";

export type PadelIntegrityPairing = {
  id: number;
  eventId: number;
  categoryId: number | null;
  pairingStatus: PadelPairingStatus;
  pairingJoinMode: PadelPairingJoinMode;
  registrationStatus: PadelRegistrationStatus | null;
  slots: Array<{ slotStatus: PadelPairingSlotStatus; paymentStatus: PadelPairingPaymentStatus }>;
};

export type PadelIntegrityIssue = {
  pairingId: number;
  eventId: number;
  categoryId: number | null;
  reason: string;
  pairingStatus: PadelPairingStatus;
  pairingJoinMode: PadelPairingJoinMode;
  registrationStatus: PadelRegistrationStatus | null;
  expectedStatus?: PadelRegistrationStatus | null;
};

const TERMINAL_STATUSES = new Set<PadelRegistrationStatus>([
  PadelRegistrationStatus.CANCELLED,
  PadelRegistrationStatus.EXPIRED,
  PadelRegistrationStatus.REFUNDED,
]);

export function resolveExpectedRegistrationStatus(pairing: PadelIntegrityPairing) {
  const slots = pairing.slots ?? [];
  const allFilled = slots.length > 0 && slots.every((slot) => slot.slotStatus === PadelPairingSlotStatus.FILLED);
  const allPaid = slots.length > 0 && slots.every((slot) => slot.paymentStatus === PadelPairingPaymentStatus.PAID);

  if (allFilled && allPaid) return PadelRegistrationStatus.CONFIRMED;
  if (allFilled && !allPaid) return PadelRegistrationStatus.PENDING_PAYMENT;
  if (pairing.pairingJoinMode === PadelPairingJoinMode.LOOKING_FOR_PARTNER) {
    return PadelRegistrationStatus.MATCHMAKING;
  }
  return PadelRegistrationStatus.PENDING_PARTNER;
}

export function evaluatePadelIntegrity(pairing: PadelIntegrityPairing): PadelIntegrityIssue[] {
  const issues: PadelIntegrityIssue[] = [];
  const registrationStatus = pairing.registrationStatus ?? null;
  if (!registrationStatus) return issues;

  const expected = resolveExpectedRegistrationStatus(pairing);
  const allFilled = pairing.slots.length > 0 && pairing.slots.every((slot) => slot.slotStatus === PadelPairingSlotStatus.FILLED);
  const allPaid = pairing.slots.length > 0 && pairing.slots.every((slot) => slot.paymentStatus === PadelPairingPaymentStatus.PAID);

  if (registrationStatus === PadelRegistrationStatus.CONFIRMED) {
    if (pairing.pairingStatus !== PadelPairingStatus.COMPLETE) {
      issues.push({
        pairingId: pairing.id,
        eventId: pairing.eventId,
        categoryId: pairing.categoryId,
        reason: "CONFIRMED_PAIRING_INCOMPLETE",
        pairingStatus: pairing.pairingStatus,
        pairingJoinMode: pairing.pairingJoinMode,
        registrationStatus,
        expectedStatus: expected,
      });
    }
    if (!allFilled || !allPaid) {
      issues.push({
        pairingId: pairing.id,
        eventId: pairing.eventId,
        categoryId: pairing.categoryId,
        reason: "CONFIRMED_SLOTS_UNPAID",
        pairingStatus: pairing.pairingStatus,
        pairingJoinMode: pairing.pairingJoinMode,
        registrationStatus,
        expectedStatus: expected,
      });
    }
  }

  if (registrationStatus === PadelRegistrationStatus.MATCHMAKING && pairing.pairingJoinMode !== PadelPairingJoinMode.LOOKING_FOR_PARTNER) {
    issues.push({
      pairingId: pairing.id,
      eventId: pairing.eventId,
      categoryId: pairing.categoryId,
      reason: "MATCHMAKING_JOINMODE_MISMATCH",
      pairingStatus: pairing.pairingStatus,
      pairingJoinMode: pairing.pairingJoinMode,
      registrationStatus,
      expectedStatus: expected,
    });
  }

  if (
    (registrationStatus === PadelRegistrationStatus.PENDING_PARTNER ||
      registrationStatus === PadelRegistrationStatus.PENDING_PAYMENT) &&
    pairing.pairingJoinMode === PadelPairingJoinMode.LOOKING_FOR_PARTNER
  ) {
    issues.push({
      pairingId: pairing.id,
      eventId: pairing.eventId,
      categoryId: pairing.categoryId,
      reason: "PENDING_JOINMODE_MISMATCH",
      pairingStatus: pairing.pairingStatus,
      pairingJoinMode: pairing.pairingJoinMode,
      registrationStatus,
      expectedStatus: expected,
    });
  }

  if (pairing.pairingStatus === PadelPairingStatus.CANCELLED && !TERMINAL_STATUSES.has(registrationStatus)) {
    issues.push({
      pairingId: pairing.id,
      eventId: pairing.eventId,
      categoryId: pairing.categoryId,
      reason: "PAIRING_CANCELLED_REGISTRATION_ACTIVE",
      pairingStatus: pairing.pairingStatus,
      pairingJoinMode: pairing.pairingJoinMode,
      registrationStatus,
      expectedStatus: expected,
    });
  }

  if (TERMINAL_STATUSES.has(registrationStatus) && pairing.pairingStatus !== PadelPairingStatus.CANCELLED) {
    issues.push({
      pairingId: pairing.id,
      eventId: pairing.eventId,
      categoryId: pairing.categoryId,
      reason: "TERMINAL_REGISTRATION_PAIRING_ACTIVE",
      pairingStatus: pairing.pairingStatus,
      pairingJoinMode: pairing.pairingJoinMode,
      registrationStatus,
      expectedStatus: expected,
    });
  }

  if (!TERMINAL_STATUSES.has(registrationStatus) && registrationStatus !== expected) {
    issues.push({
      pairingId: pairing.id,
      eventId: pairing.eventId,
      categoryId: pairing.categoryId,
      reason: "REGISTRATION_STATUS_MISMATCH",
      pairingStatus: pairing.pairingStatus,
      pairingJoinMode: pairing.pairingJoinMode,
      registrationStatus,
      expectedStatus: expected,
    });
  }

  return issues;
}

export function computePadelIntegritySummary(pairings: PadelIntegrityPairing[]) {
  const issues = pairings.flatMap((pairing) => evaluatePadelIntegrity(pairing));
  const byReason = new Map<string, number>();
  issues.forEach((issue) => {
    byReason.set(issue.reason, (byReason.get(issue.reason) ?? 0) + 1);
  });
  return {
    issues,
    counts: {
      total: issues.length,
      byReason: Object.fromEntries(byReason),
    },
  };
}
