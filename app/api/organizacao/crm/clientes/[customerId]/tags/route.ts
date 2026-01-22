import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureCrmModuleAccess } from "@/lib/crm/access";
import { OrganizationMemberRole } from "@prisma/client";

const ALLOWED_ROLES = Object.values(OrganizationMemberRole);

const MAX_TAGS = 20;

export async function PUT(req: NextRequest, context: { params: Promise<{ customerId: string }> }) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ALLOWED_ROLES],
    });

    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }
    const crmAccess = await ensureCrmModuleAccess(organization, prisma, {
      member: { userId: membership.userId, role: membership.role },
      required: "EDIT",
    });
    if (!crmAccess.ok) {
      return NextResponse.json({ ok: false, error: crmAccess.error }, { status: 403 });
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
      return NextResponse.json({ ok: false, error: "Cliente não encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, tags: uniqueTags });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("PUT /api/organizacao/crm/clientes/[customerId]/tags error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao atualizar tags." }, { status: 500 });
  }
}
