import { Organization, OrganizationMemberRole, OrganizationRolePack, OrganizationStatus, Prisma } from "@prisma/client";
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
  allowedStatuses?: readonly OrganizationStatus[];
  includeOrganizationFields?: "minimal" | "settings" | "full";
  selectOrganization?: Prisma.OrganizationSelect;
  // apenas quando se quer forçar persistência do contexto
  persistActiveOrganization?: boolean;
  // Se quisermos forçar leitura de cookie, basta fornecer organizationId externamente
};

export type OrganizationContextResult = {
  organization:
    | ({
        id: number;
        status: OrganizationStatus;
        groupId: number;
      } & Partial<Organization>)
    | null;
  membership:
    | {
        id: string;
        organizationId: number;
        userId: string;
        groupId: number;
        role: OrganizationMemberRole;
        rolePack?: OrganizationRolePack | null;
      }
    | null;
};

type OrganizationContextGuard = { ok: true; context: OrganizationContextResult } | { ok: false; error: string };
export const ORGANIZATION_SELECT_MINIMAL = {
  id: true,
  status: true,
  groupId: true,
  officialEmail: true,
  officialEmailVerifiedAt: true,
} satisfies Prisma.OrganizationSelect;

export const ORGANIZATION_SELECT_SETTINGS = {
  id: true,
  status: true,
  groupId: true,
  username: true,
  stripeAccountId: true,
  stripeChargesEnabled: true,
  stripePayoutsEnabled: true,
  feeMode: true,
  platformFeeBps: true,
  platformFeeFixedCents: true,
  businessName: true,
  entityType: true,
  city: true,
  payoutIban: true,
  language: true,
  timezone: true,
  alertsEmail: true,
  alertsSalesEnabled: true,
  alertsPayoutEnabled: true,
  officialEmail: true,
  officialEmailVerifiedAt: true,
  brandingAvatarUrl: true,
  brandingCoverUrl: true,
  brandingPrimaryColor: true,
  brandingSecondaryColor: true,
  organizationKind: true,
  primaryModule: true,
  reservationAssignmentMode: true,
  publicName: true,
  address: true,
  showAddressPublicly: true,
  publicWebsite: true,
  publicInstagram: true,
  publicYoutube: true,
  publicDescription: true,
  publicHours: true,
  publicProfileLayout: true,
  infoRules: true,
  infoFaq: true,
  infoRequirements: true,
  infoPolicies: true,
  infoLocationNotes: true,
  padelDefaultShortName: true,
  padelDefaultCity: true,
  padelDefaultAddress: true,
  padelDefaultCourts: true,
  padelDefaultHours: true,
  padelDefaultRuleSetId: true,
  padelFavoriteCategories: true,
  orgType: true,
} satisfies Prisma.OrganizationSelect;

function resolveOrganizationSelect(opts: Options): {
  select: Prisma.OrganizationSelect | null;
  kind: "minimal" | "settings" | "full" | "custom";
} {
  if (opts.selectOrganization) {
    return {
      select: { ...ORGANIZATION_SELECT_MINIMAL, ...opts.selectOrganization },
      kind: "custom",
    };
  }
  const kind = opts.includeOrganizationFields ?? "minimal";
  if (kind === "full") return { select: null, kind };
  if (kind === "settings") {
    return { select: ORGANIZATION_SELECT_SETTINGS, kind };
  }
  return { select: ORGANIZATION_SELECT_MINIMAL, kind: "minimal" };
}

export const ORG_ACTIVE_ALLOWED_STATUSES = [
  OrganizationStatus.ACTIVE,
  OrganizationStatus.SUSPENDED,
] as const;

export const ORG_CONTEXT_UI = {
  allowedStatuses: ORG_ACTIVE_ALLOWED_STATUSES,
  allowFallback: true,
} as const;

export const ORG_CONTEXT_API = {
  allowedStatuses: ORG_ACTIVE_ALLOWED_STATUSES,
  allowFallback: false,
} as const;

// Mutacoes devem exigir orgId explicito (sem fallback).
export const ORG_ACTIVE_WRITE_OPTIONS = ORG_CONTEXT_API;

// @deprecated Prefer ORG_CONTEXT_UI or ORG_CONTEXT_API (split to avoid misuse).
export const ORG_ACTIVE_ACCESS_OPTIONS = ORG_CONTEXT_UI;

export const getActiveOrganizationForUser = cache(
  async (userId: string, opts: Options = {}): Promise<OrganizationContextResult> => {
    const { roles } = opts;
    const allowFallback = typeof opts.allowFallback === "boolean" ? opts.allowFallback : false;
    const allowedStatuses = opts.allowedStatuses ? [...opts.allowedStatuses] : [OrganizationStatus.ACTIVE];
    const { select: organizationSelect, kind: organizationSelectKind } = resolveOrganizationSelect(opts);
    const shouldHydrateOrganization = organizationSelectKind !== "minimal";
    const directOrganizationId =
      typeof opts.organizationId === "number" && Number.isFinite(opts.organizationId)
        ? opts.organizationId
        : null;
    const hasExplicitOrganizationId = directOrganizationId !== null;
    const profileActive =
      directOrganizationId || !allowFallback
        ? null
        : await prisma.profile.findUnique({
            where: { id: userId },
            select: { activeOrganizationId: true },
          });
    const cookieOrganizationId =
      directOrganizationId || !allowFallback || profileActive?.activeOrganizationId
        ? null
        : await resolveOrganizationIdFromCookies();
    const organizationId = directOrganizationId ?? profileActive?.activeOrganizationId ?? cookieOrganizationId;

    if (!organizationId && !allowFallback) {
      return { organization: null, membership: null };
    }

    // 1) Se organizationId foi especificado, tenta buscar diretamente essa membership primeiro
    if (organizationId) {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        ...(organizationSelect ? { select: organizationSelect } : {}),
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
    if (hasExplicitOrganizationId || !allowFallback) {
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
              select: ORGANIZATION_SELECT_MINIMAL,
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
        let organization = org;
        if (shouldHydrateOrganization) {
          const hydrated = await prisma.organization.findUnique({
            where: { id: org.id },
            ...(organizationSelect ? { select: organizationSelect } : {}),
          });
          if (!hydrated || !allowedStatuses.includes(hydrated.status)) continue;
          organization = hydrated;
        }
        return {
          organization,
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

export async function getActiveOrganizationForUserForWrite(userId: string, opts: Options = {}) {
  return getActiveOrganizationForUser(userId, { ...opts, allowFallback: false });
}

export function ensureOrganizationContext(
  context: OrganizationContextResult,
  opts?: { requireOrganization?: boolean; requireMembership?: boolean },
): OrganizationContextGuard {
  const requireOrganization = opts?.requireOrganization ?? true;
  const requireMembership = opts?.requireMembership ?? true;
  if (requireOrganization && !context.organization) {
    return { ok: false, error: "Sem permissoes." };
  }
  if (requireMembership && !context.membership) {
    return { ok: false, error: "Sem permissoes." };
  }
  return { ok: true, context };
}

export async function getActiveOrganizationIdForUser(userId: string) {
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { activeOrganizationId: true },
  });
  return profile?.activeOrganizationId ?? null;
}

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
