import {
  PadelPairingGuaranteeStatus,
  PadelPairingLifecycleStatus,
} from "@prisma/client";

export type PairingAction =
  | "CAPTAIN_PAID"
  | "PARTNER_ASSIGNED"
  | "PARTNER_PAID"
  | "CAPTAIN_FULL_CONFIRMED"
  | "CANCEL";

export type GuaranteeAction =
  | "ARM"
  | "SCHEDULE_CHARGE"
  | "CHARGE_SUCCEEDED"
  | "CHARGE_FAILED"
  | "REQUIRES_ACTION"
  | "EXPIRE"
  | "CANCEL_GUARANTEE";

const terminalStatuses: PadelPairingLifecycleStatus[] = [
  "CONFIRMED_BOTH_PAID",
  "CONFIRMED_CAPTAIN_FULL",
  "CANCELLED_INCOMPLETE",
];

const transitionMap: Record<
  PadelPairingLifecycleStatus,
  Partial<Record<PairingAction, PadelPairingLifecycleStatus>>
> = {
  PENDING_ONE_PAID: {
    CAPTAIN_PAID: "PENDING_PARTNER_PAYMENT",
    CAPTAIN_FULL_CONFIRMED: "CONFIRMED_CAPTAIN_FULL",
    CANCEL: "CANCELLED_INCOMPLETE",
  },
  PENDING_PARTNER_PAYMENT: {
    PARTNER_ASSIGNED: "PENDING_PARTNER_PAYMENT",
    PARTNER_PAID: "CONFIRMED_BOTH_PAID",
    CAPTAIN_FULL_CONFIRMED: "CONFIRMED_CAPTAIN_FULL",
    CANCEL: "CANCELLED_INCOMPLETE",
  },
  CONFIRMED_BOTH_PAID: {},
  CONFIRMED_CAPTAIN_FULL: {},
  CANCELLED_INCOMPLETE: {},
};

export function isTerminal(status: PadelPairingLifecycleStatus) {
  return terminalStatuses.includes(status);
}

export function canTransition(
  from: PadelPairingLifecycleStatus,
  to: PadelPairingLifecycleStatus,
): boolean {
  if (from === to) return true;
  if (isTerminal(from)) return false;
  const actions = transitionMap[from] || {};
  return Object.values(actions).includes(to);
}

export function transition(
  current: PadelPairingLifecycleStatus,
  action: PairingAction,
): PadelPairingLifecycleStatus {
  if (isTerminal(current) && action !== "CANCEL") {
    return current;
  }
  const next = transitionMap[current]?.[action];
  return next ?? current;
}

// Guarantee (Modelo A) state machine
const guaranteeMap: Record<
  PadelPairingGuaranteeStatus,
  Partial<Record<GuaranteeAction, PadelPairingGuaranteeStatus>>
> = {
  NONE: {
    ARM: "ARMED",
  },
  ARMED: {
    SCHEDULE_CHARGE: "SCHEDULED",
    CANCEL_GUARANTEE: "NONE",
  },
  SCHEDULED: {
    CHARGE_SUCCEEDED: "SUCCEEDED",
    CHARGE_FAILED: "FAILED",
    REQUIRES_ACTION: "REQUIRES_ACTION",
    EXPIRE: "EXPIRED",
  },
  REQUIRES_ACTION: {
    CHARGE_SUCCEEDED: "SUCCEEDED",
    CHARGE_FAILED: "FAILED",
    EXPIRE: "EXPIRED",
  },
  FAILED: {
    REQUIRES_ACTION: "REQUIRES_ACTION",
  },
  SUCCEEDED: {},
  EXPIRED: {},
};

export function transitionGuarantee(
  current: PadelPairingGuaranteeStatus,
  action: GuaranteeAction,
): PadelPairingGuaranteeStatus {
  const next = guaranteeMap[current]?.[action];
  return next ?? current;
}

export function computeGraceUntil(
  nextGuaranteeStatus: PadelPairingGuaranteeStatus,
  now: Date = new Date(),
): Date | null {
  if (nextGuaranteeStatus === "REQUIRES_ACTION") {
    return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
  return null;
}
