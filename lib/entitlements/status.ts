import { CheckinResultCode, EntitlementStatus } from "@prisma/client";

export type EntitlementV7Status = "PENDING" | "ACTIVE" | "SUSPENDED" | "REVOKED" | "EXPIRED";
export type TicketV7Status = "ACTIVE" | "DISPUTED" | "CANCELLED" | "CHARGEBACK_LOST";
export type DisputeOutcome = "OPENED" | "WON" | "LOST";

const CONSUMED_CHECKIN_CODES = new Set<CheckinResultCode>([
  CheckinResultCode.OK,
  CheckinResultCode.ALREADY_USED,
]);

export function mapEntitlementStatusToV7(status: EntitlementStatus): EntitlementV7Status {
  switch (status) {
    case EntitlementStatus.PENDING:
      return "PENDING";
    case EntitlementStatus.EXPIRED:
      return "EXPIRED";
    case EntitlementStatus.SUSPENDED:
      return "SUSPENDED";
    case EntitlementStatus.REVOKED:
      return "REVOKED";
    case EntitlementStatus.ACTIVE:
    default:
      return "ACTIVE";
  }
}

export function isConsumed(input: {
  status: EntitlementStatus;
  checkins?: Array<{ resultCode: CheckinResultCode }>;
}): boolean {
  const checkins = input.checkins ?? [];
  return checkins.some((checkin) => CONSUMED_CHECKIN_CODES.has(checkin.resultCode));
}

export function getEntitlementEffectiveStatus(input: {
  status: EntitlementStatus;
  checkins?: Array<{ resultCode: CheckinResultCode }>;
}): EntitlementV7Status {
  return mapEntitlementStatusToV7(input.status);
}

export function getCheckinResultFromExisting(existing?: { resultCode: CheckinResultCode } | null) {
  if (!existing) return null;
  return existing.resultCode === CheckinResultCode.OK
    ? CheckinResultCode.ALREADY_USED
    : existing.resultCode;
}

export function resolveDisputeOutcome(outcome: DisputeOutcome): {
  entitlementStatus: EntitlementV7Status;
  ticketStatus: TicketV7Status;
} {
  switch (outcome) {
    case "OPENED":
      return { entitlementStatus: "SUSPENDED", ticketStatus: "DISPUTED" };
    case "WON":
      return { entitlementStatus: "ACTIVE", ticketStatus: "ACTIVE" };
    case "LOST":
    default:
      return { entitlementStatus: "REVOKED", ticketStatus: "CHARGEBACK_LOST" };
  }
}
