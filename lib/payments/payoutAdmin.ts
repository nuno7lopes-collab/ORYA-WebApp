import { prisma } from "@/lib/prisma";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import type { PendingPayout } from "@prisma/client";

export async function logPendingPayoutAudit(params: {
  payout: PendingPayout;
  actorUserId: string;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  const { payout, actorUserId, action, metadata } = params;
  if (!payout.recipientConnectAccountId) return;

  const organization = await prisma.organization.findFirst({
    where: { stripeAccountId: payout.recipientConnectAccountId },
    select: { id: true },
  });

  if (!organization?.id) return;

  await recordOrganizationAuditSafe({
    organizationId: organization.id,
    actorUserId,
    action,
    metadata: {
      payoutId: payout.id,
      paymentIntentId: payout.paymentIntentId,
      recipientConnectAccountId: payout.recipientConnectAccountId,
      status: payout.status,
      ...(metadata ?? {}),
    },
  });
}
