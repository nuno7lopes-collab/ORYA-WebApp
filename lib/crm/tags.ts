import { Prisma, type PrismaClient } from "@prisma/client";

export const MAX_CRM_TAGS = 20;
export const DEFAULT_CRM_TAG_COLOR = "#22D3EE";

const HEX_COLOR_REGEX = /^#[0-9A-F]{6}$/i;
const TAG_TOKEN_REGEX = /[^a-z0-9]+/gi;
const MAX_TAG_NAME_LENGTH = 36;

export type CrmPadelDefaultTag = {
  name: string;
  color: string;
  sortOrder: number;
};

export const DEFAULT_CRM_PADEL_TAGS: CrmPadelDefaultTag[] = [
  { name: "Newcomer", color: "#22D3EE", sortOrder: 10 },
  { name: "Winback", color: "#F59E0B", sortOrder: 20 },
  { name: "Off-peak", color: "#6366F1", sortOrder: 30 },
  { name: "No-show risk", color: "#EF4444", sortOrder: 40 },
  { name: "Tournament Funnel", color: "#8B5CF6", sortOrder: 50 },
  { name: "Lesson Upsell", color: "#10B981", sortOrder: 60 },
];

type CrmTagSlim = {
  id: string;
  name: string;
  slug: string;
  color: string;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
};

type EnsureTagDefinitionInput = {
  name: string;
  color?: string | null;
  isSystem?: boolean;
  sortOrder?: number;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function dedupeByCaseFold(values: string[]) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const token = value.toLocaleLowerCase("pt-PT");
    if (seen.has(token)) continue;
    seen.add(token);
    output.push(value);
  }
  return output;
}

export function normalizeCrmTagColor(input: unknown) {
  if (typeof input !== "string") return DEFAULT_CRM_TAG_COLOR;
  const value = input.trim().toUpperCase();
  if (!HEX_COLOR_REGEX.test(value)) return DEFAULT_CRM_TAG_COLOR;
  return value;
}

export function normalizeCrmTagName(input: unknown) {
  if (typeof input !== "string") return null;
  const withoutComma = input.replace(/,/g, " ");
  const normalized = normalizeWhitespace(withoutComma);
  if (!normalized) return null;
  if (normalized.length <= MAX_TAG_NAME_LENGTH) return normalized;
  return normalized.slice(0, MAX_TAG_NAME_LENGTH).trim();
}

