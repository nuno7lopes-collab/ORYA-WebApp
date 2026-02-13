import { CrmInteractionType, Prisma } from "@prisma/client";

export type SegmentLogic = "AND" | "OR";

export type SegmentField = string;
export type SegmentOp = string;

export type SegmentRuleNode = {
  kind: "rule";
  id: string;
  field: SegmentField;
  op: SegmentOp;
  value: string | number | boolean | string[];
  windowDays?: number;
};

export type SegmentGroupNode = {
  kind: "group";
  id: string;
  logic: SegmentLogic;
  children: SegmentNode[];
};

export type SegmentNode = SegmentRuleNode | SegmentGroupNode;

export type SegmentDefinition = {
  version: 2;
  root: SegmentGroupNode;
};

export type SegmentExplainRule = {
  ruleId: string;
  field: string;
  op: string;
  matched: number;
};

export type InteractionRule = {
  ruleId: string;
  types: CrmInteractionType[];
  since?: Date;
};

const DATE_FIELDS = new Set(["firstInteractionAt", "lastActivityAt", "lastPurchaseAt"]);
const NUMBER_FIELDS = new Set([
  "totalSpentCents",
  "totalOrders",
  "totalBookings",
  "totalAttendances",
  "totalTournaments",
  "totalStoreOrders",
]);
const STRING_FIELDS = new Set(["displayName", "contactEmail", "contactPhone", "sourceType"]);
const PADEL_STRING_FIELDS = new Set(["level", "preferredSide", "clubName"]);
const PADEL_NUMBER_FIELDS = new Set(["tournamentsCount", "noShowCount"]);

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseDays(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.trunc(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  const match = trimmed.match(/^(\d+)\s*d$/);
  if (!match) return null;
  const days = Number(match[1]);
  return Number.isFinite(days) && days > 0 ? days : null;
}

function parseDateValue(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const days = parseDays(value);
  if (days) return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function normalizeLogic(input: unknown): SegmentLogic {
  return typeof input === "string" && input.toUpperCase() === "OR" ? "OR" : "AND";
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function normalizeRuleValue(value: unknown): string | number | boolean | string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return "";
}

function ruleFromLegacy(raw: Record<string, unknown>, index: number): SegmentRuleNode | null {
  const field = typeof raw.field === "string" ? raw.field.trim() : "";
  if (!field) return null;
  const op = typeof raw.op === "string" ? raw.op.trim().toLowerCase() : "eq";
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `rule_${index + 1}`;
  const windowDaysRaw =
    typeof raw.windowDays === "number"
      ? raw.windowDays
      : raw.value && typeof raw.value === "object" && !Array.isArray(raw.value)
        ? ((raw.value as { windowDays?: unknown }).windowDays as number | undefined)
        : undefined;

  const windowDays =
    typeof windowDaysRaw === "number" && Number.isFinite(windowDaysRaw) && windowDaysRaw > 0
      ? Math.trunc(windowDaysRaw)
      : undefined;

  return {
    kind: "rule",
    id,
    field,
    op,
    value: normalizeRuleValue(raw.value),
    ...(windowDays ? { windowDays } : {}),
  };
}

function normalizeNode(raw: unknown, prefix: string): SegmentNode | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const kind = typeof data.kind === "string" ? data.kind.toLowerCase() : null;

  if (kind === "group") {
    const logic = normalizeLogic(data.logic);
    const id = typeof data.id === "string" && data.id.trim() ? data.id.trim() : `${prefix}_group`;
    const childrenRaw = Array.isArray(data.children) ? data.children : [];
    const children = childrenRaw
      .map((child, index) => normalizeNode(child, `${id}_${index + 1}`))
      .filter((node): node is SegmentNode => Boolean(node));
    return { kind: "group", id, logic, children };
  }

  if (kind === "rule") {
    const field = typeof data.field === "string" ? data.field.trim() : "";
    if (!field) return null;
    const id = typeof data.id === "string" && data.id.trim() ? data.id.trim() : `${prefix}_rule`;
    const op = typeof data.op === "string" ? data.op.trim().toLowerCase() : "eq";
    const windowDays =
      typeof data.windowDays === "number" && Number.isFinite(data.windowDays) && data.windowDays > 0
        ? Math.trunc(data.windowDays)
        : undefined;
    return {
      kind: "rule",
      id,
      field,
      op,
      value: normalizeRuleValue(data.value),
      ...(windowDays ? { windowDays } : {}),
    };
  }

  const legacyRule = ruleFromLegacy(data, 0);
  return legacyRule;
}

function normalizeFromLegacy(raw: Record<string, unknown>): SegmentDefinition {
  const logic = normalizeLogic(raw.logic);
  const rulesRaw = Array.isArray(raw.rules) ? raw.rules : [];
  const children = rulesRaw
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") return null;
      return ruleFromLegacy(entry as Record<string, unknown>, index);
    })
    .filter((rule): rule is SegmentRuleNode => Boolean(rule));

  return {
    version: 2,
    root: {
      kind: "group",
      id: "root",
      logic,
      children,
    },
  };
}

export function normalizeSegmentDefinition(raw: unknown): SegmentDefinition {
  if (!raw || typeof raw !== "object") {
    return {
      version: 2,
      root: { kind: "group", id: "root", logic: "AND", children: [] },
    };
  }

  const data = raw as Record<string, unknown>;

  if (data.version === 2 && data.root && typeof data.root === "object") {
    const root = normalizeNode(data.root, "root");
    if (root && root.kind === "group") {
      return { version: 2, root: root as SegmentGroupNode };
    }
  }

  return normalizeFromLegacy(data);
}

