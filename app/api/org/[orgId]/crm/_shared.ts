import { NextRequest } from "next/server";
import { OrganizationMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureCrmModuleAccess } from "@/lib/crm/access";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError } from "@/lib/http/envelope";

const ROLE_ALLOWLIST = Object.values(OrganizationMemberRole);

type CrmRequiredAccess = "VIEW" | "EDIT";

type ResolveCrmRequestParams = {
  req: NextRequest;
  required: CrmRequiredAccess;
  requireVerifiedEmailReason?: string | null;
};

export function crmErrorCodeForStatus(status: number) {
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

export function crmFail(
  req: NextRequest,
  status: number,
  message: string,
  errorCode = crmErrorCodeForStatus(status),
  retryable = status >= 500,
  details?: Record<string, unknown>,
) {
  const ctx = getRequestContext(req);
  const resolvedMessage = typeof message === "string" ? message : String(message);
  const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
  return respondError(
    ctx,
    {
      errorCode: resolvedCode,
      message: resolvedMessage,
      retryable,
      ...(details ? { details } : {}),
    },
    { status },
  );
}

export async function resolveCrmRequest(params: ResolveCrmRequestParams) {
  const { req, required, requireVerifiedEmailReason = null } = params;
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return {
        ok: false as const,
        response: crmFail(req, 403, "Sem permissões."),
      };
    }

    if (requireVerifiedEmailReason) {
      const emailGate = ensureOrganizationEmailVerified(organization, {
        reasonCode: requireVerifiedEmailReason,
      });
      if (!emailGate.ok) {
        return {
          ok: false as const,
          response: crmFail(
            req,
            403,
            emailGate.message ?? emailGate.errorCode ?? "Sem permissões.",
            emailGate.errorCode ?? "FORBIDDEN",
            false,
            emailGate,
          ),
        };
      }
    }

    const crmAccess = await ensureCrmModuleAccess(organization, prisma, {
      member: { userId: membership.userId, role: membership.role },
      required,
    });
    if (!crmAccess.ok) {
      return {
        ok: false as const,
        response: crmFail(req, 403, crmAccess.error),
      };
    }

    return {
      ok: true as const,
      user,
      organization,
      membership,
    };
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return {
        ok: false as const,
        response: crmFail(req, 401, "UNAUTHENTICATED"),
      };
    }
    console.error("[crm] resolveCrmRequest error", err);
    return {
      ok: false as const,
      response: crmFail(req, 500, "Erro interno."),
    };
  }
}
