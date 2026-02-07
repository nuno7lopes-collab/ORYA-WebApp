import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { OrganizationModule } from "@prisma/client";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { logError } from "@/lib/observability/logger";

export async function GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return respondError(
        ctx,
        { errorCode: "UNAUTHENTICATED", message: "Sessão inválida.", retryable: false },
        { status: 401 },
      );
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
    });

    if (!organization || !membership) {
      return respondError(
        ctx,
        { errorCode: "FORBIDDEN", message: "Sem permissões.", retryable: false },
        { status: 403 },
      );
    }

    const access = await ensureMemberModuleAccess({
      organizationId: organization.id,
      userId: user.id,
      role: membership.role,
      rolePack: membership.rolePack,
      moduleKey: OrganizationModule.FINANCEIRO,
      required: "VIEW",
    });
    if (!access.ok) {
      return respondError(
        ctx,
        { errorCode: "FORBIDDEN", message: "Sem permissões.", retryable: false },
        { status: 403 },
      );
    }

    return respondOk(
      ctx,
      { items: [], pagination: { nextCursor: null, hasMore: false }, disabled: true },
      { status: 200 },
    );
  } catch (err) {
    logError("payouts.list.error", err, { requestId: ctx.requestId });
    return respondError(
      ctx,
      { errorCode: "INTERNAL_ERROR", message: "Erro interno.", retryable: true },
      { status: 500 },
    );
  }
}
