import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureCrmModuleAccess } from "@/lib/crm/access";
import { OrganizationMemberRole } from "@prisma/client";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const ROLE_ALLOWLIST = Object.values(OrganizationMemberRole);

async function _POST(req: NextRequest, context: { params: Promise<{ customerId: string }> }) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
    details?: Record<string, unknown>,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(
      ctx,
      { errorCode: resolvedCode, message: resolvedMessage, retryable, ...(details ? { details } : {}) },
      { status },
    );
  };
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return fail(403, "Sem permissões.");
    }
    const emailGate = ensureOrganizationEmailVerified(organization, { reasonCode: "CRM_CUSTOMER_NOTES" });
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
      return fail(403, crmAccess.error);
    }

    const payload = (await req.json().catch(() => null)) as { body?: unknown } | null;
    const body = typeof payload?.body === "string" ? payload.body.trim() : "";
    if (!body || body.length < 2) {
      return fail(400, "Nota inválida.");
    }

    const resolvedParams = await context.params;
    const customerId = resolvedParams.customerId;
    const customer = await prisma.crmContact.findFirst({
      where: { id: customerId, organizationId: organization.id },
      select: { id: true },
    });

    if (!customer) {
      return fail(404, "Cliente não encontrado.");
    }

    const note = await prisma.$transaction(async (tx) => {
      const created = await tx.crmContactNote.create({
        data: {
          organizationId: organization.id,
          contactId: customer.id,
          authorUserId: user.id,
          body,
        },
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
        },
      });

      await tx.crmContact.updateMany({
        where: { id: customer.id, organizationId: organization.id },
        data: { notesCount: { increment: 1 } },
      });

      return created;
    });

    return respondOk(ctx, { note });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "UNAUTHENTICATED");
    }
    console.error("POST /api/organizacao/crm/clientes/[customerId]/notas error:", err);
    return fail(500, "Erro ao criar nota.");
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
export const POST = withApiEnvelope(_POST);
