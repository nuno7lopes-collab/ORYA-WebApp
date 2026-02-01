import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { clearUsernameForOwner } from "@/lib/globalUsernames";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

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
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
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

    const { id } = await context.params;
    const organizationId = Number(id);
    if (!organizationId || Number.isNaN(organizationId)) {
      return fail(400, "INVALID_ORGANIZATION_ID");
    }

    const membership = await resolveGroupMemberForOrg({ organizationId, userId: user.id });
    if (!membership || membership.role !== "OWNER") {
      return fail(403, "ONLY_OWNER_CAN_DELETE");
    }
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { officialEmail: true, officialEmailVerifiedAt: true },
    });
    if (!organization) {
      return fail(404, "ORGANIZATION_NOT_FOUND");
    }
    const emailGate = ensureOrganizationEmailVerified(organization, {
      reasonCode: "ORG_DELETE",
      organizationId,
    });
    if (!emailGate.ok) {
      const message =
        "message" in emailGate && typeof emailGate.message === "string"
          ? emailGate.message
          : emailGate.error ?? "Sem permissões.";
      return respondError(
        ctx,
        { errorCode: emailGate.error ?? "FORBIDDEN", message, retryable: false, details: emailGate },
        { status: 403 },
      );
    }

    // Bloquear se existir algum bilhete ativo/usado associado a eventos desta org
    const hasSales = await prisma.ticket.count({
      where: {
        status: { in: ["ACTIVE", "USED"] },
        event: { organizationId },
      },
    });
    if (hasSales > 0) {
      return fail(400, "Não é possível apagar: existem bilhetes vendidos nesta organização.");
    }

    // Soft delete simples: marcar como SUSPENDED, libertar username e limpar memberships
    await prisma.organization.update({
      where: { id: organizationId },
      data: { status: "SUSPENDED", username: null },
    });
    await prisma.organizationMember.deleteMany({ where: { organizationId } });
    await clearUsernameForOwner({ ownerType: "organization", ownerId: organizationId });

    return respondOk(ctx, {}, { status: 200 });
  } catch (err) {
    console.error("[organização/organizations/delete]", err);
    return fail(500, "INTERNAL_ERROR");
  }
}
