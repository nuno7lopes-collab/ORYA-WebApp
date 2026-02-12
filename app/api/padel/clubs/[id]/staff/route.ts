export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { OrganizationMemberRole, OrganizationModule } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { resolveOrganizationIdStrict } from "@/lib/organizationId";
import { readNumericParam } from "@/lib/routeParams";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const readRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];
const writeRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];
const PADEL_CLUB_STAFF_ROLES = ["ADMIN_CLUBE", "DIRETOR_PROVA", "STAFF"] as const;
type PadelClubStaffRole = (typeof PADEL_CLUB_STAFF_ROLES)[number];
const PADEL_CLUB_STAFF_ROLE_SET = new Set<PadelClubStaffRole>(PADEL_CLUB_STAFF_ROLES);

const PADEL_CLUB_STAFF_ROLE_ALIASES: Record<string, PadelClubStaffRole> = {
  ADMIN: "ADMIN_CLUBE",
  ADMIN_CLUB: "ADMIN_CLUBE",
  CLUB_ADMIN: "ADMIN_CLUBE",
  DIRETOR: "DIRETOR_PROVA",
  DIRECTOR: "DIRETOR_PROVA",
  ARBITRO: "DIRETOR_PROVA",
  ARBITRO_PROVA: "DIRETOR_PROVA",
  REFEREE: "DIRETOR_PROVA",
};

function normalizePadelClubStaffRole(value: unknown): PadelClubStaffRole | null {
  if (typeof value !== "string") return null;
  const compact = value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (PADEL_CLUB_STAFF_ROLE_SET.has(compact as PadelClubStaffRole)) {
    return compact as PadelClubStaffRole;
  }
  return PADEL_CLUB_STAFF_ROLE_ALIASES[compact] ?? null;
}

