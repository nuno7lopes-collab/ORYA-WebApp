import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  CORE_ORGANIZATION_MODULES,
  OPERATION_MODULES,
  ORGANIZATION_MODULES,
  resolvePrimaryModule,
  type OrganizationModule,
  type OperationModule,
} from "@/lib/organizationCategories";

type OrganizationModuleState = {
  activeModules: OrganizationModule[];
  primaryModule: OperationModule;
};

const moduleSet = new Set<string>(ORGANIZATION_MODULES);
type PrismaClientLike = Prisma.TransactionClient | typeof prisma;

export async function getOrganizationActiveModules(
  organizationId: number,
  primaryModule?: string | null,
  client: PrismaClientLike = prisma,
): Promise<OrganizationModuleState> {
  const modulesRows = await client.organizationModuleEntry.findMany({
    where: { organizationId, enabled: true },
    select: { moduleKey: true },
    orderBy: { moduleKey: "asc" },
  });

  const normalizedModules = modulesRows
    .map((row) => row.moduleKey)
    .filter((module): module is OrganizationModule => typeof module === "string")
    .map((module) => module.trim().toUpperCase())
    .map((module) => (module === "ANALYTICS" ? "FINANCEIRO" : module))
    .filter((module) => module.length > 0 && moduleSet.has(module));

  const resolvedPrimary = resolvePrimaryModule(primaryModule ?? null, normalizedModules);
  const activeSet = new Set<OrganizationModule>([
    ...CORE_ORGANIZATION_MODULES,
    ...OPERATION_MODULES,
    resolvedPrimary,
  ]);

  normalizedModules.forEach((module) => {
    activeSet.add(module as OrganizationModule);
  });

  return {
    activeModules: Array.from(activeSet),
    primaryModule: resolvedPrimary,
  };
}

export function hasAnyActiveModule(
  activeModules: string[],
  requiredModules: OrganizationModule[],
) {
  return requiredModules.some((module) => activeModules.includes(module));
}

export function hasAllActiveModules(
  activeModules: string[],
  requiredModules: OrganizationModule[],
) {
  return requiredModules.every((module) => activeModules.includes(module));
}
