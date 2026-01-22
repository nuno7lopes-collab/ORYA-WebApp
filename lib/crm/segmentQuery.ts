import { prisma } from "@/lib/prisma";
import { buildCustomerFilters, normalizeSegmentDefinition } from "@/lib/crm/segments";
import { Prisma } from "@prisma/client";

const MAX_IN_CLAUSE = 5000;

function intersectSets(a: Set<string>, b: Set<string>) {
  const out = new Set<string>();
  for (const value of a) {
    if (b.has(value)) out.add(value);
  }
  return out;
}

function unionSets(a: Set<string>, b: Set<string>) {
  const out = new Set<string>(a);
  for (const value of b) out.add(value);
  return out;
}

async function resolveInteractionUserIds(params: {
  organizationId: number;
  rules: Array<{ types: string[]; since?: Date }>;
  logic: "AND" | "OR";
}) {
  if (!params.rules.length) return null;

  let currentSet: Set<string> | null = null;
  for (const rule of params.rules) {
    const userIds = await prisma.crmInteraction.findMany({
      where: {
        organizationId: params.organizationId,
        type: { in: rule.types as any },
        ...(rule.since ? { occurredAt: { gte: rule.since } } : {}),
      },
      select: { userId: true },
      distinct: ["userId"],
    });

    const nextSet = new Set(userIds.map((item) => item.userId));
    if (!currentSet) {
      currentSet = nextSet;
      continue;
    }

    currentSet = params.logic === "AND" ? intersectSets(currentSet, nextSet) : unionSets(currentSet, nextSet);
  }

  return currentSet;
}

export async function resolveSegmentUserIds(params: {
  organizationId: number;
  rules: unknown;
  maxUsers?: number;
}): Promise<{ userIds: string[]; total: number; unfiltered: boolean }> {
  const definition = normalizeSegmentDefinition(params.rules);
  const { filters, interactionRules, logic } = buildCustomerFilters(definition, {
    organizationId: params.organizationId,
  });

  const hasCustomerFilters = filters.length > 0;
  const customerWhere: Prisma.CrmCustomerWhereInput = {
    organizationId: params.organizationId,
    ...(hasCustomerFilters ? { [logic]: filters } : {}),
  };

  const interactionSet = await resolveInteractionUserIds({
    organizationId: params.organizationId,
    rules: interactionRules.map((rule) => ({ types: rule.types, since: rule.since })),
    logic,
  });

  if (!hasCustomerFilters && !interactionSet) {
    const total = await prisma.crmCustomer.count({ where: { organizationId: params.organizationId } });
    const take = Math.min(params.maxUsers ?? 200, MAX_IN_CLAUSE);
    const customers = await prisma.crmCustomer.findMany({
      where: { organizationId: params.organizationId },
      select: { userId: true },
      orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
      take,
    });
    return { userIds: customers.map((c) => c.userId), total, unfiltered: true };
  }

  let baseSet: Set<string> | null = null;
  if (hasCustomerFilters) {
    const base = await prisma.crmCustomer.findMany({
      where: customerWhere,
      select: { userId: true },
    });
    baseSet = new Set(base.map((item) => item.userId));
  }

  let finalSet: Set<string> | null = null;
  if (logic === "AND") {
    if (baseSet && interactionSet) {
      finalSet = intersectSets(baseSet, interactionSet);
    } else {
      finalSet = baseSet ?? interactionSet ?? new Set();
    }
  } else {
    finalSet = unionSets(baseSet ?? new Set(), interactionSet ?? new Set());
  }

  const userIds = Array.from(finalSet ?? []);
  if (!userIds.length) return { userIds: [], total: 0, unfiltered: false };

  const total = finalSet ? finalSet.size : userIds.length;
  const limited = userIds.slice(0, MAX_IN_CLAUSE);
  const take = Math.min(params.maxUsers ?? 200, limited.length);
  return { userIds: limited.slice(0, take), total, unfiltered: false };
}
