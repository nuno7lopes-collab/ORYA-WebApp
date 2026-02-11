// Payment fulfillment for standard event purchases.
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { normalizePaymentScenario } from "@/lib/paymentScenario";
import { CrmInteractionSource, CrmInteractionType, EntitlementType, EntitlementStatus } from "@prisma/client";
import { requireLatestPolicyVersionForEvent } from "@/lib/checkin/accessPolicy";
import { formatEventLocationLabel } from "@/lib/location/eventLocation";
import { enqueueOperation } from "@/lib/operations/enqueue";
import { normalizeEmail } from "@/lib/utils/email";
import { checkoutKey } from "@/lib/stripe/idempotency";
import { ingestCrmInteraction } from "@/lib/crm/ingest";
import { paymentEventRepo, saleLineRepo, saleSummaryRepo } from "@/domain/finance/readModelConsumer";
import { logError } from "@/lib/observability/logger";
import { ensureEmailIdentity, resolveIdentityForUser } from "@/lib/ownership/identity";


function buildOwnerKey(params: { ownerUserId?: string | null; ownerIdentityId?: string | null; guestEmail?: string | null }) {
  if (params.ownerIdentityId) return `identity:${params.ownerIdentityId}`;
  if (params.ownerUserId) return `user:${params.ownerUserId}`;
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
  if (scenario && ["RESALE", "GROUP_SPLIT", "GROUP_FULL", "GROUP_SPLIT_SECOND_CHARGE", "BOOKING_CHANGE"].includes(scenario)) {
    return false;
  }

  let breakdown: {
    lines: BreakdownLine[];
    subtotalCents: number;
    discountCents: number;
    platformFeeCents: number;
    cardPlatformFeeCents?: number;
    totalCents: number;
    feeMode?: string | null;
    currency?: string | null;
    paymentMethod?: string | null;
  } | null =
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
          cardPlatformFeeCents: Number(parsed.cardPlatformFeeCents ?? 0),
          totalCents: Number(parsed.totalCents ?? 0),
          feeMode: parsed.feeMode ?? null,
          currency: parsed.currency ?? intent.currency ?? "EUR",
          paymentMethod: parsed.paymentMethod ?? null,
        };
      }
    } catch {
      breakdown = null;
    }
  }

  if (!breakdown || !breakdown.lines.length) return false;

  const purchaseId =
    typeof meta.purchaseId === "string" && meta.purchaseId.trim() !== "" ? meta.purchaseId.trim() : intent.id;
  const idempotencyKey = typeof meta.idempotencyKey === "string" ? meta.idempotencyKey.trim() : "";
  const paymentDedupeKey = idempotencyKey || (purchaseId ? checkoutKey(purchaseId) : intent.id);
  const ownerUserId = typeof meta.ownerUserId === "string" ? meta.ownerUserId : null;
  const ownerEmailRaw = typeof meta.emailNormalized === "string" ? meta.emailNormalized : null;
  const ownerEmail = normalizeEmail(ownerEmailRaw);
  let ownerIdentityId = typeof meta.ownerIdentityId === "string" ? meta.ownerIdentityId : null;
  if (!ownerIdentityId && ownerUserId) {
    const identity = await resolveIdentityForUser({ userId: ownerUserId, email: ownerEmail });
    ownerIdentityId = identity.id;
  } else if (!ownerIdentityId && ownerEmail) {
    const identity = await ensureEmailIdentity({ email: ownerEmail });
    ownerIdentityId = identity.id;
  }
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
    select: {
      id: true,
      organizationId: true,
      title: true,
      coverImageUrl: true,
      addressRef: { select: { formattedAddress: true } },
      startsAt: true,
      timezone: true,
      ticketTypes: {
        select: {
          id: true,
          currency: true,
        },
      },
    },
  });
  if (!event) return false;

  const ticketTypeMap = new Map(event.ticketTypes.map((t) => [t.id, t]));
  const snapshotVenueName = formatEventLocationLabel({ addressRef: event.addressRef ?? null }, "Local a anunciar");

  await prisma.$transaction(async (tx) => {
    const policyVersionApplied = await requireLatestPolicyVersionForEvent(event.id, tx);
    // Evitar conflito por purchaseId já existente: se já existir, atualizamos, senão criamos.
    const existingSummary =
      (purchaseId
        ? await tx.saleSummary.findUnique({ where: { purchaseId }, select: { id: true } })
        : null) ||
      (await tx.saleSummary.findUnique({ where: { paymentIntentId: intent.id }, select: { id: true } }));

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
      cardPlatformFeeCents: breakdown?.cardPlatformFeeCents ?? 0,
      stripeFeeCents: 0,
      totalCents: breakdown?.totalCents ?? intent.amount_received ?? intent.amount ?? 0,
      netCents: Math.max(
        0,
        (breakdown?.totalCents ?? 0) -
          (breakdown?.platformFeeCents ?? 0) -
          (breakdown?.cardPlatformFeeCents ?? 0),
      ),
      feeMode: (breakdown?.feeMode as any) ?? null,
      currency: (breakdown?.currency ?? intent.currency ?? "EUR").toUpperCase(),
      status: "PAID" as const,
      paymentMethod: breakdown?.paymentMethod ?? null,
    };

    const saleSummary = existingSummary
      ? await saleSummaryRepo(tx).update({
          where: { id: existingSummary.id },
          data: baseData,
        })
      : await saleSummaryRepo(tx).create({
          data: {
            ...baseData,
            paymentIntentId: intent.id,
          },
        });

    const existingTickets = await tx.ticket.findMany({
      where: {
        eventId: event.id,
        OR: [{ purchaseId }, { stripePaymentIntentId: intent.id }],
      },
      select: {
        id: true,
        ticketTypeId: true,
        emissionIndex: true,
        saleSummaryId: true,
        purchaseId: true,
      },
    });

    const ticketsByType = new Map<number, Map<number, typeof existingTickets[number]>>();
    for (const ticket of existingTickets) {
      const index = ticket.emissionIndex ?? 0;
      const typeMap = ticketsByType.get(ticket.ticketTypeId) ?? new Map();
      typeMap.set(index, ticket);
      ticketsByType.set(ticket.ticketTypeId, typeMap);
    }

    await saleLineRepo(tx).deleteMany({ where: { saleSummaryId: saleSummary.id } });
    for (const line of breakdown.lines) {
      const saleLine = await saleLineRepo(tx).create({
        data: {
          saleSummaryId: saleSummary.id,
          eventId: event.id,
          ticketTypeId: line.ticketTypeId,
          promoCodeId,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          discountPerUnitCents: line.discountPerUnitCents ?? 0,
          grossCents: line.lineTotalCents ?? line.unitPriceCents * line.quantity,
          netCents:
            line.lineNetCents ??
            Math.max(
              0,
              (line.lineTotalCents ?? line.unitPriceCents * line.quantity) -
                (line.discountPerUnitCents ?? 0) * line.quantity,
            ),
          platformFeeCents: line.platformFeeCents ?? 0,
        },
        select: { id: true },
      });

      const tt = ticketTypeMap.get(line.ticketTypeId);
      if (!tt) continue;
      const qty = Math.max(1, Number(line.quantity ?? 0));
      const ownerKey = buildOwnerKey({ ownerUserId: userId, ownerIdentityId, guestEmail: ownerEmail });
      const entitlementOwnerUserId = ownerIdentityId ? null : userId ?? null;
      const lineNetCents = line.lineNetCents ?? line.lineTotalCents ?? line.unitPriceCents * qty;
      const pricePerTicketCents = Math.round(lineNetCents / Math.max(1, qty));
      const totalPlatformFeeCents = line.platformFeeCents ?? 0;
      const basePlatformFee = Math.floor(totalPlatformFeeCents / Math.max(1, qty));
      let feeRemainder = totalPlatformFeeCents - basePlatformFee * Math.max(1, qty);

      const typeTickets = ticketsByType.get(line.ticketTypeId) ?? new Map();
      let createdCount = 0;

      for (let i = 0; i < qty; i++) {
        let ticket = typeTickets.get(i);
        if (!ticket) {
          const feeForTicket = basePlatformFee + (feeRemainder > 0 ? 1 : 0);
          if (feeRemainder > 0) feeRemainder -= 1;

          const created = await tx.ticket.create({
            data: {
              userId: userId ?? null,
              ownerUserId: userId ?? null,
              ownerIdentityId: ownerIdentityId ?? null,
              eventId: event.id,
              ticketTypeId: line.ticketTypeId,
              status: "ACTIVE",
              purchasedAt: new Date(),
              qrSecret: crypto.randomUUID(),
              pricePaid: pricePerTicketCents,
              currency: tt.currency ?? (breakdown.currency ?? intent.currency ?? "EUR").toUpperCase(),
              platformFeeCents: feeForTicket,
              totalPaidCents: pricePerTicketCents + feeForTicket,
              stripePaymentIntentId: intent.id,
              purchaseId,
              saleSummaryId: saleSummary.id,
              emissionIndex: i,
            },
            select: { id: true, ticketTypeId: true, emissionIndex: true, saleSummaryId: true, purchaseId: true },
          });
          ticket = created;
          typeTickets.set(i, ticket);
          createdCount += 1;
        } else {
          if (ticket.saleSummaryId !== saleSummary.id) {
            await tx.ticket.update({
              where: { id: ticket.id },
              data: { saleSummaryId: saleSummary.id },
            });
          }
          if (!ticket.purchaseId && purchaseId) {
            await tx.ticket.update({
              where: { id: ticket.id },
              data: { purchaseId },
            });
          }
        }

        if (!userId && ownerEmail) {
          await tx.guestTicketLink.upsert({
            where: { ticketId: ticket.id },
            update: {
              guestEmail: ownerEmail,
              guestName: "Convidado",
            },
            create: {
              ticketId: ticket.id,
              guestEmail: ownerEmail,
              guestName: "Convidado",
            },
          });
        }

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
            ownerUserId: entitlementOwnerUserId,
            ownerIdentityId: ownerIdentityId ?? null,
            eventId: event.id,
            policyVersionApplied,
            snapshotTitle: event.title,
            snapshotCoverUrl: event.coverImageUrl,
            snapshotVenueName,
            snapshotStartAt: event.startsAt,
            snapshotTimezone: event.timezone,
            ticketId: ticket.id,
          },
          create: {
            purchaseId,
            saleLineId: saleLine.id,
            lineItemIndex: i,
            ownerKey,
            ownerUserId: entitlementOwnerUserId,
            ownerIdentityId: ownerIdentityId ?? null,
            eventId: event.id,
            type: EntitlementType.EVENT_TICKET,
            status: EntitlementStatus.ACTIVE,
            policyVersionApplied,
            snapshotTitle: event.title,
            snapshotCoverUrl: event.coverImageUrl,
            snapshotVenueName,
            snapshotStartAt: event.startsAt,
            snapshotTimezone: event.timezone,
            ticketId: ticket.id,
          },
        });
      }

      ticketsByType.set(line.ticketTypeId, typeTickets);

      if (createdCount > 0) {
        await tx.ticketType.update({
          where: { id: tt.id },
          data: { soldQuantity: { increment: createdCount } },
        });
      }
    }

    await paymentEventRepo(tx).updateMany({
      where: { stripePaymentIntentId: intent.id },
      data: {
        status: "OK",
        updatedAt: new Date(),
        errorMessage: null,
        purchaseId,
        stripeEventId: stripeEventId ?? undefined,
        source: "WEBHOOK",
        dedupeKey: paymentDedupeKey,
        attempt: { increment: 1 },
        mode: intent.livemode ? "LIVE" : "TEST",
        isTest: !intent.livemode,
      },
    });
  });

  // Enfileirar email de recibo se houver email associado
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
      logError("fulfill_paid.enqueue_receipt_failed", err, { purchaseId });
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
      logError("fulfill_paid.enqueue_notification_failed", err, { purchaseId });
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
      logError("fulfill_paid.enqueue_apply_promo_failed", err, { purchaseId });
    }
  }

  if (event.organizationId && (ownerUserId || ownerIdentityId)) {
    try {
      const ticketCount = breakdown.lines.reduce((sum, line) => sum + (line.quantity ?? 0), 0);
      await ingestCrmInteraction({
        organizationId: event.organizationId,
        userId: ownerUserId ?? undefined,
        emailIdentityId: ownerIdentityId ?? undefined,
        type: CrmInteractionType.EVENT_TICKET,
        sourceType: CrmInteractionSource.TICKET,
        sourceId: purchaseId,
        occurredAt: new Date(),
        amountCents: breakdown.totalCents ?? intent.amount_received ?? intent.amount ?? 0,
        currency: breakdown.currency ?? intent.currency ?? "EUR",
        contactEmail: ownerEmail ?? undefined,
        metadata: {
          eventId: event.id,
          purchaseId,
          ticketCount,
        },
      });
    } catch (err) {
      logError("fulfill_paid.crm_interaction_failed", err, { purchaseId });
    }
  }

  return true;
}
