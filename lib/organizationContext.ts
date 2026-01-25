import { OrganizationMemberRole, OrganizationStatus } from "@prisma/client";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { resolveOrganizationIdFromCookies } from "@/lib/organizationId";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { appendEventLog } from "@/domain/eventLog/append";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import crypto from "crypto";

type Options = {
  organizationId?: number | null;
  roles?: OrganizationMemberRole[];
  allowFallback?: boolean;
  allowedStatuses?: OrganizationStatus[];
  // apenas quando se quer forçar persistência do contexto
  persistActiveOrganization?: boolean;
  // Se quisermos forçar leitura de cookie, basta fornecer organizationId externamente
};

export const ORG_ACTIVE_ALLOWED_STATUSES = [
  OrganizationStatus.ACTIVE,
  OrganizationStatus.SUSPENDED,
] as const;

export const ORG_ACTIVE_ACCESS_OPTIONS = {
  allowedStatuses: ORG_ACTIVE_ALLOWED_STATUSES,
} as const;

export const getActiveOrganizationForUser = cache(
  async (userId: string, opts: Options = {}) => {
  const { roles } = opts;
  const allowFallback = typeof opts.allowFallback === "boolean" ? opts.allowFallback : !opts.organizationId;
  const allowedStatuses = opts.allowedStatuses ?? [OrganizationStatus.ACTIVE];
  const directOrganizationId =
    typeof opts.organizationId === "number" && Number.isFinite(opts.organizationId)
      ? opts.organizationId
      : null;
  const profileActive = directOrganizationId
    ? null
    : await prisma.profile.findUnique({
        where: { id: userId },
        select: { activeOrganizationId: true },
      });
  const cookieOrganizationId =
    directOrganizationId || profileActive?.activeOrganizationId
      ? null
      : await resolveOrganizationIdFromCookies();
  const organizationId = directOrganizationId ?? profileActive?.activeOrganizationId ?? cookieOrganizationId;

  // 1) Se organizationId foi especificado, tenta buscar diretamente essa membership primeiro
  if (organizationId) {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, status: true, groupId: true },
    });
    if (organization && allowedStatuses.includes(organization.status)) {
      const member = await resolveGroupMemberForOrg({ organizationId, userId });
      if (member) {
        if (!roles || roles.includes(member.role)) {
          return {
            organization,
            membership: {
              id: member.memberId,
              organizationId,
              userId,
              groupId: member.groupId,
              role: member.role,
              rolePack: member.rolePack,
            },
          };
        }
      }
    }
    // Se o organizationId foi pedido explicitamente e não existe membership, não faz fallback.
    if (!allowFallback) {
      return { organization: null, membership: null };
    }
  }

  const groupMembers = await prisma.organizationGroupMember.findMany({
    where: { userId },
    select: {
      id: true,
      role: true,
      rolePack: true,
      scopeAllOrgs: true,
      scopeOrgIds: true,
      groupId: true,
      group: {
        select: {
          organizations: {
            where: { status: { in: allowedStatuses } },
            select: { id: true, status: true, groupId: true },
            orderBy: { id: "asc" },
          },
        },
      },
    },
  });

  for (const member of groupMembers) {
    if (roles && !roles.includes(member.role)) continue;
    const orgs = member.group?.organizations ?? [];
    for (const org of orgs) {
      const scopeOk = member.scopeAllOrgs || (member.scopeOrgIds ?? []).includes(org.id);
      if (!scopeOk) continue;
      const override = await prisma.organizationGroupMemberOrganizationOverride.findUnique({
        where: { groupMemberId_organizationId: { groupMemberId: member.id, organizationId: org.id } },
        select: { roleOverride: true, revokedAt: true },
      });
      if (override?.revokedAt) continue;
      const effectiveRole = override?.roleOverride ?? member.role;
      if (roles && !roles.includes(effectiveRole)) continue;
      return {
        organization: org,
        membership: {
          id: member.id,
          organizationId: org.id,
          userId,
          groupId: member.groupId,
          role: effectiveRole,
          rolePack: member.rolePack,
        },
      };
    }
  }

  return { organization: null, membership: null };
  },
);

export async function setActiveOrganizationForUser(params: {
  userId: string;
  organizationId: number;
  correlationId?: string | null;
  persistCookie?: boolean;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const { userId, organizationId, correlationId, ip, userAgent } = params;
  const membership = await resolveGroupMemberForOrg({ organizationId, userId });
  if (!membership) {
    return { ok: false as const, error: "NOT_MEMBER" as const };
  }

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { activeOrganizationId: true },
  });
  const fromOrgId = profile?.activeOrganizationId ?? null;
  if (fromOrgId === organizationId) {
    return { ok: true as const, changed: false as const, membership };
  }

  const corr = correlationId ?? crypto.randomUUID();
  return prisma.$transaction(async (tx) => {
    await tx.profile.update({
      where: { id: userId },
      data: { activeOrganizationId: organizationId },
    });

    const outbox = await recordOutboxEvent(
      {
        eventType: "org.context.changed",
        payload: {
          userId,
          fromOrganizationId: fromOrgId,
          toOrganizationId: organizationId,
          groupId: membership.groupId,
        },
        correlationId: corr,
      },
      tx,
    );

    await appendEventLog(
      {
        eventId: outbox.eventId,
        organizationId,
        eventType: "org.context.changed",
        idempotencyKey: outbox.eventId,
        payload: {
          userId,
          fromOrganizationId: fromOrgId,
          toOrganizationId: organizationId,
          groupId: membership.groupId,
        },
        actorUserId: userId,
        sourceId: String(organizationId),
        correlationId: corr,
      },
      tx,
    );

    await recordOrganizationAudit(tx, {
      organizationId,
      groupId: membership.groupId,
      actorUserId: userId,
      action: "ORG_CONTEXT_SWITCH",
      entityType: "organization_context",
      entityId: String(organizationId),
      correlationId: corr,
      metadata: {
        fromOrganizationId: fromOrgId,
        toOrganizationId: organizationId,
      },
      ip,
      userAgent,
    });

    return { ok: true as const, changed: true as const, membership };
  });
}
