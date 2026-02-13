import { OrgType, PayoutMode } from "@prisma/client";

export const INVALID_PAYOUT_MODE_ERROR_CODE = "INVALID_PAYOUT_MODE" as const;

type OrganizationTypeLike = OrgType | string | null | undefined;
type PayoutModeLike = PayoutMode | string | null | undefined;

function normalizeOrganizationType(orgType: OrganizationTypeLike): OrgType {
  return String(orgType ?? "").toUpperCase() === OrgType.PLATFORM
    ? OrgType.PLATFORM
    : OrgType.EXTERNAL;
}

function normalizePayoutMode(payoutMode: PayoutModeLike): PayoutMode {
  return String(payoutMode ?? "").toUpperCase() === PayoutMode.PLATFORM
    ? PayoutMode.PLATFORM
    : PayoutMode.ORGANIZATION;
}

export function resolveAllowedPayoutModeForOrganization(
  orgType: OrganizationTypeLike,
  requestedPayoutMode: PayoutModeLike,
): PayoutMode {
  const normalizedOrgType = normalizeOrganizationType(orgType);
  if (normalizedOrgType === OrgType.PLATFORM) {
    return PayoutMode.PLATFORM;
  }
  return PayoutMode.ORGANIZATION;
}

export function validateRequestedPayoutMode(
  orgType: OrganizationTypeLike,
  requestedPayoutMode: PayoutModeLike,
) {
  const normalizedOrgType = normalizeOrganizationType(orgType);
  const normalizedRequestedPayoutMode = normalizePayoutMode(requestedPayoutMode);
  const allowedPayoutMode = resolveAllowedPayoutModeForOrganization(
    normalizedOrgType,
    normalizedRequestedPayoutMode,
  );

  if (normalizedRequestedPayoutMode !== allowedPayoutMode) {
    return {
      ok: false as const,
      errorCode: INVALID_PAYOUT_MODE_ERROR_CODE,
      orgType: normalizedOrgType,
      requestedPayoutMode: normalizedRequestedPayoutMode,
      allowedPayoutMode,
    };
  }

  return {
    ok: true as const,
    orgType: normalizedOrgType,
    requestedPayoutMode: normalizedRequestedPayoutMode,
    allowedPayoutMode,
  };
}

export function requiresOrganizationStripe(orgType: OrganizationTypeLike) {
  return normalizeOrganizationType(orgType) !== OrgType.PLATFORM;
}
