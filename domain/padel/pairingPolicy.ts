import { DerivedPairingLifecycleStatus, isConfirmedLifecycle } from "@/domain/padelRegistration";

export function canSwapPartner(
  lifecycleStatus: DerivedPairingLifecycleStatus | null | undefined,
  now: Date,
  partnerSwapAllowedUntilAt?: Date | null,
) {
  if (!partnerSwapAllowedUntilAt) return false;
  if (isConfirmedLifecycle(lifecycleStatus ?? null)) return false;
  return now.getTime() <= partnerSwapAllowedUntilAt.getTime();
}

export function canMarkWalkover(status: DerivedPairingLifecycleStatus | null | undefined) {
  return status === "CONFIRMED_BOTH_PAID" || status === "CONFIRMED_CAPTAIN_FULL";
}
