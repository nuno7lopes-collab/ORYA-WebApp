import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { OrganizationMemberRole, OrganizationPolicyType } from "@prisma/client";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

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
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const emailGate = ensureOrganizationEmailVerified(organization, { reasonCode: "POLICIES" });
    if (!emailGate.ok) {
      return respondError(ctx, { errorCode: emailGate.error ?? "FORBIDDEN", message: emailGate.message ?? emailGate.error ?? "Sem permissões.", retryable: false, details: emailGate }, { status: 403 });
    }

    const existing = await prisma.organizationPolicy.findFirst({
      where: { id: policyId, organizationId: organization.id },
      select: { id: true },
    });
    if (!existing) {
      return fail(404, "Política não encontrada.");
    }

    const payload = await req.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};
    if (typeof payload?.name === "string") updates.name = payload.name.trim();
    if (typeof payload?.allowCancellation === "boolean") updates.allowCancellation = payload.allowCancellation;
    if (payload?.cancellationWindowMinutes === null) {
      updates.cancellationWindowMinutes = null;
    } else if (Number.isFinite(Number(payload?.cancellationWindowMinutes))) {
      updates.cancellationWindowMinutes = Math.max(0, Math.round(Number(payload.cancellationWindowMinutes)));
    }
    if (Number.isFinite(Number(payload?.cancellationPenaltyBps))) {
      updates.cancellationPenaltyBps = Math.max(0, Math.min(10000, Math.round(Number(payload.cancellationPenaltyBps))));
    }
    if (typeof payload?.allowReschedule === "boolean") updates.allowReschedule = payload.allowReschedule;
    if (payload?.rescheduleWindowMinutes === null) {
      updates.rescheduleWindowMinutes = null;
    } else if (Number.isFinite(Number(payload?.rescheduleWindowMinutes))) {
      updates.rescheduleWindowMinutes = Math.max(0, Math.round(Number(payload.rescheduleWindowMinutes)));
    }
    if (typeof payload?.policyType === "string") {
      const raw = payload.policyType.trim().toUpperCase();
      if (Object.values(OrganizationPolicyType).includes(raw as OrganizationPolicyType)) {
        updates.policyType = raw as OrganizationPolicyType;
      }
    }

    if (Object.keys(updates).length === 0) {
      return fail(400, "Sem alterações.");
    }

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
      },
    });

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
    console.error("PATCH /api/organizacao/policies/[id] error:", err);
    return fail(500, "Erro ao atualizar política.");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const emailGate = ensureOrganizationEmailVerified(organization, { reasonCode: "POLICIES" });
    if (!emailGate.ok) {
      return respondError(ctx, { errorCode: emailGate.error ?? "FORBIDDEN", message: emailGate.message ?? emailGate.error ?? "Sem permissões.", retryable: false, details: emailGate }, { status: 403 });
    }

    const policy = await prisma.organizationPolicy.findFirst({
      where: { id: policyId, organizationId: organization.id },
      select: {
        id: true,
        policyType: true,
        _count: { select: { bookingPolicyRefs: true, services: true } },
      },
    });
    if (!policy) {
      return fail(404, "Política não encontrada.");
    }

    if (policy.policyType !== OrganizationPolicyType.CUSTOM) {
      return fail(400, "Só podes apagar políticas personalizadas.");
    }

    if (policy._count.bookingPolicyRefs > 0 || policy._count.services > 0) {
      return fail(409, "Política em uso.");
    }

    await prisma.organizationPolicy.delete({ where: { id: policy.id } });

    const { ip, userAgent } = getRequestMeta(req);
    await recordOrganizationAudit(prisma, {
      organizationId: organization.id,
      actorUserId: profile.id,
      action: "POLICY_DELETED",
      metadata: {
        policyId: policy.id,
        policyType: policy.policyType,
      },
      ip,
      userAgent,
    });

    return respondOk(ctx, {});
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("DELETE /api/organizacao/policies/[id] error:", err);
    return fail(500, "Erro ao remover política.");
  }
}
