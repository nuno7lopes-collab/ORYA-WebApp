import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { clearUsernameForOwner } from "@/lib/globalUsernames";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const { id } = await context.params;
    const organizationId = Number(id);
    if (!organizationId || Number.isNaN(organizationId)) {
      return jsonWrap({ ok: false, error: "INVALID_ORGANIZATION_ID" }, { status: 400 });
    }

    const membership = await resolveGroupMemberForOrg({ organizationId, userId: user.id });
    if (!membership || membership.role !== "OWNER") {
      return jsonWrap({ ok: false, error: "ONLY_OWNER_CAN_DELETE" }, { status: 403 });
    }

    // Bloquear se existir algum bilhete ativo/usado associado a eventos desta org
    const hasSales = await prisma.ticket.count({
      where: {
        status: { in: ["ACTIVE", "USED"] },
        event: { organizationId },
      },
    });
    if (hasSales > 0) {
      return jsonWrap(
        {
          ok: false,
          error: "Não é possível apagar: existem bilhetes vendidos nesta organização.",
        },
        { status: 400 },
      );
    }

    // Soft delete simples: marcar como SUSPENDED, libertar username e limpar memberships
    await prisma.organization.update({
      where: { id: organizationId },
      data: { status: "SUSPENDED", username: null },
    });
    await prisma.organizationMember.deleteMany({ where: { organizationId } });
    await clearUsernameForOwner({ ownerType: "organization", ownerId: organizationId });

    return jsonWrap({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[organização/organizations/delete]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const DELETE = withApiEnvelope(_DELETE);