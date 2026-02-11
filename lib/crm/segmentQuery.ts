import { prisma } from "@/lib/prisma";
import { buildContactFilters, normalizeSegmentDefinition } from "@/lib/crm/segments";
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

async function resolveInteractionContactIds(params: {
  organizationId: number;
  rules: Array<{ types: string[]; since?: Date }>;
  logic: "AND" | "OR";
}) {
  if (!params.rules.length) return null;

  let currentSet: Set<string> | null = null;
  for (const rule of params.rules) {
    const contactIds = await prisma.crmInteraction.findMany({
      where: {
        organizationId: params.organizationId,
        type: { in: rule.types as any },
        ...(rule.since ? { occurredAt: { gte: rule.since } } : {}),
      },
      select: { contactId: true },
      distinct: ["contactId"],
    });

    const nextSet = new Set(contactIds.map((item) => item.contactId));
    if (!currentSet) {
      currentSet = nextSet;
      continue;
    }

    currentSet = params.logic === "AND" ? intersectSets(currentSet, nextSet) : unionSets(currentSet, nextSet);
  }

  return currentSet;
}

export async function resolveSegmentContactIds(params: {
  organizationId: number;
  rules: unknown;
  maxContacts?: number;
}): Promise<{ contactIds: string[]; total: number; unfiltered: boolean }> {
  const definition = normalizeSegmentDefinition(params.rules);
  const { filters, interactionRules, logic } = buildContactFilters(definition, {
    organizationId: params.organizationId,
  });

  const hasContactFilters = filters.length > 0;
  const contactWhere: Prisma.CrmContactWhereInput = {
    organizationId: params.organizationId,
    ...(hasContactFilters ? { [logic]: filters } : {}),
  };

  const interactionSet = await resolveInteractionContactIds({
    organizationId: params.organizationId,
    rules: interactionRules.map((rule) => ({ types: rule.types, since: rule.since })),
    logic,
  });

  if (!hasContactFilters && !interactionSet) {
    const total = await prisma.crmContact.count({ where: { organizationId: params.organizationId } });
    const take = Math.min(params.maxContacts ?? 200, MAX_IN_CLAUSE);
    const contacts = await prisma.crmContact.findMany({
      where: { organizationId: params.organizationId },
      select: { id: true },
      orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
      take,
    });
    return { contactIds: contacts.map((c) => c.id), total, unfiltered: true };
  }

  let baseSet: Set<string> | null = null;
  if (hasContactFilters) {
    const base = await prisma.crmContact.findMany({
      where: contactWhere,
      select: { id: true },
    });
    baseSet = new Set(base.map((item) => item.id));
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

  const contactIds = Array.from(finalSet ?? []);
  if (!contactIds.length) return { contactIds: [], total: 0, unfiltered: false };

  const total = finalSet ? finalSet.size : contactIds.length;
  const limited = contactIds.slice(0, MAX_IN_CLAUSE);
  const take = Math.min(params.maxContacts ?? 200, limited.length);
  return { contactIds: limited.slice(0, take), total, unfiltered: false };
}

export async function resolveSegmentUserIds(params: {
  organizationId: number;
  rules: unknown;
  maxUsers?: number;
}): Promise<{ userIds: string[]; total: number; unfiltered: boolean }> {
  const resolved = await resolveSegmentContactIds({
    organizationId: params.organizationId,
    rules: params.rules,
    maxContacts: params.maxUsers,
  });
  if (!resolved.contactIds.length) {
    return { userIds: [], total: resolved.total, unfiltered: resolved.unfiltered };
  }
  const contacts = await prisma.crmContact.findMany({
    where: { id: { in: resolved.contactIds }, userId: { not: null } },
    select: { userId: true },
  });
  return {
    userIds: contacts.map((item) => item.userId!).filter(Boolean),
    total: resolved.total,
    unfiltered: resolved.unfiltered,
  };
}
