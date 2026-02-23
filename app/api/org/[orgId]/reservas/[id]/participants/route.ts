import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { OrganizationMemberRole, OrganizationRolePack } from "@prisma/client";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { ensureStaffCanAccessBooking } from "@/lib/reservas/staffBookingAccess";

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

async function _GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  const resolved = await params;
  const bookingId = parseId(resolved.id);
  if (!bookingId) {
    return fail(ctx, 400, "BAD_REQUEST", "Reserva inválida.");
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const profile = await prisma.profile.findUnique({ where: { id: user.id }, select: { id: true } });
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

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, organizationId: organization.id },
      select: {
        id: true,
        professionalId: true,
        resourceId: true,
        courtId: true,
        invites: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            status: true,
            targetName: true,
            targetContact: true,
            respondedAt: true,
            createdAt: true,
          },
        },
        participants: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            status: true,
            name: true,
            contact: true,
            createdAt: true,
            inviteId: true,
          },
        },
      },
    });

    if (!booking) {
      return fail(ctx, 404, "NOT_FOUND", "Reserva não encontrada.");
    }
    const staffAccess = await ensureStaffCanAccessBooking({
      organizationId: organization.id,
      userId: profile.id,
      role: membership.role,
      isCoach: membership.rolePack === OrganizationRolePack.COACH,
      booking: {
        professionalId: booking.professionalId,
        resourceId: booking.resourceId,
        courtId: booking.courtId,
      },
    });
    if (!staffAccess.ok) {
      return fail(ctx, staffAccess.status, staffAccess.errorCode, staffAccess.message);
    }

    return respondOk(ctx, { invites: booking.invites, participants: booking.participants });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(ctx, 401, "UNAUTHENTICATED", "Não autenticado.");
    }
    console.error("GET /api/org/[orgId]/reservas/[id]/participants error:", err);
    return fail(ctx, 500, "INTERNAL_ERROR", "Erro ao carregar participantes.");
  }
}

export const GET = withApiEnvelope(_GET);
