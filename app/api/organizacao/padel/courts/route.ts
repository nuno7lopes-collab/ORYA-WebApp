export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { OrganizationMemberRole } from "@prisma/client";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const profile = await prisma.profile.findUnique({ where: { id: user.id } });
    if (!profile) {
      return NextResponse.json({ ok: false, error: "Perfil não encontrado." }, { status: 403 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });
    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
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

    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("GET /api/organizacao/padel/courts error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar courts." }, { status: 500 });
  }
}
