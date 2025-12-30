import { EntitlementStatus, EntitlementType } from "@prisma/client";

export type RequesterRole = "OWNER" | "ORGANIZER" | "ADMIN";

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
  isOrganizer: boolean;
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
  const { status, isOwner, isOrganizer, isAdmin, checkinWindow, outsideWindow, emailVerified, isGuestOwner } = input;
  const baseBlocked =
    status === EntitlementStatus.REFUNDED ||
    status === EntitlementStatus.REVOKED ||
    status === EntitlementStatus.SUSPENDED;

  const canViewDetails = isOwner || isAdmin || isOrganizer;
  const canShowQr =
    isOwner &&
    status === EntitlementStatus.ACTIVE &&
    !baseBlocked &&
    insideWindow(checkinWindow) &&
    !outsideWindow;

  const isWithinWindow = !outsideWindow && insideWindow(checkinWindow);
  const canCheckIn =
    (isOrganizer || isAdmin) &&
    status === EntitlementStatus.ACTIVE &&
    !baseBlocked &&
    isWithinWindow;

  const canClaim = Boolean(isGuestOwner && emailVerified && status === EntitlementStatus.ACTIVE);

  return {
    canShowQr,
    canCheckIn,
    canClaim,
    canViewDetails,
    canContactSupport: canViewDetails,
  };
}
