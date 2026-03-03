import { NextRequest } from "next/server";
import {
  OrganizationMemberRole,
  OrganizationRolePack,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  cancelBookingByOrganizationInTx,
  runOrganizationBookingCancellationPostActions,
  type OrgBookingCancellationTxResult,
} from "@/lib/reservas/orgBookingCancellation";
import { intersectIds, resolveReservasScopesForMember, resolveCoachProfessionalIds } from "@/lib/reservas/memberScopes";

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

function getRequestMeta(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  return { ip, userAgent };
}

async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  type CancelTxnResult =
    | { error: Response }
    | { result: OrgBookingCancellationTxResult };

  const resolved = await params;
  const bookingId = parseId(resolved.id);
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    errorCode: string,
    message: string,
    retryable = false,
    details?: Record<string, unknown>,
  ) =>
    respondError(
      ctx,
      { errorCode, message, retryable, ...(details ? { details } : {}) },
      { status },
    );

  if (!bookingId) {
    return fail(400, "BOOKING_ID_INVALID", "ID inválido.");
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const profile = await prisma.profile.findUnique({ where: { id: user.id } });

    if (!profile) {
      return fail(403, "FORBIDDEN", "Perfil não encontrado.");
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return fail(403, "FORBIDDEN", "Sem permissões.");
    }
    const reservasAccess = await ensureReservasModuleAccess(organization, undefined, {
      requireVerifiedEmail: true,
    });
    if (!reservasAccess.ok) {
      const reservasMessage =
        "message" in reservasAccess && typeof reservasAccess.message === "string"
          ? reservasAccess.message
          : reservasAccess.error ?? "Sem permissões.";
      return fail(
        403,
        reservasAccess.error ?? "FORBIDDEN",
        reservasMessage,
      );
    }

    const payload = await req.json().catch(() => ({}));
    const reason = typeof payload?.reason === "string" ? payload.reason.trim().slice(0, 200) : null;
    const { ip, userAgent } = getRequestMeta(req);

    const txResult = await prisma.$transaction<CancelTxnResult>(async (tx) => {
      const bookingForAccess = await tx.booking.findFirst({
        where: { id: bookingId, organizationId: organization.id },
        select: {
          id: true,
          courtId: true,
          resourceId: true,
          professionalId: true,
        },
      });

      if (!bookingForAccess) {
        return { error: fail(404, "BOOKING_NOT_FOUND", "Reserva não encontrada.") };
      }

      if (membership.role === OrganizationMemberRole.STAFF) {
        const isCoach = membership.rolePack === OrganizationRolePack.COACH;
        const scopes = await resolveReservasScopesForMember({
          organizationId: organization.id,
          userId: profile.id,
        });
        if (!scopes.hasAny) {
          return { error: fail(403, "FORBIDDEN", "Sem permissões.") };
        }
        if (isCoach) {
          const coachProfessionalIds = await resolveCoachProfessionalIds({
            organizationId: organization.id,
            userId: profile.id,
          });
          const allowedProfessionals = scopes.professionalIds.length
            ? intersectIds(coachProfessionalIds, scopes.professionalIds)
            : coachProfessionalIds;
          if (
            !allowedProfessionals.length ||
            !bookingForAccess.professionalId ||
            !allowedProfessionals.includes(bookingForAccess.professionalId)
          ) {
            return { error: fail(403, "FORBIDDEN", "Sem permissões.") };
          }
          if (scopes.courtIds.length && bookingForAccess.courtId && !scopes.courtIds.includes(bookingForAccess.courtId)) {
            return { error: fail(403, "FORBIDDEN", "Sem permissões.") };
          }
          if (scopes.resourceIds.length && bookingForAccess.resourceId && !scopes.resourceIds.includes(bookingForAccess.resourceId)) {
            return { error: fail(403, "FORBIDDEN", "Sem permissões.") };
          }
        } else {
          const allowed = [
            bookingForAccess.courtId && scopes.courtIds.includes(bookingForAccess.courtId),
            bookingForAccess.resourceId && scopes.resourceIds.includes(bookingForAccess.resourceId),
            bookingForAccess.professionalId && scopes.professionalIds.includes(bookingForAccess.professionalId),
          ].some(Boolean);
          if (!allowed) {
            return { error: fail(403, "FORBIDDEN", "Sem permissões.") };
          }
        }
      }

      const result = await cancelBookingByOrganizationInTx({
        tx,
        organizationId: organization.id,
        bookingId,
        actorUserId: profile.id,
        actorRole: membership.role,
        reason,
        ip,
        userAgent,
        auditSource: "ORG",
      });

      return { result };
    });

    if ("error" in txResult) return txResult.error;

    const postActions = await runOrganizationBookingCancellationPostActions({
      prisma,
      result: txResult.result,
    });

    return respondOk(ctx, {
      booking: { id: txResult.result.booking.id, status: txResult.result.booking.status },
      alreadyCancelled: txResult.result.already,
      snapshotTimezone: txResult.result.snapshotTimezone,
      refundCaseId: postActions.refundCaseId,
      refundStatus: postActions.refundStatus,
      splitRefundCases: postActions.splitRefundCases,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "UNAUTHENTICATED", "Não autenticado.");
    }
    if (err instanceof Error) {
      if (err.message === "BOOKING_CONFIRMATION_SNAPSHOT_REQUIRED") {
        return fail(
          409,
          "BOOKING_CONFIRMATION_SNAPSHOT_REQUIRED",
          "Reserva confirmada sem snapshot. Corre o backfill antes de cancelar.",
          false,
          { bookingId },
        );
      }
      if (err.message === "BOOKING_CANCELLATION_NOT_ALLOWED") {
        return fail(400, "BOOKING_CANCELLATION_NOT_ALLOWED", "Já não é possível cancelar esta reserva.");
      }
      if (err.message === "BOOKING_NOT_FOUND") {
        return fail(404, "BOOKING_NOT_FOUND", "Reserva não encontrada.");
      }
    }
    console.error("POST /api/org/[orgId]/reservas/[id]/cancel error:", err);
    return fail(500, "BOOKING_CANCEL_FAILED", "Erro ao cancelar reserva.", true);
  }
}

export const POST = withApiEnvelope(_POST);
