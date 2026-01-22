import { ConsentStatus, ConsentType, CrmInteractionType, Prisma } from "@prisma/client";

export type SegmentLogic = "AND" | "OR";

export type SegmentRule = {
  field?: string | null;
  op?: string | null;
  value?: unknown;
  windowDays?: number | null;
};

export type SegmentDefinition = {
  logic: SegmentLogic;
  rules: SegmentRule[];
};

export type InteractionRule = {
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

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseDays(value: unknown): number | null {
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
  if (days) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function normalizeLogic(input: unknown): SegmentLogic {
  return typeof input === "string" && input.toUpperCase() === "OR" ? "OR" : "AND";
}

function normalizeRules(input: unknown): SegmentRule[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((rule) => (rule && typeof rule === "object" ? (rule as SegmentRule) : null))
    .filter((rule): rule is SegmentRule => Boolean(rule));
}

function normalizeInteractionTypes(value: unknown): CrmInteractionType[] {
  const values = Object.values(CrmInteractionType) as string[];
  const list: string[] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string") list.push(item);
    }
  } else if (typeof value === "string") {
    list.push(value);
  } else if (value && typeof value === "object") {
    const raw = (value as { types?: unknown }).types;
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (typeof item === "string") list.push(item);
      }
    }
  }

  return list
    .map((item) => item.trim())
    .filter((item) => values.includes(item)) as CrmInteractionType[];
}

function getRuleWindowDays(rule: SegmentRule): number | null {
  if (typeof rule.windowDays === "number" && Number.isFinite(rule.windowDays)) return rule.windowDays;
  if (rule.value && typeof rule.value === "object") {
    const raw = rule.value as { windowDays?: unknown; days?: unknown };
    if (typeof raw.windowDays === "number" && Number.isFinite(raw.windowDays)) return raw.windowDays;
    if (typeof raw.days === "number" && Number.isFinite(raw.days)) return raw.days;
  }
  return null;
}

export function normalizeSegmentDefinition(raw: unknown): SegmentDefinition {
  if (!raw || typeof raw !== "object") {
    return { logic: "AND", rules: [] };
  }

  const data = raw as { logic?: unknown; rules?: unknown };
  return {
    logic: normalizeLogic(data.logic),
    rules: normalizeRules(data.rules),
  };
}

export function buildCustomerFilters(
  definition: SegmentDefinition,
  options?: { organizationId?: number | null },
): {
  logic: SegmentLogic;
  filters: Prisma.CrmCustomerWhereInput[];
  interactionRules: InteractionRule[];
} {
  const filters: Prisma.CrmCustomerWhereInput[] = [];
  const interactionRules: InteractionRule[] = [];
  const organizationId =
    typeof options?.organizationId === "number" && Number.isFinite(options.organizationId)
      ? options.organizationId
      : null;

  for (const rule of definition.rules) {
    const field = typeof rule.field === "string" ? rule.field.trim() : "";
    const op = typeof rule.op === "string" ? rule.op.trim().toLowerCase() : "eq";

    if (!field) continue;

    if (DATE_FIELDS.has(field)) {
      const dateValue = parseDateValue(rule.value);
      if (!dateValue) continue;
      if (op === "gte" || op === "after") {
        filters.push({ [field]: { gte: dateValue } });
      } else if (op === "lte" || op === "before") {
        filters.push({ [field]: { lte: dateValue } });
      }
      continue;
    }

    if (NUMBER_FIELDS.has(field)) {
      const numberValue = parseNumber(rule.value);
      if (numberValue === null) continue;
      if (op === "gte") {
        filters.push({ [field]: { gte: numberValue } });
      } else if (op === "lte") {
        filters.push({ [field]: { lte: numberValue } });
      } else {
        filters.push({ [field]: numberValue });
      }
      continue;
    }

    if (field === "tag") {
      if (op === "has" && typeof rule.value === "string") {
        filters.push({ tags: { has: rule.value } });
        continue;
      }
      if (op === "in" && Array.isArray(rule.value)) {
        const values = rule.value.filter((item): item is string => typeof item === "string");
        if (values.length) {
          filters.push({ tags: { hasSome: values } });
        }
        continue;
      }
      if (op === "not_in" && Array.isArray(rule.value)) {
        const values = rule.value.filter((item): item is string => typeof item === "string");
        if (values.length) {
          filters.push({ NOT: { tags: { hasSome: values } } });
        }
        continue;
      }
    }

    if (field === "marketingOptIn") {
      if (typeof rule.value === "boolean") {
        if (organizationId) {
          const consentFilter: Prisma.CrmCustomerWhereInput = {
            user: {
              is: {
                userConsents: {
                  some: {
                    organizationId,
                    type: ConsentType.MARKETING,
                    status: ConsentStatus.GRANTED,
                  },
                },
              },
            },
          };
          filters.push(rule.value ? consentFilter : { NOT: consentFilter });
        } else {
          filters.push({ marketingOptIn: rule.value });
        }
      }
      continue;
    }

    if (field === "interactionType") {
      const types = normalizeInteractionTypes(rule.value);
      if (!types.length) continue;
      const windowDays = getRuleWindowDays(rule);
      const since = windowDays ? new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000) : undefined;
      interactionRules.push({ types, since });
      continue;
    }
  }

  return { logic: definition.logic, filters, interactionRules };
}
