import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { computeReleaseAt, computeHold } from "@/domain/finance/payoutPolicy";

async function ensureOrganizerAccess(userId: string, eventId: number) {
  const evt = await prisma.event.findUnique({ where: { id: eventId }, select: { organizerId: true, isTest: true } });
  if (!evt?.organizerId) return { ok: false, isTest: false };
  const member = await prisma.organizerMember.findFirst({
    where: { organizerId: evt.organizerId, userId, role: { in: ["OWNER", "CO_OWNER", "ADMIN"] } },
    select: { id: true },
  });
  return { ok: Boolean(member), isTest: evt.isTest ?? false };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const tournamentId = Number(params?.id);
  if (!Number.isFinite(tournamentId)) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { eventId: true },
  });
  if (!tournament) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const access = await ensureOrganizerAccess(data.user.id, tournament.eventId);
  if (!access.ok) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const includeTest = req.nextUrl.searchParams.get("includeTest") === "1";
  if (!includeTest && access.isTest) {
    return NextResponse.json({ ok: false, error: "TEST_EVENT" }, { status: 400 });
  }

  const sales = await prisma.saleSummary.groupBy({
    by: ["eventId"],
    where: { eventId: tournament.eventId },
    _sum: { totalCents: true, netCents: true, platformFeeCents: true },
    _count: { _all: true },
  });
  const agg = sales[0] || {
    _sum: { totalCents: 0, netCents: 0, platformFeeCents: 0 },
    _count: { _all: 0 },
  };

  const recent = await prisma.saleSummary.findMany({
    where: { eventId: tournament.eventId },
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

  const event = await prisma.event.findUnique({ where: { id: tournament.eventId }, select: { endsAt: true, payoutMode: true } });
  const releaseAt = computeReleaseAt(event?.endsAt ?? null);
  const hold = computeHold(agg._sum.totalCents ?? 0, false); // sem disputes implementadas aqui

  // Placeholder refunds/disputes (não temos tabelas dedicadas aqui)
  const refundsCents = 0;
  const disputesCents = 0;

  return NextResponse.json(
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
        holdCents: hold.holdCents,
        holdReason: hold.reason,
        payoutMode: event?.payoutMode ?? null,
      },
      recent,
    },
    { status: 200 },
  );
}