export function flattenRuleNodes(node: SegmentNode): SegmentRuleNode[] {
  if (node.kind === "rule") return [node];
  return node.children.flatMap((child) => flattenRuleNodes(child));
}

function normalizeInteractionTypes(value: unknown): CrmInteractionType[] {
  const values = Object.values(CrmInteractionType) as string[];
  const list = toStringArray(value)
    .map((item) => item.toUpperCase())
    .filter((item) => values.includes(item));
  return list as CrmInteractionType[];
}

export function extractInteractionRule(rule: SegmentRuleNode): InteractionRule | null {
  if (rule.field !== "interactionType") return null;
  const types = normalizeInteractionTypes(rule.value);
  if (!types.length) return null;

  const windowDays =
    typeof rule.windowDays === "number" && Number.isFinite(rule.windowDays)
      ? rule.windowDays
      : parseDays(rule.value);

  const since = windowDays && windowDays > 0 ? new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000) : undefined;
  return { ruleId: rule.id, types, since };
}

export function buildContactWhereFromRule(rule: SegmentRuleNode): Prisma.CrmContactWhereInput | null {
  const field = rule.field.trim();
  const op = rule.op.trim().toLowerCase();

  if (field === "interactionType") return null;

  if (DATE_FIELDS.has(field)) {
    const dateValue = parseDateValue(rule.value);
    if (!dateValue) return null;
    if (op === "gte" || op === "after") return { [field]: { gte: dateValue } };
    if (op === "lte" || op === "before") return { [field]: { lte: dateValue } };
    if (op === "gt") return { [field]: { gt: dateValue } };
    if (op === "lt") return { [field]: { lt: dateValue } };
    return { [field]: dateValue };
  }

  if (NUMBER_FIELDS.has(field)) {
    const numberValue = parseNumber(rule.value);
    if (numberValue === null) return null;
    if (op === "gte") return { [field]: { gte: numberValue } };
    if (op === "lte") return { [field]: { lte: numberValue } };
    if (op === "gt") return { [field]: { gt: numberValue } };
    if (op === "lt") return { [field]: { lt: numberValue } };
    if (op === "neq" || op === "not_eq") return { NOT: { [field]: numberValue } };
    return { [field]: numberValue };
  }

  if (field === "tag") {
    const values = Array.isArray(rule.value)
      ? rule.value.filter((item): item is string => typeof item === "string")
      : typeof rule.value === "string"
        ? [rule.value]
        : [];
    if (!values.length) return null;

    if (op === "in" || op === "has_some") return { tags: { hasSome: values } };
    if (op === "not_in") return { NOT: { tags: { hasSome: values } } };
    if (op === "not_has") return { NOT: { tags: { has: values[0] } } };
    return { tags: { has: values[0] } };
  }

  if (field === "marketingOptIn") {
    if (typeof rule.value === "boolean") return { marketingEmailOptIn: rule.value };
    if (typeof rule.value === "string") {
      const token = rule.value.trim().toLowerCase();
      if (token === "true") return { marketingEmailOptIn: true };
      if (token === "false") return { marketingEmailOptIn: false };
    }
    return null;
  }

  if (field === "contactType") {
    const values = toStringArray(rule.value);
    if (!values.length) return null;
    if (op === "neq" || op === "not_in") {
      return values.length === 1
        ? { NOT: { contactType: values[0] as any } }
        : { NOT: { contactType: { in: values as any } } };
    }
    return values.length === 1
      ? { contactType: values[0] as any }
      : { contactType: { in: values as any } };
  }

  if (field.startsWith("padel.")) {
    const padelField = field.slice(6);
    if (PADEL_STRING_FIELDS.has(padelField)) {
      if (typeof rule.value !== "string" || !rule.value.trim()) return null;
      if (op === "neq") {
        return { NOT: { padelProfile: { is: { [padelField]: { equals: rule.value, mode: "insensitive" } } } } };
      }
      if (op === "contains") {
        return { padelProfile: { is: { [padelField]: { contains: rule.value, mode: "insensitive" } } } };
      }
      return { padelProfile: { is: { [padelField]: { equals: rule.value, mode: "insensitive" } } } };
    }
    if (PADEL_NUMBER_FIELDS.has(padelField)) {
      const numberValue = parseNumber(rule.value);
      if (numberValue === null) return null;
      if (op === "gte") return { padelProfile: { is: { [padelField]: { gte: numberValue } } } };
      if (op === "lte") return { padelProfile: { is: { [padelField]: { lte: numberValue } } } };
      if (op === "gt") return { padelProfile: { is: { [padelField]: { gt: numberValue } } } };
      if (op === "lt") return { padelProfile: { is: { [padelField]: { lt: numberValue } } } };
      return { padelProfile: { is: { [padelField]: numberValue } } };
    }
  }

  if (STRING_FIELDS.has(field)) {
    const values = toStringArray(rule.value);
    if (!values.length) return null;
    if (op === "contains") {
      return { [field]: { contains: values[0], mode: "insensitive" } };
    }
    if (op === "neq") {
      return { NOT: { [field]: { equals: values[0], mode: "insensitive" } } };
    }
    if (op === "in") {
      return { OR: values.map((value) => ({ [field]: { equals: value, mode: "insensitive" } })) };
    }
    if (op === "not_in") {
      return { NOT: { OR: values.map((value) => ({ [field]: { equals: value, mode: "insensitive" } })) } };
    }
    return { [field]: { equals: values[0], mode: "insensitive" } };
  }

  return null;
}
