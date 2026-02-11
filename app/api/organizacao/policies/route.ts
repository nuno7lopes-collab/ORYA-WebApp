import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureDefaultPolicies } from "@/lib/organizationPolicies";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { OrganizationMemberRole, OrganizationPolicyType } from "@prisma/client";
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
async function _GET(req: NextRequest) {
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

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

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
      return respondError(ctx, { errorCode: emailGate.errorCode ?? "FORBIDDEN", message: emailGate.message ?? emailGate.errorCode ?? "Sem permissões.", retryable: false, details: emailGate }, { status: 403 });
    }

    await ensureDefaultPolicies(prisma, organization.id);

    const items = await prisma.organizationPolicy.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        policyType: true,
        allowCancellation: true,
        cancellationWindowMinutes: true,
        cancellationPenaltyBps: true,
        allowReschedule: true,
        rescheduleWindowMinutes: true,
        createdAt: true,
      },
    });

    return respondOk(ctx, { items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("GET /api/organizacao/policies error:", err);
    return fail(500, "Erro ao carregar políticas.");
  }
}

async function _POST(req: NextRequest) {
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

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

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

    const payload = await req.json().catch(() => ({}));
    const name = String(payload?.name ?? "").trim();
    const policyTypeRaw = String(payload?.policyType ?? "CUSTOM").trim().toUpperCase();
    const policyType = Object.values(OrganizationPolicyType).includes(policyTypeRaw as OrganizationPolicyType)
      ? (policyTypeRaw as OrganizationPolicyType)
      : OrganizationPolicyType.CUSTOM;
    const cancellationWindowMinutes =
      payload?.cancellationWindowMinutes === null
        ? null
        : Number.isFinite(Number(payload?.cancellationWindowMinutes))
          ? Math.max(0, Math.round(Number(payload.cancellationWindowMinutes)))
          : null;
    const allowCancellation =
      typeof payload?.allowCancellation === "boolean" ? payload.allowCancellation : true;
    const cancellationPenaltyBps = Number.isFinite(Number(payload?.cancellationPenaltyBps))
      ? Math.max(0, Math.min(10000, Math.round(Number(payload.cancellationPenaltyBps))))
      : 0;
    const allowReschedule =
      typeof payload?.allowReschedule === "boolean" ? payload.allowReschedule : true;
    const rescheduleWindowMinutes =
      payload?.rescheduleWindowMinutes === null
        ? null
        : Number.isFinite(Number(payload?.rescheduleWindowMinutes))
          ? Math.max(0, Math.round(Number(payload.rescheduleWindowMinutes)))
          : cancellationWindowMinutes;

    if (!name) {
      return fail(400, "Nome é obrigatório.");
    }

    const policy = await prisma.organizationPolicy.create({
      data: {
        organizationId: organization.id,
        name,
        policyType,
        allowCancellation,
        cancellationWindowMinutes: allowCancellation ? cancellationWindowMinutes : null,
        cancellationPenaltyBps,
        allowReschedule,
        rescheduleWindowMinutes: allowReschedule ? rescheduleWindowMinutes : null,
      },
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
      action: "POLICY_CREATED",
      metadata: {
        policyId: policy.id,
        name: policy.name,
        policyType: policy.policyType,
        allowCancellation: policy.allowCancellation,
        cancellationWindowMinutes: policy.cancellationWindowMinutes,
        cancellationPenaltyBps: policy.cancellationPenaltyBps,
        allowReschedule: policy.allowReschedule,
        rescheduleWindowMinutes: policy.rescheduleWindowMinutes,
      },
      ip,
      userAgent,
    });

    return respondOk(ctx, { policy }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("POST /api/organizacao/policies error:", err);
    return fail(500, "Erro ao criar política.");
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
