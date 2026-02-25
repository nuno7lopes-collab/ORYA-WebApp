import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getDefaultOrganizationModules,
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

type OrganizationPrimaryRow = {
  id: number;
  primaryModule: string | null;
};

type OrganizationModelWithFindUnique = {
  findUnique?: (args: unknown) => Promise<OrganizationPrimaryRow | null>;
};

type OrganizationModuleEntryModelWithUpsert = {
  findMany?: (args: unknown) => Promise<Array<{ moduleKey: string | null }>>;
  upsert?: (args: unknown) => Promise<unknown>;
};

function normalizeModules(rows: Array<{ moduleKey: string | null }>): OrganizationModule[] {
  const activeSet = new Set<OrganizationModule>();
  for (const row of rows) {
    const normalized = row.moduleKey?.trim().toUpperCase();
    if (!normalized || !moduleSet.has(normalized)) continue;
    activeSet.add(normalized as OrganizationModule);
  }
  return Array.from(activeSet);
}

async function ensureDefaultModulesWhenMissing(params: {
  organizationId: number;
  primaryModule?: string | null;
  client: PrismaClientLike;
}): Promise<{ modules: OrganizationModule[]; primaryModule: OperationModule } | null> {
  const { organizationId, primaryModule, client } = params;
  const organizationModel = (client as unknown as { organization?: OrganizationModelWithFindUnique }).organization;
  const moduleEntryModel = (client as unknown as { organizationModuleEntry?: OrganizationModuleEntryModelWithUpsert })
    .organizationModuleEntry;
  if (!organizationModel?.findUnique || !moduleEntryModel?.upsert) return null;

  const organization = await organizationModel.findUnique({
    where: { id: organizationId },
    select: { id: true, primaryModule: true },
  });
  if (!organization?.id) return null;

  const resolvedPrimary = resolvePrimaryModule(primaryModule ?? organization.primaryModule ?? null, null);
  const baselineModules = getDefaultOrganizationModules(resolvedPrimary);
  if (baselineModules.length === 0) return null;

  for (const moduleKey of baselineModules) {
    await moduleEntryModel.upsert({
      where: {
        organizationId_moduleKey: { organizationId, moduleKey },
      },
      update: { enabled: true },
      create: { organizationId, moduleKey, enabled: true },
    });
  }

  return { modules: baselineModules, primaryModule: resolvedPrimary };
}

export async function getOrganizationActiveModules(
  organizationId: number,
  primaryModule?: string | null,
  client: PrismaClientLike = prisma,
): Promise<OrganizationModuleState> {
  const moduleEntryModel = (client as unknown as { organizationModuleEntry?: OrganizationModuleEntryModelWithUpsert })
    .organizationModuleEntry;
  if (!moduleEntryModel?.findMany) {
    const resolvedPrimary = resolvePrimaryModule(primaryModule ?? null, null);
    return {
      activeModules: getDefaultOrganizationModules(resolvedPrimary),
      primaryModule: resolvedPrimary,
    };
  }

  const modulesRows = await moduleEntryModel.findMany({
    where: { organizationId, enabled: true },
    select: { moduleKey: true },
    orderBy: { moduleKey: "asc" },
  });

  let normalizedModules = normalizeModules(
    modulesRows.map((row) => ({ moduleKey: (row.moduleKey as string | null) ?? null })),
  );
  let resolvedPrimary = resolvePrimaryModule(primaryModule ?? null, normalizedModules);
  const baselineModules = getDefaultOrganizationModules(resolvedPrimary);
  const baselineMissing = baselineModules.some((moduleKey) => !normalizedModules.includes(moduleKey));

  if (normalizedModules.length === 0 || baselineMissing) {
    const autoHeal = await ensureDefaultModulesWhenMissing({
      organizationId,
      primaryModule,
      client,
    });
    if (autoHeal) {
      normalizedModules = Array.from(new Set<OrganizationModule>([...normalizedModules, ...autoHeal.modules]));
      resolvedPrimary = autoHeal.primaryModule;
    }
  }

  return {
    activeModules: normalizedModules,
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
