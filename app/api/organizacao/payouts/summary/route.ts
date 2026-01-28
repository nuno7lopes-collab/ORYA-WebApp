export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { OrganizationModule, PendingPayoutStatus, TicketStatus } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
    });

    if (!organization || !membership) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
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
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const ticketsAgg = await prisma.ticket.aggregate({
      where: {
        status: { in: [TicketStatus.ACTIVE, TicketStatus.USED] },
        event: { organizationId: organization.id },
      },
      _count: { _all: true },
      _sum: { pricePaid: true, totalPaidCents: true, platformFeeCents: true },
    });

    const eventsWithSales = await prisma.ticket.findMany({
      where: {
        status: { in: [TicketStatus.ACTIVE, TicketStatus.USED] },
        event: { organizationId: organization.id },
      },
      select: { eventId: true },
      distinct: ["eventId"],
    });

    const ticketsSold = ticketsAgg._count?._all ?? 0;
    const revenueCents = ticketsAgg._sum?.pricePaid ?? 0;
    const grossCents = ticketsAgg._sum?.totalPaidCents ?? revenueCents;
    const platformFeesCents = ticketsAgg._sum?.platformFeeCents ?? 0;
    const recipientConnectAccountId =
      organization.orgType === "PLATFORM" ? null : organization.stripeAccountId ?? null;
    const now = new Date();
    const [pendingAgg, holdMin, nextAttemptMin, actionRequired] = recipientConnectAccountId
      ? await Promise.all([
          prisma.pendingPayout.aggregate({
            where: {
              recipientConnectAccountId,
              status: { in: [PendingPayoutStatus.HELD, PendingPayoutStatus.RELEASING] },
            },
            _sum: { amountCents: true },
          }),
          prisma.pendingPayout.aggregate({
            where: {
              recipientConnectAccountId,
              status: PendingPayoutStatus.HELD,
              holdUntil: { gt: now },
            },
            _min: { holdUntil: true },
          }),
          prisma.pendingPayout.aggregate({
            where: {
              recipientConnectAccountId,
              status: PendingPayoutStatus.HELD,
              nextAttemptAt: { not: null, gte: now },
            },
            _min: { nextAttemptAt: true },
          }),
          prisma.pendingPayout.findFirst({
            where: {
              recipientConnectAccountId,
              status: PendingPayoutStatus.HELD,
              blockedReason: { startsWith: "ACTION_REQUIRED" },
            },
            select: { id: true },
          }),
        ])
      : [null, null, null, null];
    const estimatedPayoutCents = pendingAgg?._sum?.amountCents ?? 0;
    const payoutAlerts = {
      holdUntil: holdMin?._min?.holdUntil ?? null,
      nextAttemptAt: nextAttemptMin?._min?.nextAttemptAt ?? null,
      actionRequired: Boolean(actionRequired),
    };

    return jsonWrap(
      {
        ok: true,
        ticketsSold,
        revenueCents,
        grossCents,
        platformFeesCents,
        eventsWithSales: eventsWithSales.length,
        estimatedPayoutCents,
        payoutAlerts,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organização/payouts/summary][GET] erro", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);