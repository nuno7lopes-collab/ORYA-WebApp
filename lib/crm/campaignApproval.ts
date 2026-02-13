import {
  CrmCampaignApprovalAction,
  CrmCampaignApprovalState,
  CrmCampaignStatus,
  OrganizationMemberRole,
  type Prisma,
} from "@prisma/client";
import type { CrmConfig } from "@/lib/crm/policy";

export const CAMPAIGN_APPROVER_ROLES = new Set<OrganizationMemberRole>([
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
]);

export function canApproveCampaign(role: OrganizationMemberRole | null | undefined) {
  if (!role) return false;
  return CAMPAIGN_APPROVER_ROLES.has(role);
}

export function nextApprovalExpiry(now: Date, policy: Pick<CrmConfig, "approvalExpireHours">) {
  return new Date(now.getTime() + policy.approvalExpireHours * 60 * 60 * 1000);
}

export function nextApprovalEscalation(now: Date, policy: Pick<CrmConfig, "approvalEscalationHours">) {
  return new Date(now.getTime() + policy.approvalEscalationHours * 60 * 60 * 1000);
}

export function canTransitionToSubmitted(status: CrmCampaignStatus, approvalState: CrmCampaignApprovalState) {
  if (status === CrmCampaignStatus.SENT || status === CrmCampaignStatus.SENDING || status === CrmCampaignStatus.CANCELLED) {
    return false;
  }
  return approvalState === CrmCampaignApprovalState.DRAFT || approvalState === CrmCampaignApprovalState.REJECTED;
}

export function canTransitionToApproved(status: CrmCampaignStatus, approvalState: CrmCampaignApprovalState) {
  if (status === CrmCampaignStatus.CANCELLED || status === CrmCampaignStatus.SENT) return false;
  return approvalState === CrmCampaignApprovalState.SUBMITTED;
}

export function canTransitionToRejected(status: CrmCampaignStatus, approvalState: CrmCampaignApprovalState) {
  if (status === CrmCampaignStatus.CANCELLED || status === CrmCampaignStatus.SENT) return false;
  return approvalState === CrmCampaignApprovalState.SUBMITTED;
}

export function canTransitionToCancelled(status: CrmCampaignStatus) {
  return status !== CrmCampaignStatus.SENT && status !== CrmCampaignStatus.SENDING;
}

export async function appendCampaignApprovalAudit(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: number;
    campaignId: string;
    state: CrmCampaignApprovalState;
    action: CrmCampaignApprovalAction;
    actorUserId?: string | null;
    reason?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
) {
  await tx.crmCampaignApproval.create({
    data: {
      organizationId: params.organizationId,
      campaignId: params.campaignId,
      state: params.state,
      action: params.action,
      actorUserId: params.actorUserId ?? null,
      reason: params.reason ?? null,
      metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}
