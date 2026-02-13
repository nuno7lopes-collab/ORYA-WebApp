import { describe, expect, it } from "vitest";
import {
  CrmCampaignApprovalState,
  CrmCampaignStatus,
  OrganizationMemberRole,
} from "@prisma/client";
import {
  CRM_CONFIG_DEFAULTS,
  normalizeCrmConfigInput,
} from "@/lib/crm/policy";
import {
  canApproveCampaign,
  canTransitionToApproved,
  canTransitionToCancelled,
  canTransitionToRejected,
  canTransitionToSubmitted,
  nextApprovalEscalation,
  nextApprovalExpiry,
} from "@/lib/crm/campaignApproval";

describe("crm policy normalization", () => {
  it("uses defaults when payload is invalid", () => {
    const config = normalizeCrmConfigInput(null);
    expect(config).toEqual(CRM_CONFIG_DEFAULTS);
  });

  it("enforces canonical ranges and ordering", () => {
    const config = normalizeCrmConfigInput({
      quietHoursStartMinute: 2000,
      quietHoursEndMinute: -10,
      capPerDay: 4,
      capPerWeek: 1,
      capPerMonth: 2,
      approvalEscalationHours: 36,
      approvalExpireHours: 12,
    });

    expect(config.quietHoursStartMinute).toBe(1439);
    expect(config.quietHoursEndMinute).toBe(0);
    expect(config.capPerDay).toBe(4);
    expect(config.capPerWeek).toBe(4);
    expect(config.capPerMonth).toBe(4);
    expect(config.approvalEscalationHours).toBe(36);
    expect(config.approvalExpireHours).toBe(36);
  });
});

describe("crm campaign approval rules", () => {
  it("allows only owner/co-owner/admin to approve", () => {
    expect(canApproveCampaign(OrganizationMemberRole.OWNER)).toBe(true);
    expect(canApproveCampaign(OrganizationMemberRole.CO_OWNER)).toBe(true);
    expect(canApproveCampaign(OrganizationMemberRole.ADMIN)).toBe(true);
    expect(canApproveCampaign(OrganizationMemberRole.STAFF)).toBe(false);
    expect(canApproveCampaign(null)).toBe(false);
  });

  it("applies state transitions fail-closed", () => {
    expect(canTransitionToSubmitted(CrmCampaignStatus.DRAFT, CrmCampaignApprovalState.DRAFT)).toBe(true);
    expect(canTransitionToSubmitted(CrmCampaignStatus.CANCELLED, CrmCampaignApprovalState.DRAFT)).toBe(false);
    expect(canTransitionToApproved(CrmCampaignStatus.DRAFT, CrmCampaignApprovalState.SUBMITTED)).toBe(true);
    expect(canTransitionToApproved(CrmCampaignStatus.SENT, CrmCampaignApprovalState.SUBMITTED)).toBe(false);
    expect(canTransitionToRejected(CrmCampaignStatus.PAUSED, CrmCampaignApprovalState.SUBMITTED)).toBe(true);
    expect(canTransitionToRejected(CrmCampaignStatus.CANCELLED, CrmCampaignApprovalState.SUBMITTED)).toBe(false);
    expect(canTransitionToCancelled(CrmCampaignStatus.DRAFT)).toBe(true);
    expect(canTransitionToCancelled(CrmCampaignStatus.SENDING)).toBe(false);
  });

  it("computes escalation and expiry timestamps from policy", () => {
    const now = new Date("2026-02-12T10:00:00.000Z");
    const escalation = nextApprovalEscalation(now, { approvalEscalationHours: 24 });
    const expiry = nextApprovalExpiry(now, { approvalExpireHours: 48 });

    expect(escalation.toISOString()).toBe("2026-02-13T10:00:00.000Z");
    expect(expiry.toISOString()).toBe("2026-02-14T10:00:00.000Z");
  });
});
