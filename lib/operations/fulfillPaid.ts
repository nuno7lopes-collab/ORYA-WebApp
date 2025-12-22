import { prisma } from "@/lib/prisma";
import { normalizePaymentScenario } from "@/lib/paymentScenario";
import { Prisma, EntitlementType, EntitlementStatus } from "@prisma/client";
import { enqueueOperation } from "@/lib/operations/enqueue";
import { normalizeEmail } from "@/lib/utils/email";

function buildOwnerKey(params: { ownerUserId?: string | null; ownerIdentityId?: string | null; guestEmail?: string | null }) {
  if (params.ownerUserId) return `user:${params.ownerUserId}`;
  if (params.ownerIdentityId) return `identity:${params.ownerIdentityId}`;
  const guest = normalizeEmail(params.guestEmail);
  if (guest) return `email:${guest}`;
  return "unknown";
}

type BreakdownLine = {
  ticketTypeId: number;
  quantity: number;
  unitPriceCents: number;
  discountPerUnitCents?: number;
  lineTotalCents?: number;
  lineNetCents?: number;
  platformFeeCents?: number;
};

type IntentLike = {
  id: string;
  amount_received: number | null;
  amount: number | null;
  currency: string;
  livemode: boolean;
  metadata: Record<string, any>;
};

/**
 * Fulfillment simplificado para intents pagos (SINGLE/default) via worker.
 * Retorna true se tratou o intent; false se não aplicável.
 */
