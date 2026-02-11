import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureCrmModuleAccess } from "@/lib/crm/access";
import { LoyaltyRuleTrigger, OrganizationMemberRole } from "@prisma/client";
import { validateLoyaltyRuleLimits } from "@/lib/loyalty/guardrails";
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
      select: { id: true },
    });

    const rules = program
      ? await prisma.loyaltyRule.findMany({
          where: { programId: program.id },
          orderBy: { createdAt: "desc" },
        })
      : [];

    return respondOk(ctx, { items: rules });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(ctx, 401, "UNAUTHENTICATED");
    }
    console.error("GET /api/organizacao/loyalty/regras error:", err);
    return fail(ctx, 500, "Erro ao carregar regras.");
  }
}

async function _POST(req: NextRequest) {
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
    const emailGate = ensureOrganizationEmailVerified(organization, { reasonCode: "LOYALTY_RULES" });
    if (!emailGate.ok) {
      return respondError(
        ctx,
        {
          errorCode: emailGate.errorCode ?? "FORBIDDEN",
          message: emailGate.message ?? emailGate.errorCode ?? "Sem permissões.",
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

    const program = await prisma.loyaltyProgram.findUnique({
      where: { organizationId: organization.id },
      select: { id: true },
    });

    if (!program) {
      return fail(ctx, 400, "Programa não configurado.");
    }

    const payload = (await req.json().catch(() => null)) as {
      name?: unknown;
      trigger?: unknown;
      points?: unknown;
      maxPointsPerDay?: unknown;
      maxPointsPerUser?: unknown;
      conditions?: unknown;
      isActive?: unknown;
    } | null;

    const name = typeof payload?.name === "string" ? payload.name.trim() : "Regra";
    const trigger =
      typeof payload?.trigger === "string" && Object.values(LoyaltyRuleTrigger).includes(payload.trigger as LoyaltyRuleTrigger)
        ? (payload.trigger as LoyaltyRuleTrigger)
        : null;

    const rawPoints = typeof payload?.points === "number" && Number.isFinite(payload.points) ? payload.points : null;
    const points = rawPoints !== null ? Math.floor(rawPoints) : null;
    if (!trigger || points === null || points < 1) {
      return fail(ctx, 400, "Trigger ou pontos inválidos.");
    }

    const maxPointsPerDayRaw =
      typeof payload?.maxPointsPerDay === "number" && Number.isFinite(payload.maxPointsPerDay)
        ? payload.maxPointsPerDay
        : null;
    const maxPointsPerUserRaw =
      typeof payload?.maxPointsPerUser === "number" && Number.isFinite(payload.maxPointsPerUser)
        ? payload.maxPointsPerUser
        : null;
    if ((maxPointsPerDayRaw ?? 0) < 0 || (maxPointsPerUserRaw ?? 0) < 0) {
      return fail(ctx, 400, "Limites inválidos.");
    }
    const maxPointsPerDay =
      maxPointsPerDayRaw !== null && maxPointsPerDayRaw >= 1 ? Math.floor(maxPointsPerDayRaw) : null;
    const maxPointsPerUser =
      maxPointsPerUserRaw !== null && maxPointsPerUserRaw >= 1 ? Math.floor(maxPointsPerUserRaw) : null;
    const isActive = typeof payload?.isActive === "boolean" ? payload.isActive : true;
    const conditions = payload?.conditions && typeof payload.conditions === "object" ? payload.conditions : {};

    const guardrails = validateLoyaltyRuleLimits({ points, maxPointsPerDay, maxPointsPerUser });
    if (!guardrails.ok) {
      return fail(ctx, 400, guardrails.error);
    }

    const rule = await prisma.loyaltyRule.create({
      data: {
        programId: program.id,
        name,
        trigger,
        points,
        maxPointsPerDay,
        maxPointsPerUser,
        conditions: conditions as any,
        isActive,
      },
    });

    return respondOk(ctx, { rule });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(ctx, 401, "UNAUTHENTICATED");
    }
    console.error("POST /api/organizacao/loyalty/regras error:", err);
    return fail(ctx, 500, "Erro ao criar regra.");
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
export const POST = withApiEnvelope(_POST);
