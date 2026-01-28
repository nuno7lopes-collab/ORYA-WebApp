import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { OrganizationModule } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return jsonWrap({ ok: false, error: "Perfil não encontrado." }, { status: 401 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
    });

    if (!organization || !membership) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }
    const access = await ensureMemberModuleAccess({
      organizationId: organization.id,
      userId: profile.id,
      role: membership.role,
      rolePack: membership.rolePack,
      moduleKey: OrganizationModule.EVENTOS,
      required: "EDIT",
    });
    if (!access.ok) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const venues = await prisma.event.findMany({
      where: {
        organizationId: organization.id,
        isDeleted: false,
        locationName: {
          not: "",
          ...(q
            ? {
                contains: q,
                mode: "insensitive",
              }
            : {}),
        },
      },
      select: { locationName: true, locationCity: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });

    const unique = new Map<string, { name: string; city?: string | null }>();
    venues.forEach((row) => {
      if (!row.locationName) return;
      const key = `${row.locationName.toLowerCase()}__${(row.locationCity || "").toLowerCase()}`;
      if (!unique.has(key)) {
        unique.set(key, { name: row.locationName, city: row.locationCity });
      }
    });

    return jsonWrap({ ok: true, items: Array.from(unique.values()) });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("GET /api/organizacao/venues/recent error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar locais recentes." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);