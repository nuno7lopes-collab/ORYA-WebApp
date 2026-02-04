import { NextRequest, NextResponse } from "next/server";
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
  buildPadelCategoryKey,
  buildPadelDefaultCategories,
  sortPadelCategories,
} from "@/domain/padelDefaultCategories";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

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
      return jsonWrap({ ok: false, error: "Organização não encontrado." }, { status: 403 });
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
      return jsonWrap({ ok: false, error: "Sem permissões." }, { status: 403 });
    }

    const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "1";

    const hasDefaultCategories = await prisma.padelCategory.findFirst({
      where: { organizationId: organization.id, isDefault: true },
      select: { id: true },
    });

    if (!hasDefaultCategories) {
      const existingCategories = await prisma.padelCategory.findMany({
        where: { organizationId: organization.id },
        select: { label: true, genderRestriction: true },
      });
      const existingKeys = new Set(existingCategories.map((category) => buildPadelCategoryKey(category)));
      const defaultSeeds = buildPadelDefaultCategories().filter(
        (seed) => !existingKeys.has(buildPadelCategoryKey(seed)),
      );

      if (defaultSeeds.length > 0) {
        await prisma.padelCategory.createMany({
          data: defaultSeeds.map((seed) => ({
            organizationId: organization.id,
            label: seed.label,
            genderRestriction: seed.genderRestriction,
            minLevel: seed.minLevel,
            maxLevel: seed.maxLevel,
            isDefault: true,
            isActive: true,
          })),
        });
      }
    }

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
      return jsonWrap({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("[padel/categories/my] error", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar categorias." }, { status: 500 });
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
      return jsonWrap({ ok: false, error: "Organização não encontrado." }, { status: 403 });
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
      return jsonWrap({ ok: false, error: "Sem permissões." }, { status: 403 });
    }

    const label = typeof body.label === "string" ? body.label.trim() : "";
    if (!label) {
      return jsonWrap({ ok: false, error: "LABEL_REQUIRED" }, { status: 400 });
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
      return jsonWrap({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("[padel/categories/my][POST] error", err);
    return jsonWrap({ ok: false, error: "Erro ao criar categoria." }, { status: 500 });
  }
}

async function _PATCH(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

    const categoryId = typeof body.id === "number" ? body.id : Number(body.id);
    if (!Number.isFinite(categoryId)) {
      return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: ROLE_ALLOWLIST,
    });
    if (!organization) {
      return jsonWrap({ ok: false, error: "Organização não encontrado." }, { status: 403 });
    }

    const existing = await prisma.padelCategory.findFirst({
      where: { id: categoryId, organizationId: organization.id },
      select: { id: true },
    });
    if (!existing) {
      return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (typeof body.label === "string") updates.label = body.label.trim();
    if (typeof body.genderRestriction === "string") {
      updates.genderRestriction = body.genderRestriction.trim() || null;
    }
    if (typeof body.minLevel === "string") updates.minLevel = body.minLevel.trim() || null;
    if (typeof body.maxLevel === "string") updates.maxLevel = body.maxLevel.trim() || null;
    if (typeof body.season === "string") updates.season = body.season.trim() || null;
    if (Object.prototype.hasOwnProperty.call(body, "year")) {
      const yearRaw = typeof body.year === "number" ? body.year : Number(body.year);
      updates.year = Number.isFinite(yearRaw) ? Math.floor(yearRaw) : null;
    }
    if (Object.prototype.hasOwnProperty.call(body, "isActive")) {
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
      return jsonWrap({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("[padel/categories/my][PATCH] error", err);
    return jsonWrap({ ok: false, error: "Erro ao atualizar categoria." }, { status: 500 });
  }
}

async function _DELETE(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    let categoryId = Number(req.nextUrl.searchParams.get("id"));
    if (!Number.isFinite(categoryId)) {
      const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
      const bodyId = typeof body?.id === "number" ? body.id : Number(body?.id);
      if (!Number.isFinite(bodyId)) {
        return jsonWrap({ ok: false, error: "ID inválido." }, { status: 400 });
      }
      categoryId = bodyId;
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: ROLE_ALLOWLIST,
    });
    if (!organization) {
      return jsonWrap({ ok: false, error: "Organização não encontrado." }, { status: 403 });
    }

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
      return jsonWrap({ ok: false, error: "Categoria não encontrada." }, { status: 404 });
    }
    if (existing.isDefault) {
      return jsonWrap({ ok: false, error: "Não podes apagar uma categoria base." }, { status: 409 });
    }

    const usageCount = Object.values(existing._count as Record<string, number>).reduce(
      (sum, value) => sum + value,
      0,
    );
    if (usageCount > 0) {
      return jsonWrap(
        { ok: false, error: "Categoria em uso. Remove-a dos torneios ou desativa em vez de apagar." },
        { status: 409 },
      );
    }

    await prisma.padelCategory.delete({ where: { id: categoryId } });

    return jsonWrap({ ok: true }, { status: 200 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("[padel/categories/my][DELETE] error", err);
    return jsonWrap({ ok: false, error: "Erro ao apagar categoria." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);
