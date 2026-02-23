import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { OrganizationMemberRole, OrganizationModule } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import {
  buildPadelDefaultCategories,
  inferPadelMandatoryCategoryCodeFromFields,
  isReservedPadelMandatoryLabel,
  parsePadelMandatoryCategoryCode,
  sortPadelCategories,
} from "@/domain/padelDefaultCategories";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];
const MANDATORY_CATEGORY_SEEDS = buildPadelDefaultCategories();

const RESERVED_LABEL_ERROR =
  "Código reservado: M1..M6, F1..F6 e MX1..MX6 pertencem às categorias obrigatórias.";
const DUPLICATE_LABEL_ERROR = "Já existe uma categoria com este nome.";
const DEFAULT_CATEGORY_LOCKED_ERROR = "Categorias obrigatórias não podem ser renomeadas nem desativadas.";
const RESERVED_LABEL_ERROR_CODE = "RESERVED_LABEL";
const DUPLICATE_LABEL_ERROR_CODE = "DUPLICATE_LABEL";
const DEFAULT_CATEGORY_LOCKED_ERROR_CODE = "DEFAULT_CATEGORY_LOCKED";

const failText = (status: number, errorCode: string, message: string) =>
  jsonWrap({ ok: false, error: message, errorCode }, { status });

type CategoryLite = {
  id: number;
  label: string;
  genderRestriction: string | null;
  minLevel: string | null;
  maxLevel: string | null;
  isDefault: boolean;
  isActive: boolean;
};

const normalizeCategoryLabel = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, "");

const resolveMandatoryCodeForCategory = (category: CategoryLite) => {
  const fromLabel = parsePadelMandatoryCategoryCode(category.label);
  if (fromLabel) return fromLabel;
  if (!category.isDefault) return null;
  return inferPadelMandatoryCategoryCodeFromFields(category);
};

const pickPreferredMandatoryCategory = (categories: CategoryLite[]) => {
  if (categories.length === 0) return null;
  return [...categories].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.id - b.id;
  })[0];
};

async function ensureMandatoryCategoryCatalog(organizationId: number) {
  const categories = await prisma.padelCategory.findMany({
    where: { organizationId },
    select: {
      id: true,
      label: true,
      genderRestriction: true,
      minLevel: true,
      maxLevel: true,
      isDefault: true,
      isActive: true,
    },
  });

  const byMandatoryCode = new Map<string, CategoryLite[]>();
  for (const category of categories) {
    const code = resolveMandatoryCodeForCategory(category);
    if (!code) continue;
    const list = byMandatoryCode.get(code) ?? [];
    list.push(category);
    byMandatoryCode.set(code, list);
  }

  const writes: ReturnType<typeof prisma.padelCategory.update>[] = [];
  const creates: ReturnType<typeof prisma.padelCategory.create>[] = [];
  const keptMandatoryIds = new Set<number>();

  for (const seed of MANDATORY_CATEGORY_SEEDS) {
    const code = seed.label;
    const candidates = byMandatoryCode.get(code) ?? [];
    const preferred = pickPreferredMandatoryCategory(candidates);
    if (!preferred) {
      creates.push(
        prisma.padelCategory.create({
          data: {
            organizationId,
            label: seed.label,
            genderRestriction: seed.genderRestriction,
            minLevel: seed.minLevel,
            maxLevel: seed.maxLevel,
            isDefault: true,
            isActive: true,
          },
        }),
      );
      continue;
    }

    keptMandatoryIds.add(preferred.id);
    if (
      preferred.label !== seed.label ||
      preferred.genderRestriction !== seed.genderRestriction ||
      preferred.minLevel !== seed.minLevel ||
      preferred.maxLevel !== seed.maxLevel ||
      !preferred.isDefault ||
      !preferred.isActive
    ) {
      writes.push(
        prisma.padelCategory.update({
          where: { id: preferred.id },
          data: {
            label: seed.label,
            genderRestriction: seed.genderRestriction,
            minLevel: seed.minLevel,
            maxLevel: seed.maxLevel,
            isDefault: true,
            isActive: true,
          },
        }),
      );
    }
  }

  // Se existirem duplicados com códigos reservados, removemos o conflito de nome.
  for (const [code, candidates] of byMandatoryCode.entries()) {
    for (const category of candidates) {
      if (keptMandatoryIds.has(category.id)) continue;
      const fallbackLabel = `X-${code}-${category.id}`;
      if (category.label !== fallbackLabel || category.isDefault) {
        writes.push(
          prisma.padelCategory.update({
            where: { id: category.id },
            data: {
              label: fallbackLabel,
              isDefault: false,
            },
          }),
        );
      }
    }
  }

  if (writes.length > 0 || creates.length > 0) {
    await prisma.$transaction([...writes, ...creates]);
  }
}

