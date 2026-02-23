export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { parseOrganizationId, resolveOrganizationIdFromParams } from "@/lib/organizationId";
import { OrganizationMemberRole, OrganizationModule } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
const readRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];
const writeRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

const parsePositiveInt = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isInteger(value) && value > 0 ? value : null;
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
};

async function _GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const parsedOrgId = resolveOrganizationIdFromParams(req.nextUrl.searchParams);
  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: Number.isFinite(parsedOrgId) ? parsedOrgId : undefined,
    roles: readRoles,
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });
  const viewPermission = await ensureMemberModuleAccess({
    organizationId: organization.id,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "VIEW",
  });
  if (!viewPermission.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "1";

  const teams = await prisma.padelTeam.findMany({
    where: {
      organizationId: organization.id,
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    include: {
      club: { select: { id: true, name: true } },
      category: { select: { id: true, label: true } },
      members: { select: { id: true } },
    },
  });

  return jsonWrap(
    {
      ok: true,
      items: teams.map((team) => ({
        id: team.id,
        name: team.name,
        level: team.level ?? null,
        isActive: team.isActive,
        padelClubId: team.padelClubId ?? null,
        categoryId: team.categoryId ?? null,
        club: team.club ?? null,
        category: team.category ?? null,
        membersCount: team.members.length,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
      })),
    },
    { status: 200 },
  );
}

async function _POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const organizationIdParam = body.organizationId ?? resolveOrganizationIdFromParams(req.nextUrl.searchParams);
  const parsedOrgId = parseOrganizationId(organizationIdParam);
  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: Number.isFinite(parsedOrgId) ? parsedOrgId : undefined,
    roles: writeRoles,
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });
  const editPermission = await ensureMemberModuleAccess({
    organizationId: organization.id,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  if (!editPermission.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const hasId = body.id != null;
  const id = hasId ? parsePositiveInt(body.id) : null;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const level = typeof body.level === "string" ? body.level.trim() : null;
  const hasPadelClubId = body.padelClubId != null;
  const padelClubId = hasPadelClubId ? parsePositiveInt(body.padelClubId) : null;
  const hasCategoryId = body.categoryId != null;
  const categoryId = hasCategoryId ? parsePositiveInt(body.categoryId) : null;
  const isActive = typeof body.isActive === "boolean" ? body.isActive : true;

  if (!name) return jsonWrap({ ok: false, error: "NAME_REQUIRED" }, { status: 400 });
  if (hasId && id == null) return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });
  if (hasPadelClubId && padelClubId == null) return jsonWrap({ ok: false, error: "INVALID_CLUB" }, { status: 400 });
  if (hasCategoryId && categoryId == null) return jsonWrap({ ok: false, error: "INVALID_CATEGORY" }, { status: 400 });

  if (padelClubId != null) {
    const club = await prisma.padelClub.findFirst({
      where: { id: padelClubId, organizationId: organization.id },
      select: { id: true },
    });
    if (!club) return jsonWrap({ ok: false, error: "CLUB_NOT_FOUND" }, { status: 404 });
  }

  if (categoryId != null) {
    const category = await prisma.padelCategory.findFirst({
      where: { id: categoryId, organizationId: organization.id },
      select: { id: true },
    });
    if (!category) return jsonWrap({ ok: false, error: "CATEGORY_NOT_FOUND" }, { status: 404 });
  }

  if (id != null) {
    const existing = await prisma.padelTeam.findFirst({
      where: { id, organizationId: organization.id },
      select: { id: true },
    });
    if (!existing) return jsonWrap({ ok: false, error: "TEAM_NOT_FOUND" }, { status: 404 });

    const updated = await prisma.padelTeam.update({
      where: { id },
      data: {
        name,
        level,
        padelClubId: padelClubId ?? null,
        categoryId: categoryId ?? null,
        isActive,
      },
      include: {
        club: { select: { id: true, name: true } },
        category: { select: { id: true, label: true } },
      },
    });

    return jsonWrap({ ok: true, item: updated }, { status: 200 });
  }

  const created = await prisma.padelTeam.create({
    data: {
      organizationId: organization.id,
      name,
      level,
      padelClubId: padelClubId ?? null,
      categoryId: categoryId ?? null,
      isActive,
    },
    include: {
      club: { select: { id: true, name: true } },
      category: { select: { id: true, label: true } },
    },
  });

  return jsonWrap({ ok: true, item: created }, { status: 201 });
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