export function slugifyCrmTagName(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(TAG_TOKEN_REGEX, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "tag";
}

export function normalizeCrmTagsInput(input: unknown, max = MAX_CRM_TAGS) {
  if (!Array.isArray(input)) return [] as string[];
  const normalized = input
    .map((value) => normalizeCrmTagName(value))
    .filter((value): value is string => Boolean(value));
  return dedupeByCaseFold(normalized).slice(0, Math.max(1, max));
}

function areTagsEqual(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

async function runContactTagUpdates(
  prisma: PrismaClient,
  updates: Array<{ id: string; tags: string[] }>,
) {
  if (!updates.length) return;
  const chunkSize = 100;
  for (let index = 0; index < updates.length; index += chunkSize) {
    const chunk = updates.slice(index, index + chunkSize);
    await prisma.$transaction(
      chunk.map((item) =>
        prisma.crmContact.update({
          where: { id: item.id },
          data: { tags: item.tags },
        }),
      ),
    );
  }
}

async function upsertTagDefinition(
  prisma: PrismaClient,
  organizationId: number,
  input: EnsureTagDefinitionInput,
) {
  const normalizedName = normalizeCrmTagName(input.name);
  if (!normalizedName) return null;

  const slug = slugifyCrmTagName(normalizedName);
  const color = normalizeCrmTagColor(input.color);
  const isSystem = Boolean(input.isSystem);
  const sortOrder = Number.isFinite(input.sortOrder) ? Math.trunc(Number(input.sortOrder)) : 100;

  return prisma.crmTagDefinition.upsert({
    where: {
      organizationId_slug: {
        organizationId,
        slug,
      },
    },
    create: {
      organizationId,
      name: normalizedName,
      slug,
      color,
      isSystem,
      sortOrder,
    },
    update: {
      isActive: true,
      ...(isSystem ? { isSystem: true } : {}),
      ...(isSystem ? { sortOrder } : {}),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      color: true,
      isSystem: true,
      isActive: true,
      sortOrder: true,
    },
  });
}

export async function ensureDefaultCrmPadelTags(prisma: PrismaClient, organizationId: number) {
  await Promise.all(
    DEFAULT_CRM_PADEL_TAGS.map((item) =>
      upsertTagDefinition(prisma, organizationId, {
        name: item.name,
        color: item.color,
        isSystem: true,
        sortOrder: item.sortOrder,
      }),
    ),
  );
}

export async function ensureTagDefinitionsForNames(
  prisma: PrismaClient,
  organizationId: number,
  names: string[],
) {
  const normalizedNames = dedupeByCaseFold(
    names.map((name) => normalizeCrmTagName(name)).filter((name): name is string => Boolean(name)),
  );
  if (!normalizedNames.length) return [] as CrmTagSlim[];

  const definitions = await Promise.all(
    normalizedNames.map((name) =>
      upsertTagDefinition(prisma, organizationId, {
        name,
      }),
    ),
  );
  return definitions.filter((definition): definition is CrmTagSlim => Boolean(definition));
}

type TagUsageRow = {
  tag: string;
  count: bigint;
};

function buildUsageMap(rows: TagUsageRow[]) {
  const usage = new Map<string, number>();
  for (const row of rows) {
    const tag = normalizeCrmTagName(row.tag);
    if (!tag) continue;
    usage.set(tag, Number(row.count));
  }
  return usage;
}

export async function listCrmTagDefinitions(prisma: PrismaClient, organizationId: number) {
  await ensureDefaultCrmPadelTags(prisma, organizationId);

  const distinctLegacyRows = await prisma.$queryRaw<Array<{ tag: string }>>(
    Prisma.sql`
      SELECT DISTINCT tag::text AS tag
      FROM app_v3.crm_contacts c, unnest(c.tags) AS tag
      WHERE c.organization_id = ${organizationId}
        AND trim(tag::text) <> ''
    `,
  );
  if (distinctLegacyRows.length) {
    await ensureTagDefinitionsForNames(
      prisma,
      organizationId,
      distinctLegacyRows.map((row) => row.tag),
    );
  }

  const [definitions, usageRows] = await Promise.all([
    prisma.crmTagDefinition.findMany({
      where: { organizationId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        color: true,
        isSystem: true,
        isActive: true,
        sortOrder: true,
      },
    }),
    prisma.$queryRaw<TagUsageRow[]>(
      Prisma.sql`
        SELECT tag::text AS tag, COUNT(*)::bigint AS count
        FROM app_v3.crm_contacts c, unnest(c.tags) AS tag
        WHERE c.organization_id = ${organizationId}
          AND trim(tag::text) <> ''
        GROUP BY tag
      `,
    ),
  ]);

  const usageMap = buildUsageMap(usageRows);

  return definitions.map((definition) => ({
    ...definition,
    usageCount: usageMap.get(definition.name) ?? 0,
  }));
}

export async function canonicalizeCrmTagsForOrganization(
  prisma: PrismaClient,
  organizationId: number,
  inputTags: unknown,
  max = MAX_CRM_TAGS,
) {
  const normalizedTags = normalizeCrmTagsInput(inputTags, max);
  if (!normalizedTags.length) {
    return {
      tags: [] as string[],
      tagDefinitions: [] as CrmTagSlim[],
    };
  }

  const definitions = await ensureTagDefinitionsForNames(prisma, organizationId, normalizedTags);
  const definitionBySlug = new Map(definitions.map((item) => [item.slug, item]));
  const canonicalTags: string[] = [];
  const canonicalDefinitions: CrmTagSlim[] = [];

  for (const tag of normalizedTags) {
    const slug = slugifyCrmTagName(tag);
    const definition = definitionBySlug.get(slug);
    if (!definition) continue;
    if (canonicalTags.includes(definition.name)) continue;
    canonicalTags.push(definition.name);
    canonicalDefinitions.push(definition);
  }

  return {
    tags: canonicalTags.slice(0, max),
    tagDefinitions: canonicalDefinitions.slice(0, max),
  };
}

export async function resolveTagNamesFromIds(
  prisma: PrismaClient,
  organizationId: number,
  tagIds: string[],
) {
  if (!tagIds.length) return [] as string[];
  const tags = await prisma.crmTagDefinition.findMany({
    where: {
      organizationId,
      id: { in: Array.from(new Set(tagIds)) },
      isActive: true,
    },
    select: { name: true },
  });
  return dedupeByCaseFold(tags.map((tag) => tag.name));
}

export async function replaceCrmTagNameInContacts(
  prisma: PrismaClient,
  organizationId: number,
  currentName: string,
  nextName: string,
) {
  const normalizedCurrentName = normalizeCrmTagName(currentName);
  const normalizedNextName = normalizeCrmTagName(nextName);
  if (!normalizedCurrentName || !normalizedNextName) return 0;
  if (normalizedCurrentName === normalizedNextName) return 0;

  const contacts = await prisma.crmContact.findMany({
    where: {
      organizationId,
      tags: { has: normalizedCurrentName },
    },
    select: {
      id: true,
      tags: true,
    },
  });

  const updates: Array<{ id: string; tags: string[] }> = [];
  for (const contact of contacts) {
    const nextTags = dedupeByCaseFold(
      contact.tags.map((tag) => (tag === normalizedCurrentName ? normalizedNextName : tag)),
    ).slice(0, MAX_CRM_TAGS);
    if (!areTagsEqual(contact.tags, nextTags)) {
      updates.push({ id: contact.id, tags: nextTags });
    }
  }

  await runContactTagUpdates(prisma, updates);
  return updates.length;
}

export async function removeCrmTagNameFromContacts(
  prisma: PrismaClient,
  organizationId: number,
  name: string,
) {
  const normalizedName = normalizeCrmTagName(name);
  if (!normalizedName) return 0;
  const blocked = normalizedName.toLocaleLowerCase("pt-PT");

  const contacts = await prisma.crmContact.findMany({
    where: {
      organizationId,
      tags: { has: normalizedName },
    },
    select: {
      id: true,
      tags: true,
    },
  });

  const updates: Array<{ id: string; tags: string[] }> = [];
  for (const contact of contacts) {
    const nextTags = contact.tags.filter((tag) => tag.toLocaleLowerCase("pt-PT") !== blocked);
    if (!areTagsEqual(contact.tags, nextTags)) {
      updates.push({ id: contact.id, tags: nextTags });
    }
  }

  await runContactTagUpdates(prisma, updates);
  return updates.length;
}
