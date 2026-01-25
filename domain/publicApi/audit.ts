import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function recordPublicApiAudit(params: {
  organizationId: number;
  apiKeyId: string;
  path: string;
  scope: string;
  ip?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}) {
  const { organizationId, apiKeyId, path, scope, ip, userAgent, correlationId } = params;
  return recordOrganizationAudit(prisma, {
    organizationId,
    action: "PUBLIC_API_REQUEST",
    entityType: "PublicApiKey",
    entityId: apiKeyId,
    correlationId: correlationId ?? null,
    metadata: { path, scope } as Prisma.JsonValue,
    ip,
    userAgent,
  });
}
