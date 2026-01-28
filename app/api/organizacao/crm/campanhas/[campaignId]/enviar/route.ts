import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureCrmModuleAccess } from "@/lib/crm/access";
import { sendCrmCampaign } from "@/lib/crm/campaignSend";
import { OrganizationMemberRole } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const READ_ROLES = Object.values(OrganizationMemberRole);

async function _POST(req: NextRequest, context: { params: Promise<{ campaignId: string }> }) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: [...READ_ROLES],
    });

    if (!organization || !membership) {
      return jsonWrap({ ok: false, error: "Sem permissoes." }, { status: 403 });
    }
    const crmAccess = await ensureCrmModuleAccess(organization, undefined, {
      member: { userId: membership.userId, role: membership.role },
      required: "EDIT",
    });
    if (!crmAccess.ok) {
      return jsonWrap({ ok: false, error: crmAccess.error }, { status: 403 });
    }

    const resolvedParams = await context.params;
    const result = await sendCrmCampaign({
      organizationId: organization.id,
      campaignId: resolvedParams.campaignId,
    });

    if (!result.ok) {
      return jsonWrap({ ok: false, error: result.message }, { status: result.status });
    }

    return jsonWrap({
      ok: true,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      totalEligible: result.totalEligible,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("POST /api/organizacao/crm/campanhas/[campaignId]/enviar error:", err);
    return jsonWrap({ ok: false, error: "Erro ao enviar campanha." }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);