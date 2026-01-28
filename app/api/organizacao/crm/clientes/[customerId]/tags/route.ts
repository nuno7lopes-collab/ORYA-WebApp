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

const MAX_TAGS = 20;

async function _PUT(req: NextRequest, context: { params: Promise<{ customerId: string }> }) {
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

    const payload = (await req.json().catch(() => null)) as { tags?: unknown } | null;
    const tags = Array.isArray(payload?.tags)
      ? payload?.tags
          .filter((tag): tag is string => typeof tag === "string")
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [];

    const uniqueTags = Array.from(new Set(tags)).slice(0, MAX_TAGS);

    const resolvedParams = await context.params;
    const customerId = resolvedParams.customerId;
    const updated = await prisma.crmCustomer.updateMany({
      where: { id: customerId, organizationId: organization.id },
      data: { tags: uniqueTags },
    });

    if (updated.count === 0) {
      return jsonWrap({ ok: false, error: "Cliente não encontrado." }, { status: 404 });
    }

    return jsonWrap({ ok: true, tags: uniqueTags });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("PUT /api/organizacao/crm/clientes/[customerId]/tags error:", err);
    return jsonWrap({ ok: false, error: "Erro ao atualizar tags." }, { status: 500 });
  }
}
export const PUT = withApiEnvelope(_PUT);