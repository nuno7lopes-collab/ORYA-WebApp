export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { resolveRequiredOrganizationIdFromRequest } from "@/lib/organizationId";
import { OrganizationMemberRole, OrganizationModule } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

async function _GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const profile = await prisma.profile.findUnique({ where: { id: user.id } });
    if (!profile) {
      return jsonWrap(
        { ok: false, error: "PROFILE_NOT_FOUND", message: "Perfil não encontrado." },
        { status: 403 },
      );
    }

    const orgResolution = resolveRequiredOrganizationIdFromRequest(req);
    if (!orgResolution.ok) {
      return jsonWrap({ ok: false, error: "ORG_ID_REQUIRED", message: "Org inválida." }, { status: 400 });
    }
    const organizationId = orgResolution.organizationId;
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId,
      roles: [...ROLE_ALLOWLIST],
    });
    if (!organization || !membership) {
      return jsonWrap({ ok: false, error: "FORBIDDEN", message: "Sem permissões." }, { status: 403 });
    }
    const permission = await ensureMemberModuleAccess({
      organizationId: organization.id,
      userId: profile.id,
      role: membership.role,
      rolePack: membership.rolePack,
      moduleKey: OrganizationModule.TORNEIOS,
      required: "VIEW",
    });
    if (!permission.ok) {
      return jsonWrap({ ok: false, error: "FORBIDDEN", message: "Sem permissões." }, { status: 403 });
    }

    const clubs = await prisma.padelClub.findMany({
      where: { organizationId: organization.id, deletedAt: null },
      select: { id: true, name: true },
    });
    const clubIds = clubs.map((club) => club.id);

    const courts = clubIds.length
      ? await prisma.padelClubCourt.findMany({
          where: { padelClubId: { in: clubIds }, isActive: true },
          orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
          select: { id: true, name: true, padelClubId: true },
        })
      : [];

    const clubMap = new Map(clubs.map((club) => [club.id, club.name]));
    const items = courts.map((court) => ({
      id: court.id,
      name: court.name,
      padelClubId: court.padelClubId,
      clubName: clubMap.get(court.padelClubId) ?? null,
    }));

    return jsonWrap({ ok: true, items }, { status: 200 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED", message: "Não autenticado." }, { status: 401 });
    }
    console.error("GET /api/org/[orgId]/padel/courts error:", err);
    return jsonWrap(
      { ok: false, error: "COURTS_LOAD_FAILED", message: "Erro ao carregar courts." },
      { status: 500 },
    );
  }
}
export const GET = withApiEnvelope(_GET);