async function findConflictingCategoryByLabel(params: {
  organizationId: number;
  label: string;
  excludeId?: number;
}) {
  const { organizationId, label, excludeId } = params;
  const normalized = normalizeCategoryLabel(label);
  if (!normalized) return null;

  const categories = await prisma.padelCategory.findMany({
    where: {
      organizationId,
      ...(typeof excludeId === "number" ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, label: true },
  });

  return categories.find((category) => normalizeCategoryLabel(category.label) === normalized) ?? null;
}

async function _GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: ROLE_ALLOWLIST,
    });
    if (!organization || !membership) {
      return failText(403, "NO_ORGANIZATION", "Organização não encontrado.");
    }
    const permission = await ensureMemberModuleAccess({
      organizationId: organization.id,
      userId: user.id,
      role: membership.role,
      rolePack: membership.rolePack,
      moduleKey: OrganizationModule.TORNEIOS,
      required: "VIEW",
    });
    if (!permission.ok) {
      return failText(403, "FORBIDDEN", "Sem permissões.");
    }

    const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "1";
    await ensureMandatoryCategoryCatalog(organization.id);

    const categories = await prisma.padelCategory.findMany({
      where: {
        organizationId: organization.id,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ season: "desc" }, { year: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        label: true,
        minLevel: true,
        maxLevel: true,
        genderRestriction: true,
        isActive: true,
        season: true,
        year: true,
      },
    });

    return jsonWrap({ ok: true, items: sortPadelCategories(categories) });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return failText(401, "UNAUTHENTICATED", "Não autenticado.");
    }
    console.error("[padel/categories/my] error", err);
    return failText(500, "CATEGORIES_LOAD_FAILED", "Erro ao carregar categorias.");
  }
}

async function _POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: ROLE_ALLOWLIST,
    });
    if (!organization || !membership) {
      return failText(403, "NO_ORGANIZATION", "Organização não encontrado.");
    }
    const permission = await ensureMemberModuleAccess({
      organizationId: organization.id,
      userId: user.id,
      role: membership.role,
      rolePack: membership.rolePack,
      moduleKey: OrganizationModule.TORNEIOS,
      required: "EDIT",
    });
    if (!permission.ok) {
      return failText(403, "FORBIDDEN", "Sem permissões.");
    }

    await ensureMandatoryCategoryCatalog(organization.id);

    const label = typeof body.label === "string" ? body.label.trim() : "";
    if (!label) {
      return failText(400, "CATEGORY_NAME_REQUIRED", "Nome obrigatório.");
    }
    if (isReservedPadelMandatoryLabel(label)) {
      return failText(409, RESERVED_LABEL_ERROR_CODE, RESERVED_LABEL_ERROR);
    }

    const conflicting = await findConflictingCategoryByLabel({
      organizationId: organization.id,
      label,
    });
    if (conflicting) {
      return failText(409, DUPLICATE_LABEL_ERROR_CODE, DUPLICATE_LABEL_ERROR);
    }

    const genderRestriction = typeof body.genderRestriction === "string" ? body.genderRestriction.trim() : null;
    const minLevel = typeof body.minLevel === "string" ? body.minLevel.trim() : null;
    const maxLevel = typeof body.maxLevel === "string" ? body.maxLevel.trim() : null;
    const season = typeof body.season === "string" ? body.season.trim() : null;
    const yearRaw = typeof body.year === "number" ? body.year : Number(body.year);
    const year = Number.isFinite(yearRaw) ? Math.floor(yearRaw) : null;
    const isActive = body.isActive === false ? false : true;

    const category = await prisma.padelCategory.create({
      data: {
        organizationId: organization.id,
        label,
        genderRestriction: genderRestriction || null,
        minLevel: minLevel || null,
        maxLevel: maxLevel || null,
        season: season || null,
        year,
        isActive,
      },
      select: {
        id: true,
        label: true,
        genderRestriction: true,
        minLevel: true,
        maxLevel: true,
        season: true,
        year: true,
        isActive: true,
      },
    });

    return jsonWrap({ ok: true, item: category }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return failText(401, "UNAUTHENTICATED", "Não autenticado.");
    }
    console.error("[padel/categories/my][POST] error", err);
    return failText(500, "CATEGORY_CREATE_FAILED", "Erro ao criar categoria.");
  }
}

