import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { readNumericParam } from "@/lib/routeParams";
import { PendingPayoutStatus, SaleSummaryStatus, SourceType } from "@prisma/client";
import { ensureGroupMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { OrganizationModule } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function ensureOrganizationAccess(userId: string, eventId: number) {
  const evt = await prisma.event.findUnique({ where: { id: eventId }, select: { organizationId: true } });
  if (!evt?.organizationId) return { ok: false };
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { onboardingDone: true, fullName: true, username: true },
  });
  const hasUserOnboarding =
    profile?.onboardingDone ||
    (Boolean(profile?.fullName?.trim()) && Boolean(profile?.username?.trim()));
  if (!hasUserOnboarding) return { ok: false };
  const access = await ensureGroupMemberModuleAccess({
    organizationId: evt.organizationId,
    userId,
    moduleKey: OrganizationModule.FINANCEIRO,
    required: "EDIT",
  });
  return { ok: access.ok };
}

async function _GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const tournamentId = readNumericParam(resolved?.id, req, "tournaments");
  if (tournamentId === null) return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { eventId: true },
  });
  if (!tournament) return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const access = await ensureOrganizationAccess(data.user.id, tournament.eventId);
  if (!access.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const sales = await prisma.saleSummary.groupBy({
    by: ["eventId"],
    where: { eventId: tournament.eventId, status: SaleSummaryStatus.PAID },
    _sum: { totalCents: true, netCents: true, platformFeeCents: true },
    _count: { _all: true },
  });
  const agg = sales[0] || {
    _sum: { totalCents: 0, netCents: 0, platformFeeCents: 0 },
    _count: { _all: 0 },
  };

  const recent = await prisma.saleSummary.findMany({
    where: { eventId: tournament.eventId, status: SaleSummaryStatus.PAID },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      paymentIntentId: true,
      totalCents: true,
      netCents: true,
      platformFeeCents: true,
      currency: true,
      createdAt: true,
      purchaseId: true,
    },
  });

  const event = await prisma.event.findUnique({ where: { id: tournament.eventId }, select: { payoutMode: true } });
  const pending = await prisma.pendingPayout.findMany({
    where: {
      sourceType: SourceType.TICKET_ORDER,
      sourceId: String(tournament.eventId),
      status: { in: [PendingPayoutStatus.HELD, PendingPayoutStatus.RELEASING, PendingPayoutStatus.BLOCKED] },
    },
    select: { amountCents: true, holdUntil: true, status: true },
  });
  const holdCents = pending.reduce((acc, p) => acc + p.amountCents, 0);
  const hasBlocked = pending.some((p) => p.status === PendingPayoutStatus.BLOCKED);
  const releaseAt = pending
    .filter((p) => p.status !== PendingPayoutStatus.BLOCKED)
    .reduce<Date | null>((acc, p) => (!acc || p.holdUntil < acc ? p.holdUntil : acc), null);

  // Placeholder refunds/disputes (não temos tabelas dedicadas aqui)
  const refundsCents = 0;
  const disputesCents = 0;

  return jsonWrap(
    {
      ok: true,
      summary: {
        totalCents: agg._sum.totalCents ?? 0,
        netCents: agg._sum.netCents ?? 0,
        platformFeeCents: agg._sum.platformFeeCents ?? 0,
        countSales: agg._count._all ?? 0,
        refundsCents,
        disputesCents,
        releaseAt,
        holdCents,
        holdReason: hasBlocked ? "BLOCKED" : holdCents > 0 ? "HELD" : null,
        payoutMode: event?.payoutMode ?? null,
      },
      recent,
    },
    { status: 200 },
  );
}
export const GET = withApiEnvelope(_GET);
