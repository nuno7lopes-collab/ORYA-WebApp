import { prisma } from "@/lib/prisma";
import {
  EntitlementStatus,
  EntitlementType,
  FeeMode,
  CrmInteractionSource,
  PadelPairingPaymentStatus,
  PadelPairingSlotStatus,
  PadelPaymentMode,
  PadelRegistrationStatus,
  PaymentEventSource,
  Prisma,
  SourceType,
} from "@prisma/client";
import type { PricingSnapshot } from "@/domain/finance/checkout";
import { ensureEntriesForConfirmedPairing } from "@/domain/tournaments/ensureEntriesForConfirmedPairing";
import { paymentEventRepo, saleLineRepo, saleSummaryRepo } from "@/domain/finance/readModelConsumer";
import { resolveRegistrationStatusFromSlots, upsertPadelRegistrationForPairing } from "@/domain/padelRegistration";
import { requireLatestPolicyVersionForEvent } from "@/lib/checkin/accessPolicy";
import { ingestCrmInteraction } from "@/lib/crm/ingest";
import { ensurePadelPlayerProfileId } from "@/domain/padel/playerProfile";
import { formatEventLocationLabel } from "@/lib/location/eventLocation";
import { ensureEmailIdentity, resolveIdentityForUser } from "@/lib/ownership/identity";

type IntentLike = {
  id: string;
  amount: number | null;
  livemode: boolean;
  currency: string;
  metadata: Record<string, any>;
  payment_method?: string | { id?: string } | null;
};

function extractPaymentMethodId(intent: IntentLike) {
  if (!intent.payment_method) return null;
  if (typeof intent.payment_method === "string") return intent.payment_method;
  if (typeof intent.payment_method === "object" && typeof intent.payment_method.id === "string") {
    return intent.payment_method.id;
  }
  return null;
}

function buildOwnerKey(params: { ownerUserId?: string | null; ownerIdentityId?: string | null; email?: string | null }) {
  if (params.ownerIdentityId) return `identity:${params.ownerIdentityId}`;
  if (params.ownerUserId) return `user:${params.ownerUserId}`;
  if (params.email) return `email:${params.email}`;
  return "unknown";
}

function normalizeEmail(value: string | null | undefined) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return email && email.includes("@") ? email : null;
}

