import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import {
  BOOKING_POLICY_WINDOW_MINUTES_MAX,
  BOOKING_POLICY_WINDOW_MINUTES_MIN,
  validateBookingPolicyWindowMinutes,
} from "@/lib/policies/bookingPolicyGuardrails";
import { OrganizationMemberRole, Prisma } from "@prisma/client";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

function getRequestMeta(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  return { ip, userAgent };
}

function parsePolicyId(raw: string) {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 410) return "GONE";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}
async function _PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
    details?: Record<string, unknown>,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(
      ctx,
      { errorCode: resolvedCode, message: resolvedMessage, retryable, ...(details ? { details } : {}) },
      { status },
    );
  };
  const resolved = await params;
  const policyId = parsePolicyId(resolved.id);
  if (!policyId) {
    return fail(400, "Política inválida.");
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const profile = await prisma.profile.findUnique({ where: { id: user.id } });
    if (!profile) {
      return fail(403, "Perfil não encontrado.");
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });
    if (!organization || !membership) {
      return fail(403, "Sem permissões.");
    }

    const existing = await prisma.organizationPolicy.findFirst({
      where: { id: policyId, organizationId: organization.id },
      select: { id: true },
    });
    if (!existing) {
      return fail(404, "Política não encontrada.");
    }

    const payloadRaw = await req.json().catch(() => ({}));
    const payload =
      payloadRaw && typeof payloadRaw === "object"
        ? (payloadRaw as Record<string, unknown>)
        : {};
    const updates: Record<string, unknown> = {};
    if (typeof payload?.name === "string") updates.name = payload.name.trim();
    if (typeof payload?.allowCancellation === "boolean") updates.allowCancellation = payload.allowCancellation;
    if (Object.prototype.hasOwnProperty.call(payload, "cancellationWindowMinutes")) {
      const cancellationValidation = validateBookingPolicyWindowMinutes({
        value: payload.cancellationWindowMinutes,
        field: "cancellationWindowMinutes",
        allowNull: true,
      });
      if (!cancellationValidation.ok) {
        return fail(422, cancellationValidation.message, cancellationValidation.errorCode, false, cancellationValidation.details);
      }
      updates.cancellationWindowMinutes = cancellationValidation.value;
    }
    if (typeof payload?.allowReschedule === "boolean") updates.allowReschedule = payload.allowReschedule;
    if (Object.prototype.hasOwnProperty.call(payload, "rescheduleWindowMinutes")) {
      const rescheduleValidation = validateBookingPolicyWindowMinutes({
        value: payload.rescheduleWindowMinutes,
        field: "rescheduleWindowMinutes",
        allowNull: true,
      });
      if (!rescheduleValidation.ok) {
        return fail(422, rescheduleValidation.message, rescheduleValidation.errorCode, false, rescheduleValidation.details);
      }
      updates.rescheduleWindowMinutes = rescheduleValidation.value;
    }
    if (typeof payload?.guestBookingAllowed === "boolean") {
      updates.guestBookingAllowed = payload.guestBookingAllowed;
    }
    if (payload?.cancellationPenaltyBps !== undefined && Number(payload?.cancellationPenaltyBps) !== 0) {
      return fail(400, "CANCELLATION_PENALTY_LOCKED");
    }
    if (payload?.noShowFeeCents !== undefined && Number(payload?.noShowFeeCents) !== 0) {
      return fail(400, "NO_SHOW_POLICY_LOCKED");
    }
    if (Object.prototype.hasOwnProperty.call(payload, "policyType")) {
      return fail(400, "O tipo da política é fixo.");
    }

    if (Object.keys(updates).length === 0) {
      return fail(400, "Sem alterações.");
    }
    updates.cancellationPenaltyBps = 0;
    updates.noShowFeeCents = 0;

    const policy = await prisma.organizationPolicy.update({
      where: { id: policyId },
      data: updates,
      select: {
        id: true,
        name: true,
        policyType: true,
        allowCancellation: true,
        cancellationWindowMinutes: true,
        cancellationPenaltyBps: true,
        allowReschedule: true,
        rescheduleWindowMinutes: true,
        guestBookingAllowed: true,
        noShowFeeCents: true,
      },
    });
    policy.cancellationPenaltyBps = 0;
    policy.noShowFeeCents = 0;

    const { ip, userAgent } = getRequestMeta(req);
    await recordOrganizationAudit(prisma, {
      organizationId: organization.id,
      actorUserId: profile.id,
      action: "POLICY_UPDATED",
      metadata: {
        policyId: policy.id,
        updates,
      },
      ip,
      userAgent,
    });

    return respondOk(ctx, { policy });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2020") {
      return fail(
        422,
        "Valor fora do guardrail para janela de política. Usa um valor entre 0 e 10080 minutos.",
        "BOOKING_POLICY_WINDOW_OUT_OF_RANGE",
        false,
        {
          fields: ["cancellationWindowMinutes", "rescheduleWindowMinutes"],
          min: BOOKING_POLICY_WINDOW_MINUTES_MIN,
          max: BOOKING_POLICY_WINDOW_MINUTES_MAX,
        },
      );
    }
    console.error("PATCH /api/org/[orgId]/policies/[id] error:", err);
    return fail(500, "Erro ao atualizar política.");
  }
}

async function _DELETE(req: NextRequest) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(ctx, { errorCode: resolvedCode, message: resolvedMessage, retryable }, { status });
  };
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const profile = await prisma.profile.findUnique({ where: { id: user.id } });
    if (!profile) {
      return fail(403, "Perfil não encontrado.");
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });
    if (!organization || !membership) {
      return fail(403, "Sem permissões.");
    }

    return fail(
      403,
      "Existe apenas uma política default de reservas. Não podes removê-la.",
      "BOOKING_POLICY_SINGLE_DEFAULT",
      false,
    );
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("DELETE /api/org/[orgId]/policies/[id] error:", err);
    return fail(500, "Erro ao remover política.");
  }
}
export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);
