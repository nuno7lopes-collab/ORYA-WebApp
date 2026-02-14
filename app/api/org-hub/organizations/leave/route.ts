import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { resolveOrganizationIdStrict } from "@/lib/organizationId";
import { resolveGroupMemberForOrg, revokeGroupMemberForOrg } from "@/lib/organizationGroupAccess";
import { countEffectiveOrganizationMembersByRole } from "@/lib/organizationMembers";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

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
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return fail(401, "UNAUTHENTICATED");
    }

    const body = await req.json().catch(() => null);
    const orgResolution = resolveOrganizationIdStrict({
      req,
      body: body && typeof body === "object" ? (body as Record<string, unknown>) : null,
      allowFallback: false,
    });
    if (!orgResolution.ok) {
      if (orgResolution.reason === "CONFLICT") {
        return fail(400, "ORGANIZATION_ID_CONFLICT");
      }
      return fail(400, "INVALID_ORGANIZATION_ID");
    }
    const organizationId = orgResolution.organizationId;

    const membership = await resolveGroupMemberForOrg({ organizationId, userId: user.id });

    if (!membership) {
      return fail(403, "NOT_MEMBER");
    }

    if (membership.role === "OWNER") {
      const otherOwners = await countEffectiveOrganizationMembersByRole({
        organizationId,
        role: "OWNER",
        excludeUserId: user.id,
      });
      if (otherOwners === 0) {
        return fail(400, "És o último Owner desta organização. Transfere a propriedade antes de sair.");
      }
    }

    await prisma.$transaction(async (tx) =>
      revokeGroupMemberForOrg({ organizationId, userId: user.id, client: tx }),
    );

    return respondOk(ctx, {}, { status: 200 });
  } catch (err) {
    console.error("[organização/organizations/leave]", err);
    return fail(500, "INTERNAL_ERROR");
  }
}
export const POST = withApiEnvelope(_POST);
