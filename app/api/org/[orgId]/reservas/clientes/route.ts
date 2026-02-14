import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { OrganizationMemberRole } from "@prisma/client";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

function fail(
  ctx: { requestId: string; correlationId: string },
  status: number,
  errorCode: string,
  message: string,
  details?: Record<string, unknown>,
) {
  return respondError(
    ctx,
    { errorCode, message, retryable: status >= 500, ...(details ? { details } : {}) },
    { status },
  );
}

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { id: true },
    });

    if (!profile) {
      return fail(ctx, 403, "PROFILE_NOT_FOUND", "Perfil não encontrado.");
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return fail(ctx, 403, "FORBIDDEN", "Sem permissões.");
    }
    const reservasAccess = await ensureReservasModuleAccess(organization);
    if (!reservasAccess.ok) {
      return fail(ctx, 403, "RESERVAS_UNAVAILABLE", reservasAccess.error ?? "Reservas indisponíveis.");
    }

    const url = new URL(req.url);
    const query = (url.searchParams.get("q") ?? "").trim();
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 10), 20);

    if (query.length < 2) {
      return respondOk(ctx, { items: [] });
    }

    const items = await prisma.profile.findMany({
      where: {
        isDeleted: false,
        OR: [
          { username: { contains: query, mode: "insensitive" } },
          { fullName: { contains: query, mode: "insensitive" } },
          { contactPhone: { contains: query, mode: "insensitive" } },
          { users: { email: { contains: query, mode: "insensitive" } } },
        ],
      },
      take: limit,
      select: {
        id: true,
        fullName: true,
        username: true,
        contactPhone: true,
        users: { select: { email: true } },
      },
    });

    const mapped = items.map((item) => ({
      id: item.id,
      fullName: item.fullName,
      username: item.username,
      contactPhone: item.contactPhone,
      email: item.users?.email ?? null,
    }));

    return respondOk(ctx, { items: mapped });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(ctx, 401, "UNAUTHENTICATED", "Não autenticado.");
    }
    console.error("GET /api/org/[orgId]/reservas/clientes error:", err);
    return fail(ctx, 500, "INTERNAL_ERROR", "Erro ao carregar clientes.");
  }
}

export const GET = withApiEnvelope(_GET);
