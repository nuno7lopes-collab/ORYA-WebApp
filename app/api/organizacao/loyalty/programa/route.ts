import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureCrmModuleAccess } from "@/lib/crm/access";
import { LoyaltyProgramStatus, OrganizationMemberRole } from "@prisma/client";
import { LOYALTY_GUARDRAILS } from "@/lib/loyalty/guardrails";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const READ_ROLES = Object.values(OrganizationMemberRole);

function fail(
  ctx: ReturnType<typeof getRequestContext>,
  status: number,
  message: string,
  errorCode = errorCodeForStatus(status),
  retryable = status >= 500,
  details?: Record<string, unknown>,
) {
  const resolvedMessage = typeof message === "string" ? message : String(message);
  const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
  return respondError(
    ctx,
    { errorCode: resolvedCode, message: resolvedMessage, retryable, ...(details ? { details } : {}) },
    { status },
  );
}

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: [...READ_ROLES],
    });

    if (!organization || !membership) {
      return fail(ctx, 403, "Sem permissões.");
    }
    const crmAccess = await ensureCrmModuleAccess(organization, prisma, {
      member: { userId: membership.userId, role: membership.role },
      required: "VIEW",
    });
    if (!crmAccess.ok) {
      return fail(ctx, 403, crmAccess.error);
    }

    const program = await prisma.loyaltyProgram.findUnique({
      where: { organizationId: organization.id },
      select: {
        id: true,
        organizationId: true,
        status: true,
        name: true,
        pointsName: true,
        pointsExpiryDays: true,
        termsUrl: true,
        createdAt: true,
        updatedAt: true,
        rules: {
          select: {
            id: true,
            name: true,
            trigger: true,
            points: true,
            maxPointsPerDay: true,
            maxPointsPerUser: true,
            conditions: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        rewards: {
          select: {
            id: true,
            name: true,
            type: true,
            pointsCost: true,
            stock: true,
            payload: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    return respondOk(ctx, { program, guardrails: LOYALTY_GUARDRAILS });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(ctx, 401, "UNAUTHENTICATED");
    }
    console.error("GET /api/organizacao/loyalty/programa error:", err);
    return fail(ctx, 500, "Erro ao carregar programa.");
  }
}

async function _PUT(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: [...READ_ROLES],
    });

    if (!organization || !membership) {
      return fail(ctx, 403, "Sem permissões.");
    }
    const emailGate = ensureOrganizationEmailVerified(organization, { reasonCode: "LOYALTY_PROGRAM" });
    if (!emailGate.ok) {
      return respondError(
        ctx,
        {
          errorCode: emailGate.error ?? "FORBIDDEN",
          message: emailGate.message ?? emailGate.error ?? "Sem permissões.",
          retryable: false,
          details: emailGate,
        },
        { status: 403 },
      );
    }
    const crmAccess = await ensureCrmModuleAccess(organization, prisma, {
      member: { userId: membership.userId, role: membership.role },
      required: "EDIT",
    });
    if (!crmAccess.ok) {
      return fail(ctx, 403, crmAccess.error);
    }

    const payload = (await req.json().catch(() => null)) as {
      status?: unknown;
      name?: unknown;
      pointsName?: unknown;
      pointsExpiryDays?: unknown;
      termsUrl?: unknown;
    } | null;

    const status =
      typeof payload?.status === "string" && Object.values(LoyaltyProgramStatus).includes(payload.status as LoyaltyProgramStatus)
        ? (payload.status as LoyaltyProgramStatus)
        : LoyaltyProgramStatus.ACTIVE;

    const name = typeof payload?.name === "string" ? payload.name.trim() : "Pontos ORYA";
    const pointsName = typeof payload?.pointsName === "string" ? payload.pointsName.trim() : "Pontos";
    const rawExpiryDays =
      typeof payload?.pointsExpiryDays === "number" && Number.isFinite(payload.pointsExpiryDays)
        ? payload.pointsExpiryDays
        : null;
    const pointsExpiryDays = rawExpiryDays !== null && rawExpiryDays >= 1 ? Math.floor(rawExpiryDays) : null;
    const termsUrl = typeof payload?.termsUrl === "string" ? payload.termsUrl.trim() : null;

    const program = await prisma.loyaltyProgram.upsert({
      where: { organizationId: organization.id },
      update: {
        status,
        name,
        pointsName,
        pointsExpiryDays,
        termsUrl,
      },
      create: {
        organizationId: organization.id,
        status,
        name,
        pointsName,
        pointsExpiryDays,
        termsUrl,
      },
    });

    return respondOk(ctx, { program, guardrails: LOYALTY_GUARDRAILS });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(ctx, 401, "UNAUTHENTICATED");
    }
    console.error("PUT /api/organizacao/loyalty/programa error:", err);
    return fail(ctx, 500, "Erro ao guardar programa.");
  }
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
export const GET = withApiEnvelope(_GET);
export const PUT = withApiEnvelope(_PUT);
