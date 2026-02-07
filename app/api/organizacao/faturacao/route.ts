import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { resolveConnectStatus } from "@/domain/finance/stripeConnectStatus";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { OrganizationModule, SaleSummaryStatus } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(_req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const organizationId = resolveOrganizationIdFromRequest(_req);
  const { organization, membership } = await getActiveOrganizationForUser(data.user.id, {
    organizationId: organizationId ?? undefined,
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const access = await ensureMemberModuleAccess({
    organizationId: organization.id,
    userId: data.user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.FINANCEIRO,
    required: "VIEW",
  });
  if (!access.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const events = await prisma.event.findMany({
    where: { organizationId: organization.id },
    select: {
      id: true,
      title: true,
      endsAt: true,
      organization: { select: { stripeAccountId: true, stripeChargesEnabled: true, stripePayoutsEnabled: true } },
    },
  });

  const sales = await prisma.saleSummary.groupBy({
    by: ["eventId"],
    where: { eventId: { in: events.map((e) => e.id) }, status: SaleSummaryStatus.PAID },
    _sum: { totalCents: true, netCents: true, platformFeeCents: true },
    _count: { _all: true },
  });

  const summaryPerEvent = events.map((evt) => {
    const agg = sales.find((s) => s.eventId === evt.id);
    const total = agg?._sum.totalCents ?? 0;
    const connectStatus = resolveConnectStatus(
      evt.organization?.stripeAccountId ?? null,
      evt.organization?.stripeChargesEnabled ?? false,
      evt.organization?.stripePayoutsEnabled ?? false,
    );
    return {
      eventId: evt.id,
      title: evt.title,
      totalCents: total,
      netCents: agg?._sum.netCents ?? 0,
      platformFeeCents: agg?._sum.platformFeeCents ?? 0,
      countSales: agg?._count._all ?? 0,
      releaseAt: null,
      holdCents: 0,
      holdReason: null,
      connectStatus,
    };
  });

  const grandTotal = summaryPerEvent.reduce(
    (acc, e) => {
      acc.totalCents += e.totalCents;
      acc.netCents += e.netCents;
      acc.platformFeeCents += e.platformFeeCents;
      acc.countSales += e.countSales;
      return acc;
    },
    { totalCents: 0, netCents: 0, platformFeeCents: 0, countSales: 0, holdCents: 0 },
  );

  const refundsCents = 0;
  const disputesCents = 0;

  return jsonWrap(
    {
      ok: true,
      summary: { ...grandTotal, refundsCents, disputesCents },
      events: summaryPerEvent,
    },
    { status: 200 },
  );
}
export const GET = withApiEnvelope(_GET);
