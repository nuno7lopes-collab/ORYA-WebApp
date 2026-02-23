import { OrganizationMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function parsePositiveInt(raw: string | null | undefined) {
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.floor(value);
}

export function parseOrgIds(raw: string | null) {
  if (!raw) return [] as number[];
  return raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => Math.floor(value));
}

type ScopeResolveError = {
  ok: false;
  status: number;
  errorCode: "GROUP_NOT_FOUND" | "FORBIDDEN";
  message: "GROUP_NOT_FOUND" | "FORBIDDEN";
};

type ScopeResolveSuccess = {
  ok: true;
  organizations: Array<{ id: number; name: string }>;
  scopedOrgIds: number[];
  orgById: Map<number, string>;
};

export async function resolveGroupDashboardScope(params: {
  groupId: number;
  userId: string;
  requestedOrgIds: number[];
}): Promise<ScopeResolveError | ScopeResolveSuccess> {
  const { groupId, userId, requestedOrgIds } = params;
  const group = await prisma.organizationGroup.findUnique({
    where: { id: groupId },
    select: { id: true, ownerUserId: true },
  });
  if (!group) {
    return {
      ok: false,
      status: 404,
      errorCode: "GROUP_NOT_FOUND",
      message: "GROUP_NOT_FOUND",
    };
  }

  const isOwner = group.ownerUserId === userId;
  if (!isOwner) {
    const governanceMember = await prisma.organizationGroupMember.findFirst({
      where: {
        groupId,
        userId,
        isGovernance: true,
        scopeAllOrgs: true,
        role: { in: [OrganizationMemberRole.OWNER, OrganizationMemberRole.CO_OWNER, OrganizationMemberRole.ADMIN] },
      },
      select: { id: true },
    });
    if (!governanceMember) {
      return {
        ok: false,
        status: 403,
        errorCode: "FORBIDDEN",
        message: "FORBIDDEN",
      };
    }
  }

  const organizations = await prisma.organization.findMany({
    where: { groupId },
    select: { id: true, publicName: true, businessName: true },
    orderBy: { id: "asc" },
  });
  const orgById = new Map(
    organizations.map((org) => [org.id, org.publicName?.trim() || org.businessName?.trim() || `Organização #${org.id}`]),
  );

  const allowedOrgIds = organizations.map((org) => org.id);
  const scopedOrgIds = requestedOrgIds.length
    ? requestedOrgIds.filter((id) => allowedOrgIds.includes(id))
    : allowedOrgIds;

  return {
    ok: true,
    organizations: scopedOrgIds.map((id) => ({ id, name: orgById.get(id) ?? `Organização #${id}` })),
    scopedOrgIds,
    orgById,
  };
}
