// app/api/org/[orgId]/analytics/overview/route.ts
// Analytics de organizacao (overview) — V9 (rollups + entitlements).

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { OrganizationModule } from "@prisma/client";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  getOrganizationAnalyticsOverviewMetrics,
  normalizeAnalyticsOverviewRange,
  parseEventTemplateType,
} from "@/domain/analytics/organizationOverviewMetrics";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";

async function _GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error: authError,
    } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });

    if (authError) {
      console.error("[organização/overview] Erro ao obter user:", authError);
    }

    if (!user) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const url = new URL(req.url);
    const range = normalizeAnalyticsOverviewRange(url.searchParams.get("range"));
    const templateTypeParam = url.searchParams.get("templateType");
    const excludeTemplateTypeParam = url.searchParams.get("excludeTemplateType");
    const parsedTemplateType = parseEventTemplateType(templateTypeParam);
    const parsedExcludeTemplateType = parseEventTemplateType(excludeTemplateTypeParam);

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
    });

    if (!organization || !membership) {
      return jsonWrap({ ok: false, error: "NOT_ORGANIZATION" }, { status: 403 });
    }

    const access = await ensureMemberModuleAccess({
      organizationId: organization.id,
      userId: user.id,
      role: membership.role,
      rolePack: membership.rolePack,
      moduleKey: OrganizationModule.ANALYTICS,
      required: "VIEW",
    });
    if (!access.ok) {
      return jsonWrap({ ok: false, error: "NO_ANALYTICS_ACCESS" }, { status: 403 });
    }

    const metrics = await getOrganizationAnalyticsOverviewMetrics({
      organizationId: organization.id,
      range,
      includeTemplateType: parsedTemplateType,
      excludeTemplateType: parsedExcludeTemplateType,
      preferredCurrency: "EUR",
    });

    return jsonWrap(
      {
        ok: true,
        ...metrics,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[organização/overview] Erro inesperado:", error);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
