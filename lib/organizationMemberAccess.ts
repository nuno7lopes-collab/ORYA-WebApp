import { prisma } from "@/lib/prisma";
import {
  hasModuleAccess,
  accessLevelSatisfies,
  resolveCheckinAccess,
  resolveMemberModuleAccess,
  type MemberPermissionOverride,
  type ModuleAccessLevel,
} from "@/lib/organizationRbac";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";
import type {
  OrganizationMemberRole,
  OrganizationModule,
  OrganizationRolePack,
  Prisma,
} from "@prisma/client";

type PrismaClientLike = Prisma.TransactionClient | typeof prisma;

function getPermissionModel(client: PrismaClientLike) {
  return (client as {
    organizationMemberPermission?: { findMany?: Function };
  }).organizationMemberPermission;
}

export async function getMemberPermissionOverrides(
  organizationId: number,
  userId: string,
  client?: Prisma.TransactionClient,
): Promise<MemberPermissionOverride[]> {
  const db = client ?? prisma;
  const permissionModel = getPermissionModel(db);
  if (!permissionModel?.findMany) return [];

  const rows = await permissionModel.findMany({
    where: { organizationId, userId, scopeType: null, scopeId: null },
    select: {
      moduleKey: true,
      accessLevel: true,
      scopeType: true,
      scopeId: true,
    },
  });

  return rows.map((row: any) => ({
    moduleKey: row.moduleKey as OrganizationModule,
    accessLevel: row.accessLevel as ModuleAccessLevel,
    scopeType: row.scopeType ?? null,
    scopeId: row.scopeId ?? null,
  }));
}

export async function ensureMemberModuleAccess(input: {
  organizationId: number;
  userId: string;
  role: OrganizationMemberRole | null;
  rolePack?: OrganizationRolePack | null;
  moduleKey: OrganizationModule;
  required?: ModuleAccessLevel;
  client?: Prisma.TransactionClient;
}) {
  const { organizationId, userId, role, rolePack, moduleKey, required = "VIEW", client } = input;
  if (!userId) {
    return { ok: false as const, error: "Sem permissoes." };
  }
  const membership = await resolveGroupMemberForOrg({ organizationId, userId, client });
  if (!membership) {
    return { ok: false as const, error: "Sem permissoes." };
  }
  const overrides = await getMemberPermissionOverrides(organizationId, userId, client);
  const access = resolveMemberModuleAccess({
    role: membership.role ?? role,
    rolePack: membership.rolePack ?? rolePack,
    overrides,
  });
  if (!hasModuleAccess(access, moduleKey, required)) {
    return { ok: false as const, error: "Sem permissoes." };
  }
  return { ok: true as const };
}

export async function ensureGroupMemberModuleAccess(input: {
  organizationId: number;
  userId: string;
  moduleKey: OrganizationModule;
  required?: ModuleAccessLevel;
  client?: Prisma.TransactionClient;
  membership?: { role: OrganizationMemberRole; rolePack?: OrganizationRolePack | null } | null;
}) {
  const { organizationId, userId, moduleKey, required = "VIEW", client } = input;
  const membership =
    input.membership ?? (await resolveGroupMemberForOrg({ organizationId, userId, client }));
  if (!membership) {
    return { ok: false as const, error: "Sem permissoes." };
  }
  const overrides = await getMemberPermissionOverrides(organizationId, userId, client);
  const access = resolveMemberModuleAccess({ role: membership.role, rolePack: membership.rolePack, overrides });
  if (!hasModuleAccess(access, moduleKey, required)) {
    return { ok: false as const, error: "Sem permissoes." };
  }
  return { ok: true as const, membership };
}

export function ensureMemberCheckinAccess(input: {
  role: OrganizationMemberRole | null;
  rolePack?: OrganizationRolePack | null;
  required?: ModuleAccessLevel;
}) {
  const { role, rolePack, required = "VIEW" } = input;
  if (!role) {
    return { ok: false as const, error: "Sem permissoes." };
  }
  const access = resolveCheckinAccess({ role, rolePack });
  if (!accessLevelSatisfies(access, required)) {
    return { ok: false as const, error: "Sem permissoes." };
  }
  return { ok: true as const };
}

export async function ensureGroupMemberCheckinAccess(input: {
  organizationId: number;
  userId: string;
  required?: ModuleAccessLevel;
  client?: Prisma.TransactionClient;
  membership?: { role: OrganizationMemberRole; rolePack?: OrganizationRolePack | null } | null;
}) {
  const { organizationId, userId, required = "VIEW", client } = input;
  const membership =
    input.membership ?? (await resolveGroupMemberForOrg({ organizationId, userId, client }));
  if (!membership) {
    return { ok: false as const, error: "Sem permissoes." };
  }
  const access = resolveCheckinAccess({ role: membership.role, rolePack: membership.rolePack });
  if (!accessLevelSatisfies(access, required)) {
    return { ok: false as const, error: "Sem permissoes." };
  }
  return { ok: true as const, membership };
}
