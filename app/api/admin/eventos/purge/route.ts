import { NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import { appendEventLog } from "@/domain/eventLog/append";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { recordSearchIndexOutbox } from "@/domain/searchIndex/outbox";
import { paymentEventRepo, saleLineRepo, saleSummaryRepo } from "@/domain/finance/readModelConsumer";
import { deleteHardBlocksByEvent } from "@/domain/hardBlocks/commands";
import { deleteMatchSlotsByEvent } from "@/domain/padel/matchSlots/commands";
import { SourceType } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

type PurgePayload = {
  eventId?: number;
};

async function _POST(req: Request) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return jsonWrap({ ok: false, error: admin.error }, { status: admin.status });
    }

    const body = (await req.json().catch(() => null)) as PurgePayload | null;
    const eventId = Number(body?.eventId);
    if (!Number.isFinite(eventId)) {
      return jsonWrap({ ok: false, error: "INVALID_EVENT_ID" }, { status: 400 });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, slug: true, organizationId: true },
    });
    if (!event) {
      return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
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

    await prisma.$transaction(async (tx) => {
      const eventLogId = crypto.randomUUID();
      await appendEventLog(
        {
          eventId: eventLogId,
          organizationId: event.organizationId ?? null,
          eventType: "event.cancelled",
          idempotencyKey: `event.cancelled:${eventId}:${eventLogId}`,
          actorUserId: admin.userId ?? null,
          sourceType: SourceType.EVENT,
          sourceId: String(eventId),
          correlationId: String(eventId),
          payload: {
            eventId,
            title: event.title,
            status: "CANCELLED",
            organizationId: event.organizationId ?? null,
          },
        },
        tx,
      );
      await recordOutboxEvent(
        {
          eventId: eventLogId,
          eventType: "event.cancelled",
          payload: {
            eventId,
            title: event.title,
            status: "CANCELLED",
          },
          correlationId: String(eventId),
        },
        tx,
      );
      await recordSearchIndexOutbox(
        {
          eventLogId,
          organizationId: event.organizationId ?? null,
          sourceType: SourceType.EVENT,
          sourceId: String(eventId),
          correlationId: String(eventId),
        },
        tx,
      );

      await tx.padelPairing.updateMany({
        where: { eventId },
        data: { createdByTicketId: null },
      });
      await tx.ticket.updateMany({
        where: { eventId },
        data: { pairingId: null },
      });

      const notificationOr = [{ eventId }];
      if (ticketIds.length) {
        notificationOr.push({ ticketId: { in: ticketIds } });
      }
      await tx.notification.deleteMany({ where: { OR: notificationOr } });

      await tx.entitlementCheckin.deleteMany({ where: { eventId } });
      if (entitlementIds.length) {
        await tx.entitlementQrToken.deleteMany({ where: { entitlementId: { in: entitlementIds } } });
      }
      await tx.entitlement.deleteMany({ where: { eventId } });

      if (pairingIds.length) {
        await tx.padelPairingSlot.deleteMany({ where: { pairingId: { in: pairingIds } } });
      }
      const matchDeleteRes = await deleteMatchSlotsByEvent({
        organizationId: event.organizationId,
        eventId,
        actorUserId: admin.userId ?? null,
        correlationId: String(eventId),
        tx,
      });
      if (!matchDeleteRes.ok) {
        throw new Error(`MATCH_PURGE_FAILED:${matchDeleteRes.error}`);
      }
      await tx.padelPairingHold.deleteMany({ where: { eventId } });
      await tx.padelWaitlistEntry.deleteMany({ where: { eventId } });
      await tx.tournamentEntry.deleteMany({ where: { eventId } });

      if (matchIds.length) {
        await tx.matchNotification.deleteMany({ where: { matchId: { in: matchIds } } });
      }
      if (stageIds.length) {
        await tx.tournamentMatch.deleteMany({ where: { stageId: { in: stageIds } } });
        await tx.tournamentGroup.deleteMany({ where: { stageId: { in: stageIds } } });
      }
      if (tournamentIds.length) {
        await tx.tournamentStage.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
        await tx.tournamentAuditLog.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
        await tx.tournament.deleteMany({ where: { id: { in: tournamentIds } } });
      }

      await tx.padelAvailability.deleteMany({ where: { eventId } });
      if (!Number.isFinite(event.organizationId)) {
        throw new Error("EVENT_ORG_MISSING");
      }
      const hardBlocksRes = await deleteHardBlocksByEvent({
        organizationId: event.organizationId,
        eventId,
        actorUserId: admin.userId ?? null,
        correlationId: String(eventId),
        tx,
      });
      if (!hardBlocksRes.ok) {
        throw new Error(`HARD_BLOCK_PURGE_FAILED:${hardBlocksRes.error}`);
      }
      await tx.padelRankingEntry.deleteMany({ where: { eventId } });
      await tx.padelTournamentConfig.deleteMany({ where: { eventId } });
      await tx.padelEventCategoryLink.deleteMany({ where: { eventId } });

      if (ticketIds.length) {
        await tx.ticketResale.deleteMany({ where: { ticketId: { in: ticketIds } } });
        await tx.guestTicketLink.deleteMany({ where: { ticketId: { in: ticketIds } } });
      }
      await tx.ticketReservation.deleteMany({ where: { eventId } });
      await tx.ticket.deleteMany({ where: { eventId } });
      await tx.ticketType.deleteMany({ where: { eventId } });

      await saleLineRepo(tx).deleteMany({ where: { eventId } });
      if (promoCodeIds.length) {
        await tx.promoRedemption.deleteMany({ where: { promoCodeId: { in: promoCodeIds } } });
      }
      await tx.promoCode.deleteMany({ where: { eventId } });
      await saleSummaryRepo(tx).deleteMany({ where: { eventId } });
      await tx.refund.deleteMany({ where: { eventId } });
      await paymentEventRepo(tx).deleteMany({ where: { eventId } });

      if (salePaymentIntentIds.length || salePurchaseIds.length) {
        const operationOr = [{ eventId }];
        if (salePaymentIntentIds.length) {
          operationOr.push({ paymentIntentId: { in: salePaymentIntentIds } });
        }
        if (salePurchaseIds.length) {
          operationOr.push({ purchaseId: { in: salePurchaseIds } });
        }
        await tx.operation.deleteMany({ where: { OR: operationOr } });
        if (salePaymentIntentIds.length) {
          await tx.pendingPayout.deleteMany({
            where: { paymentIntentId: { in: salePaymentIntentIds } },
          });
          await tx.transaction.deleteMany({
            where: { stripePaymentIntentId: { in: salePaymentIntentIds } },
          });
        }
      } else {
        await tx.operation.deleteMany({ where: { eventId } });
      }

      await tx.eventInvite.deleteMany({ where: { eventId } });
      await tx.padelPairing.deleteMany({ where: { eventId } });
      await tx.event.delete({ where: { id: eventId } });
    });

    return jsonWrap({ ok: true, eventId, title: event.title, slug: event.slug }, { status: 200 });
  } catch (error) {
    console.error("[admin/eventos/purge] error:", error);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);