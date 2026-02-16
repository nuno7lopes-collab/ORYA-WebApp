import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { sanitizeDashboardHiddenToolIds } from "@/lib/organizationDashboardTools";

type TxLike = Prisma.TransactionClient | PrismaClient;

export const DASHBOARD_TOOL_VISIBILITY_AUDIT_ACTION = "DASHBOARD_TOOLS_VISIBILITY_UPDATED";

function extractHiddenToolIdsFromMetadata(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const candidate = (metadata as { hiddenToolIds?: unknown }).hiddenToolIds;
  return sanitizeDashboardHiddenToolIds(candidate);
}

export async function getOrganizationDashboardHiddenToolIds(
  organizationId: number,
  client: TxLike = prisma,
): Promise<string[]> {
  const auditModel = (client as { organizationAuditLog?: { findFirst?: (args: unknown) => Promise<unknown> } })
    .organizationAuditLog;
  if (!auditModel?.findFirst) return [];

  const row = await auditModel.findFirst({
    where: {
      organizationId,
      action: DASHBOARD_TOOL_VISIBILITY_AUDIT_ACTION,
    },
    select: { metadata: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const metadata = (row as { metadata?: unknown } | null)?.metadata;
  return extractHiddenToolIdsFromMetadata(metadata);
}

export async function setOrganizationDashboardHiddenToolIds(params: {
  organizationId: number;
  actorUserId: string;
  hiddenToolIds: unknown;
  client?: TxLike;
}) {
  const { organizationId, actorUserId, hiddenToolIds, client = prisma } = params;
  const normalized = sanitizeDashboardHiddenToolIds(hiddenToolIds);

  await recordOrganizationAudit(client, {
    organizationId,
    actorUserId,
    action: DASHBOARD_TOOL_VISIBILITY_AUDIT_ACTION,
    metadata: {
      hiddenToolIds: normalized,
      version: 1,
      source: "dashboard_tools_visibility",
    },
  });

  return normalized;
}

