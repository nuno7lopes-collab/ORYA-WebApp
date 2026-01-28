import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureCrmModuleAccess } from "@/lib/crm/access";
import { OrganizationMemberRole } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const ROLE_ALLOWLIST = Object.values(OrganizationMemberRole);

async function _POST(req: NextRequest, context: { params: Promise<{ customerId: string }> }) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return jsonWrap({ ok: false, error: "Sem permissões." }, { status: 403 });
    }
    const crmAccess = await ensureCrmModuleAccess(organization, prisma, {
      member: { userId: membership.userId, role: membership.role },
      required: "EDIT",
    });
    if (!crmAccess.ok) {
      return jsonWrap({ ok: false, error: crmAccess.error }, { status: 403 });
    }

    const payload = (await req.json().catch(() => null)) as { body?: unknown } | null;
    const body = typeof payload?.body === "string" ? payload.body.trim() : "";
    if (!body || body.length < 2) {
      return jsonWrap({ ok: false, error: "Nota inválida." }, { status: 400 });
    }

    const resolvedParams = await context.params;
    const customerId = resolvedParams.customerId;
    const customer = await prisma.crmCustomer.findFirst({
      where: { id: customerId, organizationId: organization.id },
      select: { id: true },
    });

    if (!customer) {
      return jsonWrap({ ok: false, error: "Cliente não encontrado." }, { status: 404 });
    }

    const note = await prisma.$transaction(async (tx) => {
      const created = await tx.crmCustomerNote.create({
        data: {
          organizationId: organization.id,
          customerId: customer.id,
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

      await tx.crmCustomer.updateMany({
        where: { id: customer.id, organizationId: organization.id },
        data: { notesCount: { increment: 1 } },
      });

      return created;
    });

    return jsonWrap({ ok: true, note });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("POST /api/organizacao/crm/clientes/[customerId]/notas error:", err);
    return jsonWrap({ ok: false, error: "Erro ao criar nota." }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);