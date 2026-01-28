import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { AnalyticsDimensionKey, OrganizationModule } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

function parseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

async function _GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
    });
    if (!organization || !membership) {
      return jsonWrap({ ok: false, error: "Sem permissões." }, { status: 403 });
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
      return jsonWrap({ ok: false, error: "Sem permissões." }, { status: 403 });
    }

    const dimensionParam = req.nextUrl.searchParams.get("dimensionKey");
    const dimensionKey = (dimensionParam || "").toUpperCase();
    if (!Object.values(AnalyticsDimensionKey).includes(dimensionKey as AnalyticsDimensionKey)) {
      return jsonWrap({ ok: false, error: "INVALID_DIMENSION" }, { status: 400 });
    }

    const dateParam = req.nextUrl.searchParams.get("date");
    let bucketDate = parseDate(dateParam);
    if (!bucketDate) {
      const latest = await prisma.analyticsRollup.findFirst({
        where: { organizationId: organization.id },
        orderBy: { bucketDate: "desc" },
        select: { bucketDate: true },
      });
      bucketDate = latest?.bucketDate ?? null;
    }

    if (!bucketDate) {
      return jsonWrap({ ok: true, organizationId: organization.id, bucketDate: null, items: [] });
    }

    const rows = await prisma.analyticsRollup.findMany({
      where: {
        organizationId: organization.id,
        bucketDate,
        dimensionKey: dimensionKey as AnalyticsDimensionKey,
      },
      select: { dimensionValue: true, metricKey: true, value: true },
    });

    const items: Record<string, Record<string, number>> = {};
    for (const row of rows) {
      if (!items[row.dimensionValue]) items[row.dimensionValue] = {};
      items[row.dimensionValue][row.metricKey] = row.value;
    }

    return jsonWrap({
      ok: true,
      organizationId: organization.id,
      bucketDate: bucketDate.toISOString().slice(0, 10),
      dimensionKey,
      items,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[analytics/dimensoes]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
