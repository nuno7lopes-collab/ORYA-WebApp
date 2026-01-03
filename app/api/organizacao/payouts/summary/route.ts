export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { isOrgAdminOrAbove } from "@/lib/organizationPermissions";
import { TicketStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
    });

    if (!organization || !membership || !isOrgAdminOrAbove(membership.role)) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
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

    return NextResponse.json(
      {
        ok: true,
        ticketsSold,
        revenueCents,
        grossCents,
        platformFeesCents,
        eventsWithSales: eventsWithSales.length,
        estimatedPayoutCents: revenueCents,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organização/payouts/summary][GET] erro", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