export async function fulfillPaidIntent(intent: IntentLike, stripeEventId?: string): Promise<boolean> {
  const meta = intent.metadata ?? {};
  const scenario = normalizePaymentScenario(typeof meta.paymentScenario === "string" ? meta.paymentScenario : null);
  // Deixar cenários especiais para handlers dedicados.
  if (scenario && ["RESALE", "GROUP_SPLIT", "GROUP_FULL", "GROUP_SPLIT_SECOND_CHARGE"].includes(scenario)) {
    return false;
  }

  let breakdown: { lines: BreakdownLine[]; subtotalCents: number; discountCents: number; platformFeeCents: number; totalCents: number; feeMode?: string | null; currency?: string | null } | null =
    null;
  if (typeof meta.breakdown === "string") {
    try {
      const parsed = JSON.parse(meta.breakdown);
      if (parsed && Array.isArray(parsed.lines)) {
        breakdown = {
          lines: parsed.lines as BreakdownLine[],
          subtotalCents: Number(parsed.subtotalCents ?? 0),
          discountCents: Number(parsed.discountCents ?? 0),
          platformFeeCents: Number(parsed.platformFeeCents ?? 0),
          totalCents: Number(parsed.totalCents ?? 0),
          feeMode: parsed.feeMode ?? null,
          currency: parsed.currency ?? intent.currency ?? "EUR",
        };
      }
    } catch {
      breakdown = null;
    }
  }

  if (!breakdown || !breakdown.lines.length) return false;

  const purchaseId =
    typeof meta.purchaseId === "string" && meta.purchaseId.trim() !== "" ? meta.purchaseId.trim() : intent.id;
  const ownerUserId = typeof meta.ownerUserId === "string" ? meta.ownerUserId : null;
  const ownerIdentityId = typeof meta.ownerIdentityId === "string" ? meta.ownerIdentityId : null;
  const ownerEmail = typeof meta.emailNormalized === "string" ? meta.emailNormalized : null;
  const userId = ownerUserId;
  const eventId =
    typeof meta.eventId === "string" && Number.isFinite(Number(meta.eventId))
      ? Number(meta.eventId)
      : typeof meta.eventId === "number"
        ? meta.eventId
        : null;
  const promoCodeId =
    typeof meta.promoCode === "string" && meta.promoCode.trim() !== "" ? Number(meta.promoCode) : null;

  if (!eventId) return false;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { ticketTypes: true },
  });
  if (!event) return false;

  const existingTicket = await prisma.ticket.findFirst({
    where: { stripePaymentIntentId: intent.id },
  });
  if (existingTicket) {
    await prisma.paymentEvent.updateMany({
      where: { stripePaymentIntentId: intent.id },
      data: {
        status: "OK",
        purchaseId,
        stripeEventId: stripeEventId ?? undefined,
        source: "WEBHOOK",
        dedupeKey: stripeEventId ?? intent.id,
        attempt: { increment: 1 },
        updatedAt: new Date(),
        errorMessage: null,
        mode: intent.livemode ? "LIVE" : "TEST",
        isTest: !intent.livemode,
      },
    });
    return true;
  }

  const ticketTypeMap = new Map(event.ticketTypes.map((t) => [t.id, t]));

  await prisma.$transaction(async (tx) => {
    // Evitar conflito por purchaseId já existente: se já existir, atualizamos, senão criamos.
    const existingSummary =
      (purchaseId
        ? await tx.saleSummary.findUnique({ where: { purchaseId } })
        : null) ||
      (await tx.saleSummary.findUnique({ where: { paymentIntentId: intent.id } }));

    const baseData = {
      eventId: event.id,
      userId,
      ownerUserId: userId,
      ownerIdentityId,
      purchaseId,
      promoCodeId,
      subtotalCents: breakdown?.subtotalCents ?? 0,
      discountCents: breakdown?.discountCents ?? 0,
      platformFeeCents: breakdown?.platformFeeCents ?? 0,
      stripeFeeCents: 0,
      totalCents: breakdown?.totalCents ?? intent.amount_received ?? intent.amount ?? 0,
      netCents: Math.max(0, (breakdown?.totalCents ?? 0) - (breakdown?.platformFeeCents ?? 0)),
      feeMode: (breakdown?.feeMode as any) ?? null,
      currency: (breakdown?.currency ?? intent.currency ?? "EUR").toUpperCase(),
      status: "PAID" as const,
    };

    const saleSummary = existingSummary
      ? await tx.saleSummary.update({
          where: { id: existingSummary.id },
          data: baseData,
        })
      : await tx.saleSummary.create({
          data: {
            ...baseData,
            paymentIntentId: intent.id,
          },
        });

    await tx.saleLine.deleteMany({ where: { saleSummaryId: saleSummary.id } });
    for (const line of breakdown.lines) {
      const saleLine = await tx.saleLine.create({
        data: {
          saleSummaryId: saleSummary.id,
          eventId: event.id,
          ticketTypeId: line.ticketTypeId,
          promoCodeId,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          discountPerUnitCents: line.discountPerUnitCents ?? 0,
          grossCents: line.lineTotalCents ?? line.unitPriceCents * line.quantity,
          netCents: line.lineNetCents ?? Math.max(0, (line.lineTotalCents ?? line.unitPriceCents * line.quantity) - (line.discountPerUnitCents ?? 0) * line.quantity),
          platformFeeCents: line.platformFeeCents ?? 0,
        },
        select: { id: true },
      });

      const tt = ticketTypeMap.get(line.ticketTypeId);
      if (!tt) continue;
      const qty = Math.max(1, Number(line.quantity ?? 0));
      const ownerKey = buildOwnerKey({ ownerUserId: userId, ownerIdentityId, guestEmail: ownerEmail });
      for (let i = 0; i < qty; i++) {
        // Entitlement (SSOT)
        await tx.entitlement.upsert({
          where: {
            purchaseId_saleLineId_lineItemIndex_ownerKey_type: {
              purchaseId,
              saleLineId: saleLine.id,
              lineItemIndex: i,
              ownerKey,
              type: EntitlementType.EVENT_TICKET,
            },
          },
          update: {
            status: EntitlementStatus.ACTIVE,
            ownerUserId: userId ?? null,
            ownerIdentityId: ownerIdentityId ?? null,
            eventId: event.id,
            snapshotTitle: event.title,
            snapshotCoverUrl: event.coverImageUrl,
            snapshotVenueName: event.locationName,
            snapshotStartAt: event.startsAt,
            snapshotTimezone: event.timezone,
          },
          create: {
            purchaseId,
            saleLineId: saleLine.id,
            lineItemIndex: i,
            ownerKey,
            ownerUserId: userId ?? null,
            ownerIdentityId: ownerIdentityId ?? null,
            eventId: event.id,
            type: EntitlementType.EVENT_TICKET,
            status: EntitlementStatus.ACTIVE,
            snapshotTitle: event.title,
            snapshotCoverUrl: event.coverImageUrl,
            snapshotVenueName: event.locationName,
            snapshotStartAt: event.startsAt,
            snapshotTimezone: event.timezone,
          },
        });

      }

      await tx.ticketType.update({
        where: { id: tt.id },
        data: { soldQuantity: { increment: qty } },
      });
    }

    await tx.paymentEvent.updateMany({
      where: { stripePaymentIntentId: intent.id },
      data: {
        status: "OK",
        updatedAt: new Date(),
        errorMessage: null,
        purchaseId,
        stripeEventId: stripeEventId ?? undefined,
        source: "WEBHOOK",
        dedupeKey: stripeEventId ?? intent.id,
        attempt: { increment: 1 },
      },
    });
  });

  // Enfileirar email de recibo se houver email associado
  const ownerUserId = userId;
  const emailDedupe = ownerEmail
    ? `${purchaseId}:${ownerEmail}`
    : ownerUserId
      ? `${purchaseId}:${ownerUserId}`
      : null;
  if (emailDedupe) {
    try {
      await enqueueOperation({
        operationType: "SEND_EMAIL_RECEIPT",
        dedupeKey: emailDedupe,
        correlations: { purchaseId, paymentIntentId: intent.id },
        payload: { purchaseId, email: ownerEmail, userId: ownerUserId ?? null },
      });
    } catch (err) {
      console.warn("[fulfillPaidIntent] Falha ao enfileirar email de recibo", err);
    }
  }

  if (ownerUserId) {
    try {
      await enqueueOperation({
        operationType: "SEND_NOTIFICATION_PURCHASE",
        dedupeKey: `${purchaseId}:notify:${ownerUserId}`,
        correlations: { purchaseId, paymentIntentId: intent.id, eventId },
        payload: { purchaseId, userId: ownerUserId, eventId },
      });
    } catch (err) {
      console.warn("[fulfillPaidIntent] Falha ao enfileirar notificação de compra", err);
    }
  }

  if (promoCodeId) {
    try {
      await enqueueOperation({
        operationType: "APPLY_PROMO_REDEMPTION",
        dedupeKey: `APPLY_PROMO_REDEMPTION:${purchaseId}`,
        correlations: { purchaseId, paymentIntentId: intent.id, eventId },
        payload: { purchaseId, paymentIntentId: intent.id, promoCodeId, userId: ownerUserId, guestEmail: ownerEmail },
      });
    } catch (err) {
      console.warn("[fulfillPaidIntent] Falha ao enfileirar APPLY_PROMO_REDEMPTION", err);
    }
  }

  return true;
}
