import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type TxLike = Prisma.TransactionClient | PrismaClient;

export type OrganizationAuditInput = {
  organizerId: number;
  actorUserId?: string | null;
  action: string;
  fromUserId?: string | null;
  toUserId?: string | null;
  metadata?: Record<string, unknown> | Prisma.JsonValue;
  ip?: string | null;
  userAgent?: string | null;
};

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
      organizerId: input.organizerId,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      fromUserId: input.fromUserId ?? null,
      toUserId: input.toUserId ?? null,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

export async function recordOrganizationAuditSafe(input: OrganizationAuditInput) {
  return recordOrganizationAudit(prisma, input);
}
