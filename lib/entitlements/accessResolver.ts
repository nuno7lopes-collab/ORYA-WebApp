import { EntitlementStatus, EntitlementType } from "@prisma/client";
import { getEntitlementEffectiveStatus, isConsumed } from "@/lib/entitlements/status";

export type RequesterRole = "OWNER" | "ORGANIZATION" | "ADMIN";

export type EntitlementActions = {
  canShowQr: boolean;
  canCheckIn: boolean;
  canClaim: boolean;
  canViewDetails: boolean;
  canContactSupport: boolean;
};

export type ResolverInput = {
  type: EntitlementType;
  status: EntitlementStatus;
  isOwner: boolean;
  isOrganization: boolean;
  isAdmin: boolean;
  checkinWindow?: { start: Date | null; end: Date | null };
  outsideWindow?: boolean;
  emailVerified?: boolean;
  isGuestOwner?: boolean;
};

function insideWindow(window?: { start: Date | null; end: Date | null }) {
  if (!window) return true;
  const now = new Date();
  if (window.start && now < window.start) return false;
  if (window.end && now > window.end) return false;
  return true;
}

export function resolveActions(input: ResolverInput): EntitlementActions {
  const { status, isOwner, isOrganization, isAdmin, checkinWindow, outsideWindow, emailVerified, isGuestOwner } = input;
  const effectiveStatus = getEntitlementEffectiveStatus({ status });
  const consumed = isConsumed({ status });
  const baseBlocked = effectiveStatus === "REVOKED" || effectiveStatus === "SUSPENDED";

  const canViewDetails = isOwner || isAdmin || isOrganization;
  const canShowQr =
    isOwner &&
    effectiveStatus === "ACTIVE" &&
    !baseBlocked &&
    !consumed &&
    insideWindow(checkinWindow) &&
    !outsideWindow;

  const isWithinWindow = !outsideWindow && insideWindow(checkinWindow);
  const canCheckIn =
    (isOrganization || isAdmin) &&
    effectiveStatus === "ACTIVE" &&
    !baseBlocked &&
    isWithinWindow;

  const canClaim = Boolean(isGuestOwner && emailVerified && effectiveStatus === "ACTIVE");

  return {
    canShowQr,
    canCheckIn,
    canClaim,
    canViewDetails,
    canContactSupport: canViewDetails,
  };
}
