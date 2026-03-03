import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondOk } from "@/lib/http/envelope";
import { prisma } from "@/lib/prisma";
import { crmFail, resolveCrmRequest } from "@/app/api/org/[orgId]/crm/_shared";
import {
  MAX_CRM_TAGS,
  canonicalizeCrmTagsForOrganization,
  normalizeCrmTagsInput,
  resolveTagNamesFromIds,
} from "@/lib/crm/tags";

const MAX_BULK_CONTACTS = 500;

type BulkTagMode = "ADD" | "REMOVE" | "REPLACE";

function dedupeCaseFold(values: string[]) {
  const output: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const token = value.toLocaleLowerCase("pt-PT");
    if (seen.has(token)) continue;
    seen.add(token);
    output.push(value);
  }
  return output;
}

function parseMode(input: unknown): BulkTagMode {
  if (typeof input !== "string") return "ADD";
  const mode = input.trim().toUpperCase();
  if (mode === "REMOVE" || mode === "REPLACE" || mode === "ADD") return mode;
  return "ADD";
}

function parseStringArray(input: unknown) {
  if (!Array.isArray(input)) return [] as string[];
  return input.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean);
}

function removeTagsCaseFold(source: string[], toRemove: string[]) {
  if (!toRemove.length) return source;
  const blocked = new Set(toRemove.map((value) => value.toLocaleLowerCase("pt-PT")));
  return source.filter((value) => !blocked.has(value.toLocaleLowerCase("pt-PT")));
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const access = await resolveCrmRequest({
    req,
    required: "EDIT",
    requireVerifiedEmailReason: "CRM_TAGS_BULK_ASSIGN",
  });
  if (!access.ok) return access.response;

  const payload = (await req.json().catch(() => null)) as {
    contactIds?: unknown;
    tagIds?: unknown;
    tags?: unknown;
    mode?: unknown;
  } | null;

  const contactIds = Array.from(new Set(parseStringArray(payload?.contactIds)));
  if (!contactIds.length) {
    return crmFail(req, 422, "Seleciona pelo menos um cliente.");
  }
  if (contactIds.length > MAX_BULK_CONTACTS) {
    return crmFail(req, 413, `Máximo ${MAX_BULK_CONTACTS} clientes por operação.`);
  }

  const mode = parseMode(payload?.mode);
  const tagIds = Array.from(new Set(parseStringArray(payload?.tagIds)));
  const tagNamesFromIds = await resolveTagNamesFromIds(prisma, access.organization.id, tagIds);
  const canonicalFromInput = await canonicalizeCrmTagsForOrganization(
    prisma,
    access.organization.id,
    payload?.tags,
    MAX_CRM_TAGS,
  );
  const targetTags = dedupeCaseFold([...tagNamesFromIds, ...canonicalFromInput.tags]).slice(0, MAX_CRM_TAGS);

  if (!targetTags.length) {
    return crmFail(req, 422, "Seleciona pelo menos uma tag.");
  }

  const contacts = await prisma.crmContact.findMany({
    where: {
      organizationId: access.organization.id,
      id: { in: contactIds },
    },
    select: {
      id: true,
      tags: true,
    },
  });
  if (!contacts.length) {
    return crmFail(req, 404, "Nenhum cliente encontrado para esta operação.");
  }

  const updates: Array<{ id: string; tags: string[] }> = [];
  for (const contact of contacts) {
    const existingTags = normalizeCrmTagsInput(contact.tags, MAX_CRM_TAGS * 2);
    let nextTags: string[] = existingTags;
    if (mode === "ADD") {
      nextTags = dedupeCaseFold([...existingTags, ...targetTags]).slice(0, MAX_CRM_TAGS);
    } else if (mode === "REMOVE") {
      nextTags = removeTagsCaseFold(existingTags, targetTags).slice(0, MAX_CRM_TAGS);
    } else {
      nextTags = [...targetTags];
    }

    const changed =
      nextTags.length !== existingTags.length || nextTags.some((value, index) => value !== existingTags[index]);
    if (changed) {
      updates.push({ id: contact.id, tags: nextTags });
    }
  }

  if (updates.length) {
    await prisma.$transaction(
      updates.map((item) =>
        prisma.crmContact.update({
          where: { id: item.id },
          data: { tags: item.tags },
        }),
      ),
    );
  }

  return respondOk(ctx, {
    mode,
    requestedContactCount: contactIds.length,
    matchedContactCount: contacts.length,
    updatedCount: updates.length,
    appliedTags: targetTags,
  });
}

export const POST = withApiEnvelope(_POST);
