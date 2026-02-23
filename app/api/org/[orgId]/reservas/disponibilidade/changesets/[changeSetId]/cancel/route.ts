import { NextRequest } from "next/server";
import { OrganizationMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

function parseId(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function fail(
  ctx: { requestId: string; correlationId: string },
  status: number,
  errorCode: string,
  message: string,
) {
  return respondError(ctx, { errorCode, message, retryable: status >= 500 }, { status });
}

async function _POST(req: NextRequest, { params }: { params: Promise<{ changeSetId: string }> }) {
  const ctx = getRequestContext(req);
  const resolved = await params;
  const changeSetId = parseId(resolved.changeSetId);
  if (!changeSetId) {
    return fail(ctx, 400, "INVALID_ID", "ID inválido.");
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const profile = await prisma.profile.findUnique({ where: { id: user.id } });

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

    const reservasAccess = await ensureReservasModuleAccess(organization, undefined, {
      requireVerifiedEmail: true,
    });
    if (!reservasAccess.ok) {
      return fail(ctx, 403, "RESERVAS_UNAVAILABLE", reservasAccess.error ?? "Reservas indisponíveis.");
    }

    const changeSet = await prisma.availabilityChangeSet.findFirst({
      where: { id: changeSetId, organizationId: organization.id },
      select: { id: true, status: true },
    });

    if (!changeSet) {
      return fail(ctx, 404, "NOT_FOUND", "Pedido não encontrado.");
    }
    if (changeSet.status === "APPLIED") {
      return fail(ctx, 409, "AVAILABILITY_CHANGESET_NOT_READY", "Pedido já aplicado, não pode ser cancelado.");
    }
    if (changeSet.status === "CANCELLED") {
      return respondOk(ctx, { changeSetId, status: "CANCELLED", alreadyCancelled: true });
    }

    await prisma.availabilityChangeSet.update({
      where: { id: changeSet.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
      },
    });

    return respondOk(ctx, { changeSetId, status: "CANCELLED", alreadyCancelled: false });
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return fail(ctx, 401, "UNAUTHENTICATED", "Não autenticado.");
    }
    return fail(ctx, 500, "INTERNAL_ERROR", "Erro ao cancelar pedido.");
  }
}

export const POST = withApiEnvelope(_POST);
