import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type TxLike = Prisma.TransactionClient | PrismaClient;

export type OrganizationAuditInput = {
  organizationId: number;
  groupId?: number | null;
  actorUserId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  correlationId?: string | null;
  fromUserId?: string | null;
  toUserId?: string | null;
  metadata?: Record<string, unknown> | Prisma.JsonValue;
  ip?: string | null;
  userAgent?: string | null;
};

function normalizeOptionalUuid(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Regista ações sensíveis para audit trail da organização.
 * Usa TransactionClient quando já estivermos em transação.
 */
export async function recordOrganizationAudit(
  client: TxLike,
  input: OrganizationAuditInput,
) {
  // Alguns schemas podem não ter a tabela de audit; nesse caso, faz no-op.
  const auditModel = (client as any).organizationAuditLog;
  if (!auditModel?.create) return null;
  return auditModel.create({
    data: {
      organizationId: input.organizationId,
      groupId: input.groupId ?? null,
      actorUserId: normalizeOptionalUuid(input.actorUserId),
      action: input.action,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      correlationId: input.correlationId ?? null,
      fromUserId: normalizeOptionalUuid(input.fromUserId),
      toUserId: normalizeOptionalUuid(input.toUserId),
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

export async function recordOrganizationAuditSafe(input: OrganizationAuditInput) {
  return recordOrganizationAudit(prisma, input);
}
