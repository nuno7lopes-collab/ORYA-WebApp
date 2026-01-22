import { prisma } from "@/lib/prisma";
import {
  hasModuleAccess,
  resolveModuleAccess,
  type MemberPermissionOverride,
  type ModuleAccessLevel,
} from "@/lib/organizationRbac";
import type { OrganizationMemberRole, OrganizationModule, Prisma } from "@prisma/client";

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
  moduleKey: OrganizationModule;
  required?: ModuleAccessLevel;
  client?: Prisma.TransactionClient;
}) {
  const { organizationId, userId, role, moduleKey, required = "VIEW", client } = input;
  if (!role || !userId) {
    return { ok: false as const, error: "Sem permissoes." };
  }
  const overrides = await getMemberPermissionOverrides(organizationId, userId, client);
  const access = resolveModuleAccess(role, overrides);
  if (!hasModuleAccess(access, moduleKey, required)) {
    return { ok: false as const, error: "Sem permissoes." };
  }
  return { ok: true as const };
}
