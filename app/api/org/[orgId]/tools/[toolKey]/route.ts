import { NextRequest } from "next/server";
import { OrganizationStatus } from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { requireOrganizationIdFromRequest } from "@/lib/organizationId";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { ensureOrganizationEmailVerified, ensureOrganizationWriteAccess } from "@/lib/organizationWriteAccess";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
import {
  applyOrganizationToolCommand,
  OrganizationBaseToolRequiredError,
  OrganizationModuleDeactivationBlockedError,
  parseOrganizationToolKeyStrict,
} from "@/lib/organizationModuleLifecycle";

type RouteParams = { orgId?: string; toolKey?: string };

type HandlerContext = {
  params: Promise<RouteParams> | RouteParams;
};

function resolveAction(raw: unknown): "enable" | "disable" | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "enable" || normalized === "disable") return normalized;
  return null;
}

async function _POST(req: NextRequest, ctxInput: HandlerContext) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = status >= 500 ? "INTERNAL_ERROR" : "BAD_REQUEST",
    retryable = status >= 500,
    details?: Record<string, unknown> | null,
  ) =>
    respondError(
      ctx,
      {
        errorCode,
        message,
        retryable,
        ...(details ? { details } : {}),
      },
      { status },
    );

  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });

    if (!user || error) {
      return fail(401, "Não autenticado.", "UNAUTHENTICATED", false);
    }

    const params = await Promise.resolve(ctxInput.params);
    const rawToolKey = typeof params?.toolKey === "string" ? params.toolKey : "";
    const toolKey = parseOrganizationToolKeyStrict(rawToolKey);
    if (!toolKey) {
      return fail(400, "Ferramenta inválida.", "INVALID_TOOL_KEY", false);
    }

    const body = await req.json().catch(() => null);
    const action = resolveAction((body as Record<string, unknown> | null)?.action);
    if (!action) {
      return fail(400, "Ação inválida. Usa enable ou disable.", "INVALID_TOOL_ACTION", false);
    }

    const orgResult = requireOrganizationIdFromRequest({ req, actorId: user.id });
    if (!orgResult.ok) return orgResult.response;

    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: orgResult.organizationId,
      allowFallback: false,
      roles: ["OWNER", "CO_OWNER", "ADMIN"],
      allowedStatuses: [OrganizationStatus.ACTIVE, OrganizationStatus.SUSPENDED],
      includeOrganizationFields: "settings",
    });

    if (!organization || !membership || !["OWNER", "CO_OWNER", "ADMIN"].includes(membership.role)) {
      return fail(403, "Sem permissões para gerir ferramentas.", "FORBIDDEN", false);
    }

    const writeGate = ensureOrganizationWriteAccess(organization, { reasonCode: "ORG_TOOLS" });
    if (!writeGate.ok && writeGate.errorCode === "KILL_SWITCH_ACTIVE") {
      return fail(
        403,
        writeGate.message ?? "A organização está em modo restrito.",
        writeGate.errorCode,
        false,
        writeGate,
      );
    }
    const emailGate = ensureOrganizationEmailVerified(organization, { reasonCode: "ORG_TOOLS" });
    if (!emailGate.ok) {
      return fail(
        403,
        emailGate.message ?? "Sem permissões.",
        emailGate.errorCode ?? "FORBIDDEN",
        false,
        emailGate,
      );
    }

    try {
      const mutation = await applyOrganizationToolCommand({
        organizationId: organization.id,
        toolKey,
        action,
      });

      await recordOrganizationAuditSafe({
        organizationId: organization.id,
        actorUserId: user.id,
        action: "TOOLS_UPDATED",
        metadata: {
          command: action,
          toolKey: mutation.toolKey,
          previousTools: mutation.previousModules,
          nextTools: mutation.nextModules,
          enabledTools: mutation.enabledModules,
          disabledTools: mutation.disabledModules,
        },
      });

      return respondOk(
        ctx,
        {
          tool: {
            key: mutation.toolKey,
            enabled: mutation.enabled,
          },
          tools: mutation.nextModules,
          enabledTools: mutation.enabledModules,
          disabledTools: mutation.disabledModules,
        },
        { status: 200 },
      );
    } catch (error) {
      if (error instanceof OrganizationBaseToolRequiredError) {
        return fail(409, error.message, "TOOL_BASE_REQUIRED", false, {
          toolKey: error.toolKey,
        });
      }
      if (error instanceof OrganizationModuleDeactivationBlockedError) {
        return fail(409, error.message, "TOOL_DEACTIVATION_BLOCKED", false, {
          blockers: error.blockers,
        });
      }
      if (error instanceof Error && error.message === "INVALID_TOOL_KEY") {
        return fail(400, "Ferramenta inválida.", "INVALID_TOOL_KEY", false);
      }
      throw error;
    }
  } catch (error) {
    console.error("POST /api/org/[orgId]/tools/[toolKey] error:", error);
    return fail(500, "Erro interno.");
  }
}

export const POST = withApiEnvelope(_POST);
