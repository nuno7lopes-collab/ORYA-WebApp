import { PadelPairingLifecycleStatus } from "@prisma/client";

export function canSwapPartner(lifecycleStatus: PadelPairingLifecycleStatus, now: Date, partnerSwapAllowedUntilAt?: Date | null) {
  if (!partnerSwapAllowedUntilAt) return false;
  if (lifecycleStatus?.toString().startsWith("CONFIRMED")) return false;
  return now.getTime() <= partnerSwapAllowedUntilAt.getTime();
}

export function canMarkWalkover(status: PadelPairingLifecycleStatus) {
  return status === "CONFIRMED_BOTH_PAID" || status === "CONFIRMED_CAPTAIN_FULL";
}
