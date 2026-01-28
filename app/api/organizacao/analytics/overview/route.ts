import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { AnalyticsDimensionKey, AnalyticsMetricKey, OrganizationModule } from "@prisma/client";
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

    const dateParam = req.nextUrl.searchParams.get("date");
    const currencyParam = req.nextUrl.searchParams.get("currency")?.trim() || null;

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
      return jsonWrap({ ok: true, organizationId: organization.id, bucketDate: null, metrics: {}, modules: [] });
    }

    const currencyValues = await prisma.analyticsRollup.findMany({
      where: {
        organizationId: organization.id,
        bucketDate,
        dimensionKey: AnalyticsDimensionKey.CURRENCY,
      },
      select: { dimensionValue: true },
      distinct: ["dimensionValue"],
    });

    const currency = currencyParam ?? currencyValues[0]?.dimensionValue ?? null;

    const baseMetrics = await prisma.analyticsRollup.findMany({
      where: {
        organizationId: organization.id,
        bucketDate,
        dimensionKey: AnalyticsDimensionKey.CURRENCY,
        ...(currency ? { dimensionValue: currency } : {}),
      },
      select: { metricKey: true, value: true },
    });

    const metrics = baseMetrics.reduce((acc, row) => {
      acc[row.metricKey] = row.value;
      return acc;
    }, {} as Record<string, number>);

    const moduleRows = await prisma.analyticsRollup.findMany({
      where: {
        organizationId: organization.id,
        bucketDate,
        dimensionKey: AnalyticsDimensionKey.MODULE,
      },
      select: { dimensionValue: true, metricKey: true, value: true },
    });

    const modules: Record<string, Record<string, number>> = {};
    for (const row of moduleRows) {
      if (!modules[row.dimensionValue]) modules[row.dimensionValue] = {};
      modules[row.dimensionValue][row.metricKey] = row.value;
    }

    return jsonWrap({
      ok: true,
      organizationId: organization.id,
      bucketDate: bucketDate.toISOString().slice(0, 10),
      currency,
      metrics,
      modules,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[analytics/overview]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
