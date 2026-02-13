import {
  buildContactWhereFromRule,
  extractInteractionRule,
  normalizeSegmentDefinition,
  type SegmentExplainRule,
  type SegmentGroupNode,
  type SegmentNode,
  type SegmentRuleNode,
} from "@/lib/crm/segments";
import { prisma } from "@/lib/prisma";

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

async function resolveRuleContactSet(params: {
  organizationId: number;
  rule: SegmentRuleNode;
}): Promise<{ set: Set<string>; explain: SegmentExplainRule }> {
  const interaction = extractInteractionRule(params.rule);

  if (interaction) {
    const rows = await prisma.crmInteraction.findMany({
      where: {
        organizationId: params.organizationId,
        type: { in: interaction.types as any },
        ...(interaction.since ? { occurredAt: { gte: interaction.since } } : {}),
      },
      select: { contactId: true },
      distinct: ["contactId"],
    });

    const set = new Set(rows.map((row) => row.contactId));
    return {
      set,
      explain: {
        ruleId: params.rule.id,
        field: params.rule.field,
        op: params.rule.op,
        matched: set.size,
      },
    };
  }

  const where = buildContactWhereFromRule(params.rule);
  if (!where) {
    return {
      set: new Set(),
      explain: {
        ruleId: params.rule.id,
        field: params.rule.field,
        op: params.rule.op,
        matched: 0,
      },
    };
  }

  const rows = await prisma.crmContact.findMany({
    where: {
      organizationId: params.organizationId,
      ...where,
    },
    select: { id: true },
  });

  const set = new Set(rows.map((row) => row.id));
  return {
    set,
    explain: {
      ruleId: params.rule.id,
      field: params.rule.field,
      op: params.rule.op,
      matched: set.size,
    },
  };
}

async function evaluateNode(params: {
  organizationId: number;
  node: SegmentNode;
}): Promise<{ set: Set<string>; explain: SegmentExplainRule[] }> {
  const { node, organizationId } = params;

  if (node.kind === "rule") {
    const resolved = await resolveRuleContactSet({ organizationId, rule: node });
    return { set: resolved.set, explain: [resolved.explain] };
  }

  return evaluateGroupNode({ organizationId, group: node });
}

async function evaluateGroupNode(params: {
  organizationId: number;
  group: SegmentGroupNode;
}): Promise<{ set: Set<string>; explain: SegmentExplainRule[] }> {
  const { group, organizationId } = params;
  if (!group.children.length) {
    return { set: new Set(), explain: [] };
  }

  let current: Set<string> | null = null;
  const explain: SegmentExplainRule[] = [];

  for (const child of group.children) {
    const childResult = await evaluateNode({ organizationId, node: child });
    explain.push(...childResult.explain);

    if (!current) {
      current = childResult.set;
      continue;
    }

    current = group.logic === "AND" ? intersectSets(current, childResult.set) : unionSets(current, childResult.set);
  }

  return { set: current ?? new Set(), explain };
}

export async function resolveSegmentAudience(params: {
  organizationId: number;
  rules: unknown;
  maxContacts?: number;
  includeExplain?: boolean;
}): Promise<{ contactIds: string[]; total: number; unfiltered: boolean; explain: SegmentExplainRule[] }> {
  const definition = normalizeSegmentDefinition(params.rules);
  if (!definition.root.children.length) {
    const total = await prisma.crmContact.count({ where: { organizationId: params.organizationId } });
    const take = Math.min(params.maxContacts ?? 200, MAX_IN_CLAUSE);
    const contacts = await prisma.crmContact.findMany({
      where: { organizationId: params.organizationId },
      select: { id: true },
      orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
      take,
    });
    return {
      contactIds: contacts.map((c) => c.id),
      total,
      unfiltered: true,
      explain: [],
    };
  }

  const evaluated = await evaluateGroupNode({
    organizationId: params.organizationId,
    group: definition.root,
  });

  const total = evaluated.set.size;
  if (!total) {
    return {
      contactIds: [],
      total: 0,
      unfiltered: false,
      explain: params.includeExplain ? evaluated.explain : [],
    };
  }

  const limited = Array.from(evaluated.set).slice(0, MAX_IN_CLAUSE);
  const take = Math.min(params.maxContacts ?? 200, limited.length);

  return {
    contactIds: limited.slice(0, take),
    total,
    unfiltered: false,
    explain: params.includeExplain ? evaluated.explain : [],
  };
}

export async function resolveSegmentContactIds(params: {
  organizationId: number;
  rules: unknown;
  maxContacts?: number;
}): Promise<{ contactIds: string[]; total: number; unfiltered: boolean }> {
  const resolved = await resolveSegmentAudience({
    organizationId: params.organizationId,
    rules: params.rules,
    maxContacts: params.maxContacts,
    includeExplain: false,
  });

  return {
    contactIds: resolved.contactIds,
    total: resolved.total,
    unfiltered: resolved.unfiltered,
  };
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