async function _GET(req: NextRequest) {
  const clubId = readNumericParam(undefined, req, "clubs");
  if (clubId === null) return jsonWrap({ ok: false, error: "INVALID_CLUB" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const orgResolution = resolveOrganizationIdStrict({ req, allowFallback: false });
  if (!orgResolution.ok && orgResolution.reason === "CONFLICT") {
    return jsonWrap({ ok: false, error: "ORGANIZATION_ID_CONFLICT" }, { status: 400 });
  }
  if (!orgResolution.ok && orgResolution.reason === "INVALID") {
    return jsonWrap({ ok: false, error: "INVALID_ORGANIZATION_ID" }, { status: 400 });
  }
  const explicitOrganizationId = orgResolution.ok ? orgResolution.organizationId : null;

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    roles: readRoles,
    organizationId: explicitOrganizationId,
    allowFallback: !explicitOrganizationId,
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

  const club = await prisma.padelClub.findFirst({ where: { id: clubId, organizationId: organization.id, deletedAt: null } });
  if (!club) return jsonWrap({ ok: false, error: "CLUB_NOT_FOUND" }, { status: 404 });

  const staff = await prisma.padelClubStaff.findMany({
    where: { padelClubId: club.id, deletedAt: null },
    orderBy: [{ createdAt: "desc" }],
  });

  const normalized = staff.map((item) => ({
    ...item,
    role: normalizePadelClubStaffRole(item.role) ?? item.role,
  }));

  return jsonWrap({ ok: true, items: normalized }, { status: 200 });
}

async function _POST(req: NextRequest) {
  const clubId = readNumericParam(undefined, req, "clubs");
  if (clubId === null) return jsonWrap({ ok: false, error: "INVALID_CLUB" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const orgResolution = resolveOrganizationIdStrict({
    req,
    body,
    allowFallback: false,
  });
  if (!orgResolution.ok && orgResolution.reason === "CONFLICT") {
    return jsonWrap({ ok: false, error: "ORGANIZATION_ID_CONFLICT" }, { status: 400 });
  }
  if (!orgResolution.ok && orgResolution.reason === "INVALID") {
    return jsonWrap({ ok: false, error: "INVALID_ORGANIZATION_ID" }, { status: 400 });
  }
  const explicitOrganizationId = orgResolution.ok ? orgResolution.organizationId : null;

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    roles: writeRoles,
    organizationId: explicitOrganizationId,
    allowFallback: !explicitOrganizationId,
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

  const club = await prisma.padelClub.findFirst({ where: { id: clubId, organizationId: organization.id, deletedAt: null } });
  if (!club) return jsonWrap({ ok: false, error: "CLUB_NOT_FOUND" }, { status: 404 });

  const staffId = typeof body.id === "number" ? body.id : null;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const userId = typeof body.userId === "string" ? body.userId : null;
  const inheritToEvents = typeof body.inheritToEvents === "boolean" ? body.inheritToEvents : true;
  const padelRole = normalizePadelClubStaffRole(body.padelRole ?? body.role);

  if (!email && !userId) {
    return jsonWrap({ ok: false, error: "Indica o email ou userId do staff." }, { status: 400 });
  }
  if (!padelRole) {
    return jsonWrap(
      { ok: false, error: `Papel inválido. Usa: ${PADEL_CLUB_STAFF_ROLES.join(", ")}` },
      { status: 400 },
    );
  }

  try {
    // Se recebermos email mas não userId, tentar ligar a uma conta existente
    let resolvedUserId = userId;
    if (!resolvedUserId && email) {
      const foundUser = await prisma.users.findFirst({
        where: { email: email.toLowerCase() },
        select: { id: true },
      });
      if (foundUser) resolvedUserId = foundUser.id;
    }

    // Evitar duplicados (mesmo userId ou mesmo email no clube)
    const existing = await prisma.padelClubStaff.findFirst({
      where: {
        padelClubId: club.id,
        deletedAt: null,
        OR: [
          resolvedUserId ? { userId: resolvedUserId } : undefined,
          email ? { email } : undefined,
        ].filter(Boolean) as { userId?: string; email?: string | null }[],
      },
    });

    const data = {
      padelClubId: club.id,
      email: email || null,
      userId: resolvedUserId,
      role: padelRole,
      inheritToEvents,
    };

    let staff;
    if (staffId || existing) {
      const targetId = staffId || existing?.id;
      staff = await prisma.padelClubStaff.update({
        where: { id: targetId, padelClubId: club.id },
        data: { ...data, deletedAt: null, isActive: true },
      });
    } else {
      staff = await prisma.padelClubStaff.create({ data });
    }

    return jsonWrap({ ok: true, staff }, { status: staffId ? 200 : 201 });
  } catch (err) {
    console.error("[padel/clubs/staff] error", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// Soft delete staff member
async function _DELETE(req: NextRequest) {
  const clubId = readNumericParam(undefined, req, "clubs");
  if (clubId === null) return jsonWrap({ ok: false, error: "INVALID_CLUB" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const orgResolution = resolveOrganizationIdStrict({ req, allowFallback: false });
  if (!orgResolution.ok && orgResolution.reason === "CONFLICT") {
    return jsonWrap({ ok: false, error: "ORGANIZATION_ID_CONFLICT" }, { status: 400 });
  }
  if (!orgResolution.ok && orgResolution.reason === "INVALID") {
    return jsonWrap({ ok: false, error: "INVALID_ORGANIZATION_ID" }, { status: 400 });
  }
  const explicitOrganizationId = orgResolution.ok ? orgResolution.organizationId : null;

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    roles: writeRoles,
    organizationId: explicitOrganizationId,
    allowFallback: !explicitOrganizationId,
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

  const club = await prisma.padelClub.findFirst({ where: { id: clubId, organizationId: organization.id, deletedAt: null } });
  if (!club) return jsonWrap({ ok: false, error: "CLUB_NOT_FOUND" }, { status: 404 });

  const url = new URL(req.url);
  const staffId = url.searchParams.get("staffId");
  const staffIdNum = staffId ? Number(staffId) : NaN;
  if (!Number.isFinite(staffIdNum)) return jsonWrap({ ok: false, error: "INVALID_STAFF" }, { status: 400 });

  const staff = await prisma.padelClubStaff.findFirst({
    where: { id: staffIdNum, padelClubId: clubId, deletedAt: null },
  });
  if (!staff) return jsonWrap({ ok: false, error: "STAFF_NOT_FOUND" }, { status: 404 });

  await prisma.padelClubStaff.update({
    where: { id: staffIdNum },
    data: { isActive: false, deletedAt: new Date() },
  });

  return jsonWrap({ ok: true }, { status: 200 });
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
export const DELETE = withApiEnvelope(_DELETE);
