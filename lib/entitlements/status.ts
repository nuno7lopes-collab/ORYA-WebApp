import { CheckinResultCode, EntitlementStatus } from "@prisma/client";

export type EntitlementV7Status = "ACTIVE" | "SUSPENDED" | "REVOKED";
export type TicketV7Status = "ACTIVE" | "DISPUTED" | "CANCELLED";
export type DisputeOutcome = "created" | "won" | "lost";

const CONSUMED_CHECKIN_CODES = new Set<CheckinResultCode>([
  CheckinResultCode.OK,
  CheckinResultCode.ALREADY_USED,
]);

export function mapLegacyStatusToV7(status: EntitlementStatus): EntitlementV7Status {
  switch (status) {
    case EntitlementStatus.SUSPENDED:
      return "SUSPENDED";
    case EntitlementStatus.REFUNDED:
    case EntitlementStatus.REVOKED:
      return "REVOKED";
    case EntitlementStatus.ACTIVE:
    default:
      return "ACTIVE";
  }
}

export function mapV7StatusToLegacy(status: EntitlementV7Status): EntitlementStatus {
  switch (status) {
    case "SUSPENDED":
      return EntitlementStatus.SUSPENDED;
    case "REVOKED":
      return EntitlementStatus.REVOKED;
    case "ACTIVE":
    default:
      return EntitlementStatus.ACTIVE;
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
  return mapLegacyStatusToV7(input.status);
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
    case "created":
      return { entitlementStatus: "SUSPENDED", ticketStatus: "DISPUTED" };
    case "won":
      return { entitlementStatus: "ACTIVE", ticketStatus: "ACTIVE" };
    case "lost":
    default:
      return { entitlementStatus: "REVOKED", ticketStatus: "CANCELLED" };
  }
}
