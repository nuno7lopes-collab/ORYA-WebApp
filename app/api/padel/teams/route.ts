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

const readRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];
const writeRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

async function _GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
  } = await supabase.auth.getUser();
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

  const id = typeof body.id === "number" ? body.id : null;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const level = typeof body.level === "string" ? body.level.trim() : null;
  const padelClubId =
    typeof body.padelClubId === "number"
      ? body.padelClubId
      : typeof body.padelClubId === "string"
        ? Number(body.padelClubId)
        : null;
  const categoryId =
    typeof body.categoryId === "number"
      ? body.categoryId
      : typeof body.categoryId === "string"
        ? Number(body.categoryId)
        : null;
  const isActive = typeof body.isActive === "boolean" ? body.isActive : true;

  if (!name) return jsonWrap({ ok: false, error: "NAME_REQUIRED" }, { status: 400 });

  if (Number.isFinite(padelClubId ?? NaN)) {
    const club = await prisma.padelClub.findFirst({
      where: { id: padelClubId as number, organizationId: organization.id },
      select: { id: true },
    });
    if (!club) return jsonWrap({ ok: false, error: "CLUB_NOT_FOUND" }, { status: 404 });
  }

  if (Number.isFinite(categoryId ?? NaN)) {
    const category = await prisma.padelCategory.findFirst({
      where: { id: categoryId as number, organizationId: organization.id },
      select: { id: true },
    });
    if (!category) return jsonWrap({ ok: false, error: "CATEGORY_NOT_FOUND" }, { status: 404 });
  }

  if (id) {
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
        padelClubId: Number.isFinite(padelClubId ?? NaN) ? (padelClubId as number) : null,
        categoryId: Number.isFinite(categoryId ?? NaN) ? (categoryId as number) : null,
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
      padelClubId: Number.isFinite(padelClubId ?? NaN) ? (padelClubId as number) : null,
      categoryId: Number.isFinite(categoryId ?? NaN) ? (categoryId as number) : null,
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