async function _PATCH(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

    const categoryId = typeof body.id === "number" ? body.id : Number(body.id);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: ROLE_ALLOWLIST,
    });
    if (!organization || !membership) {
      return failText(403, "NO_ORGANIZATION", "Organização não encontrado.");
    }
    const permission = await ensureMemberModuleAccess({
      organizationId: organization.id,
      userId: user.id,
      role: membership.role,
      rolePack: membership.rolePack,
      moduleKey: OrganizationModule.TORNEIOS,
      required: "EDIT",
    });
    if (!permission.ok) {
      return failText(403, "FORBIDDEN", "Sem permissões.");
    }

    await ensureMandatoryCategoryCatalog(organization.id);

    const existing = await prisma.padelCategory.findFirst({
      where: { id: categoryId, organizationId: organization.id },
      select: {
        id: true,
        isDefault: true,
        label: true,
      },
    });
    if (!existing) {
      return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (typeof body.label === "string") {
      const nextLabel = body.label.trim();
      if (!nextLabel) {
        return failText(400, "CATEGORY_NAME_REQUIRED", "Nome obrigatório.");
      }
      if (existing.isDefault) {
        const isSameLabel = normalizeCategoryLabel(nextLabel) === normalizeCategoryLabel(existing.label);
        if (!isSameLabel) {
          return failText(409, DEFAULT_CATEGORY_LOCKED_ERROR_CODE, DEFAULT_CATEGORY_LOCKED_ERROR);
        }
      } else if (isReservedPadelMandatoryLabel(nextLabel)) {
        return failText(409, RESERVED_LABEL_ERROR_CODE, RESERVED_LABEL_ERROR);
      }

      const conflicting = await findConflictingCategoryByLabel({
        organizationId: organization.id,
        label: nextLabel,
        excludeId: existing.id,
      });
      if (conflicting) {
        return failText(409, DUPLICATE_LABEL_ERROR_CODE, DUPLICATE_LABEL_ERROR);
      }

      updates.label = nextLabel;
    }
    if (typeof body.genderRestriction === "string") {
      if (existing.isDefault) {
        return failText(409, DEFAULT_CATEGORY_LOCKED_ERROR_CODE, DEFAULT_CATEGORY_LOCKED_ERROR);
      }
      updates.genderRestriction = body.genderRestriction.trim() || null;
    }
    if (typeof body.minLevel === "string") {
      if (existing.isDefault) {
        return failText(409, DEFAULT_CATEGORY_LOCKED_ERROR_CODE, DEFAULT_CATEGORY_LOCKED_ERROR);
      }
      updates.minLevel = body.minLevel.trim() || null;
    }
    if (typeof body.maxLevel === "string") {
      if (existing.isDefault) {
        return failText(409, DEFAULT_CATEGORY_LOCKED_ERROR_CODE, DEFAULT_CATEGORY_LOCKED_ERROR);
      }
      updates.maxLevel = body.maxLevel.trim() || null;
    }
    if (typeof body.season === "string") updates.season = body.season.trim() || null;
    if (Object.prototype.hasOwnProperty.call(body, "year")) {
      const yearRaw = typeof body.year === "number" ? body.year : Number(body.year);
      updates.year = Number.isFinite(yearRaw) ? Math.floor(yearRaw) : null;
    }
    if (Object.prototype.hasOwnProperty.call(body, "isActive")) {
      if (existing.isDefault && body.isActive !== true) {
        return failText(409, DEFAULT_CATEGORY_LOCKED_ERROR_CODE, DEFAULT_CATEGORY_LOCKED_ERROR);
      }
      updates.isActive = body.isActive === true;
    }

    const updated = await prisma.padelCategory.update({
      where: { id: categoryId },
      data: updates,
      select: {
        id: true,
        label: true,
        genderRestriction: true,
        minLevel: true,
        maxLevel: true,
        season: true,
        year: true,
        isActive: true,
      },
    });

    return jsonWrap({ ok: true, item: updated }, { status: 200 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return failText(401, "UNAUTHENTICATED", "Não autenticado.");
    }
    console.error("[padel/categories/my][PATCH] error", err);
    return failText(500, "CATEGORY_UPDATE_FAILED", "Erro ao atualizar categoria.");
  }
}

