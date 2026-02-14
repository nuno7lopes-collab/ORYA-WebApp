import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureCrmModuleAccess } from "@/lib/crm/access";
import { LoyaltyRewardType, OrganizationMemberRole } from "@prisma/client";
import { validateLoyaltyRewardLimits } from "@/lib/loyalty/guardrails";
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

    const rewards = program
      ? await prisma.loyaltyReward.findMany({
          where: { programId: program.id },
          orderBy: { createdAt: "desc" },
        })
      : [];

    return respondOk(ctx, { items: rewards });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(ctx, 401, "UNAUTHENTICATED");
    }
    console.error("GET /api/org/[orgId]/loyalty/recompensas error:", err);
    return fail(ctx, 500, "Erro ao carregar recompensas.");
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
    const emailGate = ensureOrganizationEmailVerified(organization, { reasonCode: "LOYALTY_REWARDS" });
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
      type?: unknown;
      pointsCost?: unknown;
      stock?: unknown;
      payload?: unknown;
      isActive?: unknown;
    } | null;

    const name = typeof payload?.name === "string" ? payload.name.trim() : "Recompensa";
    const type =
      typeof payload?.type === "string" && Object.values(LoyaltyRewardType).includes(payload.type as LoyaltyRewardType)
        ? (payload.type as LoyaltyRewardType)
        : null;
    const rawPointsCost =
      typeof payload?.pointsCost === "number" && Number.isFinite(payload.pointsCost) ? payload.pointsCost : null;
    const pointsCost = rawPointsCost !== null ? Math.floor(rawPointsCost) : null;

    if (!type || pointsCost === null || pointsCost < 1) {
      return fail(ctx, 400, "Tipo ou custo inválido.");
    }
    const guardrails = validateLoyaltyRewardLimits({ pointsCost });
    if (!guardrails.ok) {
      return fail(ctx, 400, guardrails.error);
    }

    const stockRaw = typeof payload?.stock === "number" && Number.isFinite(payload.stock) ? payload.stock : null;
    if (stockRaw !== null && stockRaw < 0) {
      return fail(ctx, 400, "Stock inválido.");
    }
    const stock = stockRaw !== null ? Math.floor(stockRaw) : null;
    const isActive = typeof payload?.isActive === "boolean" ? payload.isActive : true;
    const rewardPayload = payload?.payload && typeof payload.payload === "object" ? payload.payload : {};

    const reward = await prisma.loyaltyReward.create({
      data: {
        programId: program.id,
        name,
        type,
        pointsCost,
        stock,
        payload: rewardPayload as any,
        isActive,
      },
    });

    return respondOk(ctx, { reward });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(ctx, 401, "UNAUTHENTICATED");
    }
    console.error("POST /api/org/[orgId]/loyalty/recompensas error:", err);
    return fail(ctx, 500, "Erro ao criar recompensa.");
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
