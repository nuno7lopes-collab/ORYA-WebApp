import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { resolveConnectStatus } from "@/domain/finance/stripeConnectStatus";
import { PendingPayoutStatus } from "@prisma/client";

export async function GET(_req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: data.user.id, role: { in: ["OWNER", "CO_OWNER", "ADMIN"] } },
    select: { organizationId: true },
  });
  const organizationIds = memberships.map((m) => m.organizationId);
  if (organizationIds.length === 0) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const events = await prisma.event.findMany({
    where: { organizationId: { in: organizationIds } },
    select: {
      id: true,
      title: true,
      endsAt: true,
      organization: { select: { stripeAccountId: true, stripeChargesEnabled: true, stripePayoutsEnabled: true } },
    },
  });

  const sales = await prisma.saleSummary.groupBy({
    by: ["eventId"],
    where: { eventId: { in: events.map((e) => e.id) } },
    _sum: { totalCents: true, netCents: true, platformFeeCents: true },
    _count: { _all: true },
  });

  const pending = await prisma.pendingPayout.findMany({
    where: {
      sourceType: "EVENT_TICKET",
      sourceId: { in: events.map((e) => String(e.id)) },
      status: { in: [PendingPayoutStatus.HELD, PendingPayoutStatus.RELEASING, PendingPayoutStatus.BLOCKED] },
    },
    select: { sourceId: true, amountCents: true, holdUntil: true, status: true },
  });

  const pendingByEvent = new Map<
    string,
    { holdCents: number; releaseAt: Date | null; hasBlocked: boolean }
  >();
  for (const p of pending) {
    const key = p.sourceId;
    const current = pendingByEvent.get(key) ?? { holdCents: 0, releaseAt: null, hasBlocked: false };
    current.holdCents += p.amountCents;
    if (p.status === PendingPayoutStatus.BLOCKED) {
      current.hasBlocked = true;
    } else if (!current.releaseAt || p.holdUntil < current.releaseAt) {
      current.releaseAt = p.holdUntil;
    }
    pendingByEvent.set(key, current);
  }

  const summaryPerEvent = events.map((evt) => {
    const agg = sales.find((s) => s.eventId === evt.id);
    const total = agg?._sum.totalCents ?? 0;
    const pendingStats = pendingByEvent.get(String(evt.id)) ?? { holdCents: 0, releaseAt: null, hasBlocked: false };
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
      releaseAt: pendingStats.releaseAt,
      holdCents: pendingStats.holdCents,
      holdReason: pendingStats.hasBlocked ? "BLOCKED" : pendingStats.holdCents > 0 ? "HELD" : null,
      connectStatus,
    };
  });

  const grandTotal = summaryPerEvent.reduce(
    (acc, e) => {
      acc.totalCents += e.totalCents;
      acc.netCents += e.netCents;
      acc.platformFeeCents += e.platformFeeCents;
      acc.countSales += e.countSales;
      acc.holdCents += e.holdCents;
      return acc;
    },
    { totalCents: 0, netCents: 0, platformFeeCents: 0, countSales: 0, holdCents: 0 },
  );

  const refundsCents = 0;
  const disputesCents = 0;

  return NextResponse.json(
    {
      ok: true,
      summary: { ...grandTotal, refundsCents, disputesCents },
      events: summaryPerEvent,
    },
    { status: 200 },
  );
}
