import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";

type PurgePayload = {
  eventId?: number;
};

export async function POST(req: Request) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
    }

    const body = (await req.json().catch(() => null)) as PurgePayload | null;
    const eventId = Number(body?.eventId);
    if (!Number.isFinite(eventId)) {
      return NextResponse.json({ ok: false, error: "INVALID_EVENT_ID" }, { status: 400 });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, slug: true },
    });
    if (!event) {
      return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
    }

    const [tickets, pairings, promoCodes, saleSummaries, tournaments, entitlements] = await Promise.all([
      prisma.ticket.findMany({ where: { eventId }, select: { id: true } }),
      prisma.padelPairing.findMany({ where: { eventId }, select: { id: true } }),
      prisma.promoCode.findMany({ where: { eventId }, select: { id: true } }),
      prisma.saleSummary.findMany({
        where: { eventId },
        select: { id: true, paymentIntentId: true, purchaseId: true },
      }),
      prisma.tournament.findMany({ where: { eventId }, select: { id: true } }),
      prisma.entitlement.findMany({ where: { eventId }, select: { id: true } }),
    ]);

    const ticketIds = tickets.map((t) => t.id);
    const pairingIds = pairings.map((p) => p.id);
    const promoCodeIds = promoCodes.map((p) => p.id);
    const salePaymentIntentIds = saleSummaries.map((s) => s.paymentIntentId).filter(Boolean);
    const salePurchaseIds = saleSummaries.map((s) => s.purchaseId).filter(Boolean);
    const tournamentIds = tournaments.map((t) => t.id);
    const entitlementIds = entitlements.map((e) => e.id);

    const stageIds = tournamentIds.length
      ? (
          await prisma.tournamentStage.findMany({
            where: { tournamentId: { in: tournamentIds } },
            select: { id: true },
          })
        ).map((s) => s.id)
      : [];

    const matchIds = stageIds.length
      ? (
          await prisma.tournamentMatch.findMany({
            where: { stageId: { in: stageIds } },
            select: { id: true },
          })
        ).map((m) => m.id)
      : [];

    await prisma.padelPairing.updateMany({
      where: { eventId },
      data: { createdByTicketId: null },
    });
    await prisma.ticket.updateMany({
      where: { eventId },
      data: { pairingId: null },
    });

    const notificationOr = [{ eventId }];
    if (ticketIds.length) {
      notificationOr.push({ ticketId: { in: ticketIds } });
    }
    await prisma.notification.deleteMany({ where: { OR: notificationOr } });

    await prisma.entitlementCheckin.deleteMany({ where: { eventId } });
    if (entitlementIds.length) {
      await prisma.entitlementQrToken.deleteMany({ where: { entitlementId: { in: entitlementIds } } });
    }
    await prisma.entitlement.deleteMany({ where: { eventId } });

    if (pairingIds.length) {
      await prisma.padelPairingSlot.deleteMany({ where: { pairingId: { in: pairingIds } } });
    }
    await prisma.padelMatch.deleteMany({ where: { eventId } });
    await prisma.padelPairingHold.deleteMany({ where: { eventId } });
    await prisma.padelWaitlistEntry.deleteMany({ where: { eventId } });
    await prisma.tournamentEntry.deleteMany({ where: { eventId } });

    if (matchIds.length) {
      await prisma.matchNotification.deleteMany({ where: { matchId: { in: matchIds } } });
    }
    if (stageIds.length) {
      await prisma.tournamentMatch.deleteMany({ where: { stageId: { in: stageIds } } });
      await prisma.tournamentGroup.deleteMany({ where: { stageId: { in: stageIds } } });
    }
    if (tournamentIds.length) {
      await prisma.tournamentStage.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
      await prisma.tournamentAuditLog.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
      await prisma.tournament.deleteMany({ where: { id: { in: tournamentIds } } });
    }

    await prisma.padelAvailability.deleteMany({ where: { eventId } });
    await prisma.padelCourtBlock.deleteMany({ where: { eventId } });
    await prisma.padelRankingEntry.deleteMany({ where: { eventId } });
    await prisma.padelTournamentConfig.deleteMany({ where: { eventId } });
    await prisma.padelEventCategoryLink.deleteMany({ where: { eventId } });

    if (ticketIds.length) {
      await prisma.ticketResale.deleteMany({ where: { ticketId: { in: ticketIds } } });
      await prisma.guestTicketLink.deleteMany({ where: { ticketId: { in: ticketIds } } });
    }
    await prisma.ticketReservation.deleteMany({ where: { eventId } });
    await prisma.ticket.deleteMany({ where: { eventId } });
    await prisma.ticketType.deleteMany({ where: { eventId } });

    await prisma.saleLine.deleteMany({ where: { eventId } });
    if (promoCodeIds.length) {
      await prisma.promoRedemption.deleteMany({ where: { promoCodeId: { in: promoCodeIds } } });
    }
    await prisma.promoCode.deleteMany({ where: { eventId } });
    await prisma.saleSummary.deleteMany({ where: { eventId } });
    await prisma.refund.deleteMany({ where: { eventId } });
    await prisma.paymentEvent.deleteMany({ where: { eventId } });

    if (salePaymentIntentIds.length || salePurchaseIds.length) {
      const operationOr = [{ eventId }];
      if (salePaymentIntentIds.length) {
        operationOr.push({ paymentIntentId: { in: salePaymentIntentIds } });
      }
      if (salePurchaseIds.length) {
        operationOr.push({ purchaseId: { in: salePurchaseIds } });
      }
      await prisma.operation.deleteMany({ where: { OR: operationOr } });
      if (salePaymentIntentIds.length) {
        await prisma.pendingPayout.deleteMany({
          where: { paymentIntentId: { in: salePaymentIntentIds } },
        });
        await prisma.transaction.deleteMany({
          where: { stripePaymentIntentId: { in: salePaymentIntentIds } },
        });
      }
    } else {
      await prisma.operation.deleteMany({ where: { eventId } });
    }

    await prisma.eventInvite.deleteMany({ where: { eventId } });
    await prisma.padelPairing.deleteMany({ where: { eventId } });
    await prisma.event.delete({ where: { id: eventId } });

    return NextResponse.json({ ok: true, eventId, title: event.title, slug: event.slug }, { status: 200 });
  } catch (error) {
    console.error("[admin/eventos/purge] error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
