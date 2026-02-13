import { describe, expect, it } from "vitest";
import { OrgType, PayoutMode } from "@prisma/client";
import {
  resolveAllowedPayoutModeForOrganization,
  requiresOrganizationStripe,
  validateRequestedPayoutMode,
} from "@/domain/finance/payoutModePolicy";

describe("payoutMode policy", () => {
  it("rejects EXTERNAL + PLATFORM as INVALID_PAYOUT_MODE", () => {
    const result = validateRequestedPayoutMode(OrgType.EXTERNAL, PayoutMode.PLATFORM);
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      errorCode: "INVALID_PAYOUT_MODE",
      allowedPayoutMode: PayoutMode.ORGANIZATION,
    });
  });

  it("rejects PLATFORM + ORGANIZATION as INVALID_PAYOUT_MODE", () => {
    const result = validateRequestedPayoutMode(OrgType.PLATFORM, PayoutMode.ORGANIZATION);
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      errorCode: "INVALID_PAYOUT_MODE",
      allowedPayoutMode: PayoutMode.PLATFORM,
    });
  });

  it("maps allowed payout mode canonically from orgType", () => {
    expect(resolveAllowedPayoutModeForOrganization(OrgType.EXTERNAL, PayoutMode.PLATFORM)).toBe(
      PayoutMode.ORGANIZATION,
    );
    expect(resolveAllowedPayoutModeForOrganization(OrgType.PLATFORM, PayoutMode.ORGANIZATION)).toBe(
      PayoutMode.PLATFORM,
    );
  });

  it("requires stripe only for EXTERNAL organizations", () => {
    expect(requiresOrganizationStripe(OrgType.EXTERNAL)).toBe(true);
    expect(requiresOrganizationStripe(OrgType.PLATFORM)).toBe(false);
  });
});