export async function fulfillPadelRegistrationIntent(
  intent: IntentLike,
  stripeFeeForIntentValue: number | null,
): Promise<boolean> {
  const meta = intent.metadata ?? {};
  const sourceType = typeof meta.sourceType === "string" ? meta.sourceType : null;
  if (sourceType !== SourceType.PADEL_REGISTRATION && sourceType !== "PADEL_REGISTRATION") return false;

  const purchaseId =
    typeof meta.purchaseId === "string" && meta.purchaseId.trim() !== ""
      ? meta.purchaseId.trim()
      : typeof meta.paymentId === "string" && meta.paymentId.trim() !== ""
        ? meta.paymentId.trim()
        : null;
  if (!purchaseId) return false;

  const payment = await prisma.payment.findUnique({
    where: { id: purchaseId },
    select: {
      id: true,
      sourceId: true,
      sourceType: true,
      pricingSnapshotJson: true,
      feePolicyVersion: true,
      customerIdentityId: true,
    },
  });
  if (!payment || payment.sourceType !== SourceType.PADEL_REGISTRATION) return false;

  const registration = await prisma.padelRegistration.findUnique({
    where: { id: payment.sourceId },
    select: {
      id: true,
      eventId: true,
      pairingId: true,
      buyerIdentityId: true,
      currency: true,
      lines: {
        select: {
          id: true,
          qty: true,
          unitAmount: true,
          totalAmount: true,
          label: true,
          pairingSlotId: true,
        },
      },
      event: {
        select: {
          id: true,
          title: true,
          coverImageUrl: true,
          addressRef: { select: { formattedAddress: true } },
          startsAt: true,
          timezone: true,
          organizationId: true,
          organization: {
            select: {
              feeMode: true,
              platformFeeBps: true,
              platformFeeFixedCents: true,
              orgType: true,
            },
          },
        },
      },
    },
  });
  if (!registration || !registration.event) {
    throw new Error("PADEL_REGISTRATION_NOT_FOUND");
  }

  const pairingId = Number(meta.pairingId || registration.pairingId);
  if (!Number.isFinite(pairingId)) return false;

  const pairing = await prisma.padelPairing.findUnique({
    where: { id: pairingId },
    select: {
      id: true,
      eventId: true,
      categoryId: true,
      organizationId: true,
      payment_mode: true,
      paymentMethodId: true,
      player1UserId: true,
      player2UserId: true,
      pairingStatus: true,
      slots: {
        select: {
          id: true,
          slot_role: true,
          slotStatus: true,
          paymentStatus: true,
          profileId: true,
          invitedUserId: true,
          invitedContact: true,
        },
      },
    },
  });
  if (!pairing) return false;

  const snapshot = (payment.pricingSnapshotJson ?? null) as PricingSnapshot | null;
  const snapshotLines = snapshot?.lineItems ?? [];
  const sourceLineIds = snapshotLines
    .map((line) => (line.sourceLineId ? Number(line.sourceLineId) : NaN))
    .filter((id) => Number.isFinite(id));

  const registrationLines = sourceLineIds.length
    ? await prisma.padelRegistrationLine.findMany({
        where: { id: { in: sourceLineIds } },
      })
    : registration.lines;

  const lineMap = new Map(registrationLines.map((line) => [line.id, line]));

  const paymentMethodId = extractPaymentMethodId(intent);
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

  const now = new Date();
  const paymentDedupeKey =
    (typeof meta.idempotencyKey === "string" && meta.idempotencyKey.trim()) || purchaseId || intent.id;

  await prisma.$transaction(async (tx) => {
    const updatedSlots = new Map<number, { slotStatus: PadelPairingSlotStatus; paymentStatus: PadelPairingPaymentStatus }>();

    for (const line of registrationLines) {
      if (!line.pairingSlotId) continue;
      const slot = pairing.slots.find((s) => s.id === line.pairingSlotId);
      if (!slot) continue;

      const shouldSetPartner =
        slot.slot_role === "PARTNER" &&
        ownerUserId &&
        pairing.player1UserId !== ownerUserId &&
        (!pairing.player2UserId || pairing.player2UserId === ownerUserId);
      const shouldFillSlot = slot.slot_role === "PARTNER" ? shouldSetPartner : Boolean(ownerUserId);
      const nextSlotStatus =
        slot.slotStatus === PadelPairingSlotStatus.FILLED
          ? PadelPairingSlotStatus.FILLED
          : shouldFillSlot
            ? PadelPairingSlotStatus.FILLED
            : slot.slotStatus;

      const playerProfileId =
        shouldFillSlot && ownerUserId
          ? await ensurePadelPlayerProfileId(tx, { organizationId: pairing.organizationId, userId: ownerUserId })
          : null;

      await tx.padelPairingSlot.update({
        where: { id: slot.id },
        data: {
          paymentStatus: PadelPairingPaymentStatus.PAID,
          slotStatus: nextSlotStatus,
          ...(shouldFillSlot ? { profileId: ownerUserId ?? undefined } : {}),
          ...(playerProfileId ? { playerProfileId } : {}),
        },
      });

      updatedSlots.set(slot.id, {
        slotStatus: nextSlotStatus,
        paymentStatus: PadelPairingPaymentStatus.PAID,
      });

      if (slot.slot_role === "CAPTAIN" && paymentMethodId && !pairing.paymentMethodId) {
        await tx.padelPairing.update({
          where: { id: pairingId },
          data: { paymentMethodId },
        });
      }

      if (shouldSetPartner) {
        await tx.padelPairing.update({
          where: { id: pairingId },
          data: {
            player2UserId: ownerUserId,
            partnerInviteToken: null,
            partnerLinkToken: null,
            partnerLinkExpiresAt: null,
            partnerInviteUsedAt: now,
            partnerAcceptedAt: now,
            partnerPaidAt: now,
          },
        });
      }
    }

    const updated = await tx.padelPairing.findUnique({
      where: { id: pairingId },
      select: {
        id: true,
        eventId: true,
        organizationId: true,
        payment_mode: true,
        pairingJoinMode: true,
        pairingStatus: true,
        slots: {
          select: {
            id: true,
            slotStatus: true,
            paymentStatus: true,
          },
        },
      },
    });
    if (!updated) throw new Error("PAIRING_NOT_FOUND");

    const allPaid = updated.slots.length > 0 && updated.slots.every((slot) => slot.paymentStatus === PadelPairingPaymentStatus.PAID);
    const nextRegistrationStatus = resolveRegistrationStatusFromSlots({
      pairingJoinMode: updated.pairingJoinMode,
      slots: updated.slots,
    });

    await upsertPadelRegistrationForPairing(tx, {
      pairingId,
      organizationId: updated.organizationId,
      eventId: updated.eventId,
      status: nextRegistrationStatus,
      paymentMode: updated.payment_mode,
      isFullyPaid: allPaid,
      reason: "PAYMENT_WEBHOOK",
    });

    const stillPending = updated.slots.some(
      (slot) =>
        slot.slotStatus === PadelPairingSlotStatus.PENDING ||
        slot.paymentStatus === PadelPairingPaymentStatus.UNPAID,
    );
    if (!stillPending && updated.pairingStatus !== "COMPLETE") {
      await tx.padelPairing.update({
        where: { id: pairingId },
        data: { pairingStatus: "COMPLETE" },
      });
      await ensureEntriesForConfirmedPairing(pairingId);
    } else if (updated.pairingStatus !== "INCOMPLETE" && stillPending) {
      await tx.padelPairing.update({
        where: { id: pairingId },
        data: { pairingStatus: "INCOMPLETE" },
      });
    }

    await tx.padelPairingHold.updateMany({
      where: { pairingId, status: "ACTIVE" },
      data: { status: "CANCELLED" },
    });

    const subtotalCents = snapshotLines.reduce((sum, line) => sum + (line.totalAmountCents ?? 0), 0);
    const platformFeeCents = snapshot?.platformFee ?? 0;
    const totalCents = snapshot?.total ?? subtotalCents;
    const stripeFeeCents = stripeFeeForIntentValue ?? null;
    const stripeFeeForNet = stripeFeeCents ?? 0;
    const netCents = Math.max(0, totalCents - platformFeeCents - stripeFeeForNet);

    const saleSummary = await saleSummaryRepo(tx).upsert({
      where: { purchaseId },
      update: {
        eventId: registration.eventId,
        userId: ownerUserId ?? undefined,
        ownerUserId: ownerUserId ?? null,
        ownerIdentityId: ownerIdentityId ?? null,
        purchaseId,
        subtotalCents,
        discountCents: 0,
        platformFeeCents,
        stripeFeeCents,
        totalCents,
        netCents,
        feeMode: snapshot?.feeMode ?? (FeeMode.INCLUDED as any),
        currency: snapshot?.currency ?? registration.currency ?? "EUR",
        status: "PAID",
      },
      create: {
        eventId: registration.eventId,
        userId: ownerUserId ?? undefined,
        ownerUserId: ownerUserId ?? null,
        ownerIdentityId: ownerIdentityId ?? null,
        purchaseId,
        subtotalCents,
        discountCents: 0,
        platformFeeCents,
        stripeFeeCents,
        totalCents,
        netCents,
        feeMode: snapshot?.feeMode ?? (FeeMode.INCLUDED as any),
        currency: snapshot?.currency ?? registration.currency ?? "EUR",
        status: "PAID",
      },
    });

    await saleLineRepo(tx).deleteMany({ where: { saleSummaryId: saleSummary.id } });

    const policyVersionApplied = await requireLatestPolicyVersionForEvent(registration.eventId, tx);
    const snapshotVenueName = formatEventLocationLabel(
      { addressRef: registration.event.addressRef ?? null },
      "Local a anunciar",
    );

    for (const line of registrationLines) {
      const snapshotLine = snapshotLines.find((l) => Number(l.sourceLineId) === line.id);
      const grossCents = snapshotLine?.totalAmountCents ?? line.totalAmount;
      const feeShare =
        subtotalCents > 0 ? Math.round((platformFeeCents * grossCents) / subtotalCents) : 0;
      const netLineCents = Math.max(0, grossCents - feeShare);

      const saleLine = await saleLineRepo(tx).create({
        data: {
          saleSummaryId: saleSummary.id,
          eventId: registration.eventId,
          padelRegistrationLineId: line.id,
          promoCodeId: null,
          quantity: line.qty,
          unitPriceCents: line.unitAmount,
          discountPerUnitCents: 0,
          grossCents,
          netCents: netLineCents,
          platformFeeCents: feeShare,
        },
      });

      const slot = line.pairingSlotId
        ? pairing.slots.find((s) => s.id === line.pairingSlotId)
        : null;
      const rawEntitlementOwnerUserId =
        slot?.profileId ?? slot?.invitedUserId ?? ownerUserId ?? null;
      const entitlementEmail =
        normalizeEmail(slot?.invitedContact ?? null) ?? ownerEmail ?? null;
      const resolvedIdentityId =
        ownerIdentityId ?? payment.customerIdentityId ?? registration.buyerIdentityId ?? null;
      const entitlementOwnerUserId = resolvedIdentityId ? null : rawEntitlementOwnerUserId;
      const ownerKey = buildOwnerKey({
        ownerUserId: entitlementOwnerUserId,
        ownerIdentityId: resolvedIdentityId,
        email: entitlementEmail,
      });

      for (let i = 0; i < line.qty; i += 1) {
        await tx.entitlement.upsert({
          where: {
            purchaseId_saleLineId_lineItemIndex_ownerKey_type: {
              purchaseId,
              saleLineId: saleLine.id,
              lineItemIndex: i,
              ownerKey,
              type: EntitlementType.PADEL_ENTRY,
            },
          },
          update: {
            status: EntitlementStatus.ACTIVE,
            ownerUserId: entitlementOwnerUserId ?? null,
            ownerIdentityId: resolvedIdentityId,
            eventId: registration.eventId,
            policyVersionApplied,
            snapshotTitle: registration.event.title ?? "",
            snapshotCoverUrl: registration.event.coverImageUrl,
            snapshotVenueName,
            snapshotStartAt: registration.event.startsAt,
            snapshotTimezone: registration.event.timezone,
          },
          create: {
            purchaseId,
            saleLineId: saleLine.id,
            lineItemIndex: i,
            ownerKey,
            ownerUserId: entitlementOwnerUserId ?? null,
            ownerIdentityId: resolvedIdentityId,
            eventId: registration.eventId,
            type: EntitlementType.PADEL_ENTRY,
            status: EntitlementStatus.ACTIVE,
            policyVersionApplied,
            snapshotTitle: registration.event.title ?? "",
            snapshotCoverUrl: registration.event.coverImageUrl,
            snapshotVenueName,
            snapshotStartAt: registration.event.startsAt,
            snapshotTimezone: registration.event.timezone,
          },
        });
      }
    }

    await paymentEventRepo(tx).upsert({
      where: { purchaseId },
      update: {
        status: "OK",
        amountCents: intent.amount,
        eventId: registration.eventId,
        userId: ownerUserId ?? undefined,
        updatedAt: now,
        errorMessage: null,
        mode: intent.livemode ? "LIVE" : "TEST",
        isTest: !intent.livemode,
        stripeFeeCents: stripeFeeForIntentValue ?? null,
        purchaseId,
        source: PaymentEventSource.WEBHOOK,
        dedupeKey: paymentDedupeKey,
        attempt: { increment: 1 },
      },
      create: {
        stripePaymentIntentId: intent.id,
        status: "OK",
        amountCents: intent.amount,
        eventId: registration.eventId,
        userId: ownerUserId ?? undefined,
        mode: intent.livemode ? "LIVE" : "TEST",
        isTest: !intent.livemode,
        purchaseId,
        source: PaymentEventSource.WEBHOOK,
        dedupeKey: paymentDedupeKey,
        attempt: 1,
        stripeFeeCents: stripeFeeForIntentValue ?? null,
      },
    });
  });

  if (ownerUserId || ownerIdentityId) {
    const crmOrganizationId = registration.event.organizationId ?? pairing.organizationId;
    try {
      if (crmOrganizationId) {
        await ingestCrmInteraction({
          organizationId: crmOrganizationId,
          userId: ownerUserId ?? undefined,
          emailIdentityId: ownerIdentityId ?? undefined,
          type: "PADEL_MATCH_PAYMENT",
          sourceType: CrmInteractionSource.EVENT,
          sourceId: purchaseId,
          occurredAt: new Date(),
          amountCents: intent.amount ?? 0,
          currency: (snapshot?.currency ?? registration.currency ?? "EUR").toUpperCase(),
          contactEmail: ownerEmail ?? undefined,
          metadata: {
            eventId: registration.eventId,
            pairingId: pairing.id,
            registrationId: registration.id,
            categoryId: pairing.categoryId ?? null,
          },
        });
      }
    } catch {}
  }

  return true;
}
