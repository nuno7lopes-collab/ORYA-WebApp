import { prisma } from "@/lib/prisma";
import { appendEventLog } from "@/domain/eventLog/append";
import { logWarn } from "@/lib/observability/logger";
import type { Prisma } from "@prisma/client";

async function resolveAdminAuditOrgId() {
  const platform = await prisma.organization.findFirst({
    where: { orgType: "PLATFORM" },
    select: { id: true },
  });
  if (platform) return platform.id;
  const fallback = await prisma.organization.findFirst({ select: { id: true } });
  return fallback?.id ?? null;
}

export async function auditAdminAction(params: {
  action: string;
  actorUserId: string;
  payload?: Record<string, unknown>;
  correlationId?: string | null;
}) {
  try {
    const orgId = await resolveAdminAuditOrgId();
    if (!orgId) {
      logWarn("admin.audit_skipped_missing_org", {
        action: params.action,
        actorUserId: params.actorUserId,
        correlationId: params.correlationId,
      });
      return null;
    }
    return appendEventLog({
      organizationId: orgId,
      eventType: `ADMIN_${params.action}`,
      actorUserId: params.actorUserId,
      payload: (params.payload ?? {}) as Prisma.InputJsonValue,
      correlationId: params.correlationId ?? undefined,
    });
  } catch (err) {
    logWarn("admin.audit_failed", {
      action: params.action,
      actorUserId: params.actorUserId,
      correlationId: params.correlationId,
      error: String(err),
    });
    return null;
  }
}
