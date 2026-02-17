import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import {
  normalizeStorePolicyModeInput,
  normalizeStoreReturnWindowInput,
  resolveStorePolicy,
  STORE_RETURN_WINDOW_MAX_DAYS,
} from "@/lib/store/policySettings";
import { OrganizationMemberRole, StoreStatus } from "@prisma/client";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const ROLE_ALLOWLIST_READ: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

const ROLE_ALLOWLIST_WRITE: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
];

const updateStorePolicySchema = z.object({
  returnPolicyMode: z.string().optional().nullable(),
  returnWindowDays: z.union([z.number(), z.string(), z.null()]).optional(),
});

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

function getRequestMeta(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  return { ip, userAgent };
}

async function getOrganizationContext(
  req: NextRequest,
  userId: string,
  roles: OrganizationMemberRole[],
) {
  const organizationId = resolveOrganizationIdFromRequest(req);
  const { organization, membership } = await getActiveOrganizationForUser(userId, {
    organizationId: organizationId ?? undefined,
    roles,
    selectOrganization: {
      username: true,
      officialEmail: true,
    },
  });

  if (!organization || !membership) {
    return { ok: false as const, error: "Sem permissoes." };
  }

  const store = await prisma.store.findFirst({
    where: { ownerOrganizationId: organization.id },
    select: {
      id: true,
      status: true,
    },
  });

  const organizationSettings = await prisma.organizationSettings.findUnique({
    where: { organizationId: organization.id },
    select: {
      supportEmail: true,
      supportPhone: true,
      storeReturnPolicyMode: true,
      storeReturnWindowDays: true,
    },
  });

  return {
    ok: true as const,
    organization,
    membership,
    store,
    organizationSettings,
  };
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

    const context = await getOrganizationContext(req, user.id, ROLE_ALLOWLIST_READ);
    if (!context.ok) {
      return fail(403, context.error);
    }

    const emailGate = ensureOrganizationEmailVerified(context.organization, { reasonCode: "POLICIES" });
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

    const policy = resolveStorePolicy({
      settings: context.organizationSettings,
      fallbackSupportEmail: context.organization.officialEmail ?? null,
      organizationUsername: context.organization.username ?? null,
    });

    const storeFeatureEnabled = isStoreFeatureEnabled();
    const hasStore = Boolean(context.store);
    const storeStatus = context.store?.status ?? null;

    return respondOk(ctx, {
      storeFeatureEnabled,
      hasStore,
      storeStatus,
      appliesToCheckout:
        storeFeatureEnabled && hasStore && storeStatus === StoreStatus.ACTIVE,
      policy,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("GET /api/org/[orgId]/policies/store error:", err);
    return fail(500, "Erro ao carregar politica da loja.");
  }
}

async function _PATCH(req: NextRequest) {
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

    const context = await getOrganizationContext(req, user.id, ROLE_ALLOWLIST_WRITE);
    if (!context.ok) {
      return fail(403, context.error);
    }

    const emailGate = ensureOrganizationEmailVerified(context.organization, { reasonCode: "POLICIES" });
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

    const body = await req.json().catch(() => null);
    const parsed = updateStorePolicySchema.safeParse(body ?? {});
    if (!parsed.success) {
      return fail(400, "Dados invalidos.");
    }
    const hasMode = Object.prototype.hasOwnProperty.call(parsed.data, "returnPolicyMode");
    const hasDays = Object.prototype.hasOwnProperty.call(parsed.data, "returnWindowDays");
    if (!hasMode && !hasDays) {
      return fail(400, "Sem alteracoes.");
    }
    const previousMode = context.organizationSettings?.storeReturnPolicyMode ?? "WINDOW_DAYS";
    const returnPolicyMode = hasMode
      ? normalizeStorePolicyModeInput(parsed.data.returnPolicyMode)
      : normalizeStorePolicyModeInput(previousMode);
    const returnWindowDays = normalizeStoreReturnWindowInput(
      hasDays ? parsed.data.returnWindowDays : context.organizationSettings?.storeReturnWindowDays,
      returnPolicyMode,
    );

    if (returnWindowDays !== null && (returnWindowDays < 0 || returnWindowDays > STORE_RETURN_WINDOW_MAX_DAYS)) {
      return fail(400, "RETURN_WINDOW_DAYS_INVALID");
    }

    const beforePolicy = resolveStorePolicy({
      settings: context.organizationSettings,
      fallbackSupportEmail: context.organization.officialEmail ?? null,
      organizationUsername: context.organization.username ?? null,
    });
    const afterPolicy = resolveStorePolicy({
      settings: {
        ...context.organizationSettings,
        storeReturnPolicyMode: returnPolicyMode,
        storeReturnWindowDays: returnWindowDays,
      },
      fallbackSupportEmail: context.organization.officialEmail ?? null,
      organizationUsername: context.organization.username ?? null,
    });

    const settings = await prisma.organizationSettings.upsert({
      where: { organizationId: context.organization.id },
      create: {
        organizationId: context.organization.id,
        storeReturnPolicyMode: returnPolicyMode,
        storeReturnWindowDays: returnWindowDays,
      },
      update: {
        storeReturnPolicyMode: returnPolicyMode,
        storeReturnWindowDays: returnWindowDays,
      },
      select: {
        supportEmail: true,
        supportPhone: true,
        storeReturnPolicyMode: true,
        storeReturnWindowDays: true,
      },
    });

    const policy = resolveStorePolicy({
      settings,
      fallbackSupportEmail: context.organization.officialEmail ?? null,
      organizationUsername: context.organization.username ?? null,
    });
    const { ip, userAgent } = getRequestMeta(req);
    await recordOrganizationAudit(prisma, {
      organizationId: context.organization.id,
      actorUserId: user.id,
      action: "STORE_POLICY_UPDATED",
      metadata: {
        before: beforePolicy,
        after: afterPolicy,
        hasMode,
        hasDays,
      },
      ip,
      userAgent,
    });

    return respondOk(ctx, { policy });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("PATCH /api/org/[orgId]/policies/store error:", err);
    return fail(500, "Erro ao atualizar politica da loja.");
  }
}

export const GET = withApiEnvelope(_GET);
export const PATCH = withApiEnvelope(_PATCH);