async function _DELETE(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    let categoryId = Number(req.nextUrl.searchParams.get("id"));
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
      const bodyId = typeof body?.id === "number" ? body.id : Number(body?.id);
      if (!Number.isInteger(bodyId) || bodyId <= 0) {
        return failText(400, "INVALID_ID", "ID inválido.");
      }
      categoryId = bodyId;
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: ROLE_ALLOWLIST,
    });
    if (!organization || !membership) {
      return failText(403, "NO_ORGANIZATION", "Organização não encontrado.");
    }
    const permission = await ensureMemberModuleAccess({
      organizationId: organization.id,
      userId: user.id,
      role: membership.role,
      rolePack: membership.rolePack,
      moduleKey: OrganizationModule.TORNEIOS,
      required: "EDIT",
    });
    if (!permission.ok) {
      return failText(403, "FORBIDDEN", "Sem permissões.");
    }

    await ensureMandatoryCategoryCatalog(organization.id);

    const existing = await prisma.padelCategory.findFirst({
      where: { id: categoryId, organizationId: organization.id },
      select: {
        id: true,
        isDefault: true,
        _count: {
          select: {
            matchSlots: true,
            pairings: true,
            tournamentEntries: true,
            tournamentConfigs: true,
            eventLinks: true,
            waitlistEntries: true,
          },
        },
      },
    });
    if (!existing) {
      return failText(404, "CATEGORY_NOT_FOUND", "Categoria não encontrada.");
    }
    if (existing.isDefault) {
      return failText(409, DEFAULT_CATEGORY_LOCKED_ERROR_CODE, "Não podes apagar uma categoria base.");
    }

    const usageCount = Object.values(existing._count as Record<string, number>).reduce(
      (sum, value) => sum + value,
      0,
    );
    if (usageCount > 0) {
      return failText(409, "CATEGORY_IN_USE", "Categoria em uso. Remove-a dos torneios ou desativa em vez de apagar.");
    }

    await prisma.padelCategory.delete({ where: { id: categoryId } });

    return jsonWrap({ ok: true }, { status: 200 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return failText(401, "UNAUTHENTICATED", "Não autenticado.");
    }
    console.error("[padel/categories/my][DELETE] error", err);
    return failText(500, "CATEGORY_DELETE_FAILED", "Erro ao apagar categoria.");
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);
